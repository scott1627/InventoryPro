"use client";

import { useState, useMemo, useEffect } from "react";
import { MapPin, ChevronRight, ChevronDown, Check, Search, X } from "lucide-react";

interface Location {
    id: string;
    name: string;
    color?: string | null;
    parentId?: string | null;
}

interface LocationPickerProps {
    locations: Location[];
    value: string | null;
    onSelect: (id: string | null) => void;
    placeholder?: string;
    excludeId?: string;
}

export default function LocationPicker({ locations, value, onSelect, placeholder = "Select Location...", excludeId }: LocationPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // Build hierarchy
    const hierarchicalLocations = useMemo(() => {
        // Function to check if a location is or is a descendant of excludeId
        const isForbidden = (locId: string): boolean => {
            if (!excludeId) return false;
            if (locId === excludeId) return true;
            
            const loc = locations.find(l => l.id === locId);
            if (!loc || !loc.parentId) return false;
            return isForbidden(loc.parentId);
        };

        const build = (parentId: string | null = null): any[] => {
            return locations
                .filter(l => l.parentId === parentId)
                .filter(l => !excludeId || !isForbidden(l.id))
                .map(l => ({
                    ...l,
                    children: build(l.id)
                }));
        };
        return build(null);
    }, [locations, excludeId]);

    // Get current selection path for the display
    const currentPath = useMemo(() => {
        if (!value) return null;
        const getPath = (id: string): string[] => {
            const loc = locations.find(l => l.id === id);
            if (!loc) return [];
            return [...getPath(loc.parentId || null), loc.name].filter(Boolean);
        };
        const pathArr = getPath(value);
        return pathArr.length > 0 ? pathArr.join(" > ") : null;
    }, [value, locations]);

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(expanded);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpanded(next);
    };

    const renderNode = (node: any, depth = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExp = expanded.has(node.id) || search.length > 0;
        const isSel = value === node.id;
        
        // Simple search filtering (showing node if its name matches or any of its children match)
        const matchesSearch = (n: any): boolean => {
            if (n.name.toLowerCase().includes(search.toLowerCase())) return true;
            if (n.children && n.children.some((c: any) => matchesSearch(c))) return true;
            return false;
        };

        if (search && !matchesSearch(node)) return null;

        return (
            <div key={node.id} className="space-y-1">
                <div
                    onClick={() => {
                        onSelect(node.id);
                        setIsOpen(false);
                    }}
                    className={cn(
                        "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors group",
                        isSel ? "bg-primary text-primary-foreground font-bold" : "hover:bg-secondary text-foreground"
                    )}
                    style={{ marginLeft: `${depth * 1.5}rem` }}
                >
                    <div className="flex items-center gap-1 shrink-0">
                        {hasChildren ? (
                            <button
                                type="button"
                                onClick={(e) => toggleExpand(node.id, e)}
                                className={cn(
                                    "p-0.5 rounded hover:bg-black/10 transition-colors",
                                    isSel ? "text-primary-foreground/70" : "text-muted-foreground"
                                )}
                            >
                                {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        ) : (
                            <div className="w-5" />
                        )}
                        <div 
                            className={cn(
                                "h-3 w-3 rounded-full shrink-0 shadow-sm border border-white/10",
                                isSel ? "border-white/30" : ""
                            )}
                            style={{ backgroundColor: node.color || "#4b5563" }}
                        />
                    </div>
                    <span className="text-sm truncate">{node.name}</span>
                    {isSel && <Check size={14} className="ml-auto shrink-0" />}
                </div>
                {isExp && node.children && node.children.map((child: any) => renderNode(child, depth + 1))}
            </div>
        );
    };

    return (
        <div className="relative w-full">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-2.5 bg-secondary/50 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all flex items-center justify-between gap-2 text-left group"
            >
                <div className="flex items-center gap-2 truncate">
                    <MapPin size={14} className="text-primary shrink-0" />
                    <span className={cn("truncate text-sm", !value && "text-muted-foreground")}>
                        {currentPath || placeholder}
                    </span>
                </div>
                <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-[10001]" 
                        onClick={() => setIsOpen(false)} 
                    />
                    <div className="absolute top-full left-0 right-0 mt-2 z-[10002] bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[400px]">
                        <div className="p-3 border-b border-border bg-secondary/30 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Filter locations..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-8 py-1.5 bg-background border border-transparent focus:border-primary/50 rounded-lg outline-none text-xs"
                                />
                                {search && (
                                    <button 
                                        type="button"
                                        onClick={() => setSearch("")} 
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="p-2 overflow-y-auto custom-scrollbar flex-1 space-y-1">
                            {/* None / Root Option */}
                            <div
                                onClick={() => {
                                    onSelect(null);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors group mb-1 border-b border-border/50",
                                    !value ? "bg-primary text-primary-foreground font-bold" : "hover:bg-secondary text-foreground"
                                )}
                            >
                                <div className="w-5 flex items-center justify-center">
                                    <X size={14} className={cn(!value ? "text-primary-foreground/70" : "text-muted-foreground/50")} />
                                </div>
                                <span className="text-sm">None (Root Location)</span>
                                {!value && <Check size={14} className="ml-auto shrink-0" />}
                            </div>

                            {hierarchicalLocations.length === 0 && !search ? (
                                <div className="p-4 text-center text-xs text-muted-foreground italic">
                                    No locations available.
                                </div>
                            ) : (
                                hierarchicalLocations.map(loc => renderNode(loc))
                            )}

                            {hierarchicalLocations.length === 0 && search && (
                                <div className="p-4 text-center text-xs text-muted-foreground italic">
                                    No locations match your search.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
            <input type="hidden" name="storageLocationId" value={value || ""} />
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(" ");
}
