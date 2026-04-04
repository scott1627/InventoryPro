"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Folder, MapPin, Edit3, Trash2, Plus, ChevronRight, ChevronDown, Hash, Package, X, FileText, Check } from "lucide-react";
import { updateCategory, deleteCategory, addCategory } from "../app/actions/categories";
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
    imageUrl?: string | null;
}

interface Category {
    id: string;
    name: string;
    parentId: string | null;
    parts: Part[];
    children?: Category[];
    recursivePartCount?: number;
}

interface CategoryListProps {
    initialCategories: Category[];
    allCategories: { id: string; name: string; parentId?: string | null }[];
    allLocations: { id: string; name: string }[];
}

export default function CategoryList({ initialCategories, allCategories, allLocations }: CategoryListProps) {
    const [categorySearch, setCategorySearch] = useState("");
    const [partSearch, setPartSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(initialCategories[0] || null);
    const [selectedPart, setSelectedPart] = useState<Part | null>(null);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editParentId, setEditParentId] = useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryParentId, setNewCategoryParentId] = useState<string>("");
    const [editingPart, setEditingPart] = useState<Part | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Organize categories into hierarchy and calculate recursive counts
    const hierarchicalCategories = useMemo(() => {
        const query = categorySearch.toLowerCase();
        const rootCategories = initialCategories.filter(c => !c.parentId);

        const buildHierarchy = (cats: Category[]): any[] => {
            return cats.map(cat => {
                const children = initialCategories.filter(c => c.parentId === cat.id);
                const subHierarchy = buildHierarchy(children);
                
                // Recursive parts: self + all children's parts
                const getRecursiveParts = (c: Category, allCats: Category[]): Part[] => {
                    const directParts = c.parts;
                    const childCats = allCats.filter(child => child.parentId === c.id);
                    const childParts = childCats.flatMap(child => getRecursiveParts(child, allCats));
                    return [...directParts, ...childParts];
                };

                const recursiveParts = getRecursiveParts(cat, initialCategories);

                return {
                    ...cat,
                    children: subHierarchy,
                    recursivePartCount: recursiveParts.length,
                    allRecursiveParts: recursiveParts
                };
            }).filter(cat => 
                cat.name.toLowerCase().includes(query) || 
                (cat.children && cat.children.some((child: any) => child.name.toLowerCase().includes(query)))
            );
        };

        return buildHierarchy(rootCategories);
    }, [initialCategories, categorySearch]);

    // Filter parts within selected category (including children)
    const filteredParts = useMemo(() => {
        if (!selectedCategory) return [];
        const query = partSearch.toLowerCase();
        
        const getRecursiveParts = (c: Category, allCats: Category[]): Part[] => {
            const directParts = c.parts;
            const childCats = allCats.filter(child => child.parentId === c.id);
            const childParts = childCats.flatMap(child => getRecursiveParts(child, allCats));
            return [...directParts, ...childParts];
        };

        const allParts = getRecursiveParts(selectedCategory, initialCategories);

        return allParts.filter(part =>
            part.name.toLowerCase().includes(query) ||
            part.storageLocation.name.toLowerCase().includes(query) ||
            part.description?.toLowerCase().includes(query)
        );
    }, [selectedCategory, initialCategories, partSearch]);

    // Reset selected part when category or part search changes
    useEffect(() => {
        setSelectedPart(null);
        if (selectedCategory) {
            setNewCategoryParentId(selectedCategory.id);
        }
    }, [selectedCategory?.id, partSearch]);

    const handleEdit = (category: Category) => {
        setIsEditing(category.id);
        setEditName(category.name);
        setEditParentId(category.parentId);
    };

    const handleSave = async (id: string) => {
        const result = await updateCategory(id, editName, editParentId);
        if (result.success) {
            setIsEditing(null);
        } else {
            alert(result.error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this category?")) return;
        const result = await deleteCategory(id);
        if (!result.success) {
            alert(result.error);
        }
    };

    const handleCreate = async () => {
        if (!newCategoryName.trim()) return;
        const result = await addCategory(newCategoryName, newCategoryParentId || undefined);
        if (result.success) {
            setNewCategoryName("");
        } else {
            alert(result.error);
        }
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expandedCategories);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedCategories(next);
    };

    const renderCategory = (category: any, depth = 0) => {
        const isSel = selectedCategory?.id === category.id;
        const hasChildren = category.children && category.children.length > 0;
        const isExp = expandedCategories.has(category.id);

        return (
            <div key={category.id} className="space-y-1">
                {isEditing === category.id ? (
                    <div className={cn("glass p-3 rounded-xl space-y-3 ring-1 ring-primary/50", depth > 0 && "ml-4 md:ml-6")}>
                        <div className="flex items-center gap-2">
                            <input
                                autoFocus
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="flex-1 bg-secondary/50 rounded-lg px-3 py-1.5 text-xs outline-none border border-transparent focus:border-primary"
                            />
                            <button onClick={() => handleSave(category.id)} className="p-2 bg-primary rounded-lg text-primary-foreground hover:opacity-90 transition-opacity">
                                <Check size={14} />
                            </button>
                            <button onClick={() => setIsEditing(null)} className="p-2 bg-secondary rounded-lg text-muted-foreground hover:bg-secondary/80 transition-colors">
                                <X size={14} />
                            </button>
                        </div>
                        <select
                            value={editParentId || ""}
                            onChange={(e) => setEditParentId(e.target.value || null)}
                            className="w-full bg-secondary/50 rounded-lg px-2 py-1.5 text-[10px] outline-none border border-transparent focus:border-primary cursor-pointer appearance-none"
                        >
                            <option value="">No Parent (Root)</option>
                            {allCategories.filter(c => c.id !== category.id).map(c => (
                                <option key={c.id} value={c.id}>Parent: {c.name}</option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div
                        onClick={() => setSelectedCategory(category)}
                        className={cn(
                            "glass rounded-xl cursor-pointer transition-all border group relative",
                            isSel ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-primary/30',
                            depth > 2 ? "p-2" : "p-3"
                        )}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                                <div className="flex items-center gap-0.5">
                                    {hasChildren ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleExpand(category.id); }}
                                            className="p-0.5 hover:bg-secondary rounded transition-colors"
                                        >
                                            {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                    ) : (
                                        <div className="w-5" />
                                    )}
                                </div>
                                <Folder className={cn("shrink-0", isSel ? "text-primary" : "text-muted-foreground")} size={18} />
                                <div className="truncate">
                                    <p className="font-bold text-sm truncate">{category.name}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{category.recursivePartCount} Parts</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleEdit(category); }}
                                    className="p-1 hover:bg-primary/20 hover:text-primary rounded transition-colors"
                                    title="Edit Category"
                                >
                                    <Edit3 size={12} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(category.id); }}
                                    className="p-1 hover:bg-destructive/20 hover:text-destructive rounded transition-colors"
                                    title="Delete Category"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {isExp && category.children && category.children.length > 0 && (
                    <div className={cn(
                        "pl-2 border-l border-primary/20 space-y-1 mt-1",
                        depth < 2 ? "ml-4 md:ml-6" : "ml-2 md:ml-3"
                    )}>
                        {category.children.map((child: any) => renderCategory(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 min-h-0 pb-2">
            {/* Column 1: Categories List */}
            <div className="lg:col-span-3 flex flex-col gap-4 min-h-0 h-full overflow-hidden">
                <div className="flex flex-col gap-2">
                    {/* Add Category */}
                    <div className="glass p-3 rounded-xl space-y-3">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="New category name..."
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="flex-1 bg-secondary/50 rounded-lg px-3 py-1.5 text-xs outline-none border border-transparent focus:border-primary"
                            />
                            <button
                                onClick={handleCreate}
                                className="p-1.5 bg-primary rounded-lg text-primary-foreground hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        <select
                            value={newCategoryParentId}
                            onChange={(e) => setNewCategoryParentId(e.target.value)}
                            className="w-full bg-secondary/50 rounded-lg px-2 py-1.5 text-[10px] outline-none border border-transparent focus:border-primary appearance-none cursor-pointer"
                        >
                            <option value="">No Parent (Root)</option>
                            {allCategories.map(c => (
                                <option key={c.id} value={c.id}>Parent: {c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search Categories */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                        <input
                            type="text"
                            placeholder="Find category..."
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            className="w-full pl-9 pr-8 py-1.5 bg-secondary/30 border border-transparent focus:border-primary/50 rounded-lg outline-none text-xs"
                        />
                        {categorySearch && (
                            <button onClick={() => setCategorySearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-1 overflow-y-auto flex-1 min-h-0 custom-scrollbar p-1 pr-2 pb-2">
                    {hierarchicalCategories.length === 0 ? (
                        <div className="p-8 text-center glass rounded-xl text-muted-foreground text-xs">
                            No categories found.
                        </div>
                    ) : (
                        hierarchicalCategories.map(cat => renderCategory(cat))
                    )}
                </div>
            </div>

            {/* Column 2: Parts in Category */}
            <div className={cn(
                "transition-all duration-300 flex flex-col overflow-hidden h-full",
                selectedPart ? "lg:col-span-5" : "lg:col-span-9"
            )}>
                {selectedCategory ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2 shrink-0">
                            <div className="flex items-center gap-4 truncate">
                                <h2 className="text-xl font-bold flex items-center gap-2 truncate">
                                    <Package className="text-primary shrink-0" size={22} />
                                    <span className="truncate">{selectedCategory.name} Parts</span>
                                </h2>
                                <button
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 shrink-0"
                                >
                                    <Plus size={14} />
                                    <span>Add Part to {selectedCategory.name}</span>
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
                                    placeholder={`Search in ${selectedCategory.name}...`}
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
                                <p>{partSearch ? 'No parts match your search.' : 'No parts found in this category.'}</p>
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
                                                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                                                    {part.imageUrl ? (
                                                        <img src={part.imageUrl} alt={part.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <Hash size={18} className="text-muted-foreground" />
                                                    )}
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
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2 truncate">
                                                        <div
                                                            className="h-2 w-2 rounded-full border border-white/10 shrink-0"
                                                            style={{ backgroundColor: part.storageLocation.color || part.storageLocation.parent?.color || "#4b5563" }}
                                                        />
                                                        <span className="flex items-center gap-1 truncate">
                                                            <MapPin size={10} />
                                                            {part.storageLocation.parent && <span className="opacity-60">{part.storageLocation.parent.name} / </span>}
                                                            {part.storageLocation.name}
                                                        </span>
                                                    </div>
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
                                                <PartDetails part={part} isInline={true} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="glass p-12 text-center rounded-2xl text-muted-foreground flex flex-col items-center gap-4 h-full min-h-[300px] justify-center">
                        <Folder size={48} className="opacity-20" />
                        <p>Select a category to view its parts.</p>
                    </div>
                )}
            </div>

            {/* Column 3: Part Details */}
            {selectedPart && (
                <div className="hidden lg:block lg:col-span-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="sticky top-24">
                        <PartDetails part={selectedPart} />
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

            {selectedCategory && (
                <AddPartModal
                    isOpen={isAddModalOpen}
                    onClose={() => setIsAddModalOpen(false)}
                    categories={allCategories}
                    locations={allLocations}
                    initialCategoryId={selectedCategory.id}
                />
            )}
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(" ");
}
