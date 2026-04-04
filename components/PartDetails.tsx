"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FileText, ChevronRight, MapPin, Package, AlertTriangle, ExternalLink, Plus, Minus, Loader2, X } from "lucide-react";
import PDFViewer from "./PDFViewer";
import { cn } from "../lib/utils";
import { adjustStock } from "../app/actions/parts";

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
        parent?: { name: string; color: string | null } | null;
    };
    stockLevels: { quantity: number }[];
    minStock: number;
    lowStockAlertEnabled: boolean;
    reorderLink: string | null;
}

interface PartDetailsProps {
    part: Part;
    isInline?: boolean;
    categoryPath?: string;
}

export default function PartDetails({ part, isInline, categoryPath }: PartDetailsProps) {
    const [showDatasheet, setShowDatasheet] = useState(false);
    const [adjustQuantity, setAdjustQuantity] = useState(1);
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [isEnlarged, setIsEnlarged] = useState(false);

    const handleAdjust = async (amount: number) => {
        setIsAdjusting(true);
        try {
            const result = await adjustStock(part.id, amount);
            if (!result.success) {
                alert(result.error);
            }
        } finally {
            setIsAdjusting(false);
        }
    };

    // Reset datasheet view when part changes
    useEffect(() => {
        setShowDatasheet(false);
    }, [part.id]);

    return (
        <div className={cn(
            "rounded-xl space-y-6",
            isInline ? "p-4 bg-secondary/20 mt-4 animate-in slide-in-from-top-2 duration-200" : "glass p-6 sticky top-24"
        )}>
            {part.lowStockAlertEnabled && part.stockLevels[0]?.quantity <= part.minStock && (
                <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive animate-pulse">
                    <AlertTriangle size={18} />
                    <div className="text-xs font-bold uppercase tracking-wider">Low Stock Warning</div>
                </div>
            )}

            <div>
                <h2 className="text-xl font-bold">{part.name}</h2>
                <p className="text-sm text-muted-foreground">{categoryPath || part.category.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-secondary/50 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Stock Level</p>
                    <div className="flex items-end gap-1.5">
                        <p className="text-xl font-bold">{part.stockLevels[0]?.quantity || 0}</p>
                        {part.lowStockAlertEnabled && (
                            <p className="text-[10px] text-muted-foreground mb-0.5 opacity-60">/ min {part.minStock}</p>
                        )}
                    </div>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg flex flex-col justify-between">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Quick Adjust</p>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min="1"
                            value={adjustQuantity}
                            onChange={(e) => setAdjustQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-12 bg-background/50 border border-border/50 rounded px-1 py-0.5 text-xs text-center outline-none focus:border-primary"
                        />
                        <div className="flex gap-1">
                            <button
                                onClick={() => handleAdjust(-adjustQuantity)}
                                disabled={isAdjusting || (part.stockLevels[0]?.quantity || 0) < adjustQuantity}
                                className="p-1 bg-amber-500/20 text-amber-500 rounded hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                                title="Remove Stock"
                            >
                                {isAdjusting ? <Loader2 size={14} className="animate-spin" /> : <Minus size={14} />}
                            </button>
                            <button
                                onClick={() => handleAdjust(adjustQuantity)}
                                disabled={isAdjusting}
                                className="p-1 bg-green-500/20 text-green-500 rounded hover:bg-green-500/30 transition-colors disabled:opacity-50"
                                title="Add Stock"
                            >
                                {isAdjusting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Bin Location</p>
                    <div className="flex items-center gap-2">
                        <div
                            className="h-2.5 w-2.5 rounded-full shrink-0 border border-white/10"
                            style={{ backgroundColor: part.storageLocation.color || part.storageLocation.parent?.color || "#4b5563" }}
                        />
                        <p className="text-sm font-bold truncate">
                            {part.storageLocation.parent && <span className="text-muted-foreground font-normal">{part.storageLocation.parent.name} / </span>}
                            {part.storageLocation.name}
                        </p>
                    </div>
                </div>
            </div>

            {part.imageUrl && (
                <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Part Photo</p>
                    <div 
                        className="relative w-full aspect-video rounded-xl overflow-hidden border border-border bg-background/50 group cursor-zoom-in"
                        onClick={() => setIsEnlarged(true)}
                    >
                        <img 
                            src={part.imageUrl} 
                            alt={part.name} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <Plus className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
                        </div>
                    </div>
                </div>
            )}

            {isEnlarged && part.imageUrl && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 z-[11000] flex items-center justify-center p-4 md:p-12 bg-black/95 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setIsEnlarged(false)}
                >
                    <div className="relative w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-300">
                        <img 
                            src={part.imageUrl} 
                            alt={part.name} 
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
                        />
                        <button 
                            className="absolute top-0 right-0 m-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/20 hover:scale-110 active:scale-95"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEnlarged(false);
                            }}
                            title="Close"
                        >
                            <X size={32} />
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {part.description && (
                <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Description</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{part.description}</p>
                </div>
            )}

            <div className="space-y-2">
                <button
                    onClick={() => setShowDatasheet(!showDatasheet)}
                    disabled={!part.datasheetUrl}
                    className="w-full flex items-center justify-between p-4 glass rounded-xl hover:bg-secondary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                    <div className="flex items-center gap-3">
                        <FileText className="text-primary" size={18} />
                        <span className="text-sm font-medium">View Datasheet</span>
                    </div>
                    <ChevronRight
                        size={16}
                        className={`text-muted-foreground transition-transform duration-200 ${showDatasheet ? 'rotate-90' : ''}`}
                    />
                </button>

                {part.reorderLink && (
                    <a
                        href={part.reorderLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-between p-4 glass rounded-xl hover:bg-primary/10 transition-colors text-left group"
                    >
                        <div className="flex items-center gap-3">
                            <ExternalLink className="text-primary" size={18} />
                            <span className="text-sm font-medium">Reorder Part</span>
                        </div>
                        <ChevronRight
                            size={16}
                            className="text-muted-foreground group-hover:translate-x-1 transition-transform"
                        />
                    </a>
                )}
            </div>

            {showDatasheet && part.datasheetUrl && (
                <div className="animate-in slide-in-from-top-4 duration-300">
                    <PDFViewer url={part.datasheetUrl} title={`${part.name} Datasheet`} />
                </div>
            )}
        </div>
    );
}
