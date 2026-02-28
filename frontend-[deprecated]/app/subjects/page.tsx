"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchMe, fetchSubjects } from "@/lib/api";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Spinner } from "@/app/components/ui/spinner";

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
      <Card>
        <CardHeader>
          <CardTitle className="text-4xl mt-4">My Subjects</CardTitle>
          <CardDescription className="max-w-2xl">
            View all subjects enrolled in your batch {batchName}.
          </CardDescription>
        </CardHeader>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-20 flex items-center justify-center">
            <Spinner size="lg" />
          </CardContent>
        </Card>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : mySubjects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No subjects found for your batch yet. Please check back later.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Subjects List</CardTitle>
            <CardDescription>
              {mySubjects.length} {mySubjects.length === 1 ? "subject" : "subjects"} enrolled
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
