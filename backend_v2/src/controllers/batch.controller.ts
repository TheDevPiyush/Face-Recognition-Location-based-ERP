import type { Request, Response } from "express";
import { db } from "../db";
import { batches } from "../db/schema";
import { eq } from "drizzle-orm";

function serverError(res: Response, err: unknown, context = "Operation failed") {
    console.error(`[batch.controller] ${context}:`, err);
    return res.status(500).json({ error: context });
}


function param(value: string | string[] | undefined): any {
    if (value === undefined) return null;
    return Array.isArray(value) ? value[0] : value;
}


export const getBatches = async (_req: Request, res: Response) => {
    try {
        const all = await db.select().from(batches);
        return res.status(200).json(all);
    } catch (err) {
        return serverError(res, err, "Failed to fetch batches");
    }
};


export const createBatch = async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const [created] = await db.insert(batches).values(req.body).returning();
        return res.status(201).json(created);
    } catch (err) {
        if (err instanceof Error && err.message.includes("unique")) {
            return res.status(400).json({ error: "Batch already exists" });
        }
        return serverError(res, err, "Failed to create batch");
    }
};


export const getBatch = async (req: Request, res: Response) => {
    try {
        const pk = param(req.params.pk);
        if (!pk) return res.status(400).json({ error: "Batch ID is required" });

        const [batch] = await db
            .select()
            .from(batches)
            .where(eq(batches.id, pk))
            .limit(1);

        if (!batch) return res.status(404).json({ error: "Batch not found" });

        return res.status(200).json(batch);
    } catch (err) {
        return serverError(res, err, "Failed to fetch batch");
    }
};