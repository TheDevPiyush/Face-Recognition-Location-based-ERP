import type { Request, Response } from "express";
import {
    getActiveWindow,
    upsertWindow,
    markAttendanceRecord
} from "../services/controller_services/attendance.service";


function param(v: any) {
    if (v === undefined) return null;
    return Array.isArray(v) ? v[0] : v;
}


function fail(res: Response, err: any) {
    const status = err?.status ?? 500;
    const message = err?.message ?? "Operation failed";
    if (status === 500) console.error("[attendance]", err);
    return res.status(status).json({ error: message });
}


export const getAttendanceWindow = async (req: Request, res: Response) => {
    try {

        const batchId = param(req.query.target_batch);
        const subjectId = param(req.query.target_subject);

        if (!batchId || !subjectId)
            return res.status(400).json({ error: "'target_batch' and 'target_subject' are required" });

        const window = await getActiveWindow(batchId, subjectId);
        
        return res.json(window);
    } catch (err) {
        return fail(res, err);
    }
};


export const upsertAttendanceWindow = async (req: Request, res: Response) => {
    try {
        
        const { target_batch: batchId, target_subject: subjectId, is_active, duration } = req.body;
        
        if (!batchId || !subjectId || is_active === undefined)
            return res.status(400).json({ error: "'target_batch', 'target_subject', and 'is_active' are required" });

        const role = req.user.role;
        
        if (role !== "teacher" && role !== "admin")
            return res.status(403).json({ error: "Only teachers and admins can manage attendance windows" });

        
        const { window, created } = await upsertWindow(batchId, subjectId, is_active, duration, req.user.id);
        
        return res.status(created ? 201 : 200).json(window);
    } catch (err) {
        return fail(res, err);
    }
};


export const markAttendance = async (req: Request, res: Response) => {
    try {
        
        const windowId = req.body.attendance_window;
        
        if (!windowId) return res.status(400).json({ error: "'attendance_window' is required" });
        
        if (!req.file) return res.status(400).json({ error: "A face photo is required" });

        const { record, created, similarity } = await markAttendanceRecord({
            windowId,
            file: req.file,
            userId: req.user.id,
            userRole: req.user.role!,
        });

        return res.status(created ? 201 : 200).json({
            message: created ? "Attendance marked" : "Attendance updated",
            similarity,
            record,
        });
    } catch (err) {
        return fail(res, err);
    }
};