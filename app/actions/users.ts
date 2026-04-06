"use server";

import { prisma } from "../../lib/prisma";
import { getServerAuthSession } from "../../lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

async function requireAdmin() {
    const session = await getServerAuthSession();
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Unauthorized");
    }
}

export async function getUsers() {
    await requireAdmin();
    return await prisma.user.findMany({
        orderBy: { username: 'asc' },
        select: {
            id: true,
            username: true,
            role: true,
            timezone: true,
            createdAt: true
        }
    });
}

export async function createUser(username: string, passwordRaw: string, role: "USER" | "ADMIN", timezone: string = "UTC") {
    try {
        await requireAdmin();
        const hashedPassword = await bcrypt.hash(passwordRaw, 10);
        
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role,
                timezone
            }
        });
        revalidatePath("/users");
        return { success: true, user: { id: user.id, username: user.username, role: user.role, timezone: user.timezone } };
    } catch (error: any) {
        if (error.code === 'P2002') {
            return { success: false, error: "Username already exists" };
        }
        return { success: false, error: error.message || "Failed to create user" };
    }
}

export async function updateUser(id: string, username: string, passwordRaw?: string, role?: "USER" | "ADMIN", timezone?: string) {
    try {
        await requireAdmin();
        const updateData: any = { username };
        if (role) updateData.role = role;
        if (timezone) updateData.timezone = timezone;
        if (passwordRaw) {
            updateData.password = await bcrypt.hash(passwordRaw, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData
        });
        revalidatePath("/users");
        return { success: true, user: { id: user.id, username: user.username, role: user.role, timezone: user.timezone } };
    } catch (error: any) {
        if (error.code === 'P2002') {
            return { success: false, error: "Username already exists" };
        }
        return { success: false, error: error.message || "Failed to update user" };
    }
}

export async function deleteUser(id: string) {
    try {
        await requireAdmin();
        const userCount = await prisma.user.count();
        if (userCount <= 1) {
            return { success: false, error: "Cannot delete the last user" };
        }

        await prisma.user.delete({
            where: { id }
        });
        revalidatePath("/users");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || "Failed to delete user" };
    }
}

export async function updateOwnTimezone(timezone: string) {
    try {
        const session = await getServerAuthSession();
        if (!session) return { success: false, error: "Unauthorized" };

        await prisma.user.update({
            where: { id: session.user.id },
            data: { timezone }
        });

        revalidatePath("/");
        revalidatePath("/parts");
        revalidatePath("/categories");
        revalidatePath("/locations");
        revalidatePath("/users");
        
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Failed to update timezone" };
    }
}
