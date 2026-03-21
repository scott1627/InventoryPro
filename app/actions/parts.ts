"use server";

import { prisma } from "../../lib/prisma";
import { getServerAuthSession } from "../../lib/auth";
import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import path from "node:path";

export async function addPart(formData: FormData) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const name = formData.get("name") as string;
        const categoryId = formData.get("categoryId") as string;
        const storageLocationId = formData.get("locationId") as string;
        const storageAreaId = formData.get("storageAreaId") as string;
        const stock = parseInt(formData.get("stock") as string) || 0;
        const description = formData.get("description") as string;
        const minStock = parseInt(formData.get("minStock") as string) || 0;
        const lowStockAlertEnabled = formData.get("lowStockAlertEnabled") === "on";
        const reorderLink = formData.get("reorderLink") as string;

        // Handle datasheet upload
        const datasheet = formData.get("datasheet") as File;
        let datasheetUrl = null;
        if (datasheet && datasheet.size > 0) {
            const fileName = `${Date.now()}-${datasheet.name}`;
            datasheetUrl = `/uploads/datasheets/${fileName}`;
            const buffer = Buffer.from(await datasheet.arrayBuffer());
            const filePath = path.join(process.cwd(), "public", datasheetUrl);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, buffer);
        }

        // Handle image upload
        const image = formData.get("image") as File;
        let imageUrl = null;
        if (image && image.size > 0) {
            const fileName = `${Date.now()}-${image.name}`;
            imageUrl = `/uploads/images/${fileName}`;
            const buffer = Buffer.from(await image.arrayBuffer());
            const filePath = path.join(process.cwd(), "public", imageUrl);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, buffer);
        }

        // Helper to ensure Unassigned fallback if IDs are missing
        let finalCategoryId = categoryId;
        if (!finalCategoryId) {
            let unassigned = await prisma.category.findFirst({
                where: { name: "Unassigned" }
            });
            if (!unassigned) {
                unassigned = await prisma.category.create({
                    data: { name: "Unassigned" }
                });
            }
            finalCategoryId = unassigned.id;
        }

        let finalLocationId = storageLocationId || storageAreaId;
        if (!finalLocationId) {
            let unassigned = await prisma.storageLocation.findFirst({
                where: { name: "Unassigned" }
            });
            if (!unassigned) {
                unassigned = await prisma.storageLocation.create({
                    data: { name: "Unassigned" }
                });
            }
            finalLocationId = unassigned.id;
        }

        // 3. Create the Part
        const part = await prisma.part.create({
            data: {
                name,
                description,
                datasheetUrl,
                imageUrl,
                category: { connect: { id: finalCategoryId } },
                storageLocation: { connect: { id: finalLocationId } },
                minStock,
                lowStockAlertEnabled,
                reorderLink,
                stockLevels: {
                    create: {
                        quantity: stock
                    }
                }
            }
        });

        await prisma.activityLog.create({
            data: {
                type: "PART_CREATED",
                description: `Created new part: ${name} with initial stock ${stock}.`,
                partId: part.id,
                userId: session.user.id
            }
        });

        revalidatePath("/parts");
        revalidatePath("/");

        return { success: true, part };
    } catch (error) {
        console.error("Error adding part:", error);
        return { success: false, error: "Failed to add part" };
    }
}

