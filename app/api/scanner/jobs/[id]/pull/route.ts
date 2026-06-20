import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { authenticateScannerRequest } from "../../../../../../lib/scanner-auth";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // 1. Authenticate Request
    const user = await authenticateScannerRequest(request);
    if (!user) {
        return new NextResponse(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    const jobId = params.id;

    // 2. Parse Request Body
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return new NextResponse(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const { upc, partId, amount } = body;

    if ((!upc && !partId) || amount === undefined || typeof amount !== "number") {
        return new NextResponse(
            JSON.stringify({ error: "upc or partId, and amount (number) are required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        // 3. Find Part
        const part = await prisma.part.findFirst({
            where: upc ? { upc } : { id: partId }
        });

        if (!part) {
            return new NextResponse(
                JSON.stringify({ error: `Part not found for ${upc ? 'UPC ' + upc : 'ID ' + partId}` }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        // 4. Retrieve Job
        const job = await prisma.job.findUnique({
            where: { id: jobId },
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

        if (!job) {
            return new NextResponse(
                JSON.stringify({ error: "Job not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        if (job.status === "COMPLETED") {
            return new NextResponse(
                JSON.stringify({ error: "Job is already completed" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // 5. Calculate total required quantity of this part for this job
        let totalRequired = 0;
        for (const jobBom of job.boms) {
            if (!jobBom.bom) continue;
            for (const item of jobBom.bom.items) {
                if (item.partId === part.id) {
                    totalRequired += item.quantity * jobBom.quantity;
                }
            }
        }

        if (totalRequired === 0) {
            return new NextResponse(
                JSON.stringify({ error: `Part '${part.name}' is not required for this job` }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // 6. Get current pulled quantity
        const existingPull = await prisma.jobPartPull.findUnique({
            where: {
                jobId_partId: {
                    jobId,
                    partId: part.id
                }
            }
        });

        const currentPulled = existingPull?.quantity ?? 0;
        const newPulled = currentPulled + amount;

        // 7. Validate pulling constraints (no overpulling, no negative pulls)
        if (newPulled > totalRequired) {
            return new NextResponse(
                JSON.stringify({ 
                    error: `Cannot pull more than required. Max: ${totalRequired}, Scanned: ${newPulled}` 
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        if (newPulled < 0) {
            return new NextResponse(
                JSON.stringify({ error: "Pulled quantity cannot be negative" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // 8. Update database
        if (newPulled === 0) {
            if (existingPull) {
                await prisma.jobPartPull.delete({
                    where: { id: existingPull.id }
                });
            }
        } else {
            await prisma.jobPartPull.upsert({
                where: {
                    jobId_partId: {
                        jobId,
                        partId: part.id
                    }
                },
                update: {
                    quantity: newPulled
                },
                create: {
                    jobId,
                    partId: part.id,
                    quantity: newPulled
                }
            });
        }

        return new NextResponse(
            JSON.stringify({
                success: true,
                partId: part.id,
                partName: part.name,
                totalRequired,
                totalPulled: newPulled
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error updating job pull:", error);
        return new NextResponse(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
