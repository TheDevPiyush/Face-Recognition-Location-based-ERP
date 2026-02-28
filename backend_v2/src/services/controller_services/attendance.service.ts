import { db } from "../../db";
import { batches, subjects, attendanceWindows, attendanceRecords, users } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { uploadToS3, deleteFromS3 } from "../aws/s3.service";
import { compareFace } from "../aws/rekognition.service";

const COLLEGE_BOUNDARY: [number, number][] = [
    [85.101206, 25.632875],
    [85.101317, 25.632820],
    [85.101409, 25.632982],
    [85.101295, 25.633035],
];

function isInsidePolygon(point: [number, number], polygon: [number, number][]) {
    const [px, py] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]!;
        const [xj, yj] = polygon[j]!;
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
}

function isExpired(startTime: Date, durationSec: number) {
    return Date.now() > startTime.getTime() + durationSec * 1000;
}

function today() {
    return new Date().toISOString().split("T")[0] as string;
}

// ─── Window ───────────────────────────────────────────────────────────────────

export async function getActiveWindow(batchId: string, subjectId: string) {
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) throw { status: 404, message: "Batch not found" };

    const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
    if (!subject) throw { status: 404, message: "Subject not found" };
    if (subject.batchId !== batchId) throw { status: 400, message: "Subject does not belong to the provided batch" };

    const [window] = await db
        .select()
        .from(attendanceWindows)
        .where(and(
            eq(attendanceWindows.targetBatchId, batchId),
            eq(attendanceWindows.targetSubjectId, subjectId),
            eq(attendanceWindows.isActive, true),
        ))
        .orderBy(attendanceWindows.createdAt)
        .limit(1);

    if (!window) throw { status: 404, message: "Attendance window not found" };

    if (isExpired(window.startTime as Date, window.duration as number)) {
        await db.update(attendanceWindows).set({ isActive: false }).where(eq(attendanceWindows.id, window.id));
        throw { status: 400, message: "Attendance window is closed" };
    }

    return window;
}

export async function upsertWindow(batchId: string, subjectId: string, isActive: boolean, duration: number, userId: string) {
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) throw { status: 404, message: "Batch not found" };

    const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
    if (!subject) throw { status: 404, message: "Subject not found" };
    if (subject.batchId !== batchId) throw { status: 400, message: "Subject does not belong to the provided batch" };

    const resolvedDuration = Math.max(30, duration || 30);
    const date = today();

    const [existing] = await db
        .select()
        .from(attendanceWindows)
        .where(and(
            eq(attendanceWindows.targetBatchId, batchId),
            eq(attendanceWindows.targetSubjectId, subjectId),
            eq(attendanceWindows.date, date),
        ))
        .limit(1);

    if (existing) {
        const payload: any = { isActive, lastInteractedBy: userId };
        if (isActive) {
            payload.startTime = new Date();
            payload.duration = resolvedDuration;
        }
        const [updated] = await db
            .update(attendanceWindows)
            .set(payload)
            .where(eq(attendanceWindows.id, existing.id))
            .returning();
        return { window: updated, created: false };
    }

    const [inserted] = await db
        .insert(attendanceWindows)
        .values({
            targetBatchId: batchId,
            targetSubjectId: subjectId,
            date,
            startTime: new Date(),
            duration: resolvedDuration,
            isActive,
            lastInteractedBy: userId,
        })
        .returning();

    return { window: inserted, created: true };
}

// ─── Record ───────────────────────────────────────────────────────────────────

export async function markAttendanceRecord(opts: {
    windowId: string;
    file: Express.Multer.File;
    userId: string;
    userRole: string;
}) {
    const { windowId, file, userId, userRole } = opts;

    const [window] = await db.select().from(attendanceWindows).where(eq(attendanceWindows.id, windowId)).limit(1);
    if (!window) throw { status: 404, message: "Attendance window not found" };
    if (!window.isActive) throw { status: 400, message: "Attendance window is not active" };

    if (isExpired(window.startTime as Date, window.duration as number)) {
        await db.update(attendanceWindows).set({ isActive: false }).where(eq(attendanceWindows.id, window.id));
        throw { status: 400, message: "Attendance window is closed" };
    }

    // Upload photo → compare face → delete temp photo
    const imageResult = await uploadToS3(file, "attendance-temp");

    let match: any;
    try {
        match = await compareFace(process.env.AWS_S3_BUCKET!, imageResult.key);
    } finally {
        await deleteFromS3(imageResult.key).catch((e) => console.warn("Failed to delete temp photo:", e));
    }

    if (!match) throw { status: 403, message: "Face not recognised. Make sure you are registered, not wearing glasses, and close to the camera." };

    if (userRole === "student" && match.externalImageId !== userId) {
        throw { status: 403, message: "Face does not match your registered profile" };
    }

    const targetUserId = userRole === "student" ? userId : match.userId;
    if (!targetUserId) throw { status: 404, message: "Could not resolve matched user" };

    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) throw { status: 404, message: "Matched user not found" };
    if (!targetUser.faceRegistered) throw { status: 403, message: "Face not registered for this user. Contact admin." };
    if (targetUser.batchId !== window.targetBatchId) throw { status: 400, message: "User does not belong to the window's batch" };

    // Location check
    if (!targetUser.latitude || !targetUser.longitude) throw { status: 400, message: "User location not available. Update your location first." };

    const lat = parseFloat(targetUser.latitude);
    const lon = parseFloat(targetUser.longitude);
    if (isNaN(lat) || isNaN(lon)) throw { status: 400, message: "Invalid user location" };
    if (!isInsidePolygon([lon, lat], COLLEGE_BOUNDARY)) throw { status: 400, message: "Student is outside the college boundary" };

    // Upsert record
    const date = today();

    const [existing] = await db
        .select()
        .from(attendanceRecords)
        .where(and(
            eq(attendanceRecords.userId, targetUserId),
            eq(attendanceRecords.attendanceWindowId, windowId),
            eq(attendanceRecords.date, date),
        ))
        .limit(1);

    if (existing) {
        const [updated] = await db
            .update(attendanceRecords)
            .set({ status: "P", markedBy: userId })
            .where(eq(attendanceRecords.id, existing.id))
            .returning();
        return { record: updated, created: false, similarity: match.similarity };
    }

    const [inserted] = await db
        .insert(attendanceRecords)
        .values({ userId: targetUserId, attendanceWindowId: windowId, date, status: "P", markedBy: userId })
        .returning();

    return { record: inserted, created: true, similarity: match.similarity };
}