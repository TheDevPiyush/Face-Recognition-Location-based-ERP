"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchMe, fetchSubjects } from "@/lib/api";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Subjects</h1>
        <p className="text-sm opacity-80">Subjects for your current batch{me?.batch?.name ? ` (${me.batch.name})` : ""}.</p>
      </div>

      {loading ? (
        <div className="card">Loading...</div>
      ) : error ? (
        <div className="card text-red-600">{error}</div>
      ) : mySubjects.length === 0 ? (
        <div className="card text-sm opacity-80">No subjects found for your batch.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {mySubjects.map((s) => (
            <div key={s.id} className="rounded-md border border-border p-4">
              <div className="text-base font-medium">{s.name}</div>
              <div className="text-xs opacity-70">ID: {s.id}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
