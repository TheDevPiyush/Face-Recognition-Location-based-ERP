"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchMe, fetchSubjects, getWindow, markAttendance, updateMyLocation } from "@/lib/api";
import Alert from "@/app/components/Alert";
import Toast from "@/app/components/Toast";

export default function AttendancePage() {
  const [me, setMe] = useState<any>(null);
  const [subjects, setSubjects] = useState<Array<{ id: number; name: string; batch: number }>>([]);
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [windowInfo, setWindowInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
        const [meRes, subs] = await Promise.all([fetchMe(), fetchSubjects()]);
        setMe(meRes);
        setSubjects(subs as any);
      } catch (e: any) {
        setMessage(e.message || "Failed to load data");
      }
    })();
  }, []);

  const myBatchId = me?.batch?.id as number | undefined;
  const mySubjects = useMemo(
    () => subjects.filter((s) => (myBatchId ? s.batch === myBatchId : true)),
    [subjects, myBatchId]
  );

  useEffect(() => {
    if (mySubjects.length) setSubjectId(mySubjects[0].id);
  }, [mySubjects.length]);

  const useLocation = () => {
    setMessage(null);
    if (!navigator.geolocation) {
      addToast("❌ Geolocation not supported", "error");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await updateMyLocation(pos.coords.latitude, pos.coords.longitude);
          addToast("✅ Location updated successfully", "success");
        } catch (e: any) {
          addToast(`❌ ${e.message}`, "error");
        } finally {
          setLoading(false);
        }
      },
      () => {
        addToast("❌ Please allow location permission", "error");
        setLoading(false);
      }
    );
  };

  const checkWindow = async () => {
    setMessage(null);
    if (!myBatchId || !subjectId) {
      addToast("❌ Please select a subject", "error");
      return;
    }
    setLoading(true);
    try {
      const w = await getWindow(myBatchId, subjectId);
      setWindowInfo(w);
      addToast("✅ Window status checked", "success");
    } catch (e: any) {
      setWindowInfo(null);
      addToast(`❌ ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const markMe = async () => {
    if (!windowInfo?.id) return;
    setLoading(true);
    try {
      await markAttendance(windowInfo.id);
      addToast("✅ Attendance marked successfully", "success");
    } catch (e: any) {
      addToast(`❌ ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <section className="card-soft relative overflow-hidden px-8 py-10">
        <div className="pointer-events-none absolute -top-28 right-[-10%] h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-[-15%] h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative space-y-4">
          <span className="badge bg-primary/20 text-primary">Attendance studio</span>
          <h1 className="section-title text-4xl">Mark your pastel-perfect presence</h1>
          <p className="section-subtitle max-w-2xl">
            Follow the soft steps: pick your subject, share your location, and tap in while the window is glowing.
          </p>
          {message ? <Alert type="error">{message}</Alert> : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="card-soft space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-foreground">📚 Step 1 · Subject</div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Choose the class you&apos;re attending so we can whisper it to your teacher.
                </p>
              </div>
              <span className="badge bg-accent/20 text-accent-foreground">{mySubjects.length} options</span>
            </div>
            <div>
              <label className="mb-2 block">Your subject</label>
              <select className="select" value={subjectId ?? ""} onChange={(e) => setSubjectId(Number(e.target.value) || undefined)}>
                <option value="">Select a subject</option>
                {mySubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {mySubjects.length === 0 ? (
                <p className="mt-3 text-xs text-[var(--muted-foreground)]">No subjects available yet. Reach out to your faculty 🌼</p>
              ) : null}
            </div>
          </section>

          <section className="card-soft space-y-5">
            <div className="text-lg font-semibold text-foreground">📍 Step 2 · Location (testing)</div>
            <p className="text-sm text-[var(--muted-foreground)]">
              Allow location access so we can verify you&apos;re on campus—or within the cozy fence.
            </p>
            <button className="btn w-full sm:w-auto" onClick={useLocation} disabled={loading}>
              {loading ? "Updating..." : "📍 Use my current location"}
            </button>
          </section>
        </div>

        <section className="card space-y-6">
          <div>
            <div className="text-lg font-semibold text-foreground">✅ Step 3 · Attendance glow-up</div>
            <p className="text-sm text-[var(--muted-foreground)]">
              Check if the window is open and tap to mark your presence. Don&apos;t forget to smile!
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="btn-outline flex-1" onClick={checkWindow} disabled={loading || !subjectId}>
              {loading ? "Checking..." : "🔍 Check active window"}
            </button>
            <button className="btn flex-1" onClick={markMe} disabled={loading || !windowInfo?.id || !windowInfo?.is_active}>
              {loading ? "Marking..." : "✓ Mark attendance"}
            </button>
          </div>

          {windowInfo ? (
            <div className="rounded-2xl bg-white/80 px-5 py-4 text-sm text-[var(--muted-foreground)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em]">Window status</div>
              <div className="mt-3 space-y-2 text-sm text-foreground">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className={`font-semibold ${windowInfo.is_active ? "text-emerald-500" : "text-rose-500"}`}>
                    {windowInfo.is_active ? "🟢 Active" : "🔴 Inactive"}
                  </span>
                </div>
                {windowInfo.is_active && (
                  <div className="flex items-center justify-between">
                    <span>Duration</span>
                    <span className="font-semibold">{windowInfo.duration} seconds</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/60 px-5 py-4 text-sm text-[var(--muted-foreground)]">
              No active window right now. Try checking again or message your faculty 💌
            </div>
          )}
        </section>
      </div>

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}
