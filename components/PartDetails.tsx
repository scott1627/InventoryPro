"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FileText, ChevronRight, MapPin, Package, AlertTriangle, ExternalLink, Plus, Minus, Loader2, X, Barcode as BarcodeIcon, Copy, Check, Printer } from "lucide-react";
import Barcode from "react-barcode";
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
    upc: string | null;
}

interface PartDetailsProps {
    part: Part;
    isInline?: boolean;
    categoryPath?: string;
}

export default function PartDetails({ part, isInline, categoryPath }: PartDetailsProps) {
    const [showDatasheet, setShowDatasheet] = useState(!!part.datasheetUrl);
    const [adjustQuantity, setAdjustQuantity] = useState(1);
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [isEnlarged, setIsEnlarged] = useState(false);
    const [copiedUPC, setCopiedUPC] = useState(false);

    const handleCopyUPC = () => {
        if (part.upc) {
            navigator.clipboard.writeText(part.upc);
            setCopiedUPC(true);
            setTimeout(() => setCopiedUPC(false), 2000);
        }
    };

    const handlePrintBarcode = () => {
        const barcodeEl = document.getElementById('barcode-svg-container');
        if (!barcodeEl) return;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Print Barcode - ${part.name}</title>
                        <style>
                            body { margin: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; }
                            @media print {
                                @page { margin: 0; }
                                body { height: auto; margin: 1cm; display: block; text-align: center; }
                            }
                            svg { max-width: 100%; height: auto; display: inline-block; }
                        </style>
                    </head>
                    <body style="text-align: center;">
                        <div style="text-align: center; margin-bottom: 10px; font-weight: bold; font-size: 20px;">${part.name}</div>
                        <div style="display: inline-block; text-align: center;">
                            ${barcodeEl.innerHTML}
                        </div>
                        <script>
                            window.onload = () => { window.print(); window.close(); }
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

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
        setShowDatasheet(!!part.datasheetUrl);
    }, [part.id, part.datasheetUrl]);

    const isSplitView = !isInline && !!part.datasheetUrl;

    return (
        <div className={cn(
            "rounded-xl",
            isInline ? "p-4 bg-secondary/20 mt-4 animate-in slide-in-from-top-2 duration-200" : "animate-in fade-in duration-500 overflow-hidden h-full flex flex-col"
        )}>
            <div className={cn(
                "grid grid-cols-1",
                isSplitView ? "lg:grid-cols-2 xl:grid-cols-[450px_1fr] flex-1 min-h-0" : ""
            )}>
                {/* Left Column: Details */}
                <div className={cn(
                    "p-6 space-y-6 flex flex-col",
                    isSplitView ? "border-r border-border/50 bg-secondary/5 h-full overflow-y-auto" : ""
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

                    {part.description && (
                        <div className="space-y-2">
                            <p className="text-[10px] text-muted-foreground uppercase">Description</p>
                            <p className="text-sm text-foreground/80 leading-relaxed">{part.description}</p>
                        </div>
                    )}

                    {part.upc && (
                        <div className="space-y-2 mt-2">
                            <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5">
                                <BarcodeIcon size={12} /> Barcode / UPC
                            </p>
                            <div className="relative p-4 bg-white rounded-xl flex items-center justify-center shadow-sm overflow-hidden border border-border/50 group/barcode">
                                <div id="barcode-svg-container">
                                    <Barcode 
                                        value={part.upc} 
                                        format="CODE128" 
                                        width={2} 
                                        height={50} 
                                        displayValue={true} 
                                        background="#ffffff" 
                                        lineColor="#000000"
                                        margin={0}
                                    />
                                </div>
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/barcode:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-[2px]">
                                    <button
                                        onClick={handleCopyUPC}
                                        className="p-3 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all hover:scale-110 flex items-center justify-center"
                                        title="Copy UPC"
                                    >
                                        {copiedUPC ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
                                    </button>
                                    <button
                                        onClick={handlePrintBarcode}
                                        className="p-3 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all hover:scale-110 flex items-center justify-center"
                                        title="Print Barcode"
                                    >
                                        <Printer size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 mt-auto">
                        {!isSplitView && (
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
                        )}

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
                </div>

                {/* Right Column: PDF Preview */}
                {(showDatasheet || isSplitView) && part.datasheetUrl && (
                    <div className={cn(
                        "animate-in slide-in-from-right-4 duration-500 h-full",
                        isSplitView ? "bg-background/20" : "p-6"
                    )}>
                        <PDFViewer url={part.datasheetUrl} title={`${part.name} Datasheet`} />
                    </div>
                )}
            </div>

            {/* Enlarged Image Portal */}
            {isEnlarged && part.imageUrl && createPortal(
                <div 
                    className="fixed inset-0 z-[20000] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
                    onClick={() => setIsEnlarged(false)}
                >
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
                    <button 
                        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
                        onClick={() => setIsEnlarged(false)}
                    >
                        <X size={24} />
                    </button>
                    <div className="relative w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-300">
                        <img 
                            src={part.imageUrl} 
                            alt={part.name} 
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
