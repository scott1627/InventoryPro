import { ClipboardList } from "lucide-react";

export default function Loading() {
    return (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-background/30 backdrop-blur-sm animate-fade-in">
            <div className="relative flex flex-col items-center gap-6">
                {/* Logo Animation */}
                <div className="relative flex items-center justify-center">
                    <ClipboardList className="w-24 h-24 text-primary animate-pulse" />
                </div>

                {/* Subtext and Loader Line */}
                <div className="flex flex-col items-center gap-3">
                    <span className="text-xl font-bold tracking-tight text-foreground/90">InventoryPro</span>
                    <div className="h-1 w-48 bg-secondary/50 rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-loading-bar" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest animate-pulse">
                        Preparing your workspace
                    </span>
                </div>
            </div>
        </div>
    );
}
