"use server";

import { prisma } from "../../lib/prisma";
import { getServerAuthSession } from "../../lib/auth";
import { revalidatePath } from "next/cache";

export async function addCategory(name: string, parentId?: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        const category = await prisma.category.create({
            data: {
                name,
                parentId: parentId || null
            }
        });
        revalidatePath("/categories");
        revalidatePath("/parts");
        return { success: true, category };
    } catch (error) {
        console.error("Error adding category:", error);
        return { success: false, error: "Failed to add category" };
    }
}

export async function updateCategory(id: string, name: string, parentId?: string | null) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const category = await prisma.category.update({
            where: { id },
            data: { 
                name,
                parentId: parentId !== undefined ? parentId : undefined
            }
        });
        revalidatePath("/categories");
        revalidatePath("/parts");
        return { success: true, category };
    } catch (error) {
        console.error("Error updating category:", error);
        return { success: false, error: "Failed to update category" };
    }
}

export async function deleteCategory(id: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        // 1. Ensure "Unassigned" category exists
        let unassigned = await prisma.category.findFirst({
            where: { name: "Unassigned" }
        });

        if (!unassigned) {
            unassigned = await prisma.category.create({
                data: { name: "Unassigned" }
            });
        }

        // 2. Prevent deleting "Unassigned" itself
        if (id === unassigned.id) {
            return { success: false, error: "Cannot delete the 'Unassigned' category" };
        }

        // 3. Re-assign parts to "Unassigned"
        await prisma.part.updateMany({
            where: { categoryId: id },
            data: { categoryId: unassigned.id }
        });

        // 4. Delete the category
        await prisma.category.delete({
            where: { id }
        });

        revalidatePath("/categories");
        revalidatePath("/parts");
        return { success: true };
    } catch (error) {
        console.error("Error deleting category:", error);
        return { success: false, error: "Failed to delete category" };
    }
}

export async function getCategories() {
    return await prisma.category.findMany({
        orderBy: { name: 'asc' }
    });
}
