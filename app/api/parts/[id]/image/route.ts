import { prisma } from "../../../../../lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const part = await prisma.part.findUnique({
            where: { id: params.id },
            select: { imageContent: true, imageType: true }
        });

        if (!part || !part.imageContent) {
            return new Response("Not Found", { status: 404 });
        }

        return new Response(part.imageContent, {
            headers: {
                "Content-Type": part.imageType || "image/jpeg",
                "Cache-Control": "public, max-age=31536000, immutable"
            }
        });
    } catch (error: any) {
        console.error("Image API Error:", error);
        return new Response(error.message, { status: 500 });
    }
}
