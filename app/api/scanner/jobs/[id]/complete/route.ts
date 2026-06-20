import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { authenticateScannerRequest } from "../../../../../../lib/scanner-auth";
import { revalidatePath } from "next/cache";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // 1. Authenticate Request
    const user = await authenticateScannerRequest(request);
    if (!user) {
        return new NextResponse(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    const jobId = params.id;

    try {
        await prisma.$transaction(async (tx) => {
            // 2. Fetch Job details with BOMs and their items
            const job = await tx.job.findUnique({
                where: { id: jobId },
                include: {
                    boms: {
                        include: {
                            bom: {
                                include: {
                                    items: true
                                }
                            }
                        }
                    }
                }
            });

            if (!job) throw new Error("Job not found");
            if (job.status === "COMPLETED") throw new Error("Job is already completed");

            // 3. Calculate total required deductions for each part
            const partDeductions: Record<string, number> = {};

            for (const jobBom of job.boms) {
                const jobQuantity = jobBom.quantity;
                if (!jobBom.bom) continue;

                for (const item of jobBom.bom.items) {
                    if (item.partId) {
                        const deduction = item.quantity * jobQuantity;
                        partDeductions[item.partId] = (partDeductions[item.partId] || 0) + deduction;
                    }
                }
            }

            // Fetch part names for logs
            const parts = await tx.part.findMany({
                where: { id: { in: Object.keys(partDeductions) } },
                select: { id: true, name: true }
            });
            const partMap = new Map<string, string>(parts.map(p => [p.id, p.name]));

            // 4. Decrement StockLevel for each part and log activity
            for (const partId of Object.keys(partDeductions)) {
                const deduction = partDeductions[partId];
                const partName = partMap.get(partId) || 'Unknown Part';

                const stockLevels = await tx.stockLevel.findMany({
                    where: { partId },
                    orderBy: { id: "desc" },
                    take: 1
                });

                if (stockLevels.length > 0) {
                    const primaryStockLevel = stockLevels[0];
                    await tx.stockLevel.update({
                        where: { id: primaryStockLevel.id },
                        data: {
                            quantity: {
                                decrement: deduction
                            }
                        }
                    });

                    await tx.activityLog.create({
                        data: {
                            type: "STOCK_DEDUCT",
                            description: `Deducted ${deduction} units from ${partName} for job completion via mobile scanner.`,
                            partId,
                            jobId: jobId,
                            userId: user.id
                        }
                    });
                }
            }

            // 5. Delete all pulls associated with this job
            await tx.jobPartPull.deleteMany({
                where: { jobId }
            });

            // 6. Update job status to COMPLETED
            await tx.job.update({
                where: { id: jobId },
                data: { status: "COMPLETED" }
            });

            // 7. Log Job completion activity
            await tx.activityLog.create({
                data: {
                    type: "JOB_COMPLETED",
                    description: `Completed job: ${job.name} via mobile scanner.`,
                    jobId: jobId,
                    userId: user.id
                }
            });
        });

        // 8. Revalidate routes to refresh Next.js cache
        revalidatePath("/jobs");
        revalidatePath("/parts");
        revalidatePath("/");

        return new NextResponse(
            JSON.stringify({ success: true }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error: any) {
        console.error("Error completing job:", error);
        return new NextResponse(
            JSON.stringify({ error: error.message || "Failed to complete Job" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
