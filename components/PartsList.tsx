"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Edit3, Trash2, MapPin, Filter, X, FileText } from "lucide-react";
import PartDetails from "./PartDetails";
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
    minStock: number;
    lowStockAlertEnabled: boolean;
}

interface PartsListProps {
    initialParts: Part[];
    categories: { id: string; name: string; parentId?: string | null }[];
    locations: { id: string; name: string }[];
}

export default function PartsList({ initialParts, categories, locations }: PartsListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPart, setSelectedPart] = useState<Part | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPart, setEditingPart] = useState<Part | null>(null);

    const categoryPaths = useMemo(() => {
        const paths: Record<string, string> = {};
        const getPath = (id: string): string => {
            const cat = categories.find(c => c.id === id);
            if (!cat) return "";
            const parentPath = cat.parentId ? getPath(cat.parentId) : "";
            return parentPath ? `${parentPath} > ${cat.name}` : cat.name;
        };
        categories.forEach(cat => {
            paths[cat.id] = getPath(cat.id);
        });
        return paths;
    }, [categories]);

    const filteredParts = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return initialParts.filter(part =>
            part.name.toLowerCase().includes(query) ||
            (categoryPaths[part.categoryId] || "").toLowerCase().includes(query) ||
            part.storageLocation.name.toLowerCase().includes(query) ||
            part.description?.toLowerCase().includes(query)
        );
    }, [initialParts, searchQuery, categoryPaths]);

    // Unified selection logic: handle initial list, search updates, and empty results
    useEffect(() => {
        const isCurrentSelectedInFiltered = selectedPart && filteredParts.find(p => p.id === selectedPart.id);
        
        if (!isCurrentSelectedInFiltered) {
            // Either nothing was selected, or the selected part was filtered out
            setSelectedPart(filteredParts[0] || null);
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
                <button className="p-2.5 glass rounded-xl text-muted-foreground hover:text-foreground transition-colors">
                    <Filter size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
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
                                onClick={() => setSelectedPart(part)}
                                className={cn(
                                    "glass p-4 rounded-xl cursor-pointer transition-all border group relative",
                                    selectedPart?.id === part.id ? 'border-primary ring-1 ring-primary' : 'border-transparent'
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="font-bold flex items-center gap-2">
                                            {part.name}
                                            {part.datasheetUrl && (
                                                <FileText size={14} className="text-blue-500" title="Datasheet Available" />
                                            )}
                                        </h3>
                                        {part.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-1">{part.description}</p>
                                        )}
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-2">
                                                <div
                                                    className="h-2 w-2 rounded-full border border-white/10"
                                                    style={{ backgroundColor: part.storageLocation.color || part.storageLocation.parent?.color || "#4b5563" }}
                                                />
                                                <span className="flex items-center gap-1">
                                                    <MapPin size={10} />
                                                    {part.storageLocation.parent && <span className="text-muted-foreground">{part.storageLocation.parent.name} / </span>}
                                                    {part.storageLocation.name}
                                                </span>
                                            </span>
                                            <span className="bg-secondary px-2 py-0.5 rounded uppercase tracking-wider">{categoryPaths[part.categoryId]}</span>
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
                                {/* Mobile Inline Details */}
                                {selectedPart?.id === part.id && (
                                    <div className="lg:hidden">
                                        <PartDetails part={part} isInline={true} categoryPath={categoryPaths[part.categoryId]} />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="hidden lg:block space-y-6">
                    {selectedPart && <PartDetails part={selectedPart} categoryPath={categoryPaths[selectedPart.categoryId]} />}
                </div>

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
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(" ");
}
