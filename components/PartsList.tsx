"use client";

import React, { useState, useMemo, useEffect, ReactNode } from "react";
import { Search, Edit3, Trash2, MapPin, Filter, X, FileText, Hash, Image as ImageIcon, AlertTriangle, Check, RotateCcw } from "lucide-react";
import PartDetailModal from "./PartDetailModal";
import EditPartModal from "./EditPartModal";
import { deletePart } from "../app/actions/parts";

interface Part {
    id: string;
    name: string;
    description: string | null;
    datasheetUrl: string | null;
    categoryId: string;
    storageLocationId: string;
    category: { id: string; name: string; parentId?: string | null };
    storageLocation: {
        name: string;
        color: string | null;
        parent?: { id: string; name: string; color: string | null } | null;
    };
    stockLevels: { quantity: number }[];
    reorderLink: string | null;
    imageUrl: string | null;
    minStock: number;
    lowStockAlertEnabled: boolean;
    upc: string | null;
    iconId: string | null;
}

interface PartsListProps {
    initialParts: Part[];
    categories: { id: string; name: string; parentId?: string | null }[];
    locations: { id: string; name: string }[];
}

export default function PartsList({ initialParts, categories, locations }: PartsListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPart, setSelectedPart] = useState<Part | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPart, setEditingPart] = useState<Part | null>(null);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState({
        missingDatasheet: false,
        missingImage: false,
        missingDescription: false,
        unassignedCategory: false,
        unassignedLocation: false,
        lowStock: false,
        exclusive: false
    });

    const categoryPaths = useMemo(() => {
        const paths: Record<string, string> = {};
        const catMap = new Map(categories.map(c => [c.id, c]));
        
        const getPath = (id: string, visited = new Set()): string => {
            if (paths[id]) return paths[id];
            if (visited.has(id)) return "...";
            visited.add(id);
            
            const cat = catMap.get(id);
            if (!cat) return "";
            
            const parentName = cat.parentId ? getPath(cat.parentId, visited) : "";
            const fullPath = parentName ? `${parentName} > ${cat.name}` : cat.name;
            paths[id] = fullPath;
            return fullPath;
        };

        categories.forEach(cat => getPath(cat.id));
        return paths;
    }, [categories]);

    const filteredParts = useMemo(() => {
        let result = initialParts;

        // 1. Search query filtering
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(part =>
                part.name.toLowerCase().includes(query) ||
                (categoryPaths[part.categoryId] || "").toLowerCase().includes(query) ||
                part.storageLocation.name.toLowerCase().includes(query) ||
                part.description?.toLowerCase().includes(query) ||
                part.upc?.toLowerCase().includes(query)
            );
        }

        // 2. Conditional filtering
        const filtersToApply = Object.entries(activeFilters).filter(([key, value]) => value && key !== 'exclusive');
        
        if (filtersToApply.length > 0) {
            result = result.filter(part => {
                const matches = filtersToApply.map(([key]) => {
                    switch(key) {
                        case 'missingDatasheet': return !part.datasheetUrl;
                        case 'missingImage': return !part.imageUrl;
                        case 'missingDescription': return !part.description || part.description.trim() === '';
                        case 'unassignedCategory': return part.category.name === "Unassigned";
                        case 'unassignedLocation': return part.storageLocation.name === "Unassigned";
                        case 'lowStock': return part.lowStockAlertEnabled && (part.stockLevels[0]?.quantity || 0) <= part.minStock;
                        default: return true;
                    }
                });

                if (activeFilters.exclusive) {
                    return matches.every(m => m);
                } else {
                    return matches.some(m => m);
                }
            });
        }

        return result;
    }, [initialParts, searchQuery, categoryPaths, activeFilters]);

    // Synchronize selectedPart with the latest data from filteredParts
    useEffect(() => {
        if (selectedPart) {
            const freshPart = filteredParts.find(p => p.id === selectedPart.id);
            if (freshPart) {
                // Only update if the object reference has changed (fresh data from prop update)
                if (freshPart !== selectedPart) {
                    setSelectedPart(freshPart);
                }
            } else {
                // Selected part was filtered out or deleted
                setSelectedPart(null);
                setIsDetailModalOpen(false);
            }
        }
    }, [filteredParts, selectedPart]);

    return (
        <div className="space-y-6">
            {/* Search Bar */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Search by part, category, or bin..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-secondary/50 border border-transparent focus:border-primary/50 rounded-xl outline-none transition-all glass text-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                
                <div className="relative">
                    <button 
                        onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                        className={cn(
                            "p-2.5 glass rounded-xl transition-all relative group",
                            Object.values(activeFilters).some(v => v) ? "text-primary border-primary/30 shadow-lg shadow-primary/10" : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Filter Parts"
                    >
                        <Filter size={20} />
                        {Object.entries(activeFilters).filter(([k,v]) => v && k !== 'exclusive').length > 0 && (
                            <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                                {Object.entries(activeFilters).filter(([k,v]) => v && k !== 'exclusive').length}
                            </span>
                        )}
                    </button>

                    {isFilterMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsFilterMenuOpen(false)} />
                            <div className="absolute right-0 mt-2 w-72 glass border border-primary/20 rounded-2xl shadow-2xl p-4 z-50 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-sm">Filter Parts</h3>
                                    <button 
                                        onClick={() => {
                                            setActiveFilters({
                                                missingDatasheet: false,
                                                missingImage: false,
                                                missingDescription: false,
                                                unassignedCategory: false,
                                                unassignedLocation: false,
                                                lowStock: false,
                                                exclusive: false
                                            });
                                        }}
                                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 uppercase font-bold tracking-wider"
                                    >
                                        <RotateCcw size={10} />
                                        Clear All
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <FilterOption 
                                        label="Missing Datasheet" 
                                        active={activeFilters.missingDatasheet} 
                                        onClick={() => setActiveFilters(f => ({ ...f, missingDatasheet: !f.missingDatasheet }))}
                                        icon={<FileText size={14} />}
                                    />
                                    <FilterOption 
                                        label="Missing Image" 
                                        active={activeFilters.missingImage} 
                                        onClick={() => setActiveFilters(f => ({ ...f, missingImage: !f.missingImage }))}
                                        icon={<ImageIcon size={14} />}
                                    />
                                    <FilterOption 
                                        label="Missing Description" 
                                        active={activeFilters.missingDescription} 
                                        onClick={() => setActiveFilters(f => ({ ...f, missingDescription: !f.missingDescription }))}
                                        icon={<Hash size={14} />}
                                    />
                                    <FilterOption 
                                        label="Unassigned Category" 
                                        active={activeFilters.unassignedCategory} 
                                        onClick={() => setActiveFilters(f => ({ ...f, unassignedCategory: !f.unassignedCategory }))}
                                        icon={<MapPin size={14} />}
                                    />
                                    <FilterOption 
                                        label="Unassigned Location" 
                                        active={activeFilters.unassignedLocation} 
                                        onClick={() => setActiveFilters(f => ({ ...f, unassignedLocation: !f.unassignedLocation }))}
                                        icon={<MapPin size={14} />}
                                    />
                                    <FilterOption 
                                        label="Low Stock Alert" 
                                        active={activeFilters.lowStock} 
                                        onClick={() => setActiveFilters(f => ({ ...f, lowStock: !f.lowStock }))}
                                        icon={<AlertTriangle size={14} />}
                                    />
                                </div>

                                <div className="mt-4 pt-4 border-t border-primary/10">
                                    <button 
                                        onClick={() => setActiveFilters(f => ({ ...f, exclusive: !f.exclusive }))}
                                        className={cn(
                                            "w-full flex items-center justify-between p-2 rounded-lg transition-all text-xs",
                                            activeFilters.exclusive ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-secondary/50 text-muted-foreground border border-transparent"
                                        )}
                                    >
                                        <span className="font-medium">Match All Criteria</span>
                                        <div className={cn(
                                            "w-8 h-4 rounded-full relative transition-colors duration-300",
                                            activeFilters.exclusive ? "bg-primary" : "bg-muted/30"
                                        )}>
                                            <div className={cn(
                                                "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-300 shadow-sm",
                                                activeFilters.exclusive ? "left-4.5" : "left-0.5"
                                            )} />
                                        </div>
                                    </button>
                                    <p className="px-2 mt-2 text-[10px] text-muted-foreground leading-tight italic">
                                        {activeFilters.exclusive 
                                            ? "Showing parts that meet ALL selected filters." 
                                            : "Showing parts that meet ANY selected filter."
                                        }
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {filteredParts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 glass rounded-2xl text-center space-y-4">
                        <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center">
                            <Search className="text-muted-foreground" size={32} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">No results found</h2>
                            <p className="text-muted-foreground">Adjust your search to find what you're looking for.</p>
                        </div>
                    </div>
                ) : (
                    filteredParts.map((part) => (
                        <div
                            key={part.id}
                            onClick={() => {
                                setSelectedPart(part);
                                setIsDetailModalOpen(true);
                            }}
                            className={cn(
                                "glass-light p-4 rounded-xl cursor-pointer transition-all border group relative",
                                selectedPart?.id === part.id ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-primary/50'
                            )}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 truncate">
                                    <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                                        {part.iconId ? (
                                            <img src={`/api/icons/${part.iconId}`} alt="Icon" className="h-full w-full object-contain p-1 bg-white" />
                                        ) : (
                                            <Hash size={18} className="text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="space-y-1 truncate">
                                        <h3 className="font-bold flex items-center gap-2 truncate">
                                            <span className="truncate">{part.name}</span>
                                            {part.datasheetUrl && (
                                                <span title="Datasheet Available">
                                                    <FileText size={14} className="text-blue-500 shrink-0" />
                                                </span>
                                            )}
                                        </h3>
                                        {part.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-1 italic">{part.description}</p>
                                        )}
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground truncate">
                                            <span className="flex items-center gap-1.5 truncate">
                                                <div
                                                    className="h-2 w-2 rounded-full border border-white/10 shrink-0"
                                                    style={{ backgroundColor: part.storageLocation.color || part.storageLocation.parent?.color || "#4b5563" }}
                                                />
                                                <span className="flex items-center gap-1 truncate font-medium">
                                                    <MapPin size={10} />
                                                    {part.storageLocation.parent && <span className="opacity-60">{part.storageLocation.parent.name} / </span>}
                                                    {part.storageLocation.name}
                                                </span>
                                            </span>
                                            <span className="bg-secondary/80 px-2 py-0.5 rounded uppercase tracking-tighter text-[9px] font-bold border border-white/5">{categoryPaths[part.categoryId]}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-sm font-bold">{part.stockLevels[0]?.quantity || 0}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase">Qty</p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingPart(part);
                                                setIsEditModalOpen(true);
                                            }}
                                            className="p-1.5 hover:bg-primary/20 hover:text-primary rounded-md transition-colors"
                                            title="Edit Part"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (confirm(`Are you sure you want to delete ${part.name}?`)) {
                                                    await deletePart(part.id);
                                                }
                                            }}
                                            className="p-1.5 hover:bg-destructive/20 hover:text-destructive rounded-md transition-colors"
                                            title="Delete Part"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <PartDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                part={selectedPart}
                categoryPath={selectedPart ? categoryPaths[selectedPart.categoryId] : undefined}
            />

            {editingPart && (
                <EditPartModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setEditingPart(null);
                    }}
                    part={editingPart}
                    categories={categories}
                    locations={locations}
                />
            )}
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(" ");
}

interface FilterOptionProps {
    label: string;
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
}

function FilterOption({ label, active, onClick, icon }: FilterOptionProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between p-2 rounded-lg transition-all group/opt",
                active ? "bg-primary/20 text-primary" : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
            )}
        >
            <div className="flex items-center gap-2 text-xs font-medium">
                <div className={cn(
                    "transition-colors",
                    active ? "text-primary" : "text-muted-foreground group-hover/opt:text-foreground"
                )}>
                    {icon}
                </div>
                {label}
            </div>
            <div className={cn(
                "h-4 w-4 rounded border transition-all flex items-center justify-center",
                active ? "bg-primary border-primary" : "border-muted-foreground/30 group-hover/opt:border-muted-foreground/50"
            )}>
                {active && <Check size={10} className="text-primary-foreground stroke-[4]" />}
            </div>
        </button>
    );
}
