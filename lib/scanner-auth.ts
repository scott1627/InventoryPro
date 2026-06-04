import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export interface AuthenticatedUser {
    id: string;
    username: string;
    role: string;
}

export async function authenticateScannerRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Basic ")) {
            return null;
        }

        const base64Credentials = authHeader.slice(6); // Remove "Basic " prefix
        const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
        const parts = credentials.split(":");
        
        if (parts.length !== 2) {
            return null;
        }

        const [username, password] = parts;

        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user || !user.password) {
            return null;
        }

        const isCorrectPassword = await bcrypt.compare(password, user.password);
        if (!isCorrectPassword) {
            return null;
        }

        return {
            id: user.id,
            username: user.username,
            role: user.role
        };
    } catch (error) {
        console.error("Scanner authentication error:", error);
        return null;
    }
}
