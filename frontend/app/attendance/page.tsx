"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchMe, fetchSubjects, getWindow, markAttendance, updateMyLocation } from "@/lib/api";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { useToast } from "@/app/components/ui/use-toast";
import CameraModal from "@/app/components/CameraModal";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Spinner } from "@/app/components/ui/spinner";

export default function AttendancePage() {
  const [me, setMe] = useState<any>(null);
  const [subjects, setSubjects] = useState<Array<{ id: number; name: string; batch: number }>>([]);
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [windowInfo, setWindowInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const { toast } = useToast();

  const addToast = (message: string, type: "success" | "error" | "info" = "success") => {
    toast({
      title: type === "error" ? "Error" : type === "success" ? "Success" : "Info",
      description: message,
      variant: type === "error" ? "destructive" : type === "success" ? "success" : "default",
    });
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
      addToast("Geolocation not supported", "error");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await updateMyLocation(pos.coords.latitude, pos.coords.longitude);
          addToast("Location updated successfully", "success");
        } catch (e: any) {
          addToast(e.message, "error");
        } finally {
          setLoading(false);
        }
      },
      () => {
        addToast("Please allow location permission", "error");
        setLoading(false);
      }
    );
  };

  const checkWindow = async () => {
    setMessage(null);
    if (!myBatchId || !subjectId) {
      addToast("Please select a subject", "error");
      return;
    }
    setLoading(true);
    try {
      const w = await getWindow(myBatchId, subjectId);
      setWindowInfo(w);
      addToast("Window status checked", "success");
    } catch (e: any) {
      setWindowInfo(null);
      addToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const markMe = async () => {
    if (!windowInfo?.id) return;
    setIsCameraModalOpen(true);
  };

  // Accurate countdown tied to backend start_time and duration
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

  const handlePhotoCapture = async (file: File) => {
    if (!windowInfo?.id) return;

    setIsUploading(true);
    try {
      await markAttendance(windowInfo.id, file);
      addToast("Attendance marked successfully", "success");
      setIsCameraModalOpen(false);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-4xl mt-4">Mark Attendance</CardTitle>
          <CardDescription className="max-w-2xl">
            Select your subject, check window status, and mark your attendance while the window is active.
          </CardDescription>
          {message ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Process</CardTitle>
          <CardDescription>
            Follow the steps below to mark your attendance for the selected subject.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Subject Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono text-xs">1</Badge>
              <div>
                <h3 className="text-sm font-semibold">Select Subject</h3>
                <p className="text-xs text-muted-foreground">Choose the subject you are attending</p>
              </div>
            </div>
            <div className="pl-8">
              <Select value={subjectId?.toString()} onValueChange={(value) => setSubjectId(Number(value) || undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {mySubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mySubjects.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No subjects available. Please contact your faculty.</p>
              ) : null}
            </div>
          </div>

          {/* Step 2: Location Update (Admin only) */}
          {me?.role === "admin" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-xs">2</Badge>
                <div>
                  <h3 className="text-sm font-semibold">Update Location</h3>
                  <p className="text-xs text-muted-foreground">Allow location access to verify geofence boundary</p>
                </div>
              </div>
              <div className="pl-8">
                <Button onClick={useLocation} disabled={loading} variant="outline">
                  {loading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Updating...
                    </>
                  ) : (
                    "Use Current Location"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border/50"></div>

          {/* Step 3: Window Status & Mark Attendance */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono text-xs">{me?.role === "admin" ? "3" : "2"}</Badge>
              <div>
                <h3 className="text-sm font-semibold">Check Status & Mark Attendance</h3>
                <p className="text-xs text-muted-foreground">Verify window status and mark your presence</p>
              </div>
            </div>
            <div className="pl-8 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={checkWindow} disabled={loading || !subjectId}>
                  {loading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Checking...
                    </>
                  ) : (
                    "Check Window Status"
                  )}
                </Button>
                <Button className="flex-1" onClick={markMe} disabled={loading || !windowInfo?.id || !windowInfo?.is_active}>
                  {loading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Marking...
                    </>
                  ) : (
                    "Mark Attendance"
                  )}
                </Button>
              </div>

              {/* Window Status Display */}
              {windowInfo ? (
                <div className="rounded-lg border bg-secondary/50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={windowInfo.is_active ? "default" : "secondary"}>
                      {windowInfo.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {windowInfo.is_active && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Time left</span>
                      <span className="font-semibold">{formatMMSS(remainingSec)}</span>
                    </div>
                  )}
                  {windowInfo.id && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Window ID</span>
                      <span className="font-mono text-xs">{windowInfo.id}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No active window available. Please check again or contact your faculty.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handlePhotoCapture}
        isUploading={isUploading}
      />
    </div>
  );
}
