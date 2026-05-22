"use server";

import { exec } from "child_process";
import { promisify } from "util";
import { getServerAuthSession } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const execAsync = promisify(exec);

/**
 * Helper function to run the BLOB to filesystem migration.
 * Called automatically after restoring a legacy SQL database backup that contains BLOBs.
 */
async function autoMigrateRestoredBlobs() {
    console.log("Post-Restore Auto-Migration: Checking for legacy BLOB data...");
    const imagesDir = path.join(process.cwd(), "public", "uploads", "images");
    const datasheetsDir = path.join(process.cwd(), "public", "uploads", "datasheets");

    await fs.mkdir(imagesDir, { recursive: true });
    await fs.mkdir(datasheetsDir, { recursive: true });

    try {
        // Query database directly to bypass modern Prisma schema which doesn't have BLOB fields
        const parts = await prisma.$queryRaw<any[]>`
            SELECT "id", "name", "imageContent", "imageType", "datasheetContent", "datasheetType"
            FROM "Part"
        `;

        console.log(`Post-Restore Auto-Migration: Found ${parts.length} parts to inspect.`);
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
            }

            if (part.datasheetContent && part.datasheetContent.length > 0) {
                const filePath = path.join(datasheetsDir, part.id);
                await fs.writeFile(filePath, part.datasheetContent);
                const version = Date.now();
                updateData.datasheetUrl = `/api/parts/${part.id}/datasheet?v=${version}`;
                migratedDatasheets++;
                updated = true;
            }

            if (updated) {
                if (updateData.imageUrl !== undefined && updateData.datasheetUrl !== undefined) {
                    await prisma.$executeRaw`
                        UPDATE "Part"
                        SET "imageUrl" = ${updateData.imageUrl},
                            "datasheetUrl" = ${updateData.datasheetUrl}
                        WHERE "id" = ${part.id}
                    `;
                } else if (updateData.imageUrl !== undefined) {
                    await prisma.$executeRaw`
                        UPDATE "Part"
                        SET "imageUrl" = ${updateData.imageUrl}
                        WHERE "id" = ${part.id}
                    `;
                } else if (updateData.datasheetUrl !== undefined) {
                    await prisma.$executeRaw`
                        UPDATE "Part"
                        SET "datasheetUrl" = ${updateData.datasheetUrl}
                        WHERE "id" = ${part.id}
                    `;
                }
            }
        }

        console.log(`Post-Restore Auto-Migration Success: Migrated ${migratedImages} images and ${migratedDatasheets} datasheets.`);

        // Clean up database schema raw so it aligns exactly with current schema.prisma (dropping bytea columns)
        console.log("Post-Restore Auto-Migration: Cleaning up database schema...");
        await prisma.$executeRawUnsafe('ALTER TABLE "Part" DROP COLUMN IF EXISTS "imageContent"');
        await prisma.$executeRawUnsafe('ALTER TABLE "Part" DROP COLUMN IF EXISTS "datasheetContent"');
        console.log("Post-Restore Auto-Migration: Schema cleaned successfully.");

    } catch (error: any) {
        console.log("Post-Restore Auto-Migration: No legacy BLOB columns found in Part table or migration skipped.", error.message);
    }
}

/**
 * Generates a full compressed database and filesystem backup.
 * Returns the `.tar.gz` archive as a Base64-encoded string.
 */
export async function getDatabaseBackup() {
    const session = await getServerAuthSession();
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" };
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return { success: false, error: "DATABASE_URL environment variable is missing." };

    const timestamp = Date.now();
    const tempBackupDir = path.join(os.tmpdir(), `inventory-backup-${timestamp}`);
    const tempTarballPath = path.join(os.tmpdir(), `inventory-backup-${timestamp}.tar.gz`);

    try {
        console.log("Backup: Creating temporary directories...");
        await fs.mkdir(tempBackupDir, { recursive: true });

        // 1. Dump the database to db.sql in the temp backup folder
        console.log("Backup: Running pg_dump...");
        await execAsync(`pg_dump "${dbUrl}" > "${path.join(tempBackupDir, "db.sql")}"`);

        // 2. Copy the uploads directory to the temp backup folder if it exists
        const uploadsSrc = path.join(process.cwd(), "public", "uploads");
        const uploadsDest = path.join(tempBackupDir, "uploads");
        
        try {
            await fs.access(uploadsSrc);
            console.log("Backup: Copying uploads directory...");
            await execAsync(`cp -r "${uploadsSrc}" "${uploadsDest}"`);
        } catch (e) {
            console.log("Backup: No uploads directory found, skipping uploads backup.");
        }

        // 3. Compress the folder into a .tar.gz tarball
        console.log("Backup: Creating tarball...");
        await execAsync(`tar -czf "${tempTarballPath}" -C "${tempBackupDir}" .`);

        // 4. Read tarball and convert to base64
        console.log("Backup: Reading tarball as Base64...");
        const tarballBuffer = await fs.readFile(tempTarballPath);
        const base64Data = tarballBuffer.toString("base64");

        console.log("Backup process completed successfully.");
        return { 
            success: true, 
            filename: `inventory-pro-backup-${new Date().toISOString().split("T")[0]}.tar.gz`,
            data: base64Data 
        };

    } catch (error: any) {
        console.error("Backup failed:", error);
        return { success: false, error: error.message || "Failed to generate backup." };
    } finally {
        // Clean up temp files
        try {
            await fs.rm(tempBackupDir, { recursive: true, force: true });
            await fs.unlink(tempTarballPath);
        } catch (e) {
            // Ignore clean up errors
        }
    }
}

