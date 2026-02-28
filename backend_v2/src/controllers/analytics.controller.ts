import type { Request, Response } from "express";
import {
    buildAnalytics,
    buildMonthlyPercentage,
    buildStudentCalendar
} from "../services/controller_services/analytics.service";

function param(v: string | string[] | undefined) {
    if (v === undefined) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
}


export async function getAttendanceAnalytics(req: Request, res: Response) {
    try {

        const user = req.user!;

        let studentId = null;

        if (user.role === "student") studentId = user.id;

        else if (user.role === "teacher" || user.role === "admin")
            studentId = param(req.query.student_id as string | undefined);

        else return res.status(403).json({ error: "Not authorized" });

        const batchId = param(req.query.batch_id as string);
        const subjectId = param(req.query.subject_id as string);
        const monthStr = param(req.query.month as string);

        const today = new Date();

        const todayStr = today.toISOString().split("T")[0]!;

        const startDate = param(req.query.start_date as string)
            ?? new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

        const endDate = param(req.query.end_date as string) ?? todayStr;

        if (startDate > endDate) return res.status(400).json({ error: "Invalid date range" });

        const result = await buildAnalytics({ studentId, batchId, subjectId, startDate, endDate, monthStr });

        return res.json(result);
    } catch (err: any) {
        console.error("[analytics] getAttendanceAnalytics:", err);
        return res.status(err.message?.includes("Invalid") ? 400 : 500).json({ error: err.message ?? "Failed" });
    }
}



export async function getMonthlyPercentage(req: Request, res: Response) {
    try {

        const user = req.user!;

        let studentId = null;

        if (user.role === "student") studentId = user.id;

        else if (user.role === "teacher" || user.role === "admin")
            studentId = param(req.query.student_id as string | undefined);

        else return res.status(403).json({ error: "Not authorized" });

        const result = await buildMonthlyPercentage({
            studentId,
            batchId: param(req.query.batch_id as string | undefined),
            subjectId: param(req.query.subject_id as string | undefined),
            monthStr: param(req.query.month as string | undefined),
        });

        return res.json(result);
    } catch (err: any) {
        console.error("[analytics] getMonthlyPercentage:", err);
        return res.status(500).json({ error: err.message ?? "Failed" });
    }
}



export async function getStudentCalendar(req: Request, res: Response) {
    try {

        const user = req.user!;

        if (user.role !== "student")
            return res.status(403).json({ error: "Only students can access the calendar" });

        if (!user.batchId)
            return res.status(400).json({ error: "No batch assigned to your account" });

        const result = await buildStudentCalendar(
            user.id,
            user.batchId,
            param(req.query.month as string | undefined),
        );

        return res.json(result);
    } catch (err: any) {
        console.error("[analytics] getStudentCalendar:", err);
        return res.status(err.message === "Batch not found" ? 404 : 500).json({ error: err.message ?? "Failed" });
    }
}