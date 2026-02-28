import type { Request, Response } from "express";
import { db } from "../db";
import { subjects } from "../db/schema";
import { eq } from "drizzle-orm";


function serverError(res: Response, err: unknown, context = "Operation failed") {
    console.error(`[subject.controller] ${context}:`, err);
    return res.status(500).json({ error: context });
}

function param(value: string | string[] | undefined): any {
    if (value === undefined) return null;
    return Array.isArray(value) ? value[0] : value;
}


export const getSubjects = async (_req: Request, res: Response) => {
    try {
       
        const all = await db.select().from(subjects);
        return res.status(200).json(all);
    } catch (err) {
        return serverError(res, err, "Failed to fetch subjects");
    }
};


export const createSubject = async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const [created] = await db.insert(subjects).values(req.body).returning();
        return res.status(201).json(created);
    } catch (err) {
        if (err instanceof Error && err.message.includes("unique")) {
            return res.status(400).json({ error: "Subject already exists" });
        }
        return serverError(res, err, "Failed to create subject");
    }
};


export const getSubject = async (req: Request, res: Response) => {
    try {
       
        const pk = param(req.params.pk);
        if (!pk) return res.status(400).json({ error: "Subject ID is required" });

        const [subject] = await db
            .select()
            .from(subjects)
            .where(eq(subjects.id, pk))
            .limit(1);

        if (!subject) return res.status(404).json({ error: "Subject not found" });

        return res.status(200).json(subject);
    } catch (err) {
        return serverError(res, err, "Failed to fetch subject");
    }
};