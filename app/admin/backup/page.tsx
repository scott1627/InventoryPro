"use client";

import { useState } from "react";
import { Download, Upload, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { getDatabaseBackup, restoreDatabase } from "../../actions/backup";

export default function BackupPage() {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleDownload = async () => {
        setIsDownloading(true);
        setMessage(null);
        try {
            const res = await getDatabaseBackup();
            if (res.success && res.data && res.filename) {
                const byteCharacters = atob(res.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: "application/gzip" });

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = res.filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                setMessage({ text: "Backup generated and download started.", type: "success" });
            } else {
                setMessage({ text: res.error || "Failed to generate backup.", type: "error" });
            }
        } catch (error) {
            setMessage({ text: "An error occurred during backup generation.", type: "error" });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const handleRestore = async () => {
        if (!selectedFile) return;

        if (!window.confirm("CRITICAL WARNING: This will DELETE all current data and replace it with the content of the backup file. This action CANNOT be undone. Are you absolutely certain you want to proceed?")) {
            return;
        }

        setIsRestoring(true);
        setMessage(null);
        try {
            console.log("Restore: Starting restore process for file:", selectedFile.name);
            setMessage({ text: "Uploading and restoring... (This may take a minute)", type: "success" });

            const formData = new FormData();
            formData.append("file", selectedFile);

            const res = await restoreDatabase(formData);
            console.log("Restore: Server action response received:", res);
            if (res.success) {
                setMessage({ text: "System restored successfully! Refreshing...", type: "success" });
                setTimeout(() => window.location.reload(), 2000);
            } else {
                console.error("Restore failed on server:", res.error);
                setMessage({ text: res.error || "Failed to restore backup.", type: "error" });
            }
        } catch (error: any) {
            console.error("Restore process error:", error);
            setMessage({ text: error.message || "An error occurred during database restoration.", type: "error" });
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <div className="flex-1 space-y-6">
            <div className="flex flex-col gap-2 xs:flex-row xs:items-center xs:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Backup & Restore</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Safeguard your inventory database along with all media files, or migrate between hosts.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Export Section */}
                <div className="glass p-6 rounded-2xl space-y-4 border flex flex-col h-full">
                    <div className="bg-primary/10 h-10 w-10 shrink-0 rounded-lg flex items-center justify-center text-primary mb-2">
                        <Download size={20} />
                    </div>
                    <h2 className="text-xl font-bold">Export Backup</h2>
                    <p className="text-muted-foreground text-sm flex-grow">
                        Generate a full snapshot of your database (parts, categories, locations, jobs, BOMs, users) and all stored images and datasheets. 
                        This file is downloaded as a compressed `.tar.gz` archive.
                    </p>
                    <div className="pt-4">
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            {isDownloading ? "Generating..." : "Download Compressed Backup"}
                        </button>
                    </div>
                </div>

                {/* Import Section */}
                <div className="glass p-6 rounded-2xl space-y-4 border flex flex-col h-full">
                    <div className="bg-amber-500/10 h-10 w-10 shrink-0 rounded-lg flex items-center justify-center text-amber-500 mb-2">
                        <Upload size={20} />
                    </div>
                    <h2 className="text-xl font-bold">Restore System</h2>
                    <p className="text-muted-foreground text-sm flex-grow">
                        Upload a previously exported compressed backup (`.tar.gz`) or a legacy blob backup (`.sql`) to restore your entire system. 
                        Note: This will overwrite EVERYTHING.
                    </p>
                    <div className="space-y-4 pt-4">
                        <div className="relative group">
                            <input
                                type="file"
                                accept=".sql,.tar.gz,.gz"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                            />
                        </div>
                        <button
                            onClick={handleRestore}
                            disabled={!selectedFile || isRestoring}
                            className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isRestoring ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                            {isRestoring ? "Restoring..." : "Restore from file"}
                        </button>
                    </div>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 ${
                    message.type === "success" 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                        : "bg-destructive/10 border-destructive/20 text-destructive"
                }`}>
                    {message.type === "success" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                    <span className="text-sm font-medium">{message.text}</span>
                </div>
            )}

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-4">
                <div className="bg-amber-500/20 p-2 rounded-lg text-amber-500 mt-1">
                    <AlertTriangle size={18} />
                </div>
                <div className="space-y-1">
                    <h3 className="text-sm font-bold text-amber-500">Important Precautions</h3>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>Supports both modern `.tar.gz` and legacy `.sql` database backups.</li>
                        <li>Legacy `.sql` backups will automatically have their media blobs extracted to the host filesystem.</li>
                        <li>The system will briefly disconnect while the database is being reset during restoration.</li>
                        <li>Ensure you have a recent reliable backup before performing a restore.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
