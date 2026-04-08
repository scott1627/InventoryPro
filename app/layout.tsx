import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AddPartButton from "../components/AddPartButton";
import MobileNav from "../components/MobileNav";
import { getCategories } from "./actions/categories";
import { getLocations } from "./actions/locations";
import { cn } from "../lib/utils";
import { Providers } from "./providers";
import UserNav from "../components/UserNav";
import { getServerAuthSession } from "../lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "InventoryPro | Modern Parts Management",
    description: "Advanced inventory management for electronics labs",
};

const inter = Inter({ subsets: ["latin"] });

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const categories = await getCategories();
    const locations = await getLocations();
    const session = await getServerAuthSession();
    
    return (
        <html lang="en" className="dark bg-background">
            <body className={cn(inter.className, "h-screen gradient-bg text-foreground antialiased")}>
                <Providers session={session}>
                    {session ? (
                        <div className="flex h-screen flex-col overflow-hidden">
                            <header className="shrink-0 z-[999] w-full glass border-b">
                                <div className="container flex h-16 items-center justify-between px-4 mt-2 mb-2 lg:my-0">
                                    <div className="flex items-center gap-4">
                                        <MobileNav role={session?.user?.role} />
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                                                <span className="text-primary-foreground font-bold font-mono">IP</span>
                                            </div>
                                            <span className="text-xl font-bold tracking-tight hidden xs:block">InventoryPro</span>
                                        </div>
                                    </div>
                                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                                        <a href="/" className="transition-colors hover:text-primary">Dashboard</a>
                                        <a href="/parts" className="transition-colors hover:text-primary">Parts</a>
                                        <a href="/categories" className="transition-colors hover:text-primary">Categories</a>
                                        <a href="/locations" className="transition-colors hover:text-primary">Locations</a>
                                        <a href="/boms" className="transition-colors hover:text-primary">BOMs</a>
                                        <a href="/jobs" className="transition-colors hover:text-primary">Jobs</a>
                                        {session?.user?.role === "ADMIN" && (
                                        <>
                                            <a href="/users" className="transition-colors text-purple-500 hover:text-purple-400">Users</a>
                                            <a href="/admin/backup" className="transition-colors text-purple-500 hover:text-purple-400">Backup</a>
                                            <a href="/admin/docs" className="transition-colors text-purple-500 hover:text-purple-400">Docs</a>
                                        </>
                                    )}
                                    </nav>
                                    <div className="flex items-center gap-2">
                                        <AddPartButton categories={categories} locations={locations} />
                                        <UserNav />
                                    </div>
                                </div>
                            </header>
                            <main className="flex-1 container pt-6 pb-2 mx-auto px-4 flex flex-col overflow-y-auto min-h-0 custom-scrollbar">
                                {children}
                            </main>
                            <footer className="border-t shrink-0 py-3 md:px-8 md:py-0 glass mt-auto">
                                <div className="container flex flex-col items-center justify-between gap-4 md:h-12 md:flex-row mx-auto">
                                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                                        Built for the modern maker lab. Open source and self-hosted.
                                    </p>
                                </div>
                            </footer>
                        </div>
                    ) : (
                        <div className="h-screen w-full flex flex-col">
                            {children}
                        </div>
                    )}
                </Providers>
            </body>
        </html>
    );
}

