import type { Request, Response } from "express";
import { db } from "../../db";
import { batches, subjects, attendanceWindows, attendanceRecords, users } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { uploadToS3, deleteFromS3 } from "../../services/aws/s3.service";
import { compareFace } from "../../services/aws/rekognition.service";

function serverError(res: Response, err: unknown, context = "Operation failed") {
    console.error(`[attendance.controller] ${context}:`, err);
    return res.status(500).json({ error: context });
}

function param(value: string | string[] | undefined): any {
    if (value === undefined) return null;
    return Array.isArray(value) ? value[0] : value;
}

// Pure JS point-in-polygon using ray casting — replaces shapely
function isInsidePolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [px, py] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const pi = polygon[i]!;
        const pj = polygon[j]!;
        const xi = pi[0], yi = pi[1];
        const xj = pj[0], yj = pj[1];
        const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
    }

    return inside;
}

// College boundary polygon — [longitude, latitude] pairs (same order as shapely)
const COLLEGE_BOUNDARY: [number, number][] = [
    [85.101206, 25.632875],
    [85.101317, 25.632820],
    [85.101409, 25.632982],
    [85.101295, 25.633035],
];

// Checks if a window has expired based on startTime + duration (seconds)
function isWindowExpired(startTime: Date, durationSeconds: number): boolean {
    const windowEnd = new Date(startTime.getTime() + durationSeconds * 1000);
    return new Date() > windowEnd;
}

// Returns today's date as a YYYY-MM-DD string
function todayString(): string {
    return new Date().toISOString().split("T")[0] as string;
}

// ------------------------------------------------------------------ //
// Attendance Window
// ------------------------------------------------------------------ //

// GET /attendance/window?target_batch=&target_subject=
// Returns the active attendance window for a batch+subject
export const getAttendanceWindow = async (req: Request, res: Response) => {
    try {
        const batchId = param(req.query.target_batch as string | undefined);
        const subjectId = param(req.query.target_subject as string | undefined);

        if (!batchId || !subjectId) {
            return res.status(400).json({ error: "'target_batch' and 'target_subject' query params are required" });
        }

        const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
        if (!batch) return res.status(404).json({ error: "Batch not found" });

        const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
        if (!subject) return res.status(404).json({ error: "Subject not found" });

        if (subject.batchId !== batchId) {
            return res.status(400).json({ error: "Subject does not belong to the provided batch" });
        }

        const [window] = await db
            .select()
            .from(attendanceWindows)
            .where(
                and(
                    eq(attendanceWindows.targetBatchId, batchId),
                    eq(attendanceWindows.targetSubjectId, subjectId),
                    eq(attendanceWindows.isActive, true)
                )
            )
            .orderBy(attendanceWindows.createdAt)
            .limit(1);

        if (!window) {
            return res.status(404).json({ message: "Attendance window not found" });
        }

        if (isWindowExpired(window.startTime as Date, window.duration as number)) {
            await db
                .update(attendanceWindows)
                .set({ isActive: false })
                .where(eq(attendanceWindows.id, window.id));

            return res.status(400).json({ message: "Attendance window is closed" });
        }

        return res.status(200).json(window);
    } catch (err) {
        return serverError(res, err, "Failed to fetch attendance window");
    }
};

// POST /attendance/window
// Opens or closes an attendance window for today (teacher/admin only) — upserts by batch+subject+date
export const upsertAttendanceWindow = async (req: Request, res: Response) => {
    try {
        const { target_batch: batchId, target_subject: subjectId, is_active, duration } = req.body;

        if (!batchId || !subjectId || is_active === undefined) {
            return res.status(400).json({ error: "'target_batch', 'target_subject', and 'is_active' are required" });
        }

        const role = req.user.role;
        if (role !== "teacher" && role !== "admin") {
            return res.status(403).json({ error: "Only teachers and admins can manage attendance windows" });
        }

        const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
        if (!batch) return res.status(404).json({ error: "Batch not found" });

        const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
        if (!subject) return res.status(404).json({ error: "Subject not found" });

        if (subject.batchId !== batchId) {
            return res.status(400).json({ error: "Subject does not belong to the provided batch" });
        }

        const today = todayString();
        const resolvedDuration = duration ? Math.max(30, Number(duration)) : 30;

        // Check if a window already exists for batch+subject+today
        const [existing] = await db
            .select()
            .from(attendanceWindows)
            .where(
                and(
                    eq(attendanceWindows.targetBatchId, batchId),
                    eq(attendanceWindows.targetSubjectId, subjectId),
                    eq(attendanceWindows.date, today)
                )
            )
            .limit(1);

        let window;
        let created = false;

        if (existing) {
            // Update existing window
            const updatePayload: Record<string, unknown> = {
                isActive: is_active,
                lastInteractedBy: req.user.id,
            };

            // Only reset timer when re-opening
            if (is_active) {
                updatePayload.startTime = new Date();
                updatePayload.duration = resolvedDuration;
            }

            const [updated] = await db
                .update(attendanceWindows)
                .set(updatePayload)
                .where(eq(attendanceWindows.id, existing.id))
                .returning();

            window = updated;
        } else {
            // Create new window
            const [inserted] = await db
                .insert(attendanceWindows)
                .values({
                    targetBatchId: batchId,
                    targetSubjectId: subjectId,
                    date: today,
                    startTime: new Date(),
                    duration: resolvedDuration,
                    isActive: is_active,
                    lastInteractedBy: req.user.id,
                })
                .returning();

            window = inserted;
            created = true;
        }

        return res.status(created ? 201 : 200).json(window);
    } catch (err) {
        return serverError(res, err, "Failed to upsert attendance window");
    }
};

