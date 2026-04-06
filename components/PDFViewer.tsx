"use client";

import { useEffect, useState } from "react";

interface PDFViewerProps {
    url: string;
    title: string;
}

export default function PDFViewer({ url, title }: PDFViewerProps) {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <div className="flex flex-col h-full bg-card rounded-xl overflow-hidden border">
            <div className="p-4 border-b flex items-center justify-between bg-muted/50">
                <h3 className="font-semibold text-sm truncate">{title}</h3>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline font-medium"
                >
                    Open External
                </a>
            </div>
            <div className="flex-1 relative">
                {!isLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-card">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                )}
                <iframe
                    src={url}
                    className="w-full h-full border-none rounded-b-xl"
                    onLoad={() => setIsLoaded(true)}
                    title={title}
                />
            </div>
        </div>
    );
}
