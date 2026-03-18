import { FileText, Smartphone, LayoutDashboard, Package, ListTree, MapPin, ClipboardList, PenTool, Users, Database, ShieldCheck } from "lucide-react";

export default function DocsPage() {
    return (
        <div className="max-w-4xl mx-auto py-10 px-6 space-y-12 mb-20 print:m-0 print:p-0 print:max-w-none">
            {/* Print styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body { background: white !important; color: black !important; }
                    .print\\:hidden { display: none !important; }
                    .glass { border: 1px solid #ddd !important; background: transparent !important; box-shadow: none !important; }
                    .no-break { break-inside: avoid; }
                    h1, h2, h3 { color: #000 !important; page-break-after: avoid; }
                    a { text-decoration: underline; color: black !important; }
                    .container { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
                    .p-10 { padding: 0 !important; }
                }
            ` }} />

            <header className="text-center space-y-4 border-b pb-10">
                <div className="flex justify-center mb-6">
                    <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-xl">
                        <span className="text-primary-foreground font-bold font-mono text-3xl">IP</span>
                    </div>
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight">InventoryPro User Manual</h1>
                <p className="text-muted-foreground text-lg">Comprehensive Guide & Technical Documentation</p>
                <div className="text-xs text-muted-foreground pt-2">Version 1.2 • Published March 2026</div>
            </header>

            <section className="space-y-6 no-break">
                <h2 className="text-2xl font-bold flex items-center gap-3 border-b pb-2">
                    <LayoutDashboard className="text-primary" /> 1. Introduction
                </h2>
                <div className="prose dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                    <p>
                        InventoryPro is a modern, responsive inventory management system designed for labs, maker spaces, and production environments. 
                        Built with a focus on speed and clarity, it allows you to track components, manage multi-part assemblies (BOMs), 
                        and orchestrate production jobs with real-time stock deduction.
                    </p>
                </div>
            </section>

            <section className="space-y-6 no-break">
                <h2 className="text-2xl font-bold flex items-center gap-3 border-b pb-2">
                    <ShieldCheck className="text-primary" /> 2. Getting Started
                </h2>
                <div className="prose dark:prose-invert max-w-none text-muted-foreground space-y-4">
                    <p>The system utilizes role-based access control. All standard inventory pages are accessible to logged-in users, while management tools are restricted to Administrators.</p>
                    <div className="glass p-4 rounded-xl space-y-2 border-l-4 border-primary">
                        <h4 className="font-bold text-foreground">Default Administrator Access</h4>
                        <ul className="text-sm list-disc list-inside">
                            <li><strong>Username:</strong> admin</li>
                            <li><strong>Password:</strong> password123 (Change immediately after first login)</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section className="space-y-6 no-break">
                <h2 className="text-2xl font-bold flex items-center gap-3 border-b pb-2">
                    <Package className="text-primary" /> 3. Inventory Fundamentals
                </h2>
                <div className="grid gap-6 md:grid-cols-3">
                    <div className="glass p-5 rounded-2xl space-y-3">
                        <ListTree className="text-primary" size={24} />
                        <h3 className="font-bold">Categories</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">Organize parts into logical groups (e.g., Resistors, Microcontrollers). Categories can have descriptions and help in filtered searching.</p>
                    </div>
                    <div className="glass p-5 rounded-2xl space-y-3">
                        <MapPin className="text-primary" size={24} />
                        <h3 className="font-bold">Locations</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">Track physical storage using a hierarchical tree. Map parts to specific bins or shelves to find them instantly.</p>
                    </div>
                    <div className="glass p-5 rounded-2xl space-y-3">
                        <FileText className="text-primary" size={24} />
                        <h3 className="font-bold">Parts</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">The core record. Each part tracks stock levels, footprints, and datasheets. A visual indicator appears if a datasheet is attached.</p>
                    </div>
                </div>
            </section>

            <section className="space-y-8 no-break">
                <h2 className="text-2xl font-bold flex items-center gap-3 border-b pb-2">
                    <PenTool className="text-primary" /> 4. Assembly & Production
                </h2>
                <div className="space-y-4">
                    <div className="flex gap-4 items-start">
                        <div className="bg-secondary p-2 rounded-lg"><ClipboardList /></div>
                        <div>
                            <h3 className="font-bold">BOMs (Bill of Materials)</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Build recipes for products. A BOM allows you to group multiple parts together with specific quantities (e.g., a "Control Board" BOM requires 1x MCU and 4x Resistors).
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4 items-start">
                        <div className="bg-secondary p-2 rounded-lg"><PenTool /></div>
                        <div>
                            <h3 className="font-bold">Jobs (Production Context)</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Orchestrate the production of one or more units. When a Job is marked as <strong>Completed</strong>, the system automatically calculates the total parts required across all attached BOMs and deducts them from the inventory.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-6 no-break">
                <h2 className="text-2xl font-bold flex items-center gap-3 border-b pb-2">
                    <Users className="text-primary" /> 5. Administration
                </h2>
                <div className="prose dark:prose-invert max-w-none text-muted-foreground space-y-4">
                    <div className="glass p-5 rounded-xl border-dashed">
                        <h3 className="font-bold text-foreground flex items-center gap-2 mb-2"><Users size={18} /> User Management</h3>
                        <p className="text-sm">Manage team access, reset passwords, and assign roles (User vs. Admin) from the <strong>Users</strong> dashboard.</p>
                    </div>
                    <div className="glass p-5 rounded-xl border-dashed">
                        <h3 className="font-bold text-foreground flex items-center gap-2 mb-2"><Database size={18} /> Backup & Restore</h3>
                        <p className="text-sm">Found in the <strong>Admin Backup</strong> section. Keep your data safe by exporting standard PostgreSQL SQL dumps. You can restore your entire system from these files at any time.</p>
                    </div>
                </div>
            </section>

            <footer className="text-center pt-20 border-t print:hidden">
                <p className="text-muted-foreground text-sm italic">
                    Tip: Press <strong>Ctrl + P</strong> (Windows/Linux) or <strong>Cmd + P</strong> (Mac) to save this page as a professional PDF.
                </p>
            </footer>

            <div className="hidden print:block text-[10px] text-center text-muted-foreground pt-10">
                End of InventoryPro Documentation • Generated via System Dashboard
            </div>
        </div>
    );
}
