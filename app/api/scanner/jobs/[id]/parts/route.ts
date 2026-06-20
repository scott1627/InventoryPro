import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { authenticateScannerRequest } from "../../../../../../lib/scanner-auth";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // 1. Authenticate Request
    const user = await authenticateScannerRequest(request);
    if (!user) {
        return new NextResponse(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    const jobId = params.id;

    try {
        // 2. Query Job with its BOMs and current pulls
        const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: {
                boms: {
                    include: {
                        bom: {
                            include: {
                                items: {
                                    include: {
                                        part: {
                                            include: {
                                                category: { select: { name: true } },
                                                storageLocation: {
                                                    include: { parent: true }
                                                },
                                                stockLevels: {
                                                    orderBy: { id: "desc" },
                                                    take: 1
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                pulls: true
            }
        });

        if (!job) {
            return new NextResponse(
                JSON.stringify({ error: "Job not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        // 3. Aggregate part requirements
        const partsMap = new Map<string, {
            part: any;
            totalRequired: number;
        }>();

        for (const jobBom of job.boms) {
            const bomQty = jobBom.quantity;
            if (!jobBom.bom) continue;

            for (const item of jobBom.bom.items) {
                if (!item.part) continue; // Skip deleted parts
                
                const partId = item.part.id;
                const quantityNeeded = item.quantity * bomQty;

                const existing = partsMap.get(partId);
                if (existing) {
                    existing.totalRequired += quantityNeeded;
                } else {
                    partsMap.set(partId, {
                        part: item.part,
                        totalRequired: quantityNeeded
                    });
                }
            }
        }

        // 4. Create a map of pulled quantities from database pulls
        const pullsMap = new Map<string, number>(
            job.pulls.map(p => [p.partId, p.quantity])
        );

        // 5. Compile flat checklist response
        const partsList = Array.from(partsMap.values()).map(({ part, totalRequired }) => {
            const locationName = part.storageLocation.parent
                ? `${part.storageLocation.parent.name} / ${part.storageLocation.name}`
                : part.storageLocation.name;
            
            const locationColor = part.storageLocation.color || part.storageLocation.parent?.color || "#4b5563";

            return {
                partId: part.id,
                name: part.name,
                description: part.description,
                upc: part.upc,
                category: part.category.name,
                location: locationName,
                locationColor: locationColor,
                stock: part.stockLevels[0]?.quantity ?? 0,
                totalRequired,
                totalPulled: pullsMap.get(part.id) ?? 0
            };
        });

        // Sort parts by location name then part name
        partsList.sort((a, b) => {
            const locCompare = a.location.localeCompare(b.location);
            if (locCompare !== 0) return locCompare;
            return a.name.localeCompare(b.name);
        });

        return new NextResponse(
            JSON.stringify({
                jobId: job.id,
                jobName: job.name,
                jobStatus: job.status,
                parts: partsList
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error aggregating job parts:", error);
        return new NextResponse(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
