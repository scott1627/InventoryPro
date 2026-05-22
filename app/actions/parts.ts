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
        const storageLocationId = formData.get("storageLocationId") as string;
        const stock = parseInt(formData.get("stock") as string) || 0;
        const description = formData.get("description") as string;
        const minStock = parseInt(formData.get("minStock") as string) || 0;
        const lowStockAlertEnabled = formData.get("lowStockAlertEnabled") === "on";
        const reorderLink = formData.get("reorderLink") as string;
        let upc = formData.get("upc") as string | null;
        const iconId = formData.get("iconId") as string | null;

        // Auto-generate UPC if not provided (12 digits)
        if (!upc || upc.trim() === "") {
            const randomDigits = Math.floor(100000000000 + Math.random() * 900000000000);
            upc = randomDigits.toString();
        } else {
            upc = upc.trim();
        }

        // Handle datasheet upload
        const datasheet = formData.get("datasheet") as File;
        let datasheetType: string | null = null;
        const hasDatasheet = datasheet && datasheet.size > 0;
        if (hasDatasheet) {
            datasheetType = datasheet.type;
        }

        // Handle image upload
        const image = formData.get("image") as File;
        let imageType: string | null = null;
        const hasImage = image && image.size > 0;
        if (hasImage) {
            imageType = image.type;
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

        let finalLocationId = storageLocationId;
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
                datasheetType,
                imageType,
                categoryId: finalCategoryId,
                storageLocationId: finalLocationId,
                minStock,
                lowStockAlertEnabled,
                reorderLink,
                upc,
                iconId: iconId && iconId !== "" ? iconId : null,
                stockLevels: {
                    create: {
                        quantity: stock
                    }
                }
            }
        });

        // 4. Write uploads to filesystem & Update virtual URLs
        const version = Date.now();
        let imageUrl: string | null = null;
        let datasheetUrl: string | null = null;

        if (hasImage) {
            const uploadDir = path.join(process.cwd(), "public", "uploads", "images");
            await fs.mkdir(uploadDir, { recursive: true });
            const imageBuffer = Buffer.from(await image.arrayBuffer());
            await fs.writeFile(path.join(uploadDir, part.id), imageBuffer);
            imageUrl = `/api/parts/${part.id}/image?v=${version}`;
        }

        if (hasDatasheet) {
            const uploadDir = path.join(process.cwd(), "public", "uploads", "datasheets");
            await fs.mkdir(uploadDir, { recursive: true });
            const datasheetBuffer = Buffer.from(await datasheet.arrayBuffer());
            await fs.writeFile(path.join(uploadDir, part.id), datasheetBuffer);
            datasheetUrl = `/api/parts/${part.id}/datasheet?v=${version}`;
        }

        if (hasImage || hasDatasheet) {
            await prisma.part.update({
                where: { id: part.id },
                data: {
                    imageUrl,
                    datasheetUrl,
                }
            });
        }

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
        const storageLocationId = formData.get("storageLocationId") as string;
        const stock = parseInt(formData.get("stock") as string) || 0;
        const description = formData.get("description") as string;
        const minStock = parseInt(formData.get("minStock") as string) || 0;
        const lowStockAlertEnabled = formData.get("lowStockAlertEnabled") === "on";
        const reorderLink = formData.get("reorderLink") as string;
        const upc = (formData.get("upc") as string)?.trim() || null;
        const iconId = formData.get("iconId") as string | null;

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

        let finalLocationId = storageLocationId;
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

        const version = Date.now();
        const updateData: any = {
            name,
            description,
            categoryId: finalCategoryId,
            storageLocationId: finalLocationId,
            minStock,
            lowStockAlertEnabled,
            reorderLink,
            upc,
            iconId: iconId && iconId !== "" ? iconId : null,
            stockLevels: {
                create: {
                    quantity: stock
                }
            }
        };

        const datasheet = formData.get("datasheet") as File;
        if (datasheet && datasheet.size > 0) {
            const uploadDir = path.join(process.cwd(), "public", "uploads", "datasheets");
            await fs.mkdir(uploadDir, { recursive: true });
            const datasheetBuffer = Buffer.from(await datasheet.arrayBuffer());
            await fs.writeFile(path.join(uploadDir, id), datasheetBuffer);
            
            updateData.datasheetType = datasheet.type;
            updateData.datasheetUrl = `/api/parts/${id}/datasheet?v=${version}`;
        }

        const image = formData.get("image") as File;
        if (image && image.size > 0) {
            const uploadDir = path.join(process.cwd(), "public", "uploads", "images");
            await fs.mkdir(uploadDir, { recursive: true });
            const imageBuffer = Buffer.from(await image.arrayBuffer());
            await fs.writeFile(path.join(uploadDir, id), imageBuffer);
            
            updateData.imageType = image.type;
            updateData.imageUrl = `/api/parts/${id}/image?v=${version}`;
        }

        const part = await prisma.part.update({
            where: { id },
            data: updateData
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

        // Delete files from disk if they exist
        try {
            await fs.unlink(path.join(process.cwd(), "public", "uploads", "images", id));
        } catch (e) {
            // Ignore if file doesn't exist
        }
        try {
            await fs.unlink(path.join(process.cwd(), "public", "uploads", "datasheets", id));
        } catch (e) {
            // Ignore if file doesn't exist
        }

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
