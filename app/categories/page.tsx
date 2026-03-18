import { prisma } from "../../lib/prisma";
import CategoryList from "../../components/CategoryList";
import { getCategories } from "../actions/categories";
import { getLocations } from "../actions/locations";

export default async function CategoriesPage() {
    const categories = await prisma.category.findMany({
        include: {
            parts: {
                include: {
                    category: true,
                    storageLocation: {
                        include: {
                            parent: true
                        }
                    },
                    stockLevels: {
                        orderBy: { id: 'desc' },
                        take: 1
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    });

    const allCategories = await getCategories();
    const allLocations = await getLocations();

    return (
        <div className="flex-1 flex flex-col space-y-6 overflow-hidden h-full">
            <div className="shrink-0">
                <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
                <p className="text-muted-foreground">Manage your part classification and view parts by category.</p>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
                <CategoryList
                    initialCategories={categories}
                    allCategories={allCategories}
                    allLocations={allLocations}
                />
            </div>
        </div>
    );
}
