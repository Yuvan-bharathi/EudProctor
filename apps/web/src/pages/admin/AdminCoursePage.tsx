import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { StatCard } from "@/components/StatCard";
import { ErrorState, QueryState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { User } from "@/features/auth/store";
import { api, errorMessage } from "@/lib/api";

interface CourseDetails {
  id: string;
  name: string;
  code: string;
  mentors: { user: User; role: string }[];
  candidates: { user: User; role: string }[];
  topics: { topic_id: string; name: string; questions: number; approved_notes: number }[];
  assessments: number;
}

function AddMember({ course }: { course: CourseDetails }) {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => api<User[]>("/admin/users") });
  const [userId, setUserId] = useState("");
  const members = new Set([...course.mentors, ...course.candidates].map((m) => m.user.id));
  const options = (users.data ?? []).filter((u) => u.role !== "admin" && !members.has(u.id));
  const add = useMutation({
    mutationFn: () => {
      const u = options.find((o) => o.id === userId);
      return api(`/admin/courses/${course.id}/members`, { body: { user_id: userId, role: u?.role } });
    },
    onSuccess: () => {
      setUserId("");
      qc.invalidateQueries({ queryKey: ["admin", "course", course.id] });
    },
  });
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
    >
      <div className="w-72">
        <Label htmlFor="add-member">Add a mentor or candidate</Label>
        <Select id="add-member" className="w-full" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Choose a person</option>
          {options.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role})
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="secondary" disabled={!userId || add.isPending}>
        Add
      </Button>
      {add.isError && <ErrorState message={errorMessage(add.error)} />}
    </form>
  );
}

function People({ title, rows }: { title: string; rows: { user: User }[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">None yet.</p>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map(({ user }) => (
              <TR key={user.id}>
                <TD>
                  <Link className="font-medium text-primary-700 hover:underline" to={`/admin/users/${user.id}`}>
                    {user.name}
                  </Link>
                </TD>
                <TD className="text-muted">{user.email}</TD>
                <TD>{user.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </section>
  );
}

export function AdminCoursePage() {
  const { courseId } = useParams();
  const q = useQuery({ queryKey: ["admin", "course", courseId], queryFn: () => api<CourseDetails>(`/admin/courses/${courseId}`) });
  usePageTitle(q.data?.name ?? "Course");
  return (
    <QueryState query={q} emptyMessage="">
      {(c) => (
        <div className="space-y-6">
          <Link to="/admin/courses" className="text-sm text-primary-700 hover:underline">
            ← All courses
          </Link>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Code" value={c.code} />
            <StatCard label="Candidates" value={c.candidates.length} />
            <StatCard label="Questions" value={c.topics.reduce((n, t) => n + t.questions, 0)} />
            <StatCard label="Assessments" value={c.assessments} />
          </div>
          <Card className="space-y-4">
            <CardTitle>Topics</CardTitle>
            {c.topics.length === 0 ? (
              <p className="text-sm text-muted">No topics yet. Mentors add topics in the question bank.</p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Topic</TH>
                    <TH>Approved questions</TH>
                    <TH>Approved notes</TH>
                  </tr>
                </THead>
                <TBody>
                  {c.topics.map((t) => (
                    <TR key={t.topic_id}>
                      <TD className="font-medium">{t.name}</TD>
                      <TD>{t.questions}</TD>
                      <TD>{t.approved_notes ? t.approved_notes : <Badge tone="warning">None</Badge>}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
          <Card>
            <AddMember course={c} />
          </Card>
          <People title="Mentors" rows={c.mentors} />
          <People title="Candidates" rows={c.candidates} />
        </div>
      )}
    </QueryState>
  );
}
