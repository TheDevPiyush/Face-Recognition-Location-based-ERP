"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchMe, fetchSubjects, getWindow, markAttendance, updateMyLocation } from "@/lib/api";
import Alert from "@/components/Alert";
import Toast from "@/components/Toast";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Mark Attendance</h1>
        <p className="text-sm opacity-80">Select your subject, update your location, then mark attendance if a window is active.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Step 1: Select Subject */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-1 text-lg font-medium">📚 Step 1: Select Subject</div>
            <p className="mb-4 text-xs opacity-70">Choose the subject you want to mark attendance for</p>
            <div>
              <label className="mb-1 block text-sm opacity-80">Your Subject</label>
              <select className="select" value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))}>
                <option value="">Select a subject</option>
                {mySubjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {mySubjects.length === 0 && (
                <p className="mt-2 text-xs opacity-60">No subjects available for your batch</p>
              )}
            </div>
          </section>

          {/* Step 2: Update Location */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-1 text-lg font-medium">📍 Step 2: Update Location</div>
            <p className="mb-4 text-xs opacity-70">Allow location access to verify you're on campus</p>
            <button 
              className="btn transition-all hover:-translate-y-0.5" 
              onClick={useLocation} 
              disabled={loading}
            >
              {loading ? "Updating..." : "📍 Use My Location"}
            </button>
          </section>
        </div>

        {/* Right Column */}
        <div>
          {/* Step 3: Check Window & Mark */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-1 text-lg font-medium">✅ Step 3: Mark Your Attendance</div>
            <p className="mb-4 text-xs opacity-70">Check if the attendance window is open and mark your presence</p>
            
            <div className="flex flex-wrap gap-3">
              <button 
                className="btn-outline transition-all hover:-translate-y-0.5" 
                onClick={checkWindow} 
                disabled={loading || !subjectId}
              >
                {loading ? "Checking..." : "🔍 Check Active Window"}
              </button>
              <button 
                className="btn transition-all hover:-translate-y-0.5" 
                onClick={markMe} 
                disabled={loading || !windowInfo?.id || !windowInfo?.is_active}
              >
                {loading ? "Marking..." : "✓ Mark Attendance"}
              </button>
            </div>

            {windowInfo ? (
              <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide opacity-70">Window Status</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">Status:</span>
                    <span className={`font-medium ${windowInfo.is_active ? "text-green-600" : "text-red-600"}`}>
                      {windowInfo.is_active ? "🟢 Active" : "🔴 Inactive"}
                    </span>
                  </div>
                  {windowInfo.is_active && (
                    <div className="flex items-center justify-between">
                      <span className="opacity-80">Duration:</span>
                      <span className="font-medium">{windowInfo.duration} seconds</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-border px-4 py-3 text-sm opacity-70">
                No active window found. Check the window status or contact your teacher.
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Toast notifications */}
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}