// ------------------------------------------------------------------ //
// Attendance Record
// ------------------------------------------------------------------ //

// POST /attendance/record
// Marks attendance for a student after face verification and location check
export const markAttendance = async (req: Request, res: Response) => {
    try {
        const windowId = req.body.attendance_window;

        if (!windowId) {
            return res.status(400).json({ error: "'attendance_window' is required" });
        }

        if (!req.file) {
            return res.status(400).json({ error: "A face photo is required" });
        }

        const role = req.user.role;
        if (role !== "student" && role !== "teacher" && role !== "admin") {
            return res.status(403).json({ error: "Access denied" });
        }

        // Fetch and validate window
        const [window] = await db
            .select()
            .from(attendanceWindows)
            .where(eq(attendanceWindows.id, windowId))
            .limit(1);

        if (!window) return res.status(404).json({ error: "Attendance window not found" });

        if (!window.isActive) {
            return res.status(400).json({ error: "Attendance window is not active" });
        }

        if (isWindowExpired(window.startTime as Date, window.duration as number)) {
            await db
                .update(attendanceWindows)
                .set({ isActive: false })
                .where(eq(attendanceWindows.id, window.id));

            return res.status(400).json({ error: "Attendance window is closed" });
        }

        // Upload live photo to S3 temporarily for Rekognition
        let imageResult: { key: string; url: string };
        try {
            imageResult = await uploadToS3(req.file, "attendance-temp");
        } catch (err) {
            return serverError(res, err, "Failed to upload attendance photo");
        }

        // Run face comparison against Rekognition collection
        let match: any;
        try {
            match = await compareFace(process.env.AWS_S3_BUCKET!, imageResult.key);
        } catch (err) {
            await deleteFromS3(imageResult.key).catch(() => { });
            return serverError(res, err, "Face comparison failed");
        }

        // Delete temp photo from S3 — no longer needed after comparison
        await deleteFromS3(imageResult.key).catch((err) =>
            console.warn("[attendance.controller] Failed to delete temp photo:", err)
        );

        if (!match) {
            return res.status(403).json({
                error: "Face not recognised. Make sure you are registered, not wearing glasses, and close to the camera.",
            });
        }

        // Students can only mark their own attendance
        if (role === "student" && match.externalImageId !== req.user.id) {
            console.log(match)
            console.log(req.user.id)
            return res.status(403).json({ error: "Face does not match your registered profile" });
        }

        // Resolve target user — student = self, teacher/admin = whoever matched
        const targetUserId = role === "student" ? req.user.id : match.userId;

        if (!targetUserId) {
            return res.status(404).json({ error: "Could not resolve matched user — face may not be properly registered" });
        }

        const [targetUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, targetUserId))
            .limit(1);

        if (!targetUser) return res.status(404).json({ error: "Matched user not found" });

        if (!targetUser.faceRegistered) {
            return res.status(403).json({ error: "Face not registered for this user. Contact admin." });
        }

        // Ensure the target user belongs to the window's batch
        if (targetUser.batchId !== window.targetBatchId) {
            return res.status(400).json({ error: "User does not belong to the window's batch" });
        }

        // Location check — user must be inside college boundary
        if (!targetUser.latitude || !targetUser.longitude) {
            return res.status(400).json({ error: "User location not available. Update your location first." });
        }

        const lat = parseFloat(targetUser.latitude);
        const lon = parseFloat(targetUser.longitude);

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: "Invalid user latitude/longitude" });
        }

        if (!isInsidePolygon([lon, lat], COLLEGE_BOUNDARY)) {
            return res.status(400).json({ error: "Student is outside the college boundary" });
        }

        // Upsert attendance record for today
        const today = todayString();

        const [existing] = await db
            .select()
            .from(attendanceRecords)
            .where(
                and(
                    eq(attendanceRecords.userId, targetUserId),
                    eq(attendanceRecords.attendanceWindowId, windowId),
                    eq(attendanceRecords.date, today)
                )
            )
            .limit(1);

        let record;
        let created = false;

        if (existing) {
            const [updated] = await db
                .update(attendanceRecords)
                .set({ status: "P", markedBy: req.user.id })
                .where(eq(attendanceRecords.id, existing.id))
                .returning();

            record = updated;
        } else {
            const [inserted] = await db
                .insert(attendanceRecords)
                .values({
                    userId: targetUserId,
                    attendanceWindowId: windowId,
                    date: today,
                    status: "P",
                    markedBy: req.user.id,
                })
                .returning();

            record = inserted;
            created = true;
        }

        return res.status(created ? 201 : 200).json({
            message: created ? "Attendance marked" : "Attendance updated",
            similarity: match.similarity,
            record,
        });
    } catch (err) {
        return serverError(res, err, "Failed to mark attendance");
    }
};