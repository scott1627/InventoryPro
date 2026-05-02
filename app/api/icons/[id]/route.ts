import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const icon = await prisma.icon.findUnique({
            where: { id: params.id },
        });

        if (!icon) {
            return new NextResponse("Not found", { status: 404 });
        }

        const headers = new Headers();
        headers.set("Content-Type", icon.type);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");

        return new NextResponse(icon.content as any, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error("Error fetching icon:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
