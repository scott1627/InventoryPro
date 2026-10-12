import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { authenticateScannerRequest } from "../../../../lib/scanner-auth";

export async function GET(request: NextRequest) {
    const user = await authenticateScannerRequest(request);
    if (!user) {
        return new NextResponse(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    const { searchParams } = new URL(request.url);
    const locationQuery = searchParams.get("location") || searchParams.get("name") || searchParams.get("q");
    const locationId = searchParams.get("id");

    if (!locationQuery && !locationId) {
        return new NextResponse(
            JSON.stringify({ error: "Location name or ID is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        let storageLocation = null;
        if (locationId) {
            storageLocation = await prisma.storageLocation.findUnique({
                where: { id: locationId },
                include: {
                    parent: true,
                    parts: {
                        include: {
                            category: { select: { name: true } },
                            stockLevels: { orderBy: { id: "desc" }, take: 1 }
                        }
                    }
                }
            });
        } else if (locationQuery) {
            const trimmed = locationQuery.trim();
            const cleanQuery = trimmed.replace(/^(bin[:\s\-]+)/i, "").trim();
            const partsSplit = cleanQuery.split("/").map(s => s.trim());
            const leafName = partsSplit[partsSplit.length - 1];

            // Priority 1: Hierarchical match if path has parent/child (e.g. "Gold Bins / C5")
            if (partsSplit.length > 1) {
                const parentName = partsSplit[partsSplit.length - 2];
                storageLocation = await prisma.storageLocation.findFirst({
                    where: {
                        name: { equals: leafName, mode: "insensitive" },
                        parent: {
                            name: { equals: parentName, mode: "insensitive" }
                        }
                    },
                    include: {
                        parent: true,
                        parts: {
                            include: {
                                category: { select: { name: true } },
                                stockLevels: { orderBy: { id: "desc" }, take: 1 }
                            }
                        }
                    }
                });

                // Fallback to contains on parent name (e.g. "Gold" matching "Gold Bins")
                if (!storageLocation) {
                    storageLocation = await prisma.storageLocation.findFirst({
                        where: {
                            name: { equals: leafName, mode: "insensitive" },
                            parent: {
                                name: { contains: parentName, mode: "insensitive" }
                            }
                        },
                        include: {
                            parent: true,
                            parts: {
                                include: {
                                    category: { select: { name: true } },
                                    stockLevels: { orderBy: { id: "desc" }, take: 1 }
                                }
                            }
                        }
                    });
                }
            }

            // Priority 2: Exact full name match on single location
            if (!storageLocation) {
                storageLocation = await prisma.storageLocation.findFirst({
                    where: {
                        OR: [
                            { name: { equals: cleanQuery, mode: "insensitive" } },
                            { name: { equals: trimmed, mode: "insensitive" } }
                        ]
                    },
                    include: {
                        parent: true,
                        parts: {
                            include: {
                                category: { select: { name: true } },
                                stockLevels: { orderBy: { id: "desc" }, take: 1 }
                            }
                        }
                    }
                });
            }

            // Priority 3: Exact leaf name match (e.g. "C5"), but PREFER a bin that actually contains parts!
            if (!storageLocation) {
                const candidates = await prisma.storageLocation.findMany({
                    where: {
                        name: { equals: leafName, mode: "insensitive" }
                    },
                    include: {
                        parent: true,
                        parts: {
                            include: {
                                category: { select: { name: true } },
                                stockLevels: { orderBy: { id: "desc" }, take: 1 }
                            }
                        }
                    }
                });

                if (candidates.length > 0) {
                    // If multiple bins have the same name (e.g. C5 under Grey Bins and C5 under Gold Bins),
                    // pick the one that has parts assigned!
                    const withParts = candidates.find(c => c.parts.length > 0);
                    storageLocation = withParts || candidates[0];
                }
            }

            // Priority 4: Partial / contains leaf name match
            if (!storageLocation) {
                const candidates = await prisma.storageLocation.findMany({
                    where: {
                        name: { contains: leafName, mode: "insensitive" }
                    },
                    include: {
                        parent: true,
                        parts: {
                            include: {
                                category: { select: { name: true } },
                                stockLevels: { orderBy: { id: "desc" }, take: 1 }
                            }
                        }
                    }
                });

                if (candidates.length > 0) {
                    const withParts = candidates.find(c => c.parts.length > 0);
                    storageLocation = withParts || candidates[0];
                }
            }
        }

        if (!storageLocation) {
            return new NextResponse(
                JSON.stringify({ error: "Storage location not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        const fullName = storageLocation.parent
            ? `${storageLocation.parent.name} / ${storageLocation.name}`
            : storageLocation.name;

        const parts = storageLocation.parts.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            upc: p.upc,
            category: p.category.name,
            location: fullName,
            locationColor: storageLocation.color || storageLocation.parent?.color || "#4b5563",
            stock: p.stockLevels[0]?.quantity ?? 0,
            imageUrl: p.imageUrl
        }));

        return new NextResponse(
            JSON.stringify({
                id: storageLocation.id,
                location: fullName,
                locationColor: storageLocation.color || storageLocation.parent?.color || "#4b5563",
                parts: parts
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error looking up bin:", error);
        return new NextResponse(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
