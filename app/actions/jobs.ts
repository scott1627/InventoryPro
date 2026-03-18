"use server";

import { prisma } from "../../lib/prisma";
import { getServerAuthSession } from "../../lib/auth";
import { revalidatePath } from "next/cache";

export async function createJob(name: string, description?: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        const job = await prisma.job.create({
            data: {
                name,
                description,
                status: "DRAFT"
            }
        });
        await prisma.activityLog.create({
            data: {
                type: "JOB_CREATED",
                description: `Created new job: ${name}.`,
                jobId: job.id,
                userId: session.user.id
            }
        });
        revalidatePath("/jobs");
        return { success: true, job };
    } catch (error) {
        console.error("Error creating Job:", error);
        return { success: false, error: "Failed to create Job" };
    }
}

export async function updateJob(id: string, name: string, description?: string, status?: "DRAFT" | "IN_PROGRESS" | "COMPLETED") {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const job = await prisma.job.update({
            where: { id },
            data: {
                name,
                description,
                ...(status && { status })
            }
        });
        revalidatePath("/jobs");
        return { success: true, job };
    } catch (error) {
        console.error("Error updating Job:", error);
        return { success: false, error: "Failed to update Job" };
    }
}

export async function deleteJob(id: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        await prisma.job.delete({
            where: { id }
        });
        revalidatePath("/jobs");
        return { success: true };
    } catch (error) {
        console.error("Error deleting Job:", error);
        return { success: false, error: "Failed to delete Job" };
    }
}

export async function addBOMToJob(jobId: string, bomId: string, quantity: number) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const item = await prisma.jobBOM.create({
            data: {
                jobId,
                bomId,
                quantity
            }
        });
        revalidatePath("/jobs");
        return { success: true, item };
    } catch (error) {
        console.error("Error adding BOM to Job:", error);
        return { success: false, error: "Failed to add BOM to Job" };
    }
}

export async function updateJobBOMQuantity(jobBomId: string, quantity: number) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const item = await prisma.jobBOM.update({
            where: { id: jobBomId },
            data: { quantity }
        });
        revalidatePath("/jobs");
        return { success: true, item };
    } catch (error) {
        console.error("Error updating Job BOM quantity:", error);
        return { success: false, error: "Failed to update Job BOM quantity" };
    }
}

export async function removeBOMFromJob(jobBomId: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        await prisma.jobBOM.delete({
            where: { id: jobBomId }
        });
        revalidatePath("/jobs");
        return { success: true };
    } catch (error) {
        console.error("Error removing BOM from Job:", error);
        return { success: false, error: "Failed to remove BOM from Job" };
    }
}

export async function completeJob(id: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        // Run in transaction to ensure atomicity
        await prisma.$transaction(async (tx) => {
            const job = await tx.job.findUnique({
                where: { id },
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

            // Calculate total deductions for each part
            const partDeductions: Record<string, number> = {};

            for (const jobBom of job.boms) {
                const jobQuantity = jobBom.quantity;
                for (const item of jobBom.bom.items) {
                    if (item.partId) {
                        const deduction = item.quantity * jobQuantity;
                        partDeductions[item.partId] = (partDeductions[item.partId] || 0) + deduction;
                    }
                }
            }

            const parts = await tx.part.findMany({
                where: { id: { in: Object.keys(partDeductions) } },
                select: { id: true, name: true }
            });
            const partMap = new Map<string, { id: string, name: string }>(parts.map(p => [p.id, p as any]));

            // Deduct stock levels for each part
            for (const partId of Object.keys(partDeductions)) {
                const deduction = partDeductions[partId];
                const partName = partMap.get(partId)?.name || 'Unknown Part';
                // Find primary stock level
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
                            description: `Deducted ${deduction} units from ${partName} for job completion.`,
                            partId,
                            jobId: id,
                            userId: session.user.id
                        }
                    });
                }
            }

            // Update job status to completed
            await tx.job.update({
                where: { id },
                data: { status: "COMPLETED" }
            });

            await tx.activityLog.create({
                data: {
                    type: "JOB_COMPLETED",
                    description: `Completed job: ${job.name}.`,
                    jobId: id,
                    userId: session.user.id
                }
            });
        });

        revalidatePath("/jobs");
        revalidatePath("/parts");
        revalidatePath("/");
        
        return { success: true };
    } catch (error: any) {
        console.error("Error completing Job:", error);
        return { success: false, error: error.message || "Failed to complete Job" };
    }
}
