"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchMe, fetchSubjects } from "@/lib/api";
import Alert from "@/app/components/Alert";

export default function SubjectsPage() {
  const [me, setMe] = useState<any>(null);
  const [subjects, setSubjects] = useState<Array<{ id: number; name: string; batch: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [meRes, subs] = await Promise.all([fetchMe(), fetchSubjects()]);
        setMe(meRes);
        setSubjects(subs as any);
      } catch (e: any) {
        setError(e.message || "Failed to load subjects");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const myBatchId = me?.batch?.id as number | undefined;
  const mySubjects = useMemo(
    () => subjects.filter((s) => (myBatchId ? s.batch === myBatchId : true)),
    [subjects, myBatchId]
  );

  const batchName = me?.batch?.name ? `(${me.batch.name})` : "";

  return (
    <div className="space-y-10">
      <section className="card-soft relative overflow-hidden px-8 py-10">
        <div className="pointer-events-none absolute -top-24 right-[-20%] h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-[-15%] h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative space-y-4">
          <span className="badge bg-primary/20 text-primary">Subject garden</span>
          <h1 className="section-title text-4xl">My cosy collection of subjects</h1>
          <p className="section-subtitle max-w-2xl">
            All your classes live here {batchName}. Think of it as a pastel library curated just for you.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="card-soft text-sm text-[var(--muted-foreground)]">Loading your subjects...</div>
      ) : error ? (
        <Alert type="error">{error}</Alert>
      ) : mySubjects.length === 0 ? (
        <div className="card-soft text-sm text-[var(--muted-foreground)]">
          No subjects found for your batch yet. Your academic blooms are on the way 🌱
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mySubjects.map((s) => (
            <div key={s.id} className="grid-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="badge bg-primary/10 text-primary">Subject</span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  #{s.id}
                </span>
              </div>
              <div className="text-lg font-semibold text-foreground">{s.name}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Dive in, explore resources, and stay ahead with a happy heart.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
