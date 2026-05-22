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
            select: { imageType: true, imageUrl: true }
        });

        if (!part) {
            return new Response("Part Not Found", { status: 404 });
        }

        const dirPath = path.join(process.cwd(), "public", "uploads", "images");
        let filePath = path.join(dirPath, params.id);
        let fileBuffer: Buffer | null = null;

        // 1. Try reading the standard file path (named exactly as part.id)
        try {
            fileBuffer = await fs.readFile(filePath);
        } catch (e) {
            // 2. Try matching any file starting with part.id (e.g. part.id.png, part.id.jpg)
            try {
                const files = await fs.readdir(dirPath).catch(() => []);
                const matchedFile = files.find(f => f.startsWith(params.id));
                if (matchedFile) {
                    filePath = path.join(dirPath, matchedFile);
                    fileBuffer = await fs.readFile(filePath);
                }
            } catch (err) {}
        }

        // 3. Try legacy URL resolution from database
        if (!fileBuffer && part.imageUrl) {
            try {
                const filename = path.basename(part.imageUrl.split("?")[0]);
                if (filename && filename !== params.id) {
                    const legacyPath = path.join(dirPath, filename);
                    fileBuffer = await fs.readFile(legacyPath);
                }
            } catch (err) {}
        }

        // 4. Try matching using version timestamp prefix (e.g. TIMESTAMP-filename.jpg)
        if (!fileBuffer) {
            try {
                const url = new URL(request.url);
                const v = url.searchParams.get("v");
                if (v && /^\d+$/.test(v)) {
                    const files = await fs.readdir(dirPath).catch(() => []);
                    const matchedFile = files.find(f => f.startsWith(v));
                    if (matchedFile) {
                        filePath = path.join(dirPath, matchedFile);
                        fileBuffer = await fs.readFile(filePath);
                    }
                }
            } catch (err) {}
        }

        if (!fileBuffer) {
            return new Response("Image File Not Found", { status: 404 });
        }

        return new Response(fileBuffer as any, {
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
