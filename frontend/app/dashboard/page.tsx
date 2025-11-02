"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchMe,
  fetchBatches,
  fetchSubjects,
  fetchStudents,
  getWindow,
  markAttendance,
  upsertWindow,
  updateMyLocation,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import Alert from "@/components/Alert";

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

  if (loading) return <p>Loading...</p>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Welcome{me?.name ? `, ${me.name}` : ""}</h1>
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <a href="/attendance" className="rounded-md border border-border p-4 hover:bg-muted">
          <div className="text-sm opacity-70">Quick action</div>
          <div className="text-lg font-medium">Mark Attendance →</div>
        </a>
        <a href="/subjects" className="rounded-md border border-border p-4 hover:bg-muted">
          <div className="text-sm opacity-70">Browse</div>
          <div className="text-lg font-medium">My Subjects →</div>
        </a>
        <a href="/profile" className="rounded-md border border-border p-4 hover:bg-muted">
          <div className="text-sm opacity-70">Account</div>
          <div className="text-lg font-medium">Profile →</div>
        </a>
      </div>

      <div className="card">
        <div className="mb-2 text-lg font-medium">Subjects in your batch</div>
        {mySubjects.length ? (
          <ul className="list-inside list-disc space-y-1 text-sm">
            {mySubjects.slice(0, 6).map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        ) : (
          <div className="text-sm opacity-70">No subjects found.</div>
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
    <div className="space-y-6">
      <div className="card grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm">Batch</label>
          <select className="select" value={batchId} onChange={(e) => setBatchId(Number(e.target.value))}>
            <option value="">Select</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm">Subject</label>
          <select className="select" value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))}>
            <option value="">Select</option>
            {filteredSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm">Duration (minutes)</label>
          <input className="input" type="number" min={1} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
        </div>
        <div className="sm:col-span-3 flex flex-wrap gap-3">
          <button className="btn" onClick={openWindow} disabled={loading}>Open window</button>
          <button className="btn-outline" onClick={closeWindow} disabled={loading}>Close window</button>
        </div>
        {windowInfo ? (
          <div className="sm:col-span-3 text-sm opacity-80">Current Window: ID {windowInfo.id} · Active: {String(windowInfo.is_active)} · Duration(s): {windowInfo.duration}</div>
        ) : (
          <div className="sm:col-span-3 text-sm opacity-80">No window</div>
        )}
        {message ? (
          <div className="sm:col-span-3"><Alert type={message.toLowerCase().includes("error") ? "error" : "info"}>{message}</Alert></div>
        ) : null}
      </div>

      <div className="card">
        <div className="mb-3 text-lg font-medium">Students</div>
        {batchId ? (
          <div className="space-y-2">
            {studentsInBatch.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded border border-border p-2">
                <div>
                  <div className="font-medium">{s.name || s.email || `#${s.id}`}</div>
                  <div className="text-sm opacity-70">ID: {s.id}</div>
                </div>
                <button className="btn" disabled={!windowInfo?.id} onClick={() => markForStudent(s.id)}>
                  Mark Present
                </button>
              </div>
            ))}
            {studentsInBatch.length === 0 ? <div className="text-sm opacity-70">No students found for selected batch.</div> : null}
          </div>
        ) : (
          <div className="text-sm opacity-70">Select a batch to view students.</div>
        )}
      </div>
    </div>
  );
}


