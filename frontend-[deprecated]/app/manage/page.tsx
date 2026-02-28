"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchMe,
  fetchUniversities,
  fetchCourses,
  fetchBatches,
  fetchSubjects,
  fetchUsersAll,
  createUniversity,
  createCourse,
  createBatch,
  createSubject,
  createUser,
  getWindow,
  upsertWindow,
  createMultipleUsers,
} from "@/lib/api";
import Alert from "@/app/components/Alert";
import Toast from "@/app/components/Toast";
import { useRouter } from "next/navigation";

export default function ManagePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [universities, setUniversities] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // selection state (progressive)
  const [universityId, setUniversityId] = useState<number | undefined>();
  const [courseId, setCourseId] = useState<number | undefined>();
  const [batchId, setBatchId] = useState<number | undefined>();

  // toast notifications
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "error" | "info" }>>([]);
  const addToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const meRes = await fetchMe();
        setMe(meRes);
        if (meRes?.role === "student") {
          router.replace("/dashboard");
          return;
        }
        const [unis, crs, bats, subs] = await Promise.all([
          fetchUniversities(),
          fetchCourses(),
          fetchBatches(),
          fetchSubjects(),
        ]);
        setUniversities(unis as any[]);
        setCourses(crs as any[]);
        setBatches(bats as any[]);
        setSubjects(subs as any[]);
        // Students will be fetched on demand per batch where needed
        if (meRes?.role === "admin") {
          const allUsers = await fetchUsersAll();
          setUsers(allUsers as any[]);
        }
      } catch (e: any) {
        setError(e.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const filteredCourses = useMemo(
    () => courses.filter((c) => (universityId ? c.university === universityId : true)),
    [courses, universityId]
  );
  const filteredBatches = useMemo(
    () => batches.filter((b) => (courseId ? b.course === courseId : true)),
    [batches, courseId]
  );
  const filteredSubjects = useMemo(
    () => subjects.filter((s) => (batchId ? s.batch === batchId : true)),
    [subjects, batchId]
  );

  if (loading) return <div className="card-soft text-sm text-[var(--muted-foreground)]">Loading your management studio...</div>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="space-y-10">
      <section className="card-soft relative overflow-hidden px-8 py-10">
        <div className="pointer-events-none absolute -top-28 right-[-10%] h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-[-15%] h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <span className="badge bg-primary/20 text-primary">Admin atelier</span>
            <h1 className="section-title text-4xl">Craft your campus universe</h1>
            <p className="section-subtitle max-w-2xl">
              Create universities, courses, subjects, and batches. Everything responds with warm gradients, so managing feels soft.
            </p>
          </div>
          <div className="grid w-full max-w-sm gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            <span className="rounded-2xl bg-white/80 px-4 py-3">
              Universities · {universities.length}
            </span>
            <span className="rounded-2xl bg-white/80 px-4 py-3">
              Courses · {courses.length}
            </span>
            <span className="rounded-2xl bg-white/80 px-4 py-3">
              Batches · {batches.length}
            </span>
          </div>
        </div>
      </section>

      {/* Progressive selectors */}
      <section className="card-soft space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-foreground">Filter by hierarchy</div>
            <p className="text-sm text-[var(--muted-foreground)]">
              Narrow down your view to keep your magic focused.
            </p>
          </div>
          <span className="badge bg-accent/20 text-accent-foreground">Lovely filters</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block">University</label>
            <select className="select" value={universityId} onChange={(e) => setUniversityId(Number(e.target.value) || undefined)}>
              <option value="">All</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block">Course</label>
            <select className="select" value={courseId} onChange={(e) => setCourseId(Number(e.target.value) || undefined)}>
              <option value="">{universityId ? "Select course" : "All"}</option>
              {filteredCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block">Batch</label>
            <select className="select" value={batchId} onChange={(e) => setBatchId(Number(e.target.value) || undefined)}>
              <option value="">{courseId ? "Select batch" : "All"}</option>
              {filteredBatches.map((b) => (
                <option key={b.id} value={b.id}>{b.name || b.code || `#${b.id}`}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Two-column grid for create forms */}
      <div className="space-y-8">
        {/* Row 1: University + Course */}
        <div className="grid gap-6 lg:grid-cols-2">
          <CreateUniversity
            onCreated={(u) => { setUniversities([u, ...universities]); addToast("✅ University created successfully", "success"); }}
            onError={(msg) => addToast(`❌ ${msg}`, "error")}
          />
          <CreateCourse
            universities={universities}
            defaultUniversityId={universityId}
            onCreated={(c) => { setCourses([c, ...courses]); addToast("✅ Course created successfully", "success"); }}
            onError={(msg) => addToast(`❌ ${msg}`, "error")}
          />
        </div>

        {/* Row 2: Batch + Subject */}
        <div className="grid gap-6 lg:grid-cols-2">
          <CreateBatch
            courses={filteredCourses}
            allCourses={courses}
            defaultCourseId={courseId}
            onCreated={(b) => { setBatches([b, ...batches]); addToast("✅ Batch created successfully", "success"); }}
            onError={(msg) => addToast(`❌ ${msg}`, "error")}
          />
          <CreateSubject
            batches={filteredBatches}
            allBatches={batches}
            defaultBatchId={batchId}
            onCreated={(s) => { setSubjects([s, ...subjects]); addToast("✅ Subject created successfully", "success"); }}
            onError={(msg) => addToast(`❌ ${msg}`, "error")}
          />
        </div>
      </div>

      {/* Full-width sections */}
      {/* <ManageWindow
        batches={filteredBatches}
        subjects={filteredSubjects}
        onUpdated={() => addToast("✅ Attendance window updated", "success")}
        onError={(msg) => addToast(`❌ ${msg}`, "error")}
      /> */}

      {me?.role === "admin" ? (
        <>
          <CreateStudent
            batches={filteredBatches}
            allBatches={batches}
            defaultBatchId={batchId}
            onCreated={() => addToast("✅ Student created successfully", "success")}
            onError={(msg) => addToast(`❌ ${msg}`, "error")}
          />
          <CreateStudentsFromCSV
            batches={filteredBatches}
            allBatches={batches}
            defaultBatchId={batchId}
            onCreated={() => addToast("✅ Students created successfully from CSV", "success")}
            onError={(msg) => addToast(`❌ ${msg}`, "error")}
          />
        </>
      ) : null}

      {/* Toast notifications */}
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function CreateUniversity({ onCreated, onError }: { onCreated: (u: any) => void; onError: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await createUniversity({ name, code: code || null, address: address || null });
      onCreated(u);
      setName(""); setCode(""); setAddress("");
    } catch (e: any) {
      onError(e.message || "Failed to create university");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card-soft flex h-full flex-col gap-6 p-8 transition-transform hover:-translate-y-0.5 hover:shadow-xl">
      <div>
        <div className="text-lg font-semibold text-foreground">🏢 Add university</div>
        <p className="text-sm text-[var(--muted-foreground)]">Create a new campus realm with a friendly code.</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-1 flex-col space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <input className="input" placeholder="University Name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <input className="input" placeholder="University Code" value={code} onChange={(e) => setCode(e.target.value)} required />
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Code must be unique</p>
          </div>
        </div>
        <div>
          <input className="input" placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="pt-2">
          <button className="btn" disabled={loading} type="submit">
            {loading ? "Creating..." : "Create University"}
          </button>
        </div>
      </form>
    </section>
  );
}

function CreateCourse({ universities, defaultUniversityId, onCreated, onError }: { universities: any[]; defaultUniversityId?: number; onCreated: (c: any) => void; onError: (msg: string) => void }) {
  const [university, setUniversity] = useState<number | undefined>(defaultUniversityId);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUniversity(defaultUniversityId);
  }, [defaultUniversityId]);

  const uniCode = useMemo(() => universities.find((u) => u.id === university)?.code || "", [universities, university]);
  const previewName = useMemo(() => {
    const parts = [] as string[];
    if (code) parts.push(code);
    if (uniCode) parts.push(uniCode);
    return parts.join(" - ");
  }, [code, uniCode]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!university) { onError("Select a university"); return; }
    setLoading(true);
    try {
      const c = await createCourse({ university, code: code || null });
      onCreated(c);
      setCode("");
    } catch (e: any) {
      onError(e.message || "Failed to create course");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card-soft flex h-full flex-col gap-6 p-8 transition-transform hover:-translate-y-0.5 hover:shadow-xl">
      <div>
        <div className="text-lg font-semibold text-foreground">🎓 Add course</div>
        <p className="text-sm text-[var(--muted-foreground)]">Drop a shiny new programme under the right university.</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-1 flex-col space-y-4">
        <div>
          <label className="mb-1 block text-sm opacity-80">University</label>
          <select className="select" value={university} onChange={(e) => setUniversity(Number(e.target.value) || undefined)}>
            <option value="">Select university</option>
            {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <input className="input" placeholder="Course code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">e.g., BCA, MCA, BSc</p>
        </div>
        {previewName && <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-[var(--muted-foreground)]">Preview: {previewName}</div>}
        <div className="pt-2">
          <button className="btn" disabled={loading} type="submit">
            {loading ? "Creating..." : "Create Course"}
          </button>
        </div>
      </form>
    </section>
  );
}

function CreateBatch({ courses, allCourses, defaultCourseId, onCreated, onError }: { courses: any[]; allCourses: any[]; defaultCourseId?: number; onCreated: (b: any) => void; onError: (msg: string) => void }) {
  const [course, setCourse] = useState<number | undefined>(defaultCourseId);
  const [code, setCode] = useState("");
  const [startYear, setStartYear] = useState<number | "" | undefined>("");
  const [endYear, setEndYear] = useState<number | "" | undefined>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setCourse(defaultCourseId); }, [defaultCourseId]);

  const courseName = useMemo(() => {
    const list = (courses.length ? courses : allCourses) as any[];
    return list.find((c) => c.id === course)?.name || "";
  }, [courses, allCourses, course]);
  const previewName = useMemo(() => {
    const years = typeof startYear === "number" && typeof endYear === "number" && startYear && endYear ? `${startYear}-${endYear}` : "";
    return [courseName, code || "", years].filter(Boolean).join("-");
  }, [courseName, code, startYear, endYear]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) { onError("Select a course"); return; }
    setLoading(true);
    try {
      const payload = {
        course,
        code: code || null,
        start_year: typeof startYear === "number" ? startYear : null,
        end_year: typeof endYear === "number" ? endYear : null,
      };
      const b = await createBatch(payload as any);
      onCreated(b);
      setCode(""); setStartYear(""); setEndYear("");
    } catch (e: any) {
      onError(e.message || "Failed to create batch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card-soft flex h-full flex-col gap-6 p-8 transition-transform hover:-translate-y-0.5 hover:shadow-xl">
      <div>
        <div className="text-lg font-semibold text-foreground">👥 Add batch</div>
        <p className="text-sm text-[var(--muted-foreground)]">Gather students into a snug new batch for their course.</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-1 flex-col space-y-4">
        <div>
          <label className="mb-1 block text-sm opacity-80">Course</label>
          <select className="select" value={course} onChange={(e) => setCourse(Number(e.target.value) || undefined)}>
            <option value="">Select course</option>
            {(courses.length ? courses : allCourses).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <input className="input" placeholder="Batch code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">e.g., B1, B2, A</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <input className="input" placeholder="Start year" required type="number" value={startYear} onChange={(e) => setStartYear(Number(e.target.value) || "")} />
          <input className="input" placeholder="End year" required type="number" value={endYear} onChange={(e) => setEndYear(Number(e.target.value) || "")} />
        </div>
        {previewName && <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-[var(--muted-foreground)]">Preview: {previewName}</div>}
        <div className="pt-2">
          <button className="btn" disabled={loading} type="submit">
            {loading ? "Creating..." : "Create Batch"}
          </button>
        </div>
      </form>
    </section>
  );
}

function CreateSubject({ batches, allBatches, defaultBatchId, onCreated, onError }: { batches: any[]; allBatches: any[]; defaultBatchId?: number; onCreated: (s: any) => void; onError: (msg: string) => void }) {
  const [batch, setBatch] = useState<number | undefined>(defaultBatchId);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setBatch(defaultBatchId); }, [defaultBatchId]);

  const batchName = useMemo(() => {
    const list = (batches.length ? batches : allBatches) as any[];
    return list.find((b) => b.id === batch)?.name || "";
  }, [batches, allBatches, batch]);
  const previewName = useMemo(() => {
    const parts = [] as string[];
    if (code) parts.push(code);
    if (batchName) parts.push(batchName);
    return parts.join(" - ");
  }, [code, batchName]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch) { onError("Select a batch"); return; }
    setLoading(true);
    try {
      const s = await createSubject({ batch, code });
      onCreated(s);
      setCode("");
    } catch (e: any) {
      onError(e.message || "Failed to create subject");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card-soft flex h-full flex-col gap-6 p-8 transition-transform hover:-translate-y-0.5 hover:shadow-xl">
      <div>
        <div className="text-lg font-semibold text-foreground">🖋️ Add subject</div>
        <p className="text-sm text-[var(--muted-foreground)]">Add a lovely subject and tie it neatly to a batch.</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-1 flex-col space-y-4">
        <div>
          <label className="mb-1 block text-sm opacity-80">Batch</label>
          <select className="select" value={batch} onChange={(e) => setBatch(Number(e.target.value) || undefined)}>
            <option value="">Select batch</option>
            {(batches.length ? batches : allBatches).map((b) => <option key={b.id} value={b.id}>{b.name || b.code || `#${b.id}`}</option>)}
          </select>
        </div>
        <div>
          <input className="input" placeholder="Subject" value={code} onChange={(e) => setCode(e.target.value)} required />
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">e.g., MATH101, CS201</p>
        </div>
        {previewName && <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-[var(--muted-foreground)]">Preview: {previewName}</div>}
        <div className="pt-2">
          <button className="btn" disabled={loading} type="submit">
            {loading ? "Creating..." : "Create Subject"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ManageWindow({ batches, subjects, onUpdated, onError }: { batches: any[]; subjects: any[]; onUpdated: () => void; onError: (msg: string) => void }) {
  const [batch, setBatch] = useState<number | undefined>();
  const [subject, setSubject] = useState<number | undefined>();
  const [durationSec, setDurationSec] = useState<number>(30);
  const [windowInfo, setWindowInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setWindowInfo(null); }, [batch, subject]);

  const subjectsForBatch = useMemo(() => {
    if (!batch) return [] as any[];
    return subjects.filter((s) => {
      const value = typeof s.batch === "object" ? s.batch?.id : s.batch;
      return Number(value) === Number(batch);
    });
  }, [subjects, batch]);

  useEffect(() => {
    if (!subjectsForBatch.length) {
      setSubject(undefined);
      return;
    }
    if (subject && !subjectsForBatch.some((s) => Number(s.id) === Number(subject))) {
      setSubject(undefined);
    }
  }, [subjectsForBatch, subject]);

  const refresh = async () => {
    if (!batch || !subject) return;
    try {
      const w = await getWindow(batch, subject);
      setWindowInfo(w);
    } catch (e: any) {
      setWindowInfo(null);
    }
  };

  const openWindow = async () => {
    if (!batch || !subject) return;
    setLoading(true);
    try {
      const res = await upsertWindow({ target_batch: batch, target_subject: subject, is_active: true, duration: Math.max(30, durationSec) });
      setWindowInfo(res);
      onUpdated();
    } catch (e: any) {
      onError(e.message || "Failed to open window");
    } finally { setLoading(false); }
  };

  const closeWindow = async () => {
    if (!batch || !subject) return;
    setLoading(true);
    try {
      const res = await upsertWindow({ target_batch: batch, target_subject: subject, is_active: false });
      setWindowInfo(res);
      onUpdated();
    } catch (e: any) {
      onError(e.message || "Failed to close window");
    } finally { setLoading(false); }
  };

  return (
    <section className="card space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-foreground">🪟 Attendance window</div>
          <p className="text-sm text-[var(--muted-foreground)]">Open or close the attendance window for a chosen subject.</p>
        </div>
        <span className="badge bg-primary/15 text-primary">Window controls</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-2 block">Batch</label>
          <select className="select" value={batch} onChange={(e) => setBatch(Number(e.target.value) || undefined)}>
            <option value="">Select batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name || b.code || `#${b.id}`}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-2 block">Subject</label>
          <select className="select" value={subject} onChange={(e) => setSubject(Number(e.target.value) || undefined)}>
            <option value="">{batch ? (subjectsForBatch.length ? "Select subject" : "No subjects available") : "Select batch first"}</option>
            {subjectsForBatch.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block">Duration (minutes)</label>
          <select
            className="select"
            value={durationSec}
            onChange={(e) => setDurationSec(Number(e.target.value) || 60)}
          >
            <option value={30}>30 secs</option>
            <option value={60}>1 min</option>
            <option value={120}>2 min</option>
            <option value={300}>5 min</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn-outline" onClick={refresh}>Check current window</button>
        <button className="btn" onClick={openWindow} disabled={loading}>Open window</button>
        <button className="btn-outline" onClick={closeWindow} disabled={loading}>Close window</button>
      </div>
      {windowInfo ? (
        <div className="mt-4 rounded-2xl bg-white/80 px-5 py-4 text-sm text-[var(--muted-foreground)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge bg-primary/20 text-primary">
              Window #{windowInfo.id}
            </span>
            <span className="text-base font-medium text-foreground">
              {windowInfo.is_active ? "🟢 Active" : "🔴 Inactive"}
            </span>
            {windowInfo.is_active && (
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                Duration · {windowInfo.duration} seconds
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-white/60 px-5 py-4 text-sm text-[var(--muted-foreground)]">
          No window found. Open one when your students are ready 🌸
        </div>
      )}
    </section>
  );
}

function CreateStudent({ batches, allBatches, defaultBatchId, onCreated, onError }: { batches: any[]; allBatches: any[]; defaultBatchId?: number; onCreated: () => void; onError: (msg: string) => void }) {
  const [batch, setBatch] = useState<number | undefined>(defaultBatchId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setBatch(defaultBatchId); }, [defaultBatchId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch) { onError("Select a batch"); return; }
    setLoading(true);
    try {
      await createUser({ name: name || null, email, password, role: "student", batch });
      setName(""); setEmail(""); setPassword("");
      onCreated();
    } catch (e: any) {
      onError(e.message || "Failed to create student");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card space-y-6 p-6">
      <div>
        <div className="text-lg font-semibold text-foreground">👤 Add student</div>
        <p className="text-sm text-[var(--muted-foreground)]">Create a new student account and sprinkle credentials their way.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block">Batch</label>
          <select className="select" value={batch} onChange={(e) => setBatch(Number(e.target.value) || undefined)}>
            <option value="">Select batch</option>
            {(batches.length ? batches : allBatches).map((b) => <option key={b.id} value={b.id}>{b.name || b.code || `#${b.id}`}</option>)}
          </select>
        </div>
        <div>
          <input className="input" placeholder="Full name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn" disabled={loading} type="submit">
          {loading ? "Creating..." : "Create Student"}
        </button>
      </form>
    </section>
  );
}

function CreateStudentsFromCSV({ batches, allBatches, defaultBatchId, onCreated, onError }: { batches: any[]; allBatches: any[]; defaultBatchId?: number; onCreated: () => void; onError: (msg: string) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [csvData, setCsvData] = useState<Array<{ name: string; email: string; password: string }>>([]);
  const [batch, setBatch] = useState<number | undefined>(defaultBatchId);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { setBatch(defaultBatchId); }, [defaultBatchId]);

  const parseCSV = (text: string): Array<{ name: string; email: string; password: string }> => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) throw new Error("CSV must have at least a header and one data row");

    // Simple CSV parser that handles quoted fields
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const header = parseCSVLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
    const nameIdx = header.findIndex((h) => h === "name");
    const emailIdx = header.findIndex((h) => h === "email");
    const passwordIdx = header.findIndex((h) => h === "password");

    if (nameIdx === -1 || emailIdx === -1 || passwordIdx === -1) {
      throw new Error("CSV must have 'name', 'email', and 'password' columns");
    }

    const data: Array<{ name: string; email: string; password: string }> = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map((v) => v.replace(/^"|"$/g, "").trim());
      if (values.length < Math.max(nameIdx, emailIdx, passwordIdx) + 1) continue;

      const name = values[nameIdx] || "";
      const email = values[emailIdx] || "";
      const password = values[passwordIdx] || "";

      if (!email || !password) continue;

      data.push({ name, email, password });
    }

    return data;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        onError("No valid data found in CSV");
        return;
      }
      setCsvData(parsed);
      setShowModal(true);
    } catch (err: any) {
      onError(err.message || "Failed to parse CSV file");
    }

    // Reset input
    e.target.value = "";
  };

  const handleCreateUsers = async () => {
    if (!batch) {
      onError("Select a batch");
      return;
    }
    if (csvData.length === 0) {
      onError("No data to create");
      return;
    }

    setProcessing(true);

    await createMultipleUsers(csvData)

    setProcessing(false);
    setShowModal(false);
    setCsvData([]);
    onCreated()
  };

  return (
    <>
      <section className="card space-y-6 p-6">
        <div>
          <div className="text-lg font-semibold text-foreground">📄 Import students from CSV</div>
          <p className="text-sm text-[var(--muted-foreground)]">Upload a CSV file with name, email, and password columns to create multiple students at once.</p>
        </div>
        <div>
          <label className="block cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="btn-outline inline-block">Choose CSV File</div>
          </label>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            CSV format: name,email,password (header row required)
          </p>
        </div>
      </section>

      {showModal && (
        <CSVPreviewModal
          data={csvData}
          batch={batch}
          batches={batches.length ? batches : allBatches}
          onBatchChange={setBatch}
          onConfirm={handleCreateUsers}
          onClose={() => {
            setShowModal(false);
            setCsvData([]);
          }}
          processing={processing}
        />
      )}
    </>
  );
}

function CSVPreviewModal({
  data,
  batch,
  batches,
  onBatchChange,
  onConfirm,
  onClose,
  processing,
}: {
  data: Array<{ name: string; email: string; password: string }>;
  batch: number | undefined;
  batches: any[];
  onBatchChange: (batch: number | undefined) => void;
  onConfirm: () => void;
  onClose: () => void;
  processing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card-soft max-h-[90vh] w-full max-w-4xl space-y-6 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold text-foreground">📋 CSV Preview</div>
            <p className="text-sm text-[var(--muted-foreground)]">
              Review {data.length} student{data.length !== 1 ? "s" : ""} before creating
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--muted-foreground)] hover:bg-white/10"
            disabled={processing}
          >
            ✕
          </button>
        </div>

        <div>
          <label className="mb-2 block font-medium">Select Batch *</label>
          <select
            className="select"
            value={batch || ""}
            onChange={(e) => onBatchChange(Number(e.target.value) || undefined)}
            disabled={processing}
          >
            <option value="">Select batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.code || `#${b.id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/20">
                <th className="px-4 py-2 text-left text-sm font-semibold text-foreground">Name</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-foreground">Email</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-foreground">Password</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-b border-white/10">
                  <td className="px-4 py-2 text-sm text-[var(--muted-foreground)]">{row.name || <span className="italic opacity-50">(empty)</span>}</td>
                  <td className="px-4 py-2 text-sm text-foreground">{row.email}</td>
                  <td className="px-4 py-2 text-sm text-[var(--muted-foreground)]">{"•".repeat(Math.min(row.password.length, 8))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          <button
            className="btn flex-1"
            onClick={onConfirm}
            disabled={!batch || processing}
          >
            {processing ? "Creating..." : `Create ${data.length} Student${data.length !== 1 ? "s" : ""}`}
          </button>
          <button
            className="btn-outline"
            onClick={onClose}
            disabled={processing}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
