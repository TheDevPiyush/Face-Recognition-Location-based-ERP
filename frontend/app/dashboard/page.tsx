"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchMe,
  fetchBatches,
  fetchSubjects,
  fetchStudentsByBatch,
  getWindow,
  markAttendance,
  upsertWindow,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { useToast } from "@/app/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Input } from "@/app/components/ui/input";
import { Spinner } from "@/app/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Check, CheckCircle, CheckCircle2 } from "lucide-react";

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
        // Do not fetch students here; fetched lazily per selected batch
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
      <Card>
        <CardContent className="py-20 flex items-center justify-center">
          <Spinner size="lg" />
        </CardContent>
      </Card>
    );
  }
  if (error) return (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  const displayName = me?.name || me?.email || "User";
  const roleLabel = me?.role ? me.role.replace(/\b\w/g, (c: string) => c.toUpperCase()) : "User";

  return (
    <div className="space-y-10">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <Badge variant="secondary">Dashboard</Badge>
              <CardTitle className="text-4xl flex items-center gap-2">
                <span>
                  Welcome,
                </span>
                <span className="flex items-end gap-1.5 text-primary"> {displayName.split(" ")[0] || "User"}
                  {me?.role === "admin" && <CheckCircle className="text-green-500 h-8 w-8" />}
                </span>
              </CardTitle>
              <CardDescription className="max-w-xl">
                Manage your attendance, view subjects, and access academic information.
              </CardDescription>
              <div className="flex flex-wrap gap-3 pt-2">
                <Badge variant="outline">{roleLabel}</Badge>
                {me?.batch?.name ? (
                  <Badge variant="outline">{me.batch.name}</Badge>
                ) : null}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {me?.role === "student" ? (
        <StudentDashboard me={me} subjects={subjects} />
      ) : (
        <TeacherPanel subjects={subjects} batches={batches} />
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
      title: "Mark Attendance",
      description: "Mark your presence for classes",
    },
    {
      href: "/subjects",
      title: "View Subjects",
      description: "View your enrolled subjects",
    },
    {
      href: "/profile",
      title: "Update Profile",
      description: "Manage your profile information",
    },
  ];

  return (
    <div className="space-y-8">
      {/* <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {quickLinks.map((item) => (
          <Link key={item.href} href={item.href} className="grid-card">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span>Quick Link</span>
            </div>
            <div className="mt-4 text-lg font-semibold text-foreground">{item.title}</div>
            <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>
          </Link>
        ))}
      </div> */}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Your Subjects</CardTitle>
            </div>
            <Badge variant="secondary">
              {mySubjects.length} {mySubjects.length === 1 ? "subject" : "subjects"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {mySubjects.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Subject Name</TableHead>
                  <TableHead>Batch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mySubjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-mono text-sm">{subject.id}</TableCell>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{me?.batch?.name || "N/A"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-5 py-6 text-sm text-muted-foreground text-center">
              No subjects found. Check back after enrollment updates.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeacherPanel({ subjects, batches }: { subjects: Subject[]; batches: Batch[] }) {
  const [batchId, setBatchId] = useState<number | undefined>();
  const filteredSubjects = useMemo(
    () => subjects.filter((s) => (batchId ? s.batch === batchId : true)),
    [subjects, batchId]
  );
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [durationSec, setDurationSec] = useState<number>(30);
  const [windowInfo, setWindowInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [studentsInBatch, setStudentsInBatch] = useState<Student[]>([]);
  const [studentLoading, setStudentLoading] = useState(false)
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const { toast } = useToast();
  const addToast = (description: string, type: "success" | "error" | "info" = "success") => {
    toast({
      title: type === "error" ? "Error" : type === "success" ? "Success" : "Info",
      description,
      variant: type === "error" ? "destructive" : type === "success" ? "success" : "default",
    });
  };

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

  // Manage countdown based on backend start_time and duration for accurate refresh behavior
  useEffect(() => {
    const computeRemaining = () => {
      if (!windowInfo?.is_active) return 0;
      const dur = Number(windowInfo?.duration ?? 0);
      const start = windowInfo?.start_time ? new Date(windowInfo.start_time).getTime() : NaN;
      if (!dur || Number.isNaN(start)) return 0;
      const now = Date.now();
      const elapsedSec = Math.floor((now - start) / 1000);
      return Math.max(0, dur - elapsedSec);
    };

    setRemainingSec(computeRemaining());

    if (!windowInfo?.is_active) return;
    const timer = setInterval(() => {
      setRemainingSec(computeRemaining());
    }, 1000);
    return () => clearInterval(timer);
  }, [windowInfo?.id, windowInfo?.is_active, windowInfo?.duration, windowInfo?.start_time]);

  const formatMMSS = (total: number) => {
    const m = Math.floor(total / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  // Fetch students when batch changes
  useEffect(() => {
    (async () => {
      if (!batchId) {
        setStudentsInBatch([]);
        setStudentLoading(false)
        return;
      }
      try {
        setStudentLoading(true)
        const studs = await fetchStudentsByBatch(batchId);
        setStudentsInBatch(studs as any);
        setStudentLoading(false)
      } catch {
        setStudentsInBatch([]);
        setStudentLoading(false)
      }
    })();
  }, [batchId]);

  const openWindow = async () => {
    if (!batchId || !subjectId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await upsertWindow({
        target_batch: batchId,
        target_subject: subjectId,
        is_active: true,
        duration: durationSec,
      });
      setWindowInfo(res);
      addToast("Attendance window opened", "success");
    } catch (e: any) {
      addToast(e.message || "Failed to open window", "error");
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
      addToast("Attendance window updated", "success");
    } catch (e: any) {
      addToast(e.message || "Failed to update window", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Open Attendance Window</CardTitle>
              <CardDescription>
                Select a batch and subject, then set the duration to open the attendance window.
              </CardDescription>
            </div>
            <Badge variant="secondary">Teacher Tools</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="batch-select">Batch</Label>
              <Select value={batchId?.toString()} onValueChange={(value) => setBatchId(Number(value) || undefined)}>
                <SelectTrigger id="batch-select">
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {b.name || `Batch ${b.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-select">Subject</Label>
              <Select value={subjectId?.toString()} onValueChange={(value) => setSubjectId(Number(value) || undefined)}>
                <SelectTrigger id="subject-select">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Select value={String(durationSec)} onValueChange={(value) => setDurationSec(Number(value))}>
                <SelectTrigger id="duration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 secs</SelectItem>
                  <SelectItem value="60">1 min</SelectItem>
                  <SelectItem value="120">2 min</SelectItem>
                  <SelectItem value="300">5 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={openWindow} disabled={loading}>
              Open Window
            </Button>
            <Button variant="outline" onClick={closeWindow} disabled={loading}>
              Close Window
            </Button>
            <Button variant="ghost" onClick={() => refreshWindow(batchId, subjectId)}>
              Refresh Status
            </Button>
          </div>

          {windowInfo ? (
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">Window #{windowInfo.id}</Badge>
                  <span className="text-base font-medium text-foreground">
                    {windowInfo.is_active ? "Active" : "Closed"}
                  </span>
                  {windowInfo.duration ? (
                    <>
                      {windowInfo.is_active ? (
                        <div className="ml-auto flex items-center gap-3">
                          <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            {formatMMSS(remainingSec)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground ml-auto">
                          Duration: {windowInfo.duration} seconds
                        </span>
                      )}
                    </>
                  ) : null}
                </div>

                {windowInfo.is_active && windowInfo.duration ? (
                  <div className="mt-3 h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-[width]"
                      style={{ width: `${Math.max(0, Math.min(100, ((windowInfo.duration - remainingSec) / windowInfo.duration) * 100))}%` }}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-4 text-center text-sm text-muted-foreground">
                No window is active. Open one when your class is ready.
              </CardContent>
            </Card>
          )}

          {/* Inline alerts replaced by toast notifications for a cleaner UI */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Students in Batch</CardTitle>
              <CardDescription>
                Select a batch to view students and mark attendance manually if needed.
              </CardDescription>
            </div>
            {!studentLoading ?
              <Badge variant="secondary">
                {studentsInBatch.length} {studentsInBatch.length === 1 ? "student" : "students"}
              </Badge>
              : (
                <Badge className="bg-transparent"><Spinner className="bg-transparent"/></Badge>
              )
            }
          </div>
        </CardHeader>
        <CardContent>
          {batchId ? (
            <div className="space-y-3">
              {studentsInBatch.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-secondary/50 px-5 py-3 text-sm"
                >
                  <div>
                    <div className="font-semibold text-foreground">{s.name || s.email || `#${s.id}`}</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">ID: {s.id}</div>
                  </div>
                </div>
              ))}
              {studentsInBatch.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-5 py-6 text-sm text-muted-foreground text-center">
                  No students found for the selected batch.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-5 py-6 text-sm text-muted-foreground text-center">
              Select a batch above to view students.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
