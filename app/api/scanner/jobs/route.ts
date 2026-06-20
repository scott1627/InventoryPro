import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { authenticateScannerRequest } from "../../../../lib/scanner-auth";

export async function GET(request: NextRequest) {
    // 1. Authenticate Request
    const user = await authenticateScannerRequest(request);
    if (!user) {
        return new NextResponse(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        // 2. Query active jobs (DRAFT or IN_PROGRESS)
        const jobs = await prisma.job.findMany({
            where: {
                status: {
                    in: ["DRAFT", "IN_PROGRESS"]
                }
            },
            include: {
                boms: {
                    select: { id: true }
                }
            },
            orderBy: {
                updatedAt: "desc"
            }
        });

        // 3. Format response
        const results = jobs.map(job => ({
            id: job.id,
            name: job.name,
            description: job.description,
            status: job.status,
            bomCount: job.boms.length,
            createdAt: job.createdAt
        }));

        return new NextResponse(
            JSON.stringify(results),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error fetching active jobs:", error);
        return new NextResponse(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
