"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchMe,
  fetchBatches,
  fetchSubjects,
  fetchStudents,
  getWindow,
  markAttendance,
  upsertWindow,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import Alert from "@/app/components/Alert";

type Batch = { id: number; name: string };
type Subject = { id: number; name: string; batch: number };
type Student = { id: number; name: string | null; email: string | null; role: string; batch?: any };

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [meRes, subs, bats] = await Promise.all([fetchMe(), fetchSubjects(), fetchBatches()]);
        setMe(meRes);
        setSubjects(subs as any);
        setBatches(bats as any);
        if (meRes?.role !== "student") {
          const studs = await fetchStudents();
          setStudents(studs as any);
        }
      } catch (e) {
        setError("Failed to load data");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="card-soft text-center text-sm text-[var(--muted-foreground)]">
        Loading your dashboard magic...
      </div>
    );
  }
  if (error) return <Alert type="error">{error}</Alert>;

  const displayName = me?.name || me?.email || "friend";
  const roleLabel = me?.role ? me.role.replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Explorer";

  return (
    <div className="space-y-10">
      <div className="card-soft relative overflow-hidden px-8 py-10">
        <div className="pointer-events-none absolute -top-24 right-[-20%] h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-[-10%] h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <span className="badge bg-primary/20 text-primary">Dashboard</span>
            <h1 className="section-title text-4xl">
              Hi {displayName.split(" ")[0] || "there"}! 👋
            </h1>
            <p className="section-subtitle max-w-xl">
              Your {roleLabel.toLowerCase()} mission control is ready. Peek at attendance, subjects and joyful campus updates—all
              wrapped in soft pastel calm.
            </p>
            <div className="flex flex-wrap gap-3 pt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2">
                🎓 Role · <span className="text-foreground">{roleLabel}</span>
              </span>
              {me?.batch?.name ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2">
                  🧑‍🤝‍🧑 Batch · <span className="text-foreground">{me.batch.name}</span>
                </span>
              ) : null}
            </div>
          </div>
          <div className="grid w-full gap-4 sm:grid-cols-2 md:max-w-sm">
            <Link href="/attendance" className="grid-card">
              <div className="flex items-center justify-between text-sm font-medium text-[var(--muted-foreground)]">
                Attendance
                <span className="text-lg">🕒</span>
              </div>
              <div className="mt-4 text-lg font-semibold text-foreground">Mark my presence</div>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">A quick tap keeps you in the clear.</p>
            </Link>
            <Link href="/subjects" className="grid-card">
              <div className="flex items-center justify-between text-sm font-medium text-[var(--muted-foreground)]">
                Subjects
                <span className="text-lg">📚</span>
              </div>
              <div className="mt-4 text-lg font-semibold text-foreground">Review my subjects</div>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">Stay in tune with your schedule.</p>
            </Link>
          </div>
        </div>
      </div>

      {me?.role === "student" ? (
        <StudentDashboard me={me} subjects={subjects} />
      ) : (
        <TeacherPanel subjects={subjects} batches={batches} students={students} />
      )}
    </div>
  );
}

