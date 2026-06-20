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

    // 2. Extract query parameter
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
        return new NextResponse(
            JSON.stringify([]),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        // 3. Query Parts from database matching name or description
        const parts = await prisma.part.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { description: { contains: query, mode: "insensitive" } }
                ]
            },
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
            },
            take: 50 // Limit to top 50 results
        });

        // 4. Format search results
        const results = parts.map(part => {
            const locationName = part.storageLocation.parent
                ? `${part.storageLocation.parent.name} / ${part.storageLocation.name}`
                : part.storageLocation.name;
            
            const locationColor = part.storageLocation.color || part.storageLocation.parent?.color || "#4b5563";

            return {
                id: part.id,
                name: part.name,
                description: part.description,
                upc: part.upc,
                category: part.category.name,
                location: locationName,
                locationColor: locationColor,
                stock: part.stockLevels[0]?.quantity ?? 0
            };
        });

        return new NextResponse(
            JSON.stringify(results),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error searching parts:", error);
        return new NextResponse(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
