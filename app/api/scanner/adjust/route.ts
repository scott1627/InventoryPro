import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { authenticateScannerRequest } from "../../../../lib/scanner-auth";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
    // 1. Authenticate Request
    const user = await authenticateScannerRequest(request);
    if (!user) {
        return new NextResponse(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    // 2. Parse Request Body
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return new NextResponse(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const { partId, amount } = body;

    if (!partId || amount === undefined || typeof amount !== "number") {
        return new NextResponse(
            JSON.stringify({ error: "partId (string) and amount (number) are required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        // 3. Retrieve Part & current stock
        const part = await prisma.part.findUnique({
            where: { id: partId },
            include: {
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

        const currentStock = part.stockLevels[0]?.quantity ?? 0;
        const newStock = currentStock + amount;

        if (newStock < 0) {
            return new NextResponse(
                JSON.stringify({ error: "Stock level cannot be negative" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // 4. Create new StockLevel record
        await prisma.stockLevel.create({
            data: {
                partId,
                quantity: newStock
            }
        });

        // 5. Create Activity Log entry
        const changeType = amount > 0 ? "STOCK_ADD" : "STOCK_DEDUCT";
        const direction = amount > 0 ? "Added to" : "Deducted from";
        const absAmount = Math.abs(amount);

        await prisma.activityLog.create({
            data: {
                type: changeType,
                description: `${direction} ${absAmount} unit(s) of ${part.name} via Zebra scanner.`,
                partId,
                userId: user.id
            }
        });

        // 6. Revalidate cache for web app users
        revalidatePath("/parts");
        revalidatePath("/");
        revalidatePath("/categories");
        revalidatePath("/locations");

        return new NextResponse(
            JSON.stringify({
                success: true,
                partId,
                partName: part.name,
                previousStock: currentStock,
                newStock: newStock
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error adjusting stock:", error);
        return new NextResponse(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
