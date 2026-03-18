import { prisma } from "../../lib/prisma";
import { Search, Filter } from "lucide-react";
import PartsList from "../../components/PartsList";
import { getCategories } from "../actions/categories";
import { getLocations } from "../actions/locations";

export default async function PartsPage() {
    const parts = await prisma.part.findMany({
        include: {
            category: true,
            storageLocation: {
                include: {
                    parent: true
                }
            },
            stockLevels: {
                orderBy: {
                    id: 'desc'
                },
                take: 1
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    const categories = await getCategories();
    const locations = await getLocations();

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Parts Catalog</h1>
                    <p className="text-muted-foreground">Search and manage your component inventory.</p>
                </div>
            </div>

            <PartsList initialParts={parts} categories={categories} locations={locations} />
        </div>
    );
}
