export default function Loading() {
    return (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-background/30 backdrop-blur-sm animate-fade-in">
            <div className="relative flex flex-col items-center gap-6">
                {/* Logo Animation */}
                <div className="relative h-20 w-20">
                    {/* Pulsing Outer Ring */}
                    <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping duration-[2000ms]" />
                    
                    {/* Main Logo Card */}
                    <div className="absolute inset-0 rounded-2xl bg-primary shadow-2xl shadow-primary/40 flex items-center justify-center animate-pulse">
                        <span className="text-4xl font-bold font-mono text-primary-foreground tracking-tighter">IP</span>
                    </div>
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
