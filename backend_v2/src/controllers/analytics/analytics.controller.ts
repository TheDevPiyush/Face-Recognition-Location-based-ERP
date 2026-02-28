import type { Request, Response } from "express";
import { db } from "../../db";
import { attendanceWindows, attendanceRecords, subjects, batches } from "../../db/schema";
import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";

function serverError(res: Response, err: unknown, context = "Operation failed") {
    console.error(`[analytics.controller] ${context}:`, err);
    return res.status(500).json({ error: context });
}

function param(v: string | string[] | undefined): string | null {
    if (v === undefined) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
}

// ─── GET /api/attendance/analytics ───────────────────────────────────────────
// Query params: student_id, batch_id, subject_id, start_date, end_date, month
export async function getAttendanceAnalytics(req: Request, res: Response) {
    try {
        const user = req.user!;

        // Role control — students always see own data
        let studentId: string | null = null;
        if (user.role === "student") {
            studentId = user.id;
        } else if (user.role === "teacher" || user.role === "admin") {
            studentId = param(req.query.student_id as string | undefined);
        } else {
            return res.status(403).json({ error: "Not authorized" });
        }

        const batchId = param(req.query.batch_id as string | undefined);
        const subjectId = param(req.query.subject_id as string | undefined);
        const monthStr = param(req.query.month as string | undefined);
        const startDateStr = param(req.query.start_date as string | undefined);
        const endDateStr = param(req.query.end_date as string | undefined);

        const todayDate = new Date();
        const todayStr = todayDate.toISOString().split("T")[0]!;

        const startDate = startDateStr ?? (() => {
            const d = new Date(todayDate.getTime() - 30 * 24 * 60 * 60 * 1000);
            return d.toISOString().split("T")[0]!;
        })();
        const endDate = endDateStr ?? todayStr;

        if (startDate > endDate) {
            return res.status(400).json({ error: "Invalid date range" });
        }

        // ── Windows in date range ────────────────────────────────────────────
        const windowWhere = [
            gte(attendanceWindows.date, startDate),
            lte(attendanceWindows.date, endDate),
            ...(batchId ? [eq(attendanceWindows.targetBatchId, batchId)] : []),
            ...(subjectId ? [eq(attendanceWindows.targetSubjectId, subjectId)] : []),
        ];

        const windows = await db
            .select()
            .from(attendanceWindows)
            .where(and(...windowWhere));

        // classes count per date
        const classesByDate: Record<string, number> = {};
        for (const w of windows) {
            const key = w.date as any;
            classesByDate[key] = (classesByDate[key] ?? 0) + 1;
        }

        const windowIds = windows.map((w) => w.id);

        // ── Records ──────────────────────────────────────────────────────────
        const records = windowIds.length === 0 ? [] : await db
            .select()
            .from(attendanceRecords)
            .where(and(
                inArray(attendanceRecords.attendanceWindowId, windowIds),
                ...(studentId ? [eq(attendanceRecords.userId, studentId)] : []),
            ));

        // map windowId → window for date lookups
        const windowMap = new Map(windows.map((w) => [w.id, w]));

        // ── Daily breakdown ──────────────────────────────────────────────────
        const dailyData: Record<string, { date: string; present: number; absent: number; total_classes: number }> = {};

        for (const record of records) {
            const win = windowMap.get(record.attendanceWindowId as any);
            if (!win) continue;
            const dateKey = win.date as any;

            if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                    date: dateKey,
                    present: 0,
                    absent: 0,
                    total_classes: classesByDate[dateKey] ?? 0,
                };
            }

            if (record.status === "P") {
                dailyData[dateKey]!.present += 1;
            } else {
                dailyData[dateKey]!.absent += 1;
            }
        }

        // Fill dates that had classes but no records
        for (const [dateKey, total] of Object.entries(classesByDate)) {
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = { date: dateKey, present: 0, absent: total, total_classes: total };
            }
        }

        const dailyAttendance = Object.values(dailyData).sort((a, b) =>
            a.date.localeCompare(b.date)
        );

        // ── Monthly breakdown ────────────────────────────────────────────────
        let monthly = null;

        if (monthStr) {
            const [yearStr, monStr] = monthStr.split("-");
            if (!yearStr || !monStr) {
                return res.status(400).json({ error: "Invalid month format. Use YYYY-MM" });
            }

            const year = parseInt(yearStr, 10);
            const month = parseInt(monStr, 10);
            const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

            const monthWindowWhere = [
                gte(attendanceWindows.date, monthStart),
                lte(attendanceWindows.date, monthEnd),
                ...(batchId ? [eq(attendanceWindows.targetBatchId, batchId)] : []),
                ...(subjectId ? [eq(attendanceWindows.targetSubjectId, subjectId)] : []),
            ];

            const monthWindows = await db
                .select()
                .from(attendanceWindows)
                .where(and(...monthWindowWhere));

            const monthWindowIds = monthWindows.map((w) => w.id);

            const monthRecords = monthWindowIds.length === 0 ? [] : await db
                .select()
                .from(attendanceRecords)
                .where(and(
                    inArray(attendanceRecords.attendanceWindowId, monthWindowIds),
                    ...(studentId ? [eq(attendanceRecords.userId, studentId)] : []),
                ));

            const totalClasses = monthWindows.length;
            const presentCount = monthRecords.filter((r) => r.status === "P").length;
            const percentage = totalClasses > 0
                ? Math.round((presentCount / totalClasses) * 10000) / 100
                : 0;

            // Subject-wise breakdown
            const subjectIds = [...new Set(monthWindows.map((w) => w.targetSubjectId).filter(Boolean))] as string[];

            const subjectList = subjectIds.length === 0 ? [] : await db
                .select()
                .from(subjects)
                .where(inArray(subjects.id, subjectIds));

            const subjectStats = subjectList.map((subject) => {
                const subjectWindows = monthWindows.filter((w) => w.targetSubjectId === subject.id);
                const subjectTotal = subjectWindows.length;
                const subjectWindowIds = subjectWindows.map((w) => w.id);
                const subjectPresent = monthRecords.filter(
                    (r: any) => subjectWindowIds.includes(r.attendanceWindowId) && r.status === "P"
                ).length;
                const subjectPct = subjectTotal > 0
                    ? Math.round((subjectPresent / subjectTotal) * 10000) / 100
                    : 0;

                return {
                    subject: { id: subject.id, name: subject.name, code: subject.code },
                    present: subjectPresent,
                    total_classes: subjectTotal,
                    percentage: subjectPct,
                };
            });

            monthly = {
                month: monthStr,
                total_classes: totalClasses,
                present_count: presentCount,
                percentage,
                subjects: subjectStats,
            };
        }

        // ── Summary ──────────────────────────────────────────────────────────
        const totalPresent = dailyAttendance.reduce((s, d) => s + d.present, 0);
        const totalClasses = dailyAttendance.reduce((s, d) => s + d.total_classes, 0);
        const overallPct = totalClasses > 0
            ? Math.round((totalPresent / totalClasses) * 10000) / 100
            : 0;

        return res.json({
            daily_attendance: dailyAttendance,
            monthly,
            summary: {
                total_present: totalPresent,
                total_classes: totalClasses,
                overall_percentage: overallPct,
            },
        });
    } catch (err) {
        return serverError(res, err, "Failed to fetch attendance analytics");
    }
}

