"use server";

import { exec } from "child_process";
import { promisify } from "util";
import { getServerAuthSession } from "../../lib/auth";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const execAsync = promisify(exec);

/**
 * Generates a full database dump using pg_dump.
 * Returns the dump as a string.
 */
export async function getDatabaseBackup() {
    const session = await getServerAuthSession();
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" };
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return { success: false, error: "DATABASE_URL environment variable is missing." };

    try {
        // Use pg_dump to get the SQL dump. 
        // We use --column-inserts for better compatibility if needed, 
        // but default is usually fine for psql restore.
        const { stdout } = await execAsync(`pg_dump "${dbUrl}"`);
        return { success: true, data: stdout };
    } catch (error: any) {
        console.error("Database backup failed:", error);
        return { success: false, error: error.message || "Failed to generate backup." };
    }
}

/**
 * Restores the database from a provided SQL backup string.
 * WARNING: This drops the existing 'public' schema before restoring.
 */
export async function restoreDatabase(sqlContent: string) {
    const session = await getServerAuthSession();
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" };
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return { success: false, error: "DATABASE_URL environment variable is missing." };

    const tempFilePath = path.join(os.tmpdir(), `restore-${Date.now()}.sql`);

    try {
        console.log("Restore: Writing temp file...");
        await fs.writeFile(tempFilePath, sqlContent);
        console.log("Restore: Temp file written to", tempFilePath);

        // 2. Clear the current public schema to avoid conflicts
        // We attempt to terminate other connections first to ensure the drop works.
        console.log("Restore: Terminating other database connections...");
        const terminateCmd = `psql "${dbUrl}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'inventory_db' AND pid <> pg_backend_pid();"`;
        await execAsync(terminateCmd).catch(err => console.warn("Restore: Terminate connections warning:", err.message));

        console.log("Restore: Dropping and recreating public schema...");
        const dropCmd = `psql "${dbUrl}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`;
        const { stdout: dropOut, stderr: dropErr } = await execAsync(dropCmd);
        if (dropErr) console.warn("Restore: Drop schema stderr:", dropErr);
        console.log("Restore: Public schema recreated.");

        // 3. Restore the database from the SQL file
        console.log("Restore: Executing psql restore from file...");
        const restoreCmd = `psql "${dbUrl}" -f "${tempFilePath}"`;
        const { stdout: restoreOut, stderr: restoreErr } = await execAsync(restoreCmd);
        
        // psql -f output goes to stderr for some reason even on success (statements like SET, CREATE TABLE, etc.)
        if (restoreErr) console.log("Restore: psql info/error output:", restoreErr);
        if (restoreOut) console.log("Restore: psql stdout:", restoreOut);

        console.log("Database restore process completed successfully.");
        return { success: true };
    } catch (error: any) {
        console.error("Database restore failed in execution chain:", error);
        // Extract a more useful error message if possible
        const errorMessage = error.stderr || error.message || "Failed to restore database.";
        return { success: false, error: errorMessage };
    } finally {
        // Clean up temp file
        try {
            await fs.access(tempFilePath);
            await fs.unlink(tempFilePath);
        } catch (e) {
            // Ignore if file doesn't exist
        }
    }
}
