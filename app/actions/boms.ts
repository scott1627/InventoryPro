"use server";

import { prisma } from "../../lib/prisma";
import { getServerAuthSession } from "../../lib/auth";
import { revalidatePath } from "next/cache";

export async function createBOM(name: string, description?: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const bom = await prisma.bOM.create({
            data: {
                name,
                description
            }
        });
        revalidatePath("/boms");
        return { success: true, bom };
    } catch (error) {
        console.error("Error creating BOM:", error);
        return { success: false, error: "Failed to create BOM" };
    }
}

export async function updateBOM(id: string, name: string, description?: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const bom = await prisma.bOM.update({
            where: { id },
            data: {
                name,
                description
            }
        });
        revalidatePath("/boms");
        return { success: true, bom };
    } catch (error) {
        console.error("Error updating BOM:", error);
        return { success: false, error: "Failed to update BOM" };
    }
}

export async function deleteBOM(id: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        await prisma.bOM.delete({
            where: { id }
        });
        revalidatePath("/boms");
        return { success: true };
    } catch (error) {
        console.error("Error deleting BOM:", error);
        return { success: false, error: "Failed to delete BOM" };
    }
}

export async function addPartToBOM(bomId: string, partId: string, quantity: number) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const item = await prisma.bOMItem.create({
            data: {
                bomId,
                partId,
                quantity
            }
        });
        revalidatePath("/boms");
        return { success: true, item };
    } catch (error) {
        console.error("Error adding part to BOM:", error);
        return { success: false, error: "Failed to add part to BOM" };
    }
}

export async function updateBOMItemQuantity(itemId: string, quantity: number) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const item = await prisma.bOMItem.update({
            where: { id: itemId },
            data: { quantity }
        });
        revalidatePath("/boms");
        return { success: true, item };
    } catch (error) {
        console.error("Error updating BOM item quantity:", error);
        return { success: false, error: "Failed to update BOM item quantity" };
    }
}

export async function removePartFromBOM(itemId: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        await prisma.bOMItem.delete({
            where: { id: itemId }
        });
        revalidatePath("/boms");
        return { success: true };
    } catch (error) {
        console.error("Error removing part from BOM:", error);
        return { success: false, error: "Failed to remove part from BOM" };
    }
}
