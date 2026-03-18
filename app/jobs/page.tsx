import { prisma } from "../../lib/prisma";
import JobList from "../../components/JobList";

export default async function JobsPage() {
    const jobs = await prisma.job.findMany({
        include: {
            boms: {
                include: {
                    bom: true
                }
            }
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });

    const boms = await prisma.bOM.findMany({
        orderBy: { name: 'asc' }
    });

    return (
        <div className="flex-1 flex flex-col space-y-6 overflow-hidden h-full">
            <div className="shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Active Jobs</h1>
                    <p className="text-muted-foreground">Manage production jobs and automatically deduct stock.</p>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
                <JobList initialJobs={jobs} availableBOMs={boms} />
            </div>
        </div>
    );
}
