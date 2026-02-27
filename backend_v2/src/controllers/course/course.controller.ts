import type { Request, Response } from "express";
import { db } from "../../db";
import { courses } from "../../db/schema";
import { eq } from "drizzle-orm";

function serverError(res: Response, err: unknown, context = "Operation failed") {
    console.error(`[course.controller] ${context}:`, err);
    return res.status(500).json({ error: context });
}

function param(value: string | string[] | undefined): any {
    if (value === undefined) return null;
    return Array.isArray(value) ? value[0] : value;
}

// Returns all courses
export const getCourses = async (_req: Request, res: Response) => {
    try {
        const all = await db.select().from(courses);
        return res.status(200).json(all);
    } catch (err) {
        return serverError(res, err, "Failed to fetch courses");
    }
};

// Creates a new course
export const createCourse = async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const [created] = await db.insert(courses).values(req.body).returning();
        return res.status(201).json(created);
    } catch (err) {
        if (err instanceof Error && err.message.includes("unique")) {
            return res.status(400).json({ error: "Course already exists" });
        }
        return serverError(res, err, "Failed to create course");
    }
};

// Returns a single course by ID
export const getCourse = async (req: Request, res: Response) => {
    try {
        const pk = param(req.params.pk);
        if (!pk) return res.status(400).json({ error: "Course ID is required" });

        const [course] = await db
            .select()
            .from(courses)
            .where(eq(courses.id, pk))
            .limit(1);

        if (!course) return res.status(404).json({ error: "Course not found" });

        return res.status(200).json(course);
    } catch (err) {
        return serverError(res, err, "Failed to fetch course");
    }
};