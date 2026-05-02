"use client";

import { useState, useEffect, useRef } from "react";
import { getIcons, addIcon } from "../app/actions/icons";
import { Upload, X, Loader2, Check } from "lucide-react";
import { cn } from "../lib/utils";

interface IconData {
    id: string;
    name: string;
    type: string;
}

interface IconPickerProps {
    value: string | null;
    onChange: (id: string | null) => void;
    className?: string;
}

export default function IconPicker({ value, onChange, className }: IconPickerProps) {
    const [icons, setIcons] = useState<IconData[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchIcons = async () => {
        setIsLoading(true);
        const result = await getIcons();
        if (result.success && result.icons) {
            setIcons(result.icons);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (isOpen && icons.length === 0) {
            fetchIcons();
        }
    }, [isOpen]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        const result = await addIcon(formData);
        if (result.success && result.icon) {
            setIcons([result.icon, ...icons]);
            onChange(result.icon.id);
            setIsOpen(false);
        } else {
            alert(result.error || "Failed to upload icon");
        }
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const selectedIcon = icons.find(i => i.id === value);

    // Initial fetch to get selected icon details if needed
    useEffect(() => {
        if (value && icons.length === 0) {
            fetchIcons();
        }
    }, [value]);

    return (
        <div className={cn("relative", className)}>
            <input type="hidden" name="iconId" value={value || ""} />
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="w-full flex items-center justify-between px-4 py-3 bg-secondary/40 rounded-xl border border-border/50 hover:bg-secondary/60 transition-colors text-sm text-foreground/80 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
                <div className="flex items-center gap-3">
                    {value ? (
                        <div className="w-6 h-6 rounded flex items-center justify-center overflow-hidden">
                            <img src={`/api/icons/${value}`} alt="Icon" className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded bg-secondary flex items-center justify-center border border-dashed border-border text-muted-foreground/50 text-xs">?</div>
                    )}
                    <span>{selectedIcon ? selectedIcon.name : "Select an icon..."}</span>
                </div>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
                    <div className="relative bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-border/50">
                            <h3 className="font-semibold text-lg">Choose Icon</h3>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            {isLoading ? (
                                <div className="flex justify-center p-8 text-muted-foreground">
                                    <Loader2 className="animate-spin" size={24} />
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 gap-3">
                                    {icons.map((icon) => (
                                        <button
                                            key={icon.id}
                                            type="button"
                                            onClick={() => {
                                                onChange(icon.id);
                                                setIsOpen(false);
                                            }}
                                            className={cn(
                                                "aspect-square relative flex items-center justify-center rounded-xl border transition-all p-2",
                                                value === icon.id 
                                                    ? "border-primary ring-2 ring-primary/20 bg-primary/5" 
                                                    : "border-border/50 hover:border-primary/50 hover:bg-secondary/50"
                                            )}
                                        >
                                            <img src={`/api/icons/${icon.id}`} alt={icon.name} className="w-full h-full object-contain" />
                                            {value === icon.id && (
                                                <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                                                    <Check size={12} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                    
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="aspect-square flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition-all p-2 gap-1"
                                    >
                                        {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                                        <span className="text-[10px] font-medium text-center leading-tight">Upload</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {value && (
                            <div className="p-4 border-t border-border/50 bg-secondary/20">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(null);
                                        setIsOpen(false);
                                    }}
                                    className="w-full py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors font-medium"
                                >
                                    Remove Icon
                                </button>
                            </div>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleUpload}
                            accept="image/svg+xml,image/png,image/jpeg"
                            className="hidden"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
