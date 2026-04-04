"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Package, MapPin, Tag, Hash, FileText, Upload, Loader2, CheckCircle2, Bell } from "lucide-react";
import { addPart } from "../app/actions/parts";
import CategoryPicker from "./CategoryPicker";
import LocationPicker from "./LocationPicker";

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
                        await handleSubmit(formData);
                    }}
                >
                    <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/30 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                <Plus className="text-primary" size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Add New Part</h2>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Inventory Catalog</p>
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
                            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm font-medium">
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
                                    placeholder="e.g. ESP32-WROOM-32"
                                    className="w-full px-4 py-2.5 bg-secondary/50 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Tag size={14} className="text-primary" /> Category
                                    </label>
                                    <CategoryPicker 
                                        categories={categories}
                                        value={selectedCategoryId}
                                        onSelect={setSelectedCategoryId}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Upload size={14} className="text-primary" /> Part Photo (IMG)
                                    </label>
                                    <input
                                        name="image"
                                        type="file"
                                        accept="image/*"
                                        className="w-full px-4 py-1.5 text-xs bg-secondary/50 rounded-xl border border-border file:mr-4 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 outline-none transition-all cursor-pointer"
                                    />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <MapPin size={14} className="text-primary" /> Storage Location
                                    </label>
                                    <LocationPicker 
                                        locations={locations}
                                        value={selectedLocationId}
                                        onSelect={setSelectedLocationId}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Hash size={14} className="text-primary" /> Initial Stock
                                    </label>
                                    <input
                                        name="stock"
                                        type="number"
                                        defaultValue="0"
                                        className="w-full px-4 py-2.5 bg-secondary/50 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Upload size={14} className="text-primary" /> Datasheet (PDF)
                                    </label>
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
                                    <FileText size={14} className="text-primary" /> Description
                                </label>
                                <textarea
                                    name="description"
                                    rows={2}
                                    placeholder="Enter part specifications or notes..."
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
                                            defaultValue="5"
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

                    <div className="p-6 bg-secondary/10 border-t border-border flex items-center justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-secondary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="px-8 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
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
