"use server";

import { prisma } from "../../lib/prisma";
import { getServerAuthSession } from "../../lib/auth";
import { revalidatePath } from "next/cache";

export async function addLocation(name: string, parentId?: string, color?: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };
    try {
        const location = await prisma.storageLocation.create({
            data: {
                name,
                parentId: parentId || null,
                color: color || null
            }
        });
        revalidatePath("/locations");
        revalidatePath("/parts");
        return { success: true, location };
    } catch (error) {
        console.error("Error adding location:", error);
        return { success: false, error: "Failed to add location" };
    }
}

export async function updateLocation(id: string, name: string, parentId?: string, color?: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const location = await prisma.storageLocation.update({
            where: { id },
            data: {
                name,
                parentId: parentId || null,
                color: color || null
            }
        });
        revalidatePath("/locations");
        revalidatePath("/parts");
        return { success: true, location };
    } catch (error) {
        console.error("Error updating location:", error);
        return { success: false, error: "Failed to update location" };
    }
}

export async function deleteLocation(id: string) {
    const session = await getServerAuthSession();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        // 1. Ensure "Unassigned" location exists
        let unassigned = await prisma.storageLocation.findFirst({
            where: { name: "Unassigned" }
        });

        if (!unassigned) {
            unassigned = await prisma.storageLocation.create({
                data: { name: "Unassigned" }
            });
        }

        // 2. Prevent deleting "Unassigned" itself
        if (id === unassigned.id) {
            return { success: false, error: "Cannot delete the 'Unassigned' location" };
        }

        // 3. Handle children: move them to Unassigned or set parentId to null?
        // Let's set parentId to null for simplicity or move to Unassigned.
        // Moving parts is safer.
        await prisma.part.updateMany({
            where: { storageLocationId: id },
            data: { storageLocationId: unassigned.id }
        });

        // 4. Delete the location
        await prisma.storageLocation.delete({
            where: { id }
        });

        revalidatePath("/locations");
        revalidatePath("/parts");
        return { success: true };
    } catch (error) {
        console.error("Error deleting location:", error);
        return { success: false, error: "Failed to delete location" };
    }
}

export async function getLocations() {
    return await prisma.storageLocation.findMany({
        include: {
            parent: true,
            children: true
        },
        orderBy: { name: 'asc' }
    });
}
