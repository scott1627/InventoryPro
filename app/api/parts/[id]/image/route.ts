import { prisma } from "../../../../../lib/prisma";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const part = await prisma.part.findUnique({
            where: { id: params.id },
            select: { imageType: true }
        });

        if (!part) {
            return new Response("Part Not Found", { status: 404 });
        }

        const filePath = path.join(process.cwd(), "public", "uploads", "images", params.id);

        try {
            const buffer = await fs.readFile(filePath);
            return new Response(buffer, {
                headers: {
                    "Content-Type": part.imageType || "image/jpeg",
                    "Cache-Control": "public, max-age=31536000, immutable"
                }
            });
        } catch (e) {
            return new Response("Image File Not Found", { status: 404 });
        }
    } catch (error: any) {
        console.error("Image API Error:", error);
        return new Response(error.message, { status: 500 });
    }
}
