import { Package, MapPin, AlertTriangle, CheckCircle2, Clock, PackagePlus, PlusCircle, MinusCircle, Trash2 } from "lucide-react";
import { prisma } from "../lib/prisma";

export default async function Home() {
    const totalParts = await prisma.part.count();
    const totalLocations = await prisma.storageLocation.count();
    const activeJobs = await prisma.job.count({
        where: {
            status: 'IN_PROGRESS'
        }
    });

    const partsWithAlerts = await prisma.part.findMany({
        where: {
            lowStockAlertEnabled: true
        },
        include: {
            stockLevels: {
                orderBy: {
                    id: 'desc'
                },
                take: 1
            }
        }
    });

    const allLowStockParts = partsWithAlerts.filter(part => {
        const qty = part.stockLevels[0]?.quantity || 0;
        return qty <= part.minStock;
    });

    const lowStockCount = allLowStockParts.length;
    const lowStockParts = allLowStockParts.slice(0, 3);

    const activityLogs = await prisma.activityLog.findMany({
        orderBy: {
            createdAt: 'desc'
        },
        include: {
            user: {
                select: {
                    username: true
                }
            }
        },
        take: 15
    });

    const stats = [
        { label: "Total Parts", value: totalParts.toLocaleString(), icon: Package, color: "text-blue-500" },
        { label: "Low Stock", value: lowStockCount.toString(), icon: AlertTriangle, color: "text-amber-500" },
        { label: "Locations", value: totalLocations.toString(), icon: MapPin, color: "text-purple-500" },
        { label: "Active Jobs", value: activeJobs.toString(), icon: CheckCircle2, color: "text-green-500" },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
                <p className="text-muted-foreground">Welcome back! Here is a quick look at your lab status.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, i) => (
                    <div key={i} className="glass p-6 rounded-xl space-y-2 border border-border/50 hover:border-primary/20 transition-colors">
                        <div className="flex items-center justify-between">
                            <stat.icon className={stat.color} size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                            <h3 className="text-2xl font-bold">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-7">
                <div className="md:col-span-4 glass p-6 rounded-xl border border-border/50">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-blue-500" /> Recent Activity
                    </h2>
                    <div className="space-y-3">
                        {activityLogs.length > 0 ? (
                            activityLogs.map((log) => {
                                const iconMap: Record<string, any> = {
                                    PART_CREATED: PackagePlus,
                                    STOCK_ADD: PlusCircle,
                                    STOCK_DEDUCT: MinusCircle,
                                    JOB_COMPLETED: CheckCircle2,
                                    PART_DELETED: Trash2,
                                };

                                const colorMap: Record<string, string> = {
                                    PART_CREATED: "text-blue-500 bg-blue-500/10",
                                    STOCK_ADD: "text-green-500 bg-green-500/10",
                                    STOCK_DEDUCT: "text-amber-500 bg-amber-500/10",
                                    JOB_COMPLETED: "text-emerald-500 bg-emerald-500/10",
                                    PART_DELETED: "text-red-500 bg-red-500/10",
                                };

                                const Icon = iconMap[log.type] || Package;
                                const colorClasses = colorMap[log.type] || "text-primary bg-primary/10";
                                const [colorClass, bgClass] = colorClasses.split(" ");

                                return (
                                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50 hover:border-primary/20 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 ${bgClass} rounded-full flex items-center justify-center shrink-0`}>
                                            <Icon className={colorClass} size={18} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium">{log.type.replace(/_/g, ' ')}</p>
                                                {log.user && (
                                                    <span className="text-sm font-bold text-primary">
                                                        by {log.user.username}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mr-4 line-clamp-2">
                                                {log.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                );
                            })
                        ) : (
                            <div className="space-y-4 text-center py-8">
                                <div className="h-12 w-12 bg-secondary rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Package className="text-muted-foreground" size={24} />
                                </div>
                                <p className="text-muted-foreground text-sm">Activity tracking will appear here as you update your inventory.</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="md:col-span-3 glass p-6 rounded-xl border border-border/50">
                    <h2 className="text-lg font-semibold mb-4 text-amber-500 flex items-center gap-2">
                        <AlertTriangle size={18} /> Low Stock Alerts
                    </h2>
                    <div className="space-y-4">
                        {lowStockParts.length > 0 ? (
                            lowStockParts.map((part, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                    <div>
                                        <p className="text-sm font-medium">{part.name}</p>
                                        <p className="text-xs text-muted-foreground">Available: {part.stockLevels[0]?.quantity || 0} / min {part.minStock}</p>
                                    </div>
                                    {part.reorderLink ? (
                                        <a 
                                            href={part.reorderLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                                        >
                                            Reorder
                                        </a>
                                    ) : (
                                        <button className="text-xs font-semibold text-muted-foreground cursor-not-allowed">Reorder</button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6">
                                <CheckCircle2 className="text-green-500 mx-auto mb-2" size={24} />
                                <p className="text-xs text-muted-foreground">All stock levels are healthy.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
