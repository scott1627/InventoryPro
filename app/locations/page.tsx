import { prisma } from "../../lib/prisma";
import LocationList from "../../components/LocationList";
import { getCategories } from "../actions/categories";
import { getLocations } from "../actions/locations";

export default async function LocationsPage() {
    const locations = await prisma.storageLocation.findMany({
        include: {
            parent: true,
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
                <h1 className="text-3xl font-bold tracking-tight">Storage Locations</h1>
                <p className="text-muted-foreground">Manage your bin locations and view parts by storage area.</p>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
                <LocationList
                    initialLocations={locations}
                    allCategories={allCategories}
                    allLocations={allLocations}
                />
            </div>
        </div>
    );
}
