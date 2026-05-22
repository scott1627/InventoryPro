import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

async function main() {
    console.log("Starting blob-to-filesystem migration...");
    
    // Query database directly to bypass modern Prisma schema type checking
    let parts: any[] = [];
    try {
        parts = await prisma.$queryRaw<any[]>`
            SELECT "id", "name", "imageContent", "imageType", "datasheetContent", "datasheetType"
            FROM "Part"
        `;
    } catch (error: any) {
        console.log("No legacy BLOB columns found in Part table. Migration is already complete!");
        return;
    }

    console.log(`Found ${parts.length} parts to inspect.`);
    
    const imagesDir = path.join(process.cwd(), "public", "uploads", "images");
    const datasheetsDir = path.join(process.cwd(), "public", "uploads", "datasheets");
    
    await fs.mkdir(imagesDir, { recursive: true });
    await fs.mkdir(datasheetsDir, { recursive: true });

    let migratedImages = 0;
    let migratedDatasheets = 0;

    for (const part of parts) {
        let updated = false;
        const updateData: any = {};

        if (part.imageContent && part.imageContent.length > 0) {
            const filePath = path.join(imagesDir, part.id);
            await fs.writeFile(filePath, part.imageContent);
            
            const version = Date.now();
            updateData.imageUrl = `/api/parts/${part.id}/image?v=${version}`;
            migratedImages++;
            updated = true;
            console.log(`Migrated image for part: ${part.name} (${part.id})`);
        }

        if (part.datasheetContent && part.datasheetContent.length > 0) {
            const filePath = path.join(datasheetsDir, part.id);
            await fs.writeFile(filePath, part.datasheetContent);
            
            const version = Date.now();
            updateData.datasheetUrl = `/api/parts/${part.id}/datasheet?v=${version}`;
            migratedDatasheets++;
            updated = true;
            console.log(`Migrated datasheet for part: ${part.name} (${part.id})`);
        }

        if (updated) {
            await prisma.part.update({
                where: { id: part.id },
                data: updateData,
            });
        }
    }

    console.log("Migration completed successfully!");
    console.log(`Migrated ${migratedImages} images and ${migratedDatasheets} datasheets.`);

    // Clean up database schema raw so it aligns exactly with current schema.prisma (dropping bytea columns)
    console.log("Cleaning up legacy database columns...");
    await prisma.$executeRawUnsafe('ALTER TABLE "Part" DROP COLUMN IF EXISTS "imageContent"');
    await prisma.$executeRawUnsafe('ALTER TABLE "Part" DROP COLUMN IF EXISTS "datasheetContent"');
    console.log("Database columns cleaned successfully.");
}

main()
    .catch((e) => {
        console.error("Migration error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
