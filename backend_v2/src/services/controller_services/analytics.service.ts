import { db } from "../../db";
import { attendanceWindows, attendanceRecords, subjects, batches } from "../../db/schema";
import { and, eq, gte, lte, inArray } from "drizzle-orm";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function monthBounds(yr: number, mo: number) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const last = new Date(yr, mo, 0).getDate();
    return {
        monthStart: `${yr}-${pad(mo)}-01`,
        monthEnd: `${yr}-${pad(mo)}-${pad(last)}`,
        lastDay: last,
    };
}

async function fetchWindows(filters: {
    dateStart: string;
    dateEnd: string;
    batchId?: string | null;
    subjectId?: string | null;
}) {
    const where = [
        gte(attendanceWindows.date, filters.dateStart),
        lte(attendanceWindows.date, filters.dateEnd),
        ...(filters.batchId ? [eq(attendanceWindows.targetBatchId, filters.batchId)] : []),
        ...(filters.subjectId ? [eq(attendanceWindows.targetSubjectId, filters.subjectId)] : []),
    ];
    return db.select().from(attendanceWindows).where(and(...where));
}

async function fetchRecords(windowIds: string[], studentId?: string | null) {
    if (!windowIds.length) return [];
    const where = [
        inArray(attendanceRecords.attendanceWindowId, windowIds),
        ...(studentId ? [eq(attendanceRecords.userId, studentId)] : []),
    ];
    return db.select().from(attendanceRecords).where(and(...where));
}

// unique (subject, date) pairs → how many distinct classes happened per date
function classesByDate(windows: { date: string; targetSubjectId: string | null }[]) {
    const perDate: Record<string, Set<string>> = {};
    for (const w of windows) {
        if (!w.targetSubjectId) continue;
        (perDate[w.date] ??= new Set()).add(w.targetSubjectId);
    }
    return Object.fromEntries(
        Object.entries(perDate).map(([date, subs]) => [date, subs.size])
    ) as Record<string, number>;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function buildAnalytics(opts: {
    studentId: string | null;
    batchId: string | null;
    subjectId: string | null;
    startDate: string;
    endDate: string;
    monthStr: string | null;
}) {
    const { studentId, batchId, subjectId, startDate, endDate, monthStr } = opts;

    const windows = await fetchWindows({ dateStart: startDate, dateEnd: endDate, batchId, subjectId });
    const counts = classesByDate(windows as any);
    const windowMap = new Map(windows.map((w) => [w.id, w]));

    const records = await fetchRecords(windows.map((w) => w.id), studentId);

    // daily breakdown
    const daily: Record<string, { date: string; present: number; absent: number; total_classes: number }> = {};

    for (const r of records) {
        const win = windowMap.get(r.attendanceWindowId as string);

        if (!win) continue;

        const d = win.date;

        daily[d as string] ??= { date: d as string, present: 0, absent: 0, total_classes: counts[d as string] ?? 0 };

        if (r.status === "P") daily[d as string]!.present++;
        else daily[d as string]!.absent++;
    }

    for (const [d, total] of Object.entries(counts)) {
        daily[d] ??= { date: d, present: 0, absent: total, total_classes: total };
    }

    const dailyAttendance = Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));

    // monthly breakdown
    let monthly = null;
    if (monthStr) {
        const [yearStr, monStr] = monthStr.split("-");
        if (!yearStr || !monStr) throw new Error("Invalid month format. Use YYYY-MM");

        const yr = parseInt(yearStr, 10);
        const mo = parseInt(monStr, 10);
        const { monthStart, monthEnd } = monthBounds(yr, mo);

        const mWindows = await fetchWindows({ dateStart: monthStart, dateEnd: monthEnd, batchId, subjectId });
        const mRecords = await fetchRecords(mWindows.map((w) => w.id), studentId);

        const presentIds = new Set(mRecords.filter((r) => r.status === "P").map((r) => r.attendanceWindowId));

        const subjectIds = [...new Set(mWindows.map((w) => w.targetSubjectId).filter(Boolean))] as string[];
        const subjectList = subjectIds.length
            ? await db.select().from(subjects).where(inArray(subjects.id, subjectIds))
            : [];

        const subjectStats = subjectList.map((subject) => {
            const sWindows = mWindows.filter((w) => w.targetSubjectId === subject.id);
            const classDates = [...new Set(sWindows.map((w) => w.date))];
            const total = classDates.length;
            const present = classDates.filter((date) =>
                sWindows.filter((w) => w.date === date).some((w) => presentIds.has(w.id))
            ).length;

            return {
                subject: { id: subject.id, name: subject.name, code: subject.code },
                present,
                total_classes: total,
                percentage: total > 0 ? Math.round((present / total) * 10000) / 100 : 0,
            };
        });

        const totalClasses = subjectStats.reduce((s, x) => s + x.total_classes, 0);
        const presentCount = subjectStats.reduce((s, x) => s + x.present, 0);

        monthly = {
            month: monthStr,
            total_classes: totalClasses,
            present_count: presentCount,
            percentage: totalClasses > 0 ? Math.round((presentCount / totalClasses) * 10000) / 100 : 0,
            subjects: subjectStats,
        };
    }

    const totalPresent = dailyAttendance.reduce((s, d) => s + d.present, 0);
    const totalClasses = dailyAttendance.reduce((s, d) => s + d.total_classes, 0);

    return {
        daily_attendance: dailyAttendance,
        monthly,
        summary: {
            total_present: totalPresent,
            total_classes: totalClasses,
            overall_percentage: totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 10000) / 100 : 0,
        },
    };
}

