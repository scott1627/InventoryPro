import { prisma } from "../../lib/prisma";
import BOMList from "../../components/BOMList";

export default async function BOMsPage() {
    const boms = await prisma.bOM.findMany({
        include: {
            items: {
                include: {
                    part: true
                }
            }
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });

    const parts = await prisma.part.findMany({
        orderBy: { name: 'asc' }
    });

    return (
        <div className="flex-1 flex flex-col space-y-6 overflow-hidden h-full">
            <div className="shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bills of Materials</h1>
                    <p className="text-muted-foreground">Manage your BOM templates and parts lists.</p>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
                <BOMList initialBOMs={boms} availableParts={parts} />
            </div>
        </div>
    );
}
