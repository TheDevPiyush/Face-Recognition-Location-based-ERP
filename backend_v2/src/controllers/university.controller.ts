import type { Request, Response } from "express";
import { db } from "../db";
import { universities } from "../db/schema";
import { eq } from "drizzle-orm";

function serverError(res: Response, err: unknown, context = "Operation failed") {
    console.error(`[university.controller] ${context}:`, err);
    return res.status(500).json({ error: context });
}

function param(value: string | string[] | undefined): any {
    if (value === undefined) return null;
    return Array.isArray(value) ? value[0] : value;
}


export const getUniversities = async (_req: Request, res: Response) => {
    try {
        const all = await db.select().from(universities);
        return res.status(200).json(all);
    } catch (err) {
        return serverError(res, err, "Failed to fetch universities");
    }
};


export const createUniversity = async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const [created] = await db.insert(universities).values(req.body).returning();
        return res.status(201).json(created);
    } catch (err) {
        if (err instanceof Error && err.message.includes("unique")) {
            return res.status(400).json({ error: "University already exists" });
        }
        return serverError(res, err, "Failed to create university");
    }
};


export const getUniversity = async (req: Request, res: Response) => {
    try {
        const pk = param(req.params.pk);
        if (!pk) return res.status(400).json({ error: "University ID is required" });

        const [university] = await db
            .select()
            .from(universities)
            .where(eq(universities.id, pk))
            .limit(1);

        if (!university) return res.status(404).json({ error: "University not found" });

        return res.status(200).json(university);
    } catch (err) {
        return serverError(res, err, "Failed to fetch university");
    }
};