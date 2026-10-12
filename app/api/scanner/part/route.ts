import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { authenticateScannerRequest } from "../../../../lib/scanner-auth";

export async function GET(request: NextRequest) {
    // 1. Authenticate Request
    const user = await authenticateScannerRequest(request);
    if (!user) {
        return new NextResponse(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    // 2. Extract UPC/ID param
    const { searchParams } = new URL(request.url);
    const upc = searchParams.get("upc");
    const id = searchParams.get("id");

    if (!upc && !id) {
        return new NextResponse(
            JSON.stringify({ error: "UPC or ID query parameter is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        // 3. Query Part from database
        const part = await prisma.part.findFirst({
            where: upc ? { upc } : { id: id! },
            include: {
                category: {
                    select: { name: true }
                },
                storageLocation: {
                    select: {
                        name: true,
                        color: true,
                        parent: {
                            select: { name: true, color: true }
                        }
                    }
                },
                stockLevels: {
                    orderBy: { id: "desc" },
                    take: 1
                }
            }
        });

        if (!part) {
            return new NextResponse(
                JSON.stringify({ error: "Part not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        const locationName = part.storageLocation.parent
            ? `${part.storageLocation.parent.name} / ${part.storageLocation.name}`
            : part.storageLocation.name;
        
        const locationColor = part.storageLocation.color || part.storageLocation.parent?.color || "#4b5563";

        // Query sibling parts sharing the same bin / storage location
        const siblingParts = await prisma.part.findMany({
            where: {
                storageLocationId: part.storageLocationId
            },
            include: {
                category: { select: { name: true } },
                stockLevels: { orderBy: { id: "desc" }, take: 1 }
            }
        });

        const binParts = siblingParts.map(sp => ({
            id: sp.id,
            name: sp.name,
            description: sp.description,
            upc: sp.upc,
            category: sp.category.name,
            stock: sp.stockLevels[0]?.quantity ?? 0,
            imageUrl: sp.imageUrl
        }));

        return new NextResponse(
            JSON.stringify({
                id: part.id,
                name: part.name,
                description: part.description,
                upc: part.upc,
                category: part.category.name,
                location: locationName,
                locationColor: locationColor,
                stock: part.stockLevels[0]?.quantity ?? 0,
                imageUrl: part.imageUrl,
                binParts: binParts
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error looking up part:", error);
        return new NextResponse(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