export async function updatePart(id: string, formData: FormData) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const name = formData.get("name") as string;
        const categoryId = formData.get("categoryId") as string;
        const storageLocationId = formData.get("locationId") as string;
        const storageAreaId = formData.get("storageAreaId") as string;
        const stock = parseInt(formData.get("stock") as string) || 0;
        const description = formData.get("description") as string;
        const minStock = parseInt(formData.get("minStock") as string) || 0;
        const lowStockAlertEnabled = formData.get("lowStockAlertEnabled") === "on";
        const reorderLink = formData.get("reorderLink") as string;

        const datasheet = formData.get("datasheet") as File;
        let datasheetUrl = undefined;
        if (datasheet && datasheet.size > 0) {
            const fileName = `${Date.now()}-${datasheet.name}`;
            datasheetUrl = `/uploads/datasheets/${fileName}`;
            const buffer = Buffer.from(await datasheet.arrayBuffer());
            const filePath = path.join(process.cwd(), "public", datasheetUrl);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, buffer);
        }

        const image = formData.get("image") as File;
        let imageUrl = undefined;
        if (image && image.size > 0) {
            const fileName = `${Date.now()}-${image.name}`;
            imageUrl = `/uploads/images/${fileName}`;
            const buffer = Buffer.from(await image.arrayBuffer());
            const filePath = path.join(process.cwd(), "public", imageUrl);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, buffer);
        }

        let finalCategoryId = categoryId;
        if (!finalCategoryId) {
            let unassigned = await prisma.category.findFirst({
                where: { name: "Unassigned" }
            });
            if (!unassigned) {
                unassigned = await prisma.category.create({
                    data: { name: "Unassigned" }
                });
            }
            finalCategoryId = unassigned.id;
        }

        let finalLocationId = storageLocationId || storageAreaId;
        if (!finalLocationId) {
            let unassigned = await prisma.storageLocation.findFirst({
                where: { name: "Unassigned" }
            });
            if (!unassigned) {
                unassigned = await prisma.storageLocation.create({
                    data: { name: "Unassigned" }
                });
            }
            finalLocationId = unassigned.id;
        }

        const oldPart = await prisma.part.findUnique({
            where: { id },
            include: { stockLevels: { orderBy: { id: "desc" }, take: 1 } }
        });
        const oldStock = oldPart?.stockLevels[0]?.quantity || 0;

        const part = await prisma.part.update({
            where: { id },
            data: {
                name,
                description,
                ...(datasheetUrl && { datasheetUrl }),
                ...(imageUrl && { imageUrl }),
                category: { connect: { id: finalCategoryId } },
                storageLocation: { connect: { id: finalLocationId } },
                minStock,
                lowStockAlertEnabled,
                reorderLink,
                stockLevels: {
                    create: {
                        quantity: stock
                    }
                }
            }
        });

        if (stock > oldStock) {
            await prisma.activityLog.create({
                data: {
                    type: "STOCK_ADD",
                    description: `Added ${stock - oldStock} units to ${name}.`,
                    partId: part.id,
                    userId: session.user.id
                }
            });
        } else if (stock < oldStock) {
            await prisma.activityLog.create({
                data: {
                    type: "STOCK_DEDUCT",
                    description: `Deducted ${oldStock - stock} units from ${name}.`,
                    partId: part.id,
                    userId: session.user.id
                }
            });
        }

        revalidatePath("/parts");
        revalidatePath("/");
        revalidatePath(`/categories`);
        revalidatePath(`/locations`);

        return { success: true, part };
    } catch (error) {
        console.error("Error updating part:", error);
        return { success: false, error: "Failed to update part" };
    }
}

export async function deletePart(id: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const part = await prisma.part.findUnique({
            where: { id },
            select: { name: true }
        });

        const name = part?.name || "Unknown Part";

        // Delete stock levels first (cascade) or let prisma handles it if configured
        await prisma.stockLevel.deleteMany({
            where: { partId: id }
        });

        // Prisma handles BOMItem partId SetNull via schema on delete

        await prisma.part.delete({
            where: { id }
        });

        await prisma.activityLog.create({
            data: {
                type: "PART_DELETED",
                description: `Deleted part: ${name}.`,
                userId: session.user.id
            }
        });

        revalidatePath("/parts");
        revalidatePath("/");
        revalidatePath(`/categories`);
        revalidatePath(`/locations`);

        return { success: true };
    } catch (error) {
        console.error("Error deleting part:", error);
        return { success: false, error: "Failed to delete part" };
    }
}

export async function adjustStock(partId: string, amount: number) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const part = await prisma.part.findUnique({
            where: { id: partId },
            include: { stockLevels: { orderBy: { id: "desc" }, take: 1 } }
        });

        if (!part) throw new Error("Part not found");

        const currentStock = part.stockLevels[0]?.quantity || 0;
        const newStock = currentStock + amount;

        if (newStock < 0) throw new Error("Stock cannot be negative");

        await prisma.stockLevel.create({
            data: {
                partId,
                quantity: newStock
            }
        });

        await prisma.activityLog.create({
            data: {
                type: amount > 0 ? "STOCK_ADD" : "STOCK_DEDUCT",
                description: `${amount > 0 ? "Added" : "Deducted"} ${Math.abs(amount)} units ${amount > 0 ? "to" : "from"} ${part.name} via quick adjustment.`,
                partId,
                userId: session.user.id
            }
        });

        revalidatePath("/parts");
        revalidatePath("/");
        revalidatePath(`/categories`);
        revalidatePath(`/locations`);

        return { success: true, newStock };
    } catch (error: any) {
        console.error("Error adjusting stock:", error);
        return { success: false, error: error.message || "Failed to adjust stock" };
    }
}
