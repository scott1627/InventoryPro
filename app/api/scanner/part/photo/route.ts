import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { authenticateScannerRequest } from "../../../../../lib/scanner-auth";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
    // 1. Authenticate Request using HTTP Basic Auth
    const user = await authenticateScannerRequest(request);
    if (!user) {
        return new NextResponse(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        // 2. Parse Multipart FormData
        const formData = await request.formData();
        const partId = (formData.get("partId") as string) || (formData.get("id") as string);
        const upc = formData.get("upc") as string;
        const imageFile = formData.get("image") as File | null;

        if (!partId && !upc) {
            return new NextResponse(
                JSON.stringify({ error: "partId or upc is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        if (!imageFile || imageFile.size === 0) {
            return new NextResponse(
                JSON.stringify({ error: "No image file provided" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // 3. Find the target part
        const part = await prisma.part.findFirst({
            where: partId ? { id: partId } : { upc }
        });

        if (!part) {
            return new NextResponse(
                JSON.stringify({ error: "Part not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        // 4. Save image to disk in public/uploads/images/[part.id]
        const uploadDir = path.join(process.cwd(), "public", "uploads", "images");
        await fs.mkdir(uploadDir, { recursive: true });

        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const targetFilePath = path.join(uploadDir, part.id);
        await fs.writeFile(targetFilePath, buffer);

        // 5. Update part record with new image URL and MIME type
        const version = Date.now();
        const imageType = imageFile.type || "image/jpeg";
        const imageUrl = `/api/parts/${part.id}/image?v=${version}`;

        const updatedPart = await prisma.part.update({
            where: { id: part.id },
            data: {
                imageType,
                imageUrl
            }
        });

        // 6. Record activity log
        await prisma.activityLog.create({
            data: {
                type: "PART_UPDATE",
                description: `Updated photo for ${part.name} via Zebra scanner.`,
                partId: part.id,
                userId: user.id
            }
        });

        // 7. Invalidate caches for web clients
        revalidatePath("/parts");
        revalidatePath("/");
        revalidatePath("/categories");
        revalidatePath("/locations");

        return new NextResponse(
            JSON.stringify({
                success: true,
                partId: part.id,
                imageUrl: updatedPart.imageUrl,
                message: "Photo updated successfully"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error: any) {
        console.error("Error updating part photo via scanner API:", error);
        return new NextResponse(
            JSON.stringify({ error: error.message || "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
