"use client";

import { useState } from "react";
import { Plus, Edit3, Trash2, Search, X, CheckCircle, Package } from "lucide-react";
import { createJob, deleteJob, updateJob, completeJob, addBOMToJob, removeBOMFromJob } from "../app/actions/jobs";
import { cn } from "../lib/utils";

interface BOM {
    id: string;
    name: string;
}

interface JobBOM {
    id: string;
    quantity: number;
    bomId: string;
    bom: BOM | null;
}

interface Job {
    id: string;
    name: string;
    description: string | null;
    status: "DRAFT" | "IN_PROGRESS" | "COMPLETED";
    boms: JobBOM[];
}

interface JobListProps {
    initialJobs: Job[];
    availableBOMs: BOM[];
}

const statusColors = {
    DRAFT: "bg-secondary text-secondary-foreground",
    IN_PROGRESS: "bg-blue-500/20 text-blue-500",
    COMPLETED: "bg-green-500/20 text-green-500"
};

export default function JobList({ initialJobs, availableBOMs }: JobListProps) {
    const [jobs, setJobs] = useState(initialJobs);
    const [selectedJob, setSelectedJob] = useState<Job | null>(initialJobs[0] || null);
    const [isCreating, setIsCreating] = useState(false);
    const [newJobName, setNewJobName] = useState("");
    const [newJobDesc, setNewJobDesc] = useState("");

    const [isAddingBOM, setIsAddingBOM] = useState(false);
    const [selectedBOMId, setSelectedBOMId] = useState("");
    const [newBOMQty, setNewBOMQty] = useState(1);

    const handleCreateJob = async () => {
        if (!newJobName) return;
        const result = await createJob(newJobName, newJobDesc);
        if (result.success && result.job) {
            setJobs([{ ...result.job, boms: [] } as Job, ...jobs]);
            setIsCreating(false);
            setNewJobName("");
            setNewJobDesc("");
        }
    };

    const handleDeleteJob = async (id: string) => {
        if (!confirm("Delete this Job?")) return;
        const result = await deleteJob(id);
        if (result.success) {
            setJobs(jobs.filter(j => j.id !== id));
            if (selectedJob?.id === id) setSelectedJob(null);
        }
    };

    const handleUpdateStatus = async (id: string, status: "DRAFT" | "IN_PROGRESS") => {
        const result = await updateJob(id, selectedJob!.name, selectedJob!.description || undefined, status);
        if (result.success) {
            const updated = jobs.map(j => j.id === id ? { ...j, status } : j);
            setJobs(updated);
            if (selectedJob?.id === id) setSelectedJob({ ...selectedJob, status });
        }
    };

    const handleCompleteJob = async (id: string) => {
        if (!confirm("Are you sure? This will permanently deduct the required parts from inventory.")) return;
        const result = await completeJob(id);
        if (result.success) {
            const updated = jobs.map(j => j.id === id ? { ...j, status: "COMPLETED" as "COMPLETED" } : j);
            setJobs(updated);
            if (selectedJob?.id === id) setSelectedJob({ ...selectedJob, status: "COMPLETED" });
            alert("Job completed! Stock has been deducted.");
        } else {
            alert(result.error);
        }
    };

    const handleAddBOM = async () => {
        if (!selectedJob || !selectedBOMId || newBOMQty < 1) return;
        const result = await addBOMToJob(selectedJob.id, selectedBOMId, newBOMQty);
        if (result.success) {
            const bom = availableBOMs.find(b => b.id === selectedBOMId);
            const newItem = { ...result.item, bom: bom || null } as any;
            const updatedJobs = jobs.map(j => j.id === selectedJob.id ? { ...j, boms: [...j.boms, newItem] } : j);
            setJobs(updatedJobs);
            setSelectedJob(updatedJobs.find(j => j.id === selectedJob.id) || null);
            setIsAddingBOM(false);
        }
    };

    const handleRemoveBOM = async (jobBomId: string) => {
        const result = await removeBOMFromJob(jobBomId);
        if (result.success && selectedJob) {
            const updatedJobs = jobs.map(j => j.id === selectedJob.id ? { ...j, boms: j.boms.filter(b => b.id !== jobBomId) } : j);
            setJobs(updatedJobs);
            setSelectedJob(updatedJobs.find(j => j.id === selectedJob.id) || null);
        }
    };

    return (
        <div className="flex gap-6 h-full min-h-0">
            {/* Jobs List Sidebar */}
            <div className="w-1/3 flex flex-col gap-4 min-h-0 glass p-4 rounded-xl border border-border/50">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-bold">Production Jobs</h2>
                    <button onClick={() => setIsCreating(true)} className="p-1.5 bg-primary/20 text-primary rounded-lg hover:bg-primary/30">
                        <Plus size={18} />
                    </button>
                </div>
                
                {isCreating && (
                    <div className="p-3 bg-secondary/50 rounded-lg space-y-2 border border-border">
                        <input 
                            placeholder="Job Name" 
                            className="w-full text-sm p-1.5 rounded bg-background border border-border" 
                            value={newJobName} onChange={e => setNewJobName(e.target.value)} 
                        />
                        <input 
                            placeholder="Description (Optional)" 
                            className="w-full text-xs p-1.5 rounded bg-background border border-border" 
                            value={newJobDesc} onChange={e => setNewJobDesc(e.target.value)} 
                        />
                        <div className="flex justify-end gap-2 text-xs">
                            <button onClick={() => setIsCreating(false)} className="px-2 py-1 text-muted-foreground">Cancel</button>
                            <button onClick={handleCreateJob} className="px-2 py-1 bg-primary text-primary-foreground rounded">Save</button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {jobs.map(job => (
                        <div 
                            key={job.id} 
                            onClick={() => setSelectedJob(job)}
                            className={`p-3 rounded-lg cursor-pointer border transition-colors flex justify-between items-start ${selectedJob?.id === job.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-secondary/50'}`}
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-medium text-sm truncate">{job.name}</h3>
                                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold", statusColors[job.status])}>
                                        {job.status}
                                    </span>
                                </div>
                                {job.description && <p className="text-[11px] text-muted-foreground line-clamp-2">{job.description}</p>}
                                <p className="text-[10px] text-muted-foreground mt-1">{job.boms.length} BOMs</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }} className="text-muted-foreground hover:text-destructive transition-colors ml-2">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Job Details Area */}
            <div className="flex-1 glass p-6 rounded-xl border border-border/50 flex flex-col min-h-0">
                {selectedJob ? (
                    <>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-2xl font-bold">{selectedJob.name}</h2>
                                    <span className={cn("text-xs px-2 py-1 rounded-full font-bold", statusColors[selectedJob.status])}>
                                        {selectedJob.status.replace('_', ' ')}
                                    </span>
                                </div>
                                {selectedJob.description && <p className="text-muted-foreground text-sm">{selectedJob.description}</p>}
                            </div>
                            
                            {selectedJob.status !== "COMPLETED" && (
                                <div className="flex items-center gap-2">
                                    <select 
                                        value={selectedJob.status} 
                                        onChange={e => handleUpdateStatus(selectedJob.id, e.target.value as "DRAFT" | "IN_PROGRESS")}
                                        className="px-3 py-1.5 bg-secondary text-sm rounded-lg border border-border"
                                    >
                                        <option value="DRAFT">Draft</option>
                                        <option value="IN_PROGRESS">In Progress</option>
                                    </select>
                                    
                                    <button 
                                        onClick={() => handleCompleteJob(selectedJob.id)} 
                                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-500 rounded-lg text-sm font-bold hover:bg-green-500/30 transition-colors"
                                    >
                                        <CheckCircle size={16} /> Complete & Deduct
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Required BOMs</h3>
                            {selectedJob.status !== "COMPLETED" && (
                                <button onClick={() => setIsAddingBOM(true)} className="flex items-center gap-2 px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs hover:opacity-90">
                                    <Plus size={14} /> Add BOM
                                </button>
                            )}
                        </div>

                        {isAddingBOM && (
                            <div className="mb-4 p-4 bg-secondary/30 rounded-xl border border-border flex items-end gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-medium mb-1 block">Select BOM</label>
                                    <select 
                                        value={selectedBOMId} 
                                        onChange={e => setSelectedBOMId(e.target.value)}
                                        className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                                    >
                                        <option value="">-- Choose a BOM --</option>
                                        {availableBOMs.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-24">
                                    <label className="text-xs font-medium mb-1 block">Quantity</label>
                                    <input 
                                        type="number" min="1" 
                                        value={newBOMQty} onChange={e => setNewBOMQty(parseInt(e.target.value) || 1)}
                                        className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsAddingBOM(false)} className="p-2 border border-border rounded-lg hover:bg-secondary">
                                        <X size={16} />
                                    </button>
                                    <button onClick={handleAddBOM} className="p-2 bg-primary text-primary-foreground rounded-lg">
                                        Add
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {selectedJob.boms.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                    <Package size={32} className="mb-2 opacity-50" />
                                    <p>No BOMs attached to this job yet.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 rounded-tl-lg">BOM Name</th>
                                            <th className="px-4 py-3 w-24">Produce Qty</th>
                                            <th className="px-4 py-3 rounded-tr-lg w-16 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedJob.boms.map(bom => (
                                            <tr key={bom.id} className="border-b border-border/50 hover:bg-secondary/10 last:border-0">
                                                <td className="px-4 py-3 font-medium">
                                                    {bom.bom ? bom.bom.name : <span className="text-destructive italic">Deleted BOM</span>}
                                                </td>
                                                <td className="px-4 py-3">{bom.quantity}x</td>
                                                <td className="px-4 py-3 text-right">
                                                    {selectedJob.status !== "COMPLETED" && (
                                                        <button onClick={() => handleRemoveBOM(bom.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-md">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
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
                        <Package size={48} className="mb-4 opacity-20" />
                        <p>Select a Job to view its details</p>
                    </div>
                )}
            </div>
        </div>
    );
}
