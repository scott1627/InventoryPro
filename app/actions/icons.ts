"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export async function getIcons() {
    try {
        const icons = await prisma.icon.findMany({
            select: {
                id: true,
                name: true,
                type: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return { success: true, icons };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function addIcon(formData: FormData) {
    try {
        const file = formData.get("file") as File;
        if (!file) {
            return { success: false, error: "No file provided" };
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const name = file.name;
        const type = file.type;

        const icon = await prisma.icon.create({
            data: {
                name,
                type,
                content: buffer
            }
        });

        revalidatePath("/");
        
        return { success: true, icon: { id: icon.id, name: icon.name, type: icon.type } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteIcon(id: string) {
    try {
        await prisma.icon.delete({
            where: { id }
        });
        
        revalidatePath("/");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
