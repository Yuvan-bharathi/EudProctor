import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactElement, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { StatCard } from "@/components/StatCard";
import { EmptyState, ErrorState, QueryState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { User } from "@/features/auth/store";
import { api, errorMessage } from "@/lib/api";
import type { Course } from "@/lib/types";

interface UserDetails {
  user: User;
  consent_version: string | null;
  consent_at: string | null;
  face_enrolled: boolean;
  created_at: string;
  memberships: { course_id: string; course_name: string; course_code: string; role: "mentor" | "candidate" }[];
  assessments_assigned: number;
  attempts: {
    exam_id: string;
    exam_title: string;
    course_name: string;
    status: string;
    submitted_at: string | null;
    score_pct: number | null;
    red_flags: number;
    max_flags: number;
    summary_status: string | null;
  }[];
  mentor_exams: { exam_id: string; title: string; course_name: string; window_end: string; candidates: number }[];
}

const summaryLabel: Record<string, ReactElement> = {
  draft: <Badge tone="ai">AI draft</Badge>,
  changes_requested: <Badge tone="warning">Redrafting</Badge>,
  approved: <Badge tone="success">Approved</Badge>,
  published: <Badge tone="primary">Published</Badge>,
};

function AddToCourse({ d }: { d: UserDetails }) {
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: ["admin", "courses"], queryFn: () => api<Course[]>("/admin/courses") });
  const [courseId, setCourseId] = useState("");
  const role = d.user.role === "mentor" ? "mentor" : "candidate";
  const add = useMutation({
    mutationFn: () => api(`/admin/courses/${courseId}/members`, { body: { user_id: d.user.id, role } }),
    onSuccess: () => {
      setCourseId("");
      qc.invalidateQueries({ queryKey: ["admin", "user", d.user.id] });
    },
  });
  const options = (courses.data ?? []).filter((c) => !d.memberships.some((m) => m.course_id === c.id));
  if (d.user.role === "admin") return null;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
    >
      <div className="w-64">
        <Label htmlFor="add-course">Add to course as {role}</Label>
        <Select id="add-course" className="w-full" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Choose a course</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="secondary" disabled={!courseId || add.isPending}>
        Add
      </Button>
      {add.isError && <ErrorState message={errorMessage(add.error)} />}
    </form>
  );
}

export function AdminUserPage() {
  const { userId } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "user", userId], queryFn: () => api<UserDetails>(`/admin/users/${userId}`) });
  usePageTitle(q.data?.user.name ?? "User");
  const toggle = useMutation({
    mutationFn: (active: boolean) => api(`/admin/users/${userId}`, { method: "PATCH", body: { is_active: active } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  return (
    <QueryState query={q} emptyMessage="">
      {(d) => {
        const scored = d.attempts.filter((a) => a.score_pct !== null);
        const avg = scored.length ? (scored.reduce((n, a) => n + (a.score_pct ?? 0), 0) / scored.length).toFixed(1) : null;
        return (
          <div className="space-y-6">
            <Link to="/admin" className="text-sm text-primary-700 hover:underline">
              ← All users
            </Link>
            <Card className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>{d.user.name}</CardTitle>
                <CardDescription>
                  {d.user.email} · <span className="capitalize">{d.user.role}</span> · joined {new Date(d.created_at).toLocaleDateString()}
                </CardDescription>
                <div className="flex flex-wrap gap-2 pt-2">
                  {d.user.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
                  {d.user.role === "candidate" && (
                    <>
                      {d.consent_version ? <Badge tone="primary">Consent {d.consent_version}</Badge> : <Badge>No consent yet</Badge>}
                      {d.face_enrolled ? <Badge tone="info">Face enrolled</Badge> : <Badge>Face not enrolled</Badge>}
                    </>
                  )}
                </div>
              </div>
              {d.user.role !== "admin" && (
                <Button variant="secondary" onClick={() => toggle.mutate(!d.user.is_active)} disabled={toggle.isPending}>
                  {d.user.is_active ? "Deactivate" : "Activate"}
                </Button>
              )}
            </Card>
            {toggle.isError && <ErrorState message={errorMessage(toggle.error)} />}

            {d.user.role === "candidate" && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Courses" value={d.memberships.length} />
                <StatCard label="Assessments assigned" value={d.assessments_assigned} />
                <StatCard label="Attempts" value={d.attempts.length} />
                <StatCard label="Average score" value={avg ? `${avg}%` : "–"} />
              </div>
            )}

            <Card className="space-y-4">
              <CardTitle>Courses</CardTitle>
              {d.memberships.length === 0 ? (
                <p className="text-sm text-muted">Not a member of any course yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {d.memberships.map((m) => (
                    <li key={m.course_id}>
                      <Link to={`/admin/courses/${m.course_id}`}>
                        <Badge tone="primary">
                          {m.course_name} · {m.course_code}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <AddToCourse d={d} />
            </Card>

            {d.user.role === "candidate" && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold">Assessment attempts</h2>
                {d.attempts.length === 0 ? (
                  <EmptyState message="This candidate has not started an assessment yet." />
                ) : (
                  <Table>
                    <THead>
                      <tr>
                        <TH>Assessment</TH>
                        <TH>Status</TH>
                        <TH>Score</TH>
                        <TH>Red flags</TH>
                        <TH>Summary</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {d.attempts.map((a) => (
                        <TR key={a.exam_id}>
                          <TD>
                            <span className="block font-medium">{a.exam_title}</span>
                            <span className="text-xs text-muted">
                              {a.course_name}
                              {a.submitted_at && ` · submitted ${new Date(a.submitted_at).toLocaleDateString()}`}
                            </span>
                          </TD>
                          <TD className="capitalize text-muted">{a.status.replace(/_/g, " ")}</TD>
                          <TD>{a.score_pct !== null ? `${a.score_pct}%` : "–"}</TD>
                          <TD className={a.red_flags ? "font-medium text-danger-700" : "text-muted"}>
                            {a.red_flags} / {a.max_flags}
                          </TD>
                          <TD>{a.summary_status ? summaryLabel[a.summary_status] : <span className="text-muted">–</span>}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </section>
            )}

            {d.user.role === "mentor" && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold">Assessments created</h2>
                {d.mentor_exams.length === 0 ? (
                  <EmptyState message="This mentor has not created an assessment yet." />
                ) : (
                  <Table>
                    <THead>
                      <tr>
                        <TH>Assessment</TH>
                        <TH>Course</TH>
                        <TH>Closes</TH>
                        <TH>Candidates</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {d.mentor_exams.map((e) => (
                        <TR key={e.exam_id}>
                          <TD className="font-medium">{e.title}</TD>
                          <TD>{e.course_name}</TD>
                          <TD className="text-muted">{new Date(e.window_end).toLocaleString()}</TD>
                          <TD>{e.candidates}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </section>
            )}
          </div>
        );
      }}
    </QueryState>
  );
}
