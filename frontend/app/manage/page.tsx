"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchMe,
  fetchUniversities,
  fetchCourses,
  fetchBatches,
  fetchSubjects,
  fetchStudents,
  fetchUsersAll,
  createUniversity,
  createCourse,
  createBatch,
  createSubject,
  createUser,
  getWindow,
  upsertWindow,
} from "@/lib/api";
import Alert from "@/components/Alert";
import Toast from "@/components/Toast";
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
        const studs = await fetchStudents();
        setStudents(studs as any[]);
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

  if (loading) return <p>Loading...</p>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Manage</h1>
        <p className="text-sm opacity-80">Create and manage universities, courses, batches, subjects, students, and attendance windows.</p>
      </div>

      {/* Progressive selectors */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-3 text-lg font-medium">Filter by hierarchy</div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm">University</label>
            <select className="select" value={universityId} onChange={(e) => setUniversityId(Number(e.target.value) || undefined)}>
              <option value="">All</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Course</label>
            <select className="select" value={courseId} onChange={(e) => setCourseId(Number(e.target.value) || undefined)}>
              <option value="">{universityId ? "Select course" : "All"}</option>
              {filteredCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Batch</label>
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
      <div className="space-y-6">
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
      <ManageWindow
        batches={filteredBatches}
        subjects={filteredSubjects}
        onUpdated={() => addToast("✅ Attendance window updated", "success")}
        onError={(msg) => addToast(`❌ ${msg}`, "error")}
      />

      {me?.role === "admin" ? (
        <CreateStudent
          batches={filteredBatches}
          allBatches={batches}
          defaultBatchId={batchId}
          onCreated={() => addToast("✅ Student created successfully", "success")}
          onError={(msg) => addToast(`❌ ${msg}`, "error")}
        />
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
    <section className="flex h-full flex-col rounded-xl border border-border bg-card p-8 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-1 text-lg font-medium">🏢 Add University</div>
      <p className="mb-6 text-xs opacity-70">Create a new university in the system</p>
      <form onSubmit={onSubmit} className="flex flex-1 flex-col space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <input className="input" placeholder="University Name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <input className="input" placeholder="University Code" value={code} onChange={(e) => setCode(e.target.value)} required />
            <p className="mt-1 text-xs opacity-60">Code must be unique</p>
          </div>
        </div>
        <div>
          <input className="input" placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="mt-auto! pt-2">
          <button className="btn transition-all hover:-translate-y-0.5" disabled={loading} type="submit">
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
    <section className="flex h-full flex-col rounded-xl border border-border bg-card p-8 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-1 text-lg font-medium">🎓 Add Course</div>
      <p className="mb-6 text-xs opacity-70">Create a new course under a university</p>
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
          <p className="mt-1 text-xs opacity-60">e.g., BCA, MCA, BSc</p>
        </div>
        {previewName && <div className="rounded-md bg-muted px-3 py-2 text-sm opacity-70">Preview: {previewName}</div>}
        <div className="mt-auto! pt-2">
          <button className="btn transition-all hover:-translate-y-0.5" disabled={loading} type="submit">
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
    <section className="flex h-full flex-col rounded-xl border border-border bg-card p-8 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-1 text-lg font-medium">👥 Add Batch</div>
      <p className="mb-6 text-xs opacity-70">Create a new batch for a course</p>
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
          <p className="mt-1 text-xs opacity-60">e.g., B1, B2, A</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <input className="input" placeholder="Start year" required type="number" value={startYear} onChange={(e) => setStartYear(Number(e.target.value) || "")} />
          <input className="input" placeholder="End year" required type="number" value={endYear} onChange={(e) => setEndYear(Number(e.target.value) || "")} />
        </div>
        {previewName && <div className="rounded-md bg-muted px-3 py-2 text-sm opacity-70">Preview: {previewName}</div>}
        <div className="mt-auto! pt-2">
          <button className="btn transition-all hover:-translate-y-0.5" disabled={loading} type="submit">
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
    <section className="flex h-full flex-col rounded-xl border border-border bg-card p-8 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-1 text-lg font-medium">🖋️ Add Subject</div>
      <p className="mb-6 text-xs opacity-70">Create a new subject for a batch</p>
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
          <p className="mt-1 text-xs opacity-60">e.g., MATH101, CS201</p>
        </div>
        {previewName && <div className="rounded-md bg-muted px-3 py-2 text-sm opacity-70">Preview: {previewName}</div>}
        <div className="mt-auto! pt-2">
          <button className="btn transition-all hover:-translate-y-0.5" disabled={loading} type="submit">
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
    <section className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-1 text-lg font-medium">🪟 Attendance Window</div>
      <p className="mb-6 text-xs opacity-70">Open or close attendance windows for a subject</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm opacity-80">Batch</label>
          <select className="select" value={batch} onChange={(e) => setBatch(Number(e.target.value) || undefined)}>
            <option value="">Select batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name || b.code || `#${b.id}`}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm opacity-80">Subject</label>
          <select className="select" value={subject} onChange={(e) => setSubject(Number(e.target.value) || undefined)}>
            <option value="">{batch ? (subjectsForBatch.length ? "Select subject" : "No subjects available") : "Select batch first"}</option>
            {subjectsForBatch.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm opacity-80">Duration (secs)</label>
          <input className="input" type="number" min={30} value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value) || 30)} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn-outline transition-all hover:-translate-y-0.5" onClick={refresh}>Check current window</button>
        <button className="btn transition-all hover:-translate-y-0.5" onClick={openWindow} disabled={loading}>Open window</button>
        <button className="btn-outline transition-all hover:-translate-y-0.5" onClick={closeWindow} disabled={loading}>Close window</button>
      </div>
      {windowInfo ? (
        <div className="mt-4 rounded-md bg-muted px-3 py-2 text-sm opacity-80">
          Status:{" "}
          <span className="font-medium">
            {windowInfo.is_active ? "Active" : "Inactive"}
          </span>

          {windowInfo.is_active && (
            <>
              {" "} | Duration (secs):{" "}
              <span className="font-medium">{windowInfo.duration}</span>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 text-sm opacity-70">No window found</div>
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
    <section className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-1 text-lg font-medium">👤 Add Student</div>
      <p className="mb-6 text-xs opacity-70">Create a new student account</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm opacity-80">Batch</label>
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
        <button className="btn transition-all hover:-translate-y-0.5" disabled={loading} type="submit">
          {loading ? "Creating..." : "Create Student"}
        </button>
      </form>
    </section>
  );
}