// ─── GET /api/attendance/monthly-percentage ───────────────────────────────────
// Query params: batch_id, subject_id, student_id, month
export async function getMonthlyPercentage(req: Request, res: Response) {
    try {
        const user = req.user!;

        const batchId = param(req.query.batch_id as string | undefined);
        const subjectId = param(req.query.subject_id as string | undefined);
        const monthStr = param(req.query.month as string | undefined);

        let studentId: string | null = null;
        if (user.role === "student") {
            studentId = user.id;
        } else if (user.role === "teacher" || user.role === "admin") {
            studentId = param(req.query.student_id as string | undefined);
        } else {
            return res.status(403).json({ error: "Not authorized" });
        }

        const today = new Date();
        const refDate = monthStr ? new Date(`${monthStr}-01`) : new Date(today.getFullYear(), today.getMonth(), 1);
        const year = refDate.getFullYear();
        const month = refDate.getMonth() + 1;
        const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay2 = new Date(year, month, 0).getDate();
        const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay2).padStart(2, "0")}`;

        const windowWhere = [
            gte(attendanceWindows.date, monthStart),
            lte(attendanceWindows.date, monthEnd),
            ...(batchId ? [eq(attendanceWindows.targetBatchId, batchId)] : []),
            ...(subjectId ? [eq(attendanceWindows.targetSubjectId, subjectId)] : []),
        ];

        const windows = await db
            .select()
            .from(attendanceWindows)
            .where(and(...windowWhere));

        const windowIds = windows.map((w) => w.id);

        const records = windowIds.length === 0 ? [] : await db
            .select()
            .from(attendanceRecords)
            .where(and(
                inArray(attendanceRecords.attendanceWindowId, windowIds),
                ...(studentId ? [eq(attendanceRecords.userId, studentId)] : []),
            ));

        // Group by (batchId, subjectId)
        type GroupKey = string;
        const grouped: Record<GroupKey, { batchId: string; subjectId: string; present: number; total: number }> = {};

        for (const w of windows) {
            if (!w.targetBatchId || !w.targetSubjectId) continue;
            const key: GroupKey = `${w.targetBatchId}::${w.targetSubjectId}`;
            if (!grouped[key]) {
                grouped[key] = { batchId: w.targetBatchId, subjectId: w.targetSubjectId, present: 0, total: 0 };
            }
            grouped[key]!.total += 1;
        }

        for (const r of records) {
            if (r.status !== "P") continue;
            const win = windows.find((w) => w.id === r.attendanceWindowId);
            if (!win?.targetBatchId || !win.targetSubjectId) continue;
            const key: GroupKey = `${win.targetBatchId}::${win.targetSubjectId}`;
            if (grouped[key]) grouped[key]!.present += 1;
        }

        // Resolve batch + subject names
        const batchIds = [...new Set(Object.values(grouped).map((g) => g.batchId))];
        const subjectIds = [...new Set(Object.values(grouped).map((g) => g.subjectId))];

        const [batchList, subjectList] = await Promise.all([
            batchIds.length ? db.select().from(batches).where(inArray(batches.id, batchIds)) : [],
            subjectIds.length ? db.select().from(subjects).where(inArray(subjects.id, subjectIds)) : [],
        ]);

        const batchMap = new Map(batchList.map((b) => [b.id, b]));
        const subjectMap = new Map(subjectList.map((s) => [s.id, s]));

        const result = Object.values(grouped).map((g) => {
            const batch = batchMap.get(g.batchId);
            const subject = subjectMap.get(g.subjectId);
            const pct = g.total > 0 ? Math.round((g.present / g.total) * 10000) / 100 : 0;

            return {
                batch: { id: g.batchId, name: batch?.name ?? null },
                subject: { id: g.subjectId, name: subject?.name ?? null, code: subject?.code ?? null },
                statistics: { present: g.present, total_classes: g.total, percentage: pct },
            };
        });

        return res.json({
            month: monthStr ?? refDate.toISOString().slice(0, 7),
            data: result,
        });
    } catch (err) {
        return serverError(res, err, "Failed to fetch monthly percentage");
    }
}

// ─── GET /api/attendance/student-calendar ─────────────────────────────────────
// Query params: month
export async function getStudentCalendar(req: Request, res: Response) {
    try {
        const user = req.user!;

        if (user.role !== "student") {
            return res.status(403).json({ error: "Only students can access the calendar" });
        }

        if (!user.batchId) {
            return res.status(400).json({ error: "No batch assigned to your account" });
        }

        const monthStr = param(req.query.month as string | undefined);
        const today = new Date();
        const refDate = monthStr ? new Date(`${monthStr}-01`) : new Date(today.getFullYear(), today.getMonth(), 1);
        const yr = refDate.getFullYear();
        const mo = refDate.getMonth() + 1;
        const monthStart = `${yr}-${String(mo).padStart(2, "0")}-01`;
        const calLastDay = new Date(yr, mo, 0).getDate();
        const monthEnd = `${yr}-${String(mo).padStart(2, "0")}-${String(calLastDay).padStart(2, "0")}`;

        const [batch, subjectList, windows] = await Promise.all([
            db.select().from(batches).where(eq(batches.id, user.batchId)).limit(1),
            db.select().from(subjects).where(eq(subjects.batchId, user.batchId)),
            db.select().from(attendanceWindows).where(and(
                eq(attendanceWindows.targetBatchId, user.batchId),
                gte(attendanceWindows.date, monthStart),
                lte(attendanceWindows.date, monthEnd),
            )),
        ]);

        if (!batch[0]) return res.status(404).json({ error: "Batch not found" });

        const windowIds = windows.map((w) => w.id);

        const records = windowIds.length === 0 ? [] : await db
            .select()
            .from(attendanceRecords)
            .where(and(
                eq(attendanceRecords.userId, user.id),
                inArray(attendanceRecords.attendanceWindowId, windowIds),
            ));

        // map (subjectId, dateStr) → "P" | "A"
        const recordMap = new Map<string, "P" | "A">();
        for (const r of records) {
            const win = windows.find((w) => w.id === r.attendanceWindowId);
            if (!win) continue;
            const key = `${win.targetSubjectId}::${win.date}`;
            recordMap.set(key, r.status === "P" ? "P" : "A");
        }

        const daysInMonth = calLastDay;

        const calendarData = subjectList.map((subject) => {
            const dates: Record<string, "P" | "A" | "NA"> = {};

            for (let day = 1; day <= daysInMonth; day++) {
                const dateObj = new Date(refDate.getFullYear(), refDate.getMonth(), day);
                const dateKey = dateObj.toISOString().split("T")[0]!;

                const windowExists = windows.some(
                    (w) => w.targetSubjectId === subject.id &&
                        w.date === dateKey
                );

                if (!windowExists) {
                    dates[dateKey] = "NA";
                } else {
                    dates[dateKey] = recordMap.get(`${subject.id}::${dateKey}`) ?? "A";
                }
            }

            return {
                subject: { id: subject.id, name: subject.name, code: subject.code },
                dates,
            };
        });

        return res.json({
            month: monthStr ?? refDate.toISOString().slice(0, 7),
            batch: { id: batch[0].id, name: batch[0].name },
            calendar: calendarData,
        });
    } catch (err) {
        return serverError(res, err, "Failed to fetch student calendar");
    }
}