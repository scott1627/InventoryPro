import { prisma } from "../../../../../lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const part = await prisma.part.findUnique({
            where: { id: params.id },
            select: { datasheetContent: true, datasheetType: true }
        });

        if (!part || !part.datasheetContent) {
            return new Response("Not Found", { status: 404 });
        }

        return new Response(part.datasheetContent, {
            headers: {
                "Content-Type": part.datasheetType || "application/pdf",
                "Cache-Control": "public, max-age=31536000, immutable"
            }
        });
    } catch (error: any) {
        console.error("Datasheet API Error:", error);
        return new Response(error.message, { status: 500 });
    }
}
