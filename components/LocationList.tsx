"use client";

import { useState, useEffect, useMemo } from "react";
import { MapPin, Search, Edit3, Trash2, Plus, Package, Hash, X, ChevronDown, ChevronRight, Palette, Check, FileText } from "lucide-react";
import { updateLocation, deleteLocation, addLocation } from "../app/actions/locations";
import { deletePart } from "../app/actions/parts";
import EditPartModal from "./EditPartModal";
import AddPartModal from "./AddPartModal";
import PartDetails from "./PartDetails";

interface Part {
    id: string;
    name: string;
    description: string | null;
    datasheetUrl: string | null;
    categoryId: string;
    storageLocationId: string;
    category: { name: string };
    storageLocation: {
        name: string;
        color: string | null;
        parent?: { id: string; name: string; color: string | null } | null;
    };
    stockLevels: { quantity: number }[];
    reorderLink: string | null;
    minStock: number;
    lowStockAlertEnabled: boolean;
    imageUrl: string | null;
}

interface LocationParent {
    id: string;
    name: string;
    color: string | null;
    parentId: string | null;
}

interface Location {
    id: string;
    name: string;
    color: string | null;
    parentId: string | null;
    parts: Part[];
    parent?: LocationParent | null;
    children?: Location[];
}

interface LocationListProps {
    initialLocations: Location[];
    allCategories: { id: string; name: string; parentId?: string | null }[];
    allLocations: { id: string; name: string }[];
}

const PRESET_COLORS = []; // Removed for spectrum picker