// ─── Monthly percentage ───────────────────────────────────────────────────────

export async function buildMonthlyPercentage(opts: {
    studentId: string | null;
    batchId: string | null;
    subjectId: string | null;
    monthStr: string | null;
}) {
    const { studentId, batchId, subjectId, monthStr } = opts;

    const today = new Date();
    const refDate = monthStr ? new Date(`${monthStr}-01`) : new Date(today.getFullYear(), today.getMonth(), 1);
    const yr = refDate.getFullYear();
    const mo = refDate.getMonth() + 1;
    const { monthStart, monthEnd } = monthBounds(yr, mo);

    const windows = await fetchWindows({ dateStart: monthStart, dateEnd: monthEnd, batchId, subjectId });
    const records = await fetchRecords(windows.map((w) => w.id), studentId);

    // group by (batch, subject)
    const grouped: Record<string, { batchId: string; subjectId: string; dates: Set<string>; presentDates: Set<string> }> = {};

    for (const w of windows) {
        if (!w.targetBatchId || !w.targetSubjectId) continue;
        const key = `${w.targetBatchId}::${w.targetSubjectId}`;
        grouped[key] ??= { batchId: w.targetBatchId, subjectId: w.targetSubjectId, dates: new Set(), presentDates: new Set() };
        grouped[key]!.dates.add(w.date as string);
    }

    const presentWindowIds = new Set(records.filter((r) => r.status === "P").map((r) => r.attendanceWindowId));
    const windowMap = new Map(windows.map((w) => [w.id, w]));

    for (const [wid] of presentWindowIds.entries()) {
        const win = windowMap.get(wid as string);
        if (!win?.targetBatchId || !win.targetSubjectId) continue;
        const key = `${win.targetBatchId}::${win.targetSubjectId}`;
        grouped[key]?.presentDates.add(win.date as string);
    }

    const batchIds = [...new Set(Object.values(grouped).map((g) => g.batchId))];
    const subjectIds = [...new Set(Object.values(grouped).map((g) => g.subjectId))];

    const [batchList, subjectList] = await Promise.all([
        batchIds.length ? db.select().from(batches).where(inArray(batches.id, batchIds)) : [],
        subjectIds.length ? db.select().from(subjects).where(inArray(subjects.id, subjectIds)) : [],
    ]);

    const batchMap = new Map(batchList.map((b) => [b.id, b]));
    const subjectMap = new Map(subjectList.map((s) => [s.id, s]));

    const data = Object.values(grouped).map((g) => {
        const total = g.dates.size;
        const present = g.presentDates.size;
        return {
            batch: { id: g.batchId, name: batchMap.get(g.batchId)?.name ?? null },
            subject: { id: g.subjectId, name: subjectMap.get(g.subjectId)?.name ?? null, code: subjectMap.get(g.subjectId)?.code ?? null },
            statistics: { present, total_classes: total, percentage: total > 0 ? Math.round((present / total) * 10000) / 100 : 0 },
        };
    });

    return {
        month: `${yr}-${String(mo).padStart(2, "0")}`,
        data,
    };
}

// ─── Student calendar ─────────────────────────────────────────────────────────

export async function buildStudentCalendar(userId: string, batchId: string, monthStr: string | null) {
    const today = new Date();
    const refDate = monthStr ? new Date(`${monthStr}-01`) : new Date(today.getFullYear(), today.getMonth(), 1);
    const yr = refDate.getFullYear();
    const mo = refDate.getMonth() + 1;
    const pad = (n: number) => String(n).padStart(2, "0");
    const { monthStart, monthEnd, lastDay } = monthBounds(yr, mo);

    const [batchRow, subjectList] = await Promise.all([
        db.select().from(batches).where(eq(batches.id, batchId)).limit(1),
        db.select().from(subjects).where(eq(subjects.batchId, batchId)),
    ]);

    if (!batchRow[0]) throw new Error("Batch not found");

    const windows = await fetchWindows({ dateStart: monthStart, dateEnd: monthEnd, batchId });
    const records = await fetchRecords(windows.map((w) => w.id).filter(Boolean), userId);

    // only P records matter for calendar
    const presentWindowIds = new Set(
        records.filter((r) => r.status === "P").map((r) => r.attendanceWindowId)
    );

    const calendar = subjectList.map((subject) => {
        const dates: Record<string, "P" | "A" | "NA"> = {};

        for (let day = 1; day <= lastDay; day++) {
            const dateKey = `${yr}-${pad(mo)}-${pad(day)}`;
            const dayWins = windows.filter((w) => w.targetSubjectId === subject.id && w.date === dateKey);

            if (!dayWins.length) {
                dates[dateKey] = "NA";
            } else {
                dates[dateKey] = dayWins.some((w) => presentWindowIds.has(w.id)) ? "P" : "A";
            }
        }

        return { subject: { id: subject.id, name: subject.name, code: subject.code }, dates };
    });

    return {
        month: `${yr}-${pad(mo)}`,
        batch: { id: batchRow[0].id, name: batchRow[0].name },
        calendar,
    };
}