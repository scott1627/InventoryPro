"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import AddPartModal from "./AddPartModal";

interface AddPartButtonProps {
    categories: { id: string; name: string }[];
    locations: { id: string; name: string }[];
}

export default function AddPartButton({ categories, locations }: AddPartButtonProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-primary/20"
            >
                <Plus size={16} />
                Add Part
            </button>

            <AddPartModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                categories={categories}
                locations={locations}
            />
        </>
    );
}