export default function LocationList({ initialLocations, allCategories, allLocations }: LocationListProps) {
    const [locationSearch, setLocationSearch] = useState("");
    const [partSearch, setPartSearch] = useState("");
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(initialLocations[0] || null);
    const [selectedPart, setSelectedPart] = useState<Part | null>(null);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState<string | null>(null);
    const [editParentId, setEditParentId] = useState<string | null>(null);

    const [newLocationName, setNewLocationName] = useState("");
    const [newLocationParentId, setNewLocationParentId] = useState<string>("");
    const [newLocationColor, setNewLocationColor] = useState<string | null>(null);

    const [editingPart, setEditingPart] = useState<Part | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

    const categoryPaths = useMemo(() => {
        const paths: Record<string, string> = {};
        const getPath = (id: string): string => {
            const cat = allCategories.find(c => c.id === id);
            if (!cat) return "";
            const parentPath = cat.parentId ? getPath(cat.parentId) : "";
            return parentPath ? `${parentPath} > ${cat.name}` : cat.name;
        };
        allCategories.forEach(cat => {
            paths[cat.id] = getPath(cat.id);
        });
        return paths;
    }, [allCategories]);

    // Organize locations into hierarchy and calculate recursive counts
    const hierarchicalLocations = useMemo(() => {
        const query = locationSearch.toLowerCase();
        const rootLocations = initialLocations.filter(l => !l.parentId);

        const buildHierarchy = (locs: Location[]): any[] => {
            return locs.map(loc => {
                const children = initialLocations.filter(l => l.parentId === loc.id);
                const subHierarchy = buildHierarchy(children);
                
                // Recursive parts: self + all children's parts
                const getRecursiveParts = (l: Location, allLocs: Location[]): Part[] => {
                    const directParts = l.parts;
                    const childLocs = allLocs.filter(child => child.parentId === l.id);
                    const childParts = childLocs.flatMap(child => getRecursiveParts(child, allLocs));
                    return [...directParts, ...childParts];
                };

                const recursiveParts = getRecursiveParts(loc, initialLocations);

                return {
                    ...loc,
                    children: subHierarchy,
                    recursivePartCount: recursiveParts.length,
                    allRecursiveParts: recursiveParts
                };
            }).filter(loc => 
                loc.name.toLowerCase().includes(query) || 
                (loc.children && loc.children.some((child: any) => child.name.toLowerCase().includes(query)))
            );
        };

        return buildHierarchy(rootLocations);
    }, [initialLocations, locationSearch]);

    // Filter parts within selected location (including children if it's a parent)
    const filteredParts = useMemo(() => {
        if (!selectedLocation) return [];
        const query = partSearch.toLowerCase();

        const getRecursiveParts = (l: Location, allLocs: Location[]): Part[] => {
            const directParts = l.parts;
            const childLocs = allLocs.filter(child => child.parentId === l.id);
            const childParts = childLocs.flatMap(child => getRecursiveParts(child, allLocs));
            return [...directParts, ...childParts];
        };

        const allParts = getRecursiveParts(selectedLocation, initialLocations);

        return allParts.filter(part =>
            part.name.toLowerCase().includes(query) ||
            (categoryPaths[part.categoryId] || "").toLowerCase().includes(query) ||
            part.description?.toLowerCase().includes(query)
        );
    }, [selectedLocation, initialLocations, partSearch, categoryPaths]);

    // Synchronize selectedLocation and selectedPart with the latest data from props
    useEffect(() => {
        // 1. Sync selectedLocation with fresh data from initialLocations
        if (selectedLocation) {
            const freshLoc = initialLocations.find(l => l.id === selectedLocation.id);
            if (freshLoc && freshLoc !== selectedLocation) {
                setSelectedLocation(freshLoc);
                setNewLocationParentId(freshLoc.id);
                setNewLocationColor(freshLoc.color);
            }
        }

        // 2. Sync selectedPart after filteredParts has potentially re-calculated
        if (selectedPart) {
            const freshPart = filteredParts.find(p => p.id === selectedPart.id);
            if (freshPart) {
                if (freshPart !== selectedPart) {
                    setSelectedPart(freshPart);
                }
            } else {
                // If it's no longer in the filtered list (e.g. search changed or location changed), deselect
                setSelectedPart(null);
            }
        }
    }, [initialLocations, filteredParts, selectedLocation?.id, partSearch]);

    const handleEdit = (location: Location) => {
        setIsEditing(location.id);
        setEditName(location.name);
        setEditColor(location.color);
        setEditParentId(location.parentId);
    };

    const handleSave = async (id: string) => {
        const result = await updateLocation(id, editName, editParentId || undefined, editColor || undefined);
        if (result.success) {
            setIsEditing(null);
        } else {
            alert(result.error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this location?")) return;
        const result = await deleteLocation(id);
        if (!result.success) {
            alert(result.error);
        }
    };

    const handleCreate = async () => {
        if (!newLocationName.trim()) return;

        // Split by comma and filter out empty strings
        const names = newLocationName.split(',').map(n => n.trim()).filter(n => n !== "");
        
        if (names.length === 0) return;

        let anySuccess = false;
        let lastError = "";

        for (const name of names) {
            const result = await addLocation(name, newLocationParentId || undefined, newLocationColor || undefined);
            if (result.success) {
                anySuccess = true;
            } else {
                lastError = result.error;
            }
        }

        if (anySuccess) {
            setNewLocationName("");
            // Keep newLocationParentId for further bulk actions
            setNewLocationColor(null);
        }

        if (lastError && !anySuccess) {
            alert(lastError);
        } else if (lastError) {
            alert(`Some locations failed to create: ${lastError}`);
        }
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expandedParents);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedParents(next);
    };

    const renderLocation = (location: any, depth = 0) => {
        const isSel = selectedLocation?.id === location.id;
        const hasChildren = location.children && location.children.length > 0;
        const isExp = expandedParents.has(location.id);

        return (
            <div key={location.id} className="space-y-1">
                {isEditing === location.id ? (
                    <div className={cn("glass p-3 rounded-xl space-y-3 ring-1 ring-primary/50 min-w-fit", depth > 0 && "ml-4 md:ml-6")}>
                        <div className="flex items-center gap-2">
                            <input
                                autoFocus
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="flex-1 bg-secondary/50 rounded-lg px-3 py-1.5 text-xs outline-none border border-transparent focus:border-primary"
                            />
                            <button onClick={() => handleSave(location.id)} className="p-2 bg-primary rounded-lg text-primary-foreground hover:opacity-90 transition-opacity">
                                <Check size={14} />
                            </button>
                            <button onClick={() => setIsEditing(null)} className="p-2 bg-secondary rounded-lg text-muted-foreground hover:bg-secondary/80 transition-colors">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="relative group/edit">
                                    <input
                                        type="color"
                                        value={editColor || "#4b5563"}
                                        onChange={(e) => setEditColor(e.target.value)}
                                        className="h-6 w-6 rounded-md cursor-pointer bg-transparent border-none appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
                                    />
                                    <Palette size={10} className="absolute inset-0 m-auto pointer-events-none text-white mix-blend-difference opacity-50 group-hover/edit:opacity-100 transition-opacity" />
                                </div>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Theme Color</span>
                            </div>
                            <select
                                value={editParentId || ""}
                                onChange={(e) => setEditParentId(e.target.value || null)}
                                className="flex-1 bg-secondary/50 rounded-lg px-2 py-1.5 text-[10px] outline-none border border-transparent focus:border-primary cursor-pointer appearance-none"
                            >
                                <option value="">No Parent (Root)</option>
                                {allLocations.filter(c => c.id !== location.id).map(c => (
                                    <option key={c.id} value={c.id}>Parent: {c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={() => setSelectedLocation(location)}
                        className={cn(
                            "glass rounded-xl cursor-pointer transition-all border group relative min-w-fit",
                            isSel ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-primary/30',
                            depth > 2 ? "p-2" : "p-3"
                        )}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                                <div className="flex items-center gap-0.5">
                                    {hasChildren ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleExpand(location.id); }}
                                            className="p-0.5 hover:bg-secondary rounded transition-colors"
                                        >
                                            {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                    ) : (
                                        <div className="w-5" />
                                    )}
                                </div>
                                <div
                                    className="h-3 w-3 rounded-full shrink-0 shadow-sm border border-white/10"
                                    style={{ backgroundColor: location.color || "#4b5563" }}
                                />
                                <div className="truncate">
                                    <p className="font-bold text-sm truncate">{location.name}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tight">
                                        {location.recursivePartCount} Total Parts
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleEdit(location); }}
                                    className="p-1 hover:bg-primary/20 hover:text-primary rounded transition-colors"
                                    title="Edit Location"
                                >
                                    <Edit3 size={12} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(location.id); }}
                                    className="p-1 hover:bg-destructive/20 hover:text-destructive rounded transition-colors"
                                    title="Delete Location"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {isExp && location.children && location.children.length > 0 && (
                    <div className={cn(
                        "pl-2 border-l border-primary/20 space-y-1 mt-1",
                        depth < 2 ? "ml-4 md:ml-6" : "ml-2 md:ml-3"
                    )}>
                        {location.children.map((child: any) => renderLocation(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 min-h-0 pb-2">
            {/* Column 1: Locations List (Lg: 3/12) */}
            <div className="lg:col-span-3 flex flex-col gap-4 min-h-0 h-full overflow-hidden">
                <div className="flex flex-col gap-2">
                    {/* Add Location Form */}
                    <div className="glass p-3 rounded-xl space-y-3">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="New location name..."
                                value={newLocationName}
                                onChange={(e) => setNewLocationName(e.target.value)}
                                className="flex-1 bg-secondary/50 rounded-lg px-3 py-1.5 text-xs outline-none border border-transparent focus:border-primary"
                            />
                            <button
                                onClick={handleCreate}
                                className="p-1.5 bg-primary rounded-lg text-primary-foreground hover:opacity-90 transition-opacity"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative group">
                                <input
                                    type="color"
                                    value={newLocationColor || "#4b5563"}
                                    onChange={(e) => setNewLocationColor(e.target.value)}
                                    className="h-8 w-8 rounded-lg cursor-pointer bg-transparent border-none appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                                />
                                <Palette size={12} className="absolute inset-0 m-auto pointer-events-none text-white mix-blend-difference opacity-50 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Select Theme</span>
                        </div>
                        <select
                            value={newLocationParentId}
                            onChange={(e) => {
                                const val = e.target.value;
                                setNewLocationParentId(val);
                                if (val) {
                                    const parent = initialLocations.find(l => l.id === val);
                                    if (parent?.color) setNewLocationColor(parent.color);
                                }
                            }}
                            className="w-full bg-secondary/50 rounded-lg px-2 py-1.5 text-[10px] outline-none border border-transparent focus:border-primary appearance-none cursor-pointer"
                        >
                            <option value="">No Parent (Root)</option>
                            {allLocations.map(l => (
                                <option key={l.id} value={l.id}>Parent: {l.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search Locations */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                        <input
                            type="text"
                            placeholder="Find location..."
                            value={locationSearch}
                            onChange={(e) => setLocationSearch(e.target.value)}
                            className="w-full pl-9 pr-8 py-1.5 bg-secondary/30 border border-transparent focus:border-primary/50 rounded-lg outline-none text-xs"
                        />
                        {locationSearch && (
                            <button onClick={() => setLocationSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-1 overflow-auto flex-1 min-h-0 custom-scrollbar p-1 pr-2 pb-2">
                    {hierarchicalLocations.length === 0 ? (
                        <div className="p-8 text-center glass rounded-xl text-muted-foreground text-xs">
                            No locations found.
                        </div>
                    ) : (
                        hierarchicalLocations.map(loc => renderLocation(loc))
                    )}
                </div>
            </div>

            {/* Column 2: Parts in Location */}
            <div className={cn(
                "transition-all duration-300 flex flex-col overflow-hidden h-full",
                selectedPart ? "lg:col-span-5" : "lg:col-span-9"
            )}>
                {selectedLocation ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2 shrink-0">
                            <div className="flex items-center gap-3 truncate">
                                <div
                                    className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center border-2 border-white/10"
                                    style={{ backgroundColor: selectedLocation.color || (selectedLocation.parent?.color) || "#4b5563" }}
                                >
                                    <MapPin size={12} className="text-white" />
                                </div>
                                <h2 className="text-xl font-bold truncate">
                                    {selectedLocation.parent && <span className="text-muted-foreground font-normal">{selectedLocation.parent.name} / </span>}
                                    {selectedLocation.name} Parts
                                </h2>
                                <button
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 shrink-0"
                                >
                                    <Plus size={14} />
                                    <span>Add Part to {selectedLocation.name}</span>
                                </button>
                                <button
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="sm:hidden p-1.5 bg-primary text-primary-foreground rounded-lg shadow-lg shadow-primary/20 shrink-0"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                <input
                                    type="text"
                                    placeholder={`Search in ${selectedLocation.name}...`}
                                    value={partSearch}
                                    onChange={(e) => setPartSearch(e.target.value)}
                                    className="w-full pl-9 pr-8 py-1.5 bg-secondary/50 border border-transparent focus:border-primary/50 rounded-lg outline-none text-xs glass"
                                />
                                {partSearch && (
                                    <button onClick={() => setPartSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {filteredParts.length === 0 ? (
                            <div className="glass p-12 text-center rounded-2xl text-muted-foreground flex flex-col items-center gap-4">
                                <Search size={32} className="opacity-20" />
                                <p>{partSearch ? 'No parts match your search.' : 'No parts found in this location.'}</p>
                            </div>
                        ) : (
                            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 custom-scrollbar p-1 pr-2 pb-2">
                                {filteredParts.map((part) => (
                                    <div
                                        key={part.id}
                                        onClick={() => setSelectedPart(part)}
                                        className={cn(
                                            "glass p-4 rounded-xl group cursor-pointer transition-all border",
                                            selectedPart?.id === part.id ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-primary/50'
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 truncate">
                                                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                                                    <Hash size={18} className="text-muted-foreground" />
                                                </div>
                                                <div className="truncate">
                                                    <p className="font-bold truncate flex items-center gap-2">
                                                        {part.name}
                                                        {part.datasheetUrl && (
                                                            <FileText size={12} className="text-blue-500 shrink-0" title="Datasheet Available" />
                                                        )}
                                                    </p>
                                                    {part.description && (
                                                        <p className="text-[10px] text-muted-foreground truncate italic">{part.description}</p>
                                                    )}
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                                        <Package size={10} /> {categoryPaths[part.categoryId]}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0">
                                                <div className="text-right hidden sm:block">
                                                    <p className="font-bold">{part.stockLevels[0]?.quantity || 0}</p>
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
                                                        <Edit3 size={14} />
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
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mobile Inline Details */}
                                        {selectedPart?.id === part.id && (
                                            <div className="lg:hidden mt-4">
                                                <PartDetails part={part} isInline={true} categoryPath={categoryPaths[part.categoryId]} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="glass p-12 text-center rounded-2xl text-muted-foreground flex flex-col items-center gap-4 h-full min-h-[300px] justify-center">
                        <MapPin size={48} className="opacity-20" />
                        <p>Select a location to view its parts.</p>
                    </div>
                )}
            </div>

            {/* Column 3: Part Details (Lg: 4/12) */}
            {selectedPart && (
                <div className="hidden lg:block lg:col-span-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="sticky top-24">
                        <PartDetails part={selectedPart} categoryPath={categoryPaths[selectedPart.categoryId]} />
                    </div>
                </div>
            )}

            {editingPart && (
                <EditPartModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setEditingPart(null);
                    }}
                    part={editingPart}
                    categories={allCategories}
                    locations={allLocations}
                />
            )}

            <AddPartModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                categories={allCategories}
                locations={allLocations}
                initialLocationId={selectedLocation.id}
            />
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(" ");
}