/**
 * Restores the system from a provided backup.
 * Supports both new compressed .tar.gz backups and legacy .sql backups (with auto-migration).
 * WARNING: This drops the existing 'public' schema before restoring.
 */
export async function restoreDatabase(formData: FormData) {
    const session = await getServerAuthSession();
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" };
    }

    const file = formData.get("file") as File;
    if (!file) {
        return { success: false, error: "No backup file uploaded." };
    }

    const filename = file.name;
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return { success: false, error: "DATABASE_URL environment variable is missing." };

    const timestamp = Date.now();
    const isLegacySql = filename.endsWith(".sql");
    const tempFile = path.join(os.tmpdir(), `restore-${timestamp}${isLegacySql ? ".sql" : ".tar.gz"}`);
    const tempExtractDir = path.join(os.tmpdir(), `restore-extract-${timestamp}`);

    try {
        console.log(`Restore: Writing uploaded backup file to ${tempFile}...`);
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(tempFile, buffer);

        // 1. Terminate other connections to inventory_db
        console.log("Restore: Terminating other database connections...");
        const terminateCmd = `psql "${dbUrl}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'inventory_db' AND pid <> pg_backend_pid();"`;
        await execAsync(terminateCmd).catch(err => console.warn("Restore: Terminate connections warning:", err.message));

        // 2. Clear current public schema
        console.log("Restore: Dropping and recreating public schema...");
        const dropCmd = `psql "${dbUrl}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`;
        await execAsync(dropCmd);

        let sqlFileToRestore = tempFile;

        if (!isLegacySql) {
            // 3a. Extract the tarball
            console.log(`Restore: Extracting tarball to ${tempExtractDir}...`);
            await fs.mkdir(tempExtractDir, { recursive: true });
            await execAsync(`tar -xzf "${tempFile}" -C "${tempExtractDir}"`);

            sqlFileToRestore = path.join(tempExtractDir, "db.sql");

            // Verify db.sql exists inside tarball
            try {
                await fs.access(sqlFileToRestore);
            } catch (e) {
                throw new Error("Invalid backup: Missing db.sql inside compressed archive.");
            }
        }

        // 4. Restore the PostgreSQL database from the SQL file
        console.log(`Restore: Executing psql restore from ${sqlFileToRestore}...`);
        const restoreCmd = `psql "${dbUrl}" -f "${sqlFileToRestore}"`;
        const { stderr: restoreErr } = await execAsync(restoreCmd);
        if (restoreErr) console.log("Restore: psql info/error output:", restoreErr);

        if (isLegacySql) {
            // 5a. Legacy SQL Restore: Run auto-migration to extract database blobs to the host filesystem
            await autoMigrateRestoredBlobs();
        } else {
            // 5b. Compressed Restore: Restore host filesystem uploads
            const extractedUploadsDir = path.join(tempExtractDir, "uploads");
            const publicUploadsDir = path.join(process.cwd(), "public", "uploads");

            try {
                await fs.access(extractedUploadsDir);
                console.log("Restore: Restoring host uploads files...");
                
                // Clear existing host uploads directories to avoid mixing old and new files
                await fs.rm(path.join(publicUploadsDir, "images"), { recursive: true, force: true }).catch(() => {});
                await fs.rm(path.join(publicUploadsDir, "datasheets"), { recursive: true, force: true }).catch(() => {});
                await fs.mkdir(path.join(publicUploadsDir, "images"), { recursive: true });
                await fs.mkdir(path.join(publicUploadsDir, "datasheets"), { recursive: true });

                // Copy extracted uploads to public uploads
                const imagesSrc = path.join(extractedUploadsDir, "images");
                try {
                    await fs.access(imagesSrc);
                    // Use wildcard copy safely
                    await execAsync(`cp -r "${imagesSrc}"/* "${path.join(publicUploadsDir, "images/")}"`);
                } catch (e) {
                    console.log("Restore: No images found in uploads backup.");
                }

                const datasheetsSrc = path.join(extractedUploadsDir, "datasheets");
                try {
                    await fs.access(datasheetsSrc);
                    // Use wildcard copy safely
                    await execAsync(`cp -r "${datasheetsSrc}"/* "${path.join(publicUploadsDir, "datasheets/")}"`);
                } catch (e) {
                    console.log("Restore: No datasheets found in uploads backup.");
                }

            } catch (e) {
                console.log("Restore: No uploads folder found in backup package.");
            }
        }

        console.log("Restore process completed successfully.");
        return { success: true };

    } catch (error: any) {
        console.error("Restore failed:", error);
        return { success: false, error: error.message || "Failed to restore database." };
    } finally {
        // Clean up temp files
        try {
            await fs.unlink(tempFile).catch(() => {});
            await fs.rm(tempExtractDir, { recursive: true, force: true }).catch(() => {});
        } catch (e) {
            // Ignore clean up errors
        }
    }
}
