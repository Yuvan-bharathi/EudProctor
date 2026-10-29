import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { ErrorState, QueryState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/api";

interface Course {
  id: string;
  name: string;
  code: string;
}

export function AdminCoursesPage() {
  usePageTitle("Courses");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "courses"], queryFn: () => api<Course[]>("/admin/courses") });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const create = useMutation({
    mutationFn: () => api<Course>("/admin/courses", { body: { name, code } }),
    onSuccess: () => {
      setName("");
      setCode("");
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle className="mb-4">New course</CardTitle>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Label htmlFor="course-name">Name</Label>
            <Input id="course-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-40">
            <Label htmlFor="course-code">Code</Label>
            <Input id="course-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <Button type="submit" disabled={!name || !code || create.isPending}>
            Create course
          </Button>
        </form>
        {create.isError && (
          <div className="mt-3">
            <ErrorState message={errorMessage(create.error)} />
          </div>
        )}
      </Card>
      <QueryState query={q} isEmpty={(d) => d.length === 0} emptyMessage="No courses yet.">
        {(courses) => (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Code</TH>
              </tr>
            </THead>
            <TBody>
              {courses.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link className="font-medium text-primary-700 hover:underline" to={`/admin/courses/${c.id}`}>
                      {c.name}
                    </Link>
                  </TD>
                  <TD className="font-mono text-muted">{c.code}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </QueryState>
    </div>
  );
}
