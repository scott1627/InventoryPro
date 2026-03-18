"use client";

import { useState } from "react";
import { Plus, Edit3, Trash2, Search, X, Package, FileText } from "lucide-react";
import { createBOM, deleteBOM, updateBOM, addPartToBOM, updateBOMItemQuantity, removePartFromBOM } from "../app/actions/boms";

interface Part {
    id: string;
    name: string;
}

interface BOMItem {
    id: string;
    quantity: number;
    partId: string | null;
    part: Part | null;
}

interface BOM {
    id: string;
    name: string;
    description: string | null;
    items: BOMItem[];
}

interface BOMListProps {
    initialBOMs: BOM[];
    availableParts: Part[];
}

export default function BOMList({ initialBOMs, availableParts }: BOMListProps) {
    const [boms, setBoms] = useState(initialBOMs);
    const [selectedBOM, setSelectedBOM] = useState<BOM | null>(initialBOMs[0] || null);
    const [isCreating, setIsCreating] = useState(false);
    const [newBomName, setNewBomName] = useState("");
    const [newBomDesc, setNewBomDesc] = useState("");

    const [isAddingPart, setIsAddingPart] = useState(false);
    const [selectedPartId, setSelectedPartId] = useState("");
    const [newPartQty, setNewPartQty] = useState(1);

    const handleCreateBOM = async () => {
        if (!newBomName) return;
        const result = await createBOM(newBomName, newBomDesc);
        if (result.success && result.bom) {
            setBoms([...boms, { ...result.bom, items: [] }]);
            setIsCreating(false);
            setNewBomName("");
            setNewBomDesc("");
        }
    };

    const handleDeleteBOM = async (id: string) => {
        if (!confirm("Delete this BOM?")) return;
        const result = await deleteBOM(id);
        if (result.success) {
            setBoms(boms.filter(b => b.id !== id));
            if (selectedBOM?.id === id) setSelectedBOM(null);
        }
    };

    const handleAddPart = async () => {
        if (!selectedBOM || !selectedPartId || newPartQty < 1) return;
        const result = await addPartToBOM(selectedBOM.id, selectedPartId, newPartQty);
        if (result.success) {
            const part = availableParts.find(p => p.id === selectedPartId);
            const newItem = { ...result.item, part: part || null } as any;
            const updatedBoms = boms.map(b => b.id === selectedBOM.id ? { ...b, items: [...b.items, newItem] } : b);
            setBoms(updatedBoms);
            setSelectedBOM(updatedBoms.find(b => b.id === selectedBOM.id) || null);
            setIsAddingPart(false);
        }
    };

    const handleRemovePart = async (itemId: string) => {
        const result = await removePartFromBOM(itemId);
        if (result.success && selectedBOM) {
            const updatedBoms = boms.map(b => b.id === selectedBOM.id ? { ...b, items: b.items.filter(i => i.id !== itemId) } : b);
            setBoms(updatedBoms);
            setSelectedBOM(updatedBoms.find(b => b.id === selectedBOM.id) || null);
        }
    };

    return (
        <div className="flex gap-6 h-full min-h-0">
            {/* BOMs List Sidebar */}
            <div className="w-1/3 flex flex-col gap-4 min-h-0 glass p-4 rounded-xl border border-border/50">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-bold">BOM Templates</h2>
                    <button onClick={() => setIsCreating(true)} className="p-1.5 bg-primary/20 text-primary rounded-lg hover:bg-primary/30">
                        <Plus size={18} />
                    </button>
                </div>
                
                {isCreating && (
                    <div className="p-3 bg-secondary/50 rounded-lg space-y-2 border border-border">
                        <input 
                            placeholder="BOM Name" 
                            className="w-full text-sm p-1.5 rounded bg-background border border-border" 
                            value={newBomName} onChange={e => setNewBomName(e.target.value)} 
                        />
                        <input 
                            placeholder="Description (Optional)" 
                            className="w-full text-xs p-1.5 rounded bg-background border border-border" 
                            value={newBomDesc} onChange={e => setNewBomDesc(e.target.value)} 
                        />
                        <div className="flex justify-end gap-2 text-xs">
                            <button onClick={() => setIsCreating(false)} className="px-2 py-1 text-muted-foreground">Cancel</button>
                            <button onClick={handleCreateBOM} className="px-2 py-1 bg-primary text-primary-foreground rounded">Save</button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {boms.map(bom => (
                        <div 
                            key={bom.id} 
                            onClick={() => setSelectedBOM(bom)}
                            className={`p-3 rounded-lg cursor-pointer border transition-colors flex justify-between items-start ${selectedBOM?.id === bom.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-secondary/50'}`}
                        >
                            <div>
                                <h3 className="font-medium text-sm">{bom.name}</h3>
                                {bom.description && <p className="text-xs text-muted-foreground mt-0.5">{bom.description}</p>}
                                <p className="text-[10px] text-muted-foreground mt-1">{bom.items.length} items</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteBOM(bom.id); }} className="text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* BOM Details Area */}
            <div className="flex-1 glass p-6 rounded-xl border border-border/50 flex flex-col min-h-0">
                {selectedBOM ? (
                    <>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold">{selectedBOM.name}</h2>
                                {selectedBOM.description && <p className="text-muted-foreground text-sm mt-1">{selectedBOM.description}</p>}
                            </div>
                            <button onClick={() => setIsAddingPart(true)} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90">
                                <Plus size={16} /> Add Part
                            </button>
                        </div>

                        {isAddingPart && (
                            <div className="mb-6 p-4 bg-secondary/30 rounded-xl border border-border flex items-end gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-medium mb-1 block">Select Part</label>
                                    <select 
                                        value={selectedPartId} 
                                        onChange={e => setSelectedPartId(e.target.value)}
                                        className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                                    >
                                        <option value="">-- Choose a part --</option>
                                        {availableParts.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-24">
                                    <label className="text-xs font-medium mb-1 block">Quantity</label>
                                    <input 
                                        type="number" min="1" 
                                        value={newPartQty} onChange={e => setNewPartQty(parseInt(e.target.value) || 1)}
                                        className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsAddingPart(false)} className="p-2 border border-border rounded-lg hover:bg-secondary">
                                        <X size={16} />
                                    </button>
                                    <button onClick={handleAddPart} className="p-2 bg-primary text-primary-foreground rounded-lg">
                                        Add
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {selectedBOM.items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                    <Package size={32} className="mb-2 opacity-50" />
                                    <p>No parts added to this BOM yet.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 rounded-tl-lg">Part Details</th>
                                            <th className="px-4 py-3 w-24">Quantity</th>
                                            <th className="px-4 py-3 rounded-tr-lg w-16 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedBOM.items.map(item => (
                                            <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/10 last:border-0">
                                                <td className="px-4 py-3 font-medium">
                                                    {item.part ? item.part.name : <span className="text-destructive italic">Deleted Part</span>}
                                                </td>
                                                <td className="px-4 py-3">{item.quantity}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={() => handleRemovePart(item.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-md">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <FileText size={48} className="mb-4 opacity-20" />
                        <p>Select a BOM to view its details</p>
                    </div>
                )}
            </div>
        </div>
    );
}