function StudentDashboard({ me, subjects }: { me: any; subjects: Subject[] }) {
  const myBatchId = me?.batch?.id as number | undefined;
  const mySubjects = useMemo(
    () => subjects.filter((s) => s.batch === myBatchId),
    [subjects, myBatchId]
  );

  const quickLinks = [
    {
      href: "/attendance",
      title: "Mark attendance",
      emoji: "🪄",
      description: "Tap in and stay on track",
    },
    {
      href: "/subjects",
      title: "Explore subjects",
      emoji: "🌈",
      description: "Peek at your pastel timetable",
    },
    {
      href: "/profile",
      title: "Update profile",
      emoji: "💖",
      description: "Keep your details sparkling",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {quickLinks.map((item) => (
          <Link key={item.href} href={item.href} className="grid-card">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              <span>{item.emoji} Quick link</span>
              <span>→</span>
            </div>
            <div className="mt-4 text-lg font-semibold text-foreground">{item.title}</div>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">{item.description}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xl font-semibold text-foreground">Subjects in your batch</div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              A cozy list of everything you&apos;re learning this season.
            </p>
          </div>
          <span className="badge bg-accent/20 text-accent-foreground">
            {mySubjects.length} {mySubjects.length === 1 ? "subject" : "subjects"}
          </span>
        </div>
        {mySubjects.length ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {mySubjects.slice(0, 6).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3 text-sm shadow-inner"
              >
                <span className="font-medium text-foreground">{s.name}</span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  #{s.id}
                </span>
              </div>
            ))}
            {mySubjects.length > 6 ? (
              <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-[var(--muted-foreground)]">
                and {mySubjects.length - 6} more lovely subjects...
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-white/60 px-5 py-6 text-sm text-[var(--muted-foreground)]">
            No subjects found yet. Check back after enrollment updates 💫
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherPanel({ subjects, batches, students }: { subjects: Subject[]; batches: Batch[]; students: Student[] }) {
  const [batchId, setBatchId] = useState<number | undefined>();
  const filteredSubjects = useMemo(
    () => subjects.filter((s) => (batchId ? s.batch === batchId : true)),
    [subjects, batchId]
  );
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [durationMin, setDurationMin] = useState<number>(15);
  const [windowInfo, setWindowInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshWindow = async (b?: number, s?: number) => {
    if (!b || !s) return;
    try {
      const w = await getWindow(b, s);
      setWindowInfo(w);
    } catch {
      setWindowInfo(null);
    }
  };

  useEffect(() => {
    refreshWindow(batchId, subjectId);
  }, [batchId, subjectId]);

  const openWindow = async () => {
    if (!batchId || !subjectId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await upsertWindow({
        target_batch: batchId,
        target_subject: subjectId,
        is_active: true,
        duration: Math.max(1, Math.floor(durationMin)) * 60,
      });
      setWindowInfo(res);
      setMessage("Window opened");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const closeWindow = async () => {
    if (!batchId || !subjectId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await upsertWindow({
        target_batch: batchId,
        target_subject: subjectId,
        is_active: false,
      });
      setWindowInfo(res);
      setMessage("Window updated");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const studentsInBatch = useMemo(
    () => students.filter((s) => s.batch?.id === batchId),
    [students, batchId]
  );

  const markForStudent = async (userId: number) => {
    if (!windowInfo?.id) return;
    try {
      await markAttendance(windowInfo.id, userId);
      setMessage("Marked present");
    } catch (e: any) {
      setMessage(e.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="card-soft space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-foreground">Open attendance window</div>
            <p className="text-sm text-[var(--muted-foreground)]">
              Choose a batch &amp; subject, then sprinkle in the duration to open the window.
            </p>
          </div>
          <span className="badge bg-primary/15 text-primary">Teacher tools</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block">Batch</label>
            <select className="select" value={batchId ?? ""} onChange={(e) => setBatchId(Number(e.target.value) || undefined)}>
              <option value="">Select batch</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || `Batch ${b.id}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block">Subject</label>
            <select className="select" value={subjectId ?? ""} onChange={(e) => setSubjectId(Number(e.target.value) || undefined)}>
              <option value="">Select subject</option>
              {filteredSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block">Duration (minutes)</label>
            <input
              className="input"
              type="number"
              min={1}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn" onClick={openWindow} disabled={loading}>
            Open window
          </button>
          <button className="btn-outline" onClick={closeWindow} disabled={loading}>
            Close window
          </button>
          <button className="btn-ghost" onClick={() => refreshWindow(batchId, subjectId)}>
            Refresh status
          </button>
        </div>

        {windowInfo ? (
          <div className="rounded-2xl bg-white/70 px-5 py-4 text-sm text-[var(--muted-foreground)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="badge bg-primary/20 text-primary">Window #{windowInfo.id}</span>
              <span className="text-base font-medium text-foreground">
                {windowInfo.is_active ? "🟢 Active now" : "🔴 Closed"}
              </span>
              {windowInfo.duration ? (
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Duration · {windowInfo.duration} seconds
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/60 px-5 py-4 text-sm text-[var(--muted-foreground)]">
            No window is active yet. Open one when your class is ready 🌼
          </div>
        )}

        {message ? (
          <Alert type={message.toLowerCase().includes("error") ? "error" : "info"} dismissible>
            {message}
          </Alert>
        ) : null}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-foreground">Students in batch</div>
            <p className="text-sm text-[var(--muted-foreground)]">
              Choose a batch to see who&apos;s buzzing around and mark them present manually if needed.
            </p>
          </div>
          <span className="badge bg-accent/20 text-accent-foreground">
            {studentsInBatch.length} {studentsInBatch.length === 1 ? "student" : "students"}
          </span>
        </div>
        {batchId ? (
          <div className="mt-6 space-y-3">
            {studentsInBatch.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/80 px-5 py-3 text-sm"
              >
                <div>
                  <div className="font-semibold text-foreground">{s.name || s.email || `#${s.id}`}</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">ID · {s.id}</div>
                </div>
                <button className="btn" disabled={!windowInfo?.id} onClick={() => markForStudent(s.id)}>
                  Mark present
                </button>
              </div>
            ))}
            {studentsInBatch.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/60 px-5 py-6 text-sm text-[var(--muted-foreground)]">
                No students found for the selected batch just yet.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-white/60 px-5 py-6 text-sm text-[var(--muted-foreground)]">
            Select a batch above to peek at your lovely learners 🌟
          </div>
        )}
      </div>
    </div>
  );
}
