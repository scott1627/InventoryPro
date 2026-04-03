"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Save, Package, MapPin, Tag, Hash, FileText, Upload, Loader2, CheckCircle2, Trash2, AlertTriangle, Bell } from "lucide-react";
import { updatePart, deletePart } from "../app/actions/parts";

interface Part {
    id: string;
    name: string;
    description: string | null;
    datasheetUrl: string | null;
    imageUrl: string | null;
    categoryId: string;
    storageLocationId: string;
    category: { name: string };
    storageLocation: {
        name: string;
        color: string | null;
        parent?: { id: string; name: string } | null;
    };
    stockLevels: { quantity: number }[];
    minStock: number;
    lowStockAlertEnabled: boolean;
    reorderLink: string | null;
}

interface EditPartModalProps {
    isOpen: boolean;
    onClose: () => void;
    part: Part;
    categories: { id: string; name: string }[];
    locations: { id: string; name: string; parentId?: string | null; parent?: { name: string } | null }[];
}

export default function EditPartModal({ isOpen, onClose, part, categories, locations }: EditPartModalProps) {
    const [isPending, startTransition] = useTransition();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [selectedParentId, setSelectedParentId] = useState<string>(part.storageLocation.parent?.id || part.storageLocationId);
    const [alertsEnabled, setAlertsEnabled] = useState(part.lowStockAlertEnabled);

    useEffect(() => {
        setMounted(true);
    }, []);

    const parentLocations = useMemo(() => {
        return locations.filter(loc => !loc.parentId);
    }, [locations]);

    const availableBins = useMemo(() => {
        if (!selectedParentId) return [];
        return locations.filter(loc => loc.parentId === selectedParentId);
    }, [locations, selectedParentId]);

    const categoryOptions = useMemo(() => {
        const getPath = (cat: { id: string; name: string; parentId?: string | null }): string => {
            const parent = categories.find(c => c.id === cat.parentId);
            if (parent) {
                return `${getPath(parent)} > ${cat.name}`;
            }
            return cat.name;
        };

        return categories.map(cat => ({
            id: cat.id,
            path: getPath(cat)
        })).sort((a, b) => a.path.localeCompare(b.path));
    }, [categories]);

    if (!isOpen || !mounted) return null;

    async function handleSubmit(formData: FormData) {
        setError(null);
        startTransition(async () => {
            const result = await updatePart(part.id, formData);
            if (result.success) {
                setIsSuccess(true);
                setTimeout(() => {
                    setIsSuccess(false);
                    onClose();
                }, 1500);
            } else {
                setError(result.error || "An unknown error occurred");
            }
        });
    }

    async function handleDelete() {
        if (!confirm("Are you sure you want to delete this part? This action cannot be undone.")) return;

        setError(null);
        setIsDeleting(true);
        const result = await deletePart(part.id);
        setIsDeleting(false);

        if (result.success) {
            onClose();
        } else {
            setError(result.error || "Failed to delete part");
        }
    }

    if (isSuccess) {
        return createPortal(
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                <div className="w-full max-w-sm bg-card border border-border shadow-2xl rounded-2xl p-8 text-center space-y-4 animate-in zoom-in-95">
                    <div className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-500">
                        <CheckCircle2 size={48} />
                    </div>
                    <h2 className="text-2xl font-bold">Part Updated!</h2>
                    <p className="text-muted-foreground">The changes have been saved successfully.</p>
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-start md:items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
            <div className="w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-8 max-h-[90vh] flex flex-col">
                <form
                    className="flex flex-col min-h-0 flex-1"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        await handleSubmit(formData);
                    }}
                >
                    <div className="p-6 border-b border-border flex items-center justify-between bg-primary/5 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                <Save className="text-primary" size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Edit Part</h2>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">{part.name}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar min-h-0 flex-1">
                        {error && (
                            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm font-medium flex items-center gap-2">
                                <AlertTriangle size={16} />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Package size={14} className="text-primary" /> Part Name
                                </label>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    defaultValue={part.name}
                                    className="w-full px-4 py-2.5 bg-secondary/50 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Tag size={14} className="text-primary" /> Category
                                    </label>
                                    <select
                                        name="categoryId"
                                        defaultValue={part.categoryId}
                                        className="w-full px-4 py-2.5 bg-secondary/50 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all cursor-pointer"
                                    >
                                        <option value="">Select Category...</option>
                                        {categoryOptions.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.path}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <MapPin size={14} className="text-primary" /> Storage Area
                                    </label>
                                    <select
                                        name="storageAreaId"
                                        value={selectedParentId}
                                        onChange={(e) => setSelectedParentId(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-secondary/50 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all cursor-pointer"
                                    >
                                        <option value="">Select Area...</option>
                                        {parentLocations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Hash size={14} className="text-primary" /> Specific Bin
                                    </label>
                                    <select
                                        name="locationId"
                                        disabled={!selectedParentId}
                                        defaultValue={part.storageLocationId}
                                        className="w-full px-4 py-2.5 bg-secondary/50 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        <option value="">{selectedParentId ? "Select Bin..." : "Select Area first..."}</option>
                                        {availableBins.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Hash size={14} className="text-primary" /> Stock Level
                                    </label>
                                    <input
                                        name="stock"
                                        type="number"
                                        defaultValue={part.stockLevels[0]?.quantity || 0}
                                        className="w-full px-4 py-2.5 bg-secondary/50 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Upload size={14} className="text-primary" /> {part.datasheetUrl ? "Update Datasheet" : "Datasheet (PDF)"}
                                    </label>
                                    <div className="space-y-3">
                                        {part.datasheetUrl && (
                                            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20 text-xs text-foreground/80">
                                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                    <FileText size={16} />
                                                </div>
                                                <div className="flex-1 truncate">
                                                    <p className="font-semibold truncate">{part.datasheetUrl.split('/').pop()}</p>
                                                    <a
                                                        href={part.datasheetUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:underline font-medium"
                                                    >
                                                        Review Current File
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                        <input
                                            name="datasheet"
                                            type="file"
                                            accept="application/pdf"
                                            className="w-full px-4 py-1.5 text-xs bg-secondary/50 rounded-xl border border-border file:mr-4 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 outline-none transition-all cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Upload size={14} className="text-primary" /> {part.imageUrl ? "Update Photo" : "Part Photo (IMG)"}
                                    </label>
                                    <div className="space-y-3">
                                        {part.imageUrl && (
                                            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20 text-xs text-foreground/80">
                                                <div className="h-12 w-12 rounded-lg border border-border overflow-hidden bg-background flex shrink-0">
                                                    <img src={part.imageUrl} alt="Part" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 truncate">
                                                    <p className="font-semibold truncate">{part.imageUrl.split('/').pop()}</p>
                                                    <span className="text-muted-foreground italic">Current photo attached</span>
                                                </div>
                                            </div>
                                        )}
                                        <input
                                            name="image"
                                            type="file"
                                            accept="image/*"
                                            className="w-full px-4 py-1.5 text-xs bg-secondary/50 rounded-xl border border-border file:mr-4 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 outline-none transition-all cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <FileText size={14} className="text-primary" /> Description
                                </label>
                                <textarea
                                    name="description"
                                    rows={2}
                                    defaultValue={part.description || ""}
                                    className="w-full px-4 py-2.5 bg-secondary/50 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
                                ></textarea>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Tag size={14} className="text-primary" /> Reorder Link
                                </label>
                                <input
                                    name="reorderLink"
                                    type="url"
                                    defaultValue={part.reorderLink || ""}
                                    placeholder="https://..."
                                    className="w-full px-4 py-2.5 bg-secondary/50 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                            <Bell size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">Low Stock Alerts</p>
                                            <p className="text-[10px] text-muted-foreground uppercase">Notifications</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="lowStockAlertEnabled"
                                            className="sr-only peer"
                                            checked={alertsEnabled}
                                            onChange={(e) => setAlertsEnabled(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>

                                {alertsEnabled && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                            <Hash size={14} className="text-primary" /> Low Stock Threshold
                                        </label>
                                        <input
                                            name="minStock"
                                            type="number"
                                            defaultValue={part.minStock}
                                            className="w-full px-4 py-2 bg-secondary/50 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                        />
                                        <p className="text-[10px] text-muted-foreground italic">
                                            You will be notified when the stock level drops to or below this quantity.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-secondary/10 border-t border-border flex items-center justify-between shrink-0">
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={isDeleting || isPending}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                            Delete Part
                        </button>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-secondary transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isPending || isDeleting}
                                className="px-8 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                {(isPending) && <Loader2 className="animate-spin" size={16} />}
                                {isPending ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
