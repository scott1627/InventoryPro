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

    // 2. Extract UPC param
    const { searchParams } = new URL(request.url);
    const upc = searchParams.get("upc");

    if (!upc) {
        return new NextResponse(
            JSON.stringify({ error: "UPC query parameter is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        // 3. Query Part from database
        const part = await prisma.part.findUnique({
            where: { upc },
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

        return new NextResponse(
            JSON.stringify({
                id: part.id,
                name: part.name,
                description: part.description,
                upc: part.upc,
                category: part.category.name,
                location: locationName,
                locationColor: locationColor,
                stock: part.stockLevels[0]?.quantity ?? 0
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
