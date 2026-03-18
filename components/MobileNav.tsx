"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Menu, X, Layout, Package, Tag, MapPin, Layers, FileText } from "lucide-react";
import { cn } from "../lib/utils";

const NAV_LINKS = [
    { name: "Dashboard", href: "/", icon: <Layers size={18} /> },
    { name: "Parts", href: "/parts", icon: <Package size={18} /> },
    { name: "Categories", href: "/categories", icon: <Tag size={18} /> },
    { name: "Locations", href: "/locations", icon: <MapPin size={18} /> },
    { name: "BOMs", href: "/boms", icon: <FileText size={18} /> },
    { name: "Jobs", href: "/jobs", icon: <Layers size={18} /> },
];

export default function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent scrolling when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
    }, [isOpen]);

    if (!mounted) return null;

    const navContent = (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Menu */}
            <div
                className={cn(
                    "fixed top-0 left-0 z-[1001] h-full w-[280px] border-r border-white/10 shadow-2xl transition-transform duration-300 ease-out",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
                style={{ backgroundColor: '#09090b', opacity: 1 }}
            >
                <div className="flex flex-col h-full" style={{ backgroundColor: '#09090b' }}>
                    <div className="flex items-center justify-between p-6 border-b border-white/10" style={{ backgroundColor: '#131316' }}>
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
                                <span className="text-primary-foreground font-bold text-[10px] font-mono">IP</span>
                            </div>
                            <span className="font-bold tracking-tight">Navigation</span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-white/10 rounded-md transition-colors text-muted-foreground"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <nav className="p-4 space-y-2">
                        {NAV_LINKS.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-primary/10 hover:text-primary transition-all text-sm font-medium group active:scale-95"
                            >
                                <span className="text-muted-foreground group-hover:text-primary transition-colors">
                                    {link.icon}
                                </span>
                                {link.name}
                            </a>
                        ))}
                    </nav>

                    <div className="p-6 border-t border-white/10 mt-auto" style={{ backgroundColor: '#131316' }}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-4 opacity-50">InventoryPro v1.0</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <a href="#" className="hover:text-foreground">Docs</a>
                            <a href="#" className="hover:text-foreground">GitHub</a>
                            <a href="#" className="hover:text-foreground">Settings</a>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <div className="md:hidden">
            <button
                onClick={() => setIsOpen(true)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Toggle Menu"
            >
                <Menu size={24} />
            </button>
            {createPortal(navContent, document.body)}
        </div>
    );
}
