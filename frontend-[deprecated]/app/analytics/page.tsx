"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMe,
  fetchBatches,
  fetchSubjects,
  fetchStudentsByBatch,
  fetchAttendanceAnalytics,
  fetchMonthlyPercentage,
  fetchStudentCalendar,
} from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Input } from "@/app/components/ui/input";
import { Spinner } from "@/app/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { useToast } from "@/app/components/ui/use-toast";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Batch = { id: number; name: string };
type Subject = { id: number; name: string; batch: number };
type Student = { id: number; name: string | null; email: string | null; role: string; batch?: any };

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function AnalyticsPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const { toast } = useToast();

  // Filters
  const [selectedBatch, setSelectedBatch] = useState<number | undefined>();
  const [selectedSubject, setSelectedSubject] = useState<number | undefined>();
  const [selectedStudent, setSelectedStudent] = useState<number | undefined>();
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Analytics data
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [monthlyPercentage, setMonthlyPercentage] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [calendarData, setCalendarData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [meRes, subs, bats] = await Promise.all([
          fetchMe(),
          fetchSubjects(),
          fetchBatches(),
        ]);
        setMe(meRes);
        setSubjects(subs as any);
        setBatches(bats as any);

        // Set default dates (last 30 days) - only for admin/teacher
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        setEndDate(today.toISOString().split("T")[0]);
        setStartDate(thirtyDaysAgo.toISOString().split("T")[0]);

        // Set default month (current month)
        const currentMonth = today.toISOString().slice(0, 7);
        setSelectedMonth(currentMonth);

        // If student, set their batch and student ID
        if (meRes?.role === "student" && meRes?.batch?.id) {
          setSelectedBatch(meRes.batch.id);
          setSelectedStudent(meRes.id);
        }
      } catch (e) {
        toast({
          title: "Error",
          description: "Failed to load data",
          variant: "destructive",
        });
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, toast]);

  // Fetch students when batch changes
  useEffect(() => {
    (async () => {
      if (!selectedBatch) {
        setStudents([]);
        return;
      }
      try {
        const studs = await fetchStudentsByBatch(selectedBatch);
        setStudents(studs as any);
      } catch {
        setStudents([]);
      }
    })();
  }, [selectedBatch]);

  // Filter subjects by batch
  const filteredSubjects = useMemo(
    () => subjects.filter((s) => (selectedBatch ? s.batch === selectedBatch : true)),
    [subjects, selectedBatch]
  );

  const isStudent = me?.role === "student";
  const isAdmin = me?.role === "admin" || me?.role === "teacher";

  // Load calendar for students
  useEffect(() => {
    if (isStudent && selectedMonth) {
      loadCalendar();
    }
  }, [selectedMonth, isStudent]);

  const loadCalendar = async () => {
    if (!selectedMonth) return;

    setCalendarLoading(true);
    try {
      const params: any = {
        month: selectedMonth,
      };
      if (selectedBatch) params.batch_id = selectedBatch;

      const data = await fetchStudentCalendar(params);
      setCalendarData(data);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to load calendar",
        variant: "destructive",
      });
    } finally {
      setCalendarLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select start and end dates",
        variant: "destructive",
      });
      return;
    }

    setAnalyticsLoading(true);
    try {
      const params: any = {
        start_date: startDate,
        end_date: endDate,
      };
      if (selectedBatch) params.batch_id = selectedBatch;
      if (selectedSubject) params.subject_id = selectedSubject;
      if (selectedStudent) params.student_id = selectedStudent;
      if (selectedMonth) params.month = selectedMonth;

      const data = await fetchAttendanceAnalytics(params);
      setDailyData(data.daily_attendance || []);
      setSummary(data.summary || null);
      setMonthlyPercentage(data.monthly_percentage || null);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to load analytics",
        variant: "destructive",
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadMonthlyData = async () => {
    if (!selectedMonth) {
      toast({
        title: "Error",
        description: "Please select a month",
        variant: "destructive",
      });
      return;
    }

    setMonthlyLoading(true);
    try {
      const params: any = {
        month: selectedMonth,
      };
      if (selectedBatch) params.batch_id = selectedBatch;
      if (selectedSubject) params.subject_id = selectedSubject;
      if (selectedStudent) params.student_id = selectedStudent;

      const data = await fetchMonthlyPercentage(params);
      setMonthlyData(data.data || []);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to load monthly data",
        variant: "destructive",
      });
    } finally {
      setMonthlyLoading(false);
    }
  };

  // Auto-load on filter change (only for admin/teacher)
  useEffect(() => {
    if (!isStudent && startDate && endDate) {
      loadAnalytics();
    }
  }, [startDate, endDate, selectedBatch, selectedSubject, selectedStudent, selectedMonth]);

  useEffect(() => {
    if (!isStudent && selectedMonth) {
      loadMonthlyData();
    }
  }, [selectedMonth, selectedBatch, selectedSubject, selectedStudent]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-20 flex items-center justify-center">
          <Spinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  // Student Calendar View
  if (isStudent) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">My Attendance Calendar</CardTitle>
            <CardDescription>
              View your attendance for each subject by date. P = Present, A = Absent, empty = No class
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Month Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Select Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="month">Month</Label>
                <Input
                  id="month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <Button onClick={loadCalendar} disabled={calendarLoading}>
                {calendarLoading ? <Spinner className="mr-2" /> : null}
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Table */}
        {calendarData && (
          <Card>
            <CardHeader>
              <CardTitle>
                {new Date(calendarData.year, calendarData.month_number - 1).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </CardTitle>
              <CardDescription>Batch: {calendarData.batch.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {calendarLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner size="lg" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Subject</TableHead>
                        {Array.from({ length: calendarData.days_in_month }, (_, i) => i + 1).map((day) => (
                          <TableHead key={day} className="text-center min-w-[40px]">
                            {day}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calendarData.calendar.map((subjectRow: any) => (
                        <TableRow key={subjectRow.subject.id}>
                          <TableCell className="font-medium sticky left-0 bg-background z-10">
                            {subjectRow.subject.name}
                          </TableCell>
                          {Array.from({ length: calendarData.days_in_month }, (_, i) => {
                            const day = i + 1;
                            const date = new Date(calendarData.year, calendarData.month_number - 1, day);
                            const dateKey = date.toISOString().split("T")[0];
                            const status = subjectRow.dates[dateKey];

                            return (
                              <TableCell key={day} className="text-center p-2">
                                {status === "P" ? (
                                  <Badge className="bg-green-500 hover:bg-green-600 text-white">P</Badge>
                                ) : status === "A" ? (
                                  <Badge className="bg-red-500 hover:bg-red-600 text-white">A</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary Statistics */}
        {calendarData && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {calendarData.calendar.map((subjectRow: any) => {
              const dates = Object.values(subjectRow.dates);
              const present = dates.filter((d: any) => d === "P").length;
              const absent = dates.filter((d: any) => d === "A").length;
              const total = present + absent;
              const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : "0.0";

              return (
                <Card key={subjectRow.subject.id}>
                  <CardHeader className="pb-2">
                    <CardDescription className="truncate">{subjectRow.subject.name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">{percentage}%</div>
                      <div className="text-sm text-muted-foreground">
                        {present} / {total} classes
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Admin/Teacher View
  // Prepare chart data
  const chartData = dailyData.map((day) => ({
    date: new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    present: day.present,
    absent: day.absent,
    total: day.total,
  }));

  const pieData = summary
    ? [
        { name: "Present", value: summary.total_present },
        { name: "Absent", value: summary.total_absent },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Attendance Analytics</CardTitle>
          <CardDescription>
            View detailed attendance statistics with daily breakdowns and monthly percentages
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="batch-filter">Batch</Label>
              <Select
                value={selectedBatch?.toString() || ""}
                onValueChange={(value: string) => {
                  setSelectedBatch(value ? Number(value) : undefined);
                  setSelectedSubject(undefined);
                  setSelectedStudent(undefined);
                }}
              >
                <SelectTrigger id="batch-filter">
                  <SelectValue placeholder="All batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All batches</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject-filter">Subject</Label>
              <Select
                value={selectedSubject?.toString() || ""}
                onValueChange={(value: string) => setSelectedSubject(value ? Number(value) : undefined)}
                disabled={!selectedBatch}
              >
                <SelectTrigger id="subject-filter">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All subjects</SelectItem>
                  {filteredSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="student-filter">Student</Label>
              <Select
                value={selectedStudent?.toString() || ""}
                onValueChange={(value: string) => setSelectedStudent(value ? Number(value) : undefined)}
                disabled={!selectedBatch}
              >
                <SelectTrigger id="student-filter">
                  <SelectValue placeholder="All students" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All students</SelectItem>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name || s.email || `Student #${s.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="month">Month (for monthly %)</Label>
              <Input
                id="month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={loadAnalytics} disabled={analyticsLoading}>
              {analyticsLoading ? <Spinner className="mr-2" /> : null}
              Refresh Analytics
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Present</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{summary.total_present}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Absent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{summary.total_absent}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Classes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.total_classes || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Overall Percentage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{summary.overall_percentage}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Percentage Card */}
      {monthlyPercentage && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Percentage - {monthlyPercentage.month}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Classes</div>
                <div className="text-2xl font-bold">{monthlyPercentage.total_classes}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Present</div>
                <div className="text-2xl font-bold text-green-600">{monthlyPercentage.present_count}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Absent</div>
                <div className="text-2xl font-bold text-red-600">{monthlyPercentage.absent_count}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Percentage</div>
                <div className="text-2xl font-bold text-primary">{monthlyPercentage.percentage}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Attendance Bar Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Daily Attendance</CardTitle>
              <CardDescription>Present vs Absent by day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" fill="#00C49F" name="Present" />
                  <Bar dataKey="absent" fill="#FF8042" name="Absent" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Pie Chart */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Overall Distribution</CardTitle>
              <CardDescription>Present vs Absent</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => {
                      const name = entry.name || "";
                      const percent = entry.percent || 0;
                      return `${name}: ${(percent * 100).toFixed(0)}%`;
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Line Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trend</CardTitle>
              <CardDescription>Daily attendance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#00C49F" name="Present" />
                  <Line type="monotone" dataKey="absent" stroke="#FF8042" name="Absent" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Daily Attendance Table */}
      {dailyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Attendance Details</CardTitle>
            <CardDescription>Detailed breakdown by date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Total Classes</TableHead>
                    <TableHead>Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyData.map((day) => {
                    const total = day.present + day.absent;
                    const totalClasses = day.total_classes || total;
                    const percentage = totalClasses > 0 ? ((day.present / totalClasses) * 100).toFixed(2) : "0.00";
                    return (
                      <TableRow key={day.date}>
                        <TableCell>
                          {new Date(day.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {day.present}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            {day.absent}
                          </Badge>
                        </TableCell>
                        <TableCell>{totalClasses}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{percentage}%</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Percentage Table */}
      {monthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Percentage by Batch, Subject & Student</CardTitle>
            <CardDescription>Detailed breakdown for {selectedMonth}</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Total Classes</TableHead>
                      <TableHead>Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.batch.name}</TableCell>
                        <TableCell>{item.subject.name}</TableCell>
                        <TableCell>{item.student.name || item.student.email || `#${item.student.id}`}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {item.statistics.present}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            {item.statistics.absent}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.statistics.total_classes}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              item.statistics.percentage >= 75
                                ? "bg-green-100 text-green-800"
                                : item.statistics.percentage >= 50
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {item.statistics.percentage}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {dailyData.length === 0 && !analyticsLoading && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No attendance data found for the selected filters. Try adjusting your filters.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
