"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Package, MapPin, Tag, Hash, FileText, Upload, Loader2, CheckCircle2, Bell, Barcode } from "lucide-react";
import { addPart } from "../app/actions/parts";
import CategoryPicker from "./CategoryPicker";
import LocationPicker from "./LocationPicker";
import IconPicker from "./IconPicker";
import { compressImage } from "../lib/image";

interface AddPartModalProps {
    isOpen: boolean;
    onClose: () => void;
    categories: { id: string; name: string }[];
    locations: { id: string; name: string; parentId?: string | null; parent?: { name: string } | null }[];
    initialCategoryId?: string;
    initialLocationId?: string;
}

export default function AddPartModal({ isOpen, onClose, categories, locations, initialCategoryId, initialLocationId }: AddPartModalProps) {
    const [isPending, startTransition] = useTransition();
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [selectedParentId, setSelectedParentId] = useState<string>("");
    const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId || "");
    const [alertsEnabled, setAlertsEnabled] = useState(false);
    const [iconId, setIconId] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        if (initialLocationId) {
            setSelectedLocationId(initialLocationId);
        }
    }, [initialLocationId]);

    const parentLocations = useMemo(() => {
        return locations.filter(loc => !loc.parentId);
    }, [locations]);

    const availableBins = useMemo(() => {
        if (!selectedParentId) return [];
        return locations.filter(loc => loc.parentId === selectedParentId);
    }, [locations, selectedParentId]);

    const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId || categories.find(c => c.name === "Unassigned")?.id || "");

    useEffect(() => {
        if (initialCategoryId) setSelectedCategoryId(initialCategoryId);
    }, [initialCategoryId]);

    if (!isOpen || !mounted) return null;

    async function handleSubmit(formData: FormData) {
        setError(null);
        startTransition(async () => {
            const result = await addPart(formData);
            if (result.success) {
                setIsSuccess(true);
                setTimeout(() => {
                    setIsSuccess(false);
                    onClose();
                }, 2000);
            } else {
                setError(result.error || "An unknown error occurred");
            }
        });
    }

    if (isSuccess) {
        return createPortal(
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                <div className="w-full max-w-sm bg-card border border-border shadow-2xl rounded-2xl p-8 text-center space-y-4 animate-in zoom-in-95">
                    <div className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-500">
                        <CheckCircle2 size={48} />
                    </div>
                    <h2 className="text-2xl font-bold">Part Added!</h2>
                    <p className="text-muted-foreground">The inventory has been updated successfully.</p>
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
                        const imageFile = formData.get("image") as File;
                        if (imageFile && imageFile.size > 0) {
                            const compressed = await compressImage(imageFile);
                            formData.set("image", compressed);
                        }
                        await handleSubmit(formData);
                    }}
                >
                    <div className="p-6 border-b border-border/50 flex items-center justify-between bg-secondary/20 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
                                <Plus size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight">Add New Part</h2>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold opacity-60">Inventory Catalog</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-secondary rounded-full transition-all text-muted-foreground hover:text-foreground"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar min-h-0 flex-1 bg-background/50">
                        {error && (
                            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-2">
                                <Plus size={16} className="rotate-45" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-5">
                            {/* Row 1: Part Name & UPC */}
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2.5">
                                    <label className="text-sm font-semibold flex items-center gap-2.5 text-foreground/90">
                                        <Package size={16} className="text-primary/70" /> Part Name
                                    </label>
                                    <input
                                        name="name"
                                        type="text"
                                        required
                                        autoFocus
                                        placeholder="e.g. ESP32-WROOM-32"
                                        className="w-full px-4 py-3 bg-secondary/40 rounded-xl border border-border/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/50 shadow-inner"
                                    />
                                </div>
                                <div className="space-y-2.5">
                                    <label className="text-sm font-semibold flex items-center gap-2.5 text-foreground/90">
                                        <Barcode size={16} className="text-primary/70" /> UPC / Barcode
                                    </label>
                                    <input
                                        name="upc"
                                        type="text"
                                        placeholder="Scan or leave blank..."
                                        className="w-full px-4 py-3 bg-secondary/40 rounded-xl border border-border/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/50 shadow-inner"
                                    />
                                </div>
                            </div>

                            {/* Row 2: Description */}
                            <div className="space-y-2.5">
                                <label className="text-sm font-semibold flex items-center gap-2.5 text-foreground/90">
                                    <FileText size={16} className="text-primary/70" /> Description
                                </label>
                                <textarea
                                    name="description"
                                    rows={3}
                                    placeholder="Enter part specifications or notes..."
                                    className="w-full px-4 py-3 bg-secondary/40 rounded-xl border border-border/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none shadow-inner"
                                ></textarea>
                            </div>

                            {/* Row 3: Location & Category */}
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2.5">
                                    <label className="text-sm font-semibold flex items-center gap-2.5 text-foreground/90">
                                        <MapPin size={16} className="text-primary/70" /> Select Location...
                                    </label>
                                    <LocationPicker 
                                        locations={locations}
                                        value={selectedLocationId}
                                        onSelect={setSelectedLocationId}
                                    />
                                </div>
                                <div className="space-y-2.5">
                                    <label className="text-sm font-semibold flex items-center gap-2.5 text-foreground/90">
                                        <Tag size={16} className="text-primary/70" /> Category
                                    </label>
                                    <CategoryPicker 
                                        categories={categories}
                                        value={selectedCategoryId}
                                        onSelect={setSelectedCategoryId}
                                    />
                                </div>
                            </div>

                            {/* Row 3.5: Icon & Reorder Link */}
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2.5">
                                    <label className="text-sm font-semibold flex items-center gap-2.5 text-foreground/90">
                                        <Package size={16} className="text-primary/70" /> Thumbnail Icon
                                    </label>
                                    <IconPicker value={iconId} onChange={setIconId} />
                                </div>
                                <div className="space-y-2.5">
                                    <label className="text-sm font-semibold flex items-center gap-2.5 text-foreground/90">
                                        <Tag size={16} className="text-primary/70" /> Reorder Link
                                    </label>
                                    <input
                                        name="reorderLink"
                                        type="url"
                                        placeholder="https://..."
                                        className="w-full px-4 py-3 bg-secondary/40 rounded-xl border border-border/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            {/* Row 4: Photos & Datasheets */}
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2.5">
                                    <label className="text-sm font-semibold flex items-center gap-2.5 text-foreground/90">
                                        <Upload size={16} className="text-primary/70" /> Part Photo (IMG)
                                    </label>
                                    <input
                                        name="image"
                                        type="file"
                                        accept="image/*"
                                        className="w-full px-4 py-2 text-xs bg-secondary/40 rounded-xl border border-border/50 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-primary/20 file:text-primary hover:file:bg-primary/30 outline-none transition-all cursor-pointer shadow-inner"
                                    />
                                </div>
                                <div className="space-y-2.5">
                                    <label className="text-sm font-semibold flex items-center gap-2.5 text-foreground/90">
                                        <Upload size={16} className="text-primary/70" /> Datasheet (PDF)
                                    </label>
                                    <input
                                        name="datasheet"
                                        type="file"
                                        accept="application/pdf"
                                        className="w-full px-4 py-2 text-xs bg-secondary/40 rounded-xl border border-border/50 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-primary/20 file:text-primary hover:file:bg-primary/30 outline-none transition-all cursor-pointer shadow-inner"
                                    />
                                </div>
                            </div>

                            {/* Row 6: Initial Stock */}
                            <div className="space-y-2.5">
                                <label className="text-sm font-semibold flex items-center gap-2.5 text-foreground/90">
                                    <Hash size={16} className="text-primary/70" /> Initial Stock
                                </label>
                                <input
                                    name="stock"
                                    type="number"
                                    defaultValue="0"
                                    className="w-full px-4 py-3 bg-secondary/40 rounded-xl border border-border/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner"
                                />
                            </div>

                            {/* Row 7: Alerts Card */}
                            <div className="p-5 bg-primary/5 rounded-2xl border border-primary/10 space-y-5 shadow-inner">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                                            <Bell size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold tracking-tight">Low Stock Alerts</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold opacity-60">Notifications</p>
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
                                        <div className="w-12 h-6.5 bg-secondary/80 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                                    </label>
                                </div>

                                {alertsEnabled && (
                                    <div className="space-y-3 animate-in slide-in-from-top-3 duration-300">
                                        <label className="text-sm font-semibold flex items-center gap-2.5 text-foreground/90">
                                            <Hash size={16} className="text-primary/70" /> Low Stock Threshold
                                        </label>
                                        <input
                                            name="minStock"
                                            type="number"
                                            defaultValue="5"
                                            className="w-full px-4 py-2.5 bg-background/50 rounded-xl border border-border/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner"
                                        />
                                        <p className="text-[10px] text-muted-foreground/70 italic px-1">
                                            You will be notified when the stock level drops to or below this quantity.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-secondary/10 border-t border-border/50 flex items-center justify-end gap-6 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-2"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center gap-2.5 active:scale-95"
                        >
                            {isPending && <Loader2 className="animate-spin" size={16} />}
                            {isPending ? "Saving..." : "Save Part"}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
