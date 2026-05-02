"use client";

import { X, Plus } from "lucide-react";
import PartDetails from "./PartDetails";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

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

interface PartDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    part: Part | null;
    categoryPath?: string;
}

export default function PartDetailModal({ isOpen, onClose, part, categoryPath }: PartDetailModalProps) {
    // Prevent scrolling behind the modal
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen || !part) return null;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            
            {/* Modal Content */}
            <div className={cn(
                "relative bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col w-full",
                "max-h-[calc(100dvh-2rem)] sm:max-h-[90vh]",
                part.datasheetUrl ? "max-w-7xl" : "max-w-2xl"
            )}>
                {/* Header */}
                <div className="p-4 border-b border-border/50 flex items-center justify-between bg-secondary/20 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Plus size={18} />
                        </div>
                        <h3 className="font-bold">Part Details</h3>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Details Container - Scrollable */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <PartDetails part={part} categoryPath={categoryPath} isInline={false} />
                </div>
            </div>
        </div>,
        document.body
    );
}
