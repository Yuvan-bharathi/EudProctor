import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Layers, MailWarning, Plus, Trash2, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import { type Cohort, internshipApi, type Mentee, type MentorRow } from "@/lib/internshipApi";

export function AdminCohortsPage() {
  usePageTitle("Cohorts & Mentorship Pairings");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const cohortsQ = useQuery({ queryKey: ["internship", "cohorts"], queryFn: () => internshipApi.cohorts() });
  const cohorts = cohortsQ.data ?? [];
  const active = cohorts.find((c) => c.id === selected) ?? cohorts[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="primary">
            <Layers aria-hidden="true" />
            Programme administration
          </Badge>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-text sm:text-2xl">Cohorts & Mentorship Pairings</h1>
          <p className="text-sm text-muted">
            Create cohorts, enrol interns with a mentor and manage the documents the Blocker Co-Pilot answers from.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
          <Plus aria-hidden="true" />
          New cohort
        </Button>
      </div>

      {creating && <CohortForm onDone={(c) => { setCreating(false); if (c) setSelected(c.id); }} />}

      {cohortsQ.isPending ? (
        <LoadingState rows={3} label="Loading cohorts" />
      ) : cohortsQ.isError ? (
        <ErrorState message={errorMessage(cohortsQ.error)} onRetry={() => cohortsQ.refetch()} />
      ) : cohorts.length === 0 ? (
        <EmptyState
          message="No cohorts yet. Create the first cohort to start enrolling interns."
          action={!creating && <Button onClick={() => setCreating(true)}>Create cohort</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cohorts.map((c) => (
              <CohortCard key={c.id} c={c} active={c.id === active?.id} onSelect={() => setSelected(c.id)} />
            ))}
          </div>
          {active && <CohortManager key={active.id} cohort={active} />}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ cohorts

function CohortCard({ c, active, onSelect }: { c: Cohort; active: boolean; onSelect: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const toggle = useMutation({
    mutationFn: (v: boolean) => internshipApi.patchCohort(c.id, { ai_review_enabled: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internship"] }),
  });

  return (
    <Card className={active ? "border-primary-500" : undefined}>
      {editing ? (
        <CohortForm cohort={c} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-text">{c.name}</h2>
              <p className="text-xs text-muted">{c.track}</p>
            </div>
            {active && <Badge tone="primary">Selected</Badge>}
          </div>
          <p className="mt-2 text-xs text-muted">
            {c.start_date} → {c.end_date} · {c.timezone}
          </p>
          <p className="mt-1 text-sm text-text">
            {c.mentee_count} intern{c.mentee_count === 1 ? "" : "s"} · {c.mentor_count} mentor{c.mentor_count === 1 ? "" : "s"}
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="size-4 accent-primary-600"
              checked={toggle.isPending ? !!toggle.variables : c.ai_review_enabled}
              disabled={toggle.isPending}
              onChange={(e) => toggle.mutate(e.target.checked)}
            />
            AI code review enabled
          </label>
          {toggle.isError && <p className="mt-1 text-xs text-danger-700">{errorMessage(toggle.error)}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant={active ? "secondary" : "primary"} onClick={onSelect} disabled={active}>
              {active ? "Managing" : "Manage"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function CohortForm({ cohort, onDone }: { cohort?: Cohort; onDone: (c?: Cohort) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: cohort?.name ?? "",
    track: cohort?.track ?? "",
    start_date: cohort?.start_date ?? "",
    end_date: cohort?.end_date ?? "",
    timezone: cohort?.timezone ?? "",
    ai_review_enabled: cohort?.ai_review_enabled ?? true,
  });
  const m = useMutation({
    mutationFn: () => {
      const body = { ...f, name: f.name.trim(), track: f.track.trim(), timezone: f.timezone.trim() || undefined };
      return cohort ? internshipApi.patchCohort(cohort.id, body) : internshipApi.createCohort(body);
    },
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ["internship"] });
      onDone(c);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  const id = cohort?.id ?? "new";

  const form = (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`cn-${id}`}>Name</Label>
          <Input id={`cn-${id}`} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor={`ct-${id}`}>Track</Label>
          <Input id={`ct-${id}`} required placeholder="e.g. MERN Full Stack" value={f.track} onChange={(e) => setF({ ...f, track: e.target.value })} />
        </div>
        <div>
          <Label htmlFor={`cs-${id}`}>Start date</Label>
          <Input id={`cs-${id}`} type="date" required value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
        </div>
        <div>
          <Label htmlFor={`ce-${id}`}>End date</Label>
          <Input id={`ce-${id}`} type="date" required value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
        </div>
        <div>
          <Label htmlFor={`cz-${id}`}>Time zone (IANA, optional)</Label>
          <Input id={`cz-${id}`} placeholder="Server default" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-text">
          <input
            type="checkbox"
            className="size-4 accent-primary-600"
            checked={f.ai_review_enabled}
            onChange={(e) => setF({ ...f, ai_review_enabled: e.target.checked })}
          />
          AI code review enabled
        </label>
      </div>
      {m.isError && <ErrorState message={errorMessage(m.error)} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" disabled={m.isPending}>
          {m.isPending ? "Saving…" : cohort ? "Save cohort" : "Create cohort"}
        </Button>
      </div>
    </form>
  );

  if (cohort) return form;
  return (
    <Card>
      <CardHeader>
        <CardTitle>New cohort</CardTitle>
      </CardHeader>
      {form}
    </Card>
  );
}

// ------------------------------------------------------------------ selected cohort

function CohortManager({ cohort }: { cohort: Cohort }) {
  const mentorsQ = useQuery({ queryKey: ["internship", "mentors"], queryFn: () => internshipApi.mentors() });
  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-text">{cohort.name}</h2>
      <EnrollForm cohort={cohort} mentorsQ={mentorsQ} />
      <CohortMentees cohort={cohort} mentors={mentorsQ.data ?? []} />
      <CohortDocs cohort={cohort} />
    </div>
  );
}

function MentorOptions({ mentors }: { mentors: MentorRow[] }) {
  return (
    <>
      {mentors.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} ({m.active_mentees} active intern{m.active_mentees === 1 ? "" : "s"})
        </option>
      ))}
    </>
  );
}

const EMPTY_ENROLL = { name: "", email: "", mentor_id: "", phone: "", roll_number: "", started_on: "" };

function EnrollForm({
  cohort,
  mentorsQ,
}: {
  cohort: Cohort;
  mentorsQ: { isPending: boolean; isError: boolean; error: unknown; data?: MentorRow[]; refetch: () => unknown };
}) {
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY_ENROLL);
  const m = useMutation({
    mutationFn: () =>
      internshipApi.enroll(cohort.id, {
        name: f.name.trim(),
        email: f.email.trim(),
        mentor_id: f.mentor_id,
        phone: f.phone.trim() || undefined,
        roll_number: f.roll_number.trim() || undefined,
        started_on: f.started_on || undefined,
      }),
    onSuccess: () => {
      setF(EMPTY_ENROLL);
      void qc.invalidateQueries({ queryKey: ["internship"] });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-muted" aria-hidden="true" />
            Enrol an intern
          </CardTitle>
          <CardDescription>
            Creates (or reuses) the intern's account and emails their username and a unique password. Each mentor can
            only take a limited number of active interns; the server rejects the enrolment if the mentor is full.
          </CardDescription>
        </div>
      </CardHeader>
      {mentorsQ.isError ? (
        <ErrorState message={errorMessage(mentorsQ.error)} onRetry={() => mentorsQ.refetch()} />
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="en-name">Full name</Label>
              <Input id="en-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="en-email">Email</Label>
              <Input id="en-email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="en-mentor">Mentor</Label>
              <Select
                id="en-mentor"
                required
                className="w-full"
                disabled={mentorsQ.isPending}
                value={f.mentor_id}
                onChange={(e) => setF({ ...f, mentor_id: e.target.value })}
              >
                <option value="">{mentorsQ.isPending ? "Loading mentors…" : "Choose a mentor"}</option>
                <MentorOptions mentors={mentorsQ.data ?? []} />
              </Select>
            </div>
            <div>
              <Label htmlFor="en-phone">Phone (optional)</Label>
              <Input id="en-phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="en-roll">Roll number (optional)</Label>
              <Input id="en-roll" value={f.roll_number} onChange={(e) => setF({ ...f, roll_number: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="en-start">Start date (defaults to cohort start)</Label>
              <Input id="en-start" type="date" value={f.started_on} onChange={(e) => setF({ ...f, started_on: e.target.value })} />
            </div>
          </div>
          {m.isError && <ErrorState message={errorMessage(m.error)} />}
          {m.isSuccess && (
            <div className="space-y-1 rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700" role="status">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {m.data.name} enrolled{m.data.username ? ` (username ${m.data.username})` : ""} with {m.data.mentor_name}.
              </p>
              {m.data.welcome_email.delivered ? (
                <p>The welcome email with their username and password was delivered to {m.data.email}.</p>
              ) : (
                <p className="flex items-center gap-2 text-warning-800">
                  <MailWarning className="size-4" aria-hidden="true" />
                  The welcome email could not be delivered
                  {m.data.welcome_email.error ? `: ${m.data.welcome_email.error}` : ""}. The intern can use “Forgot
                  password” on the sign-in page.
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={m.isPending || !f.mentor_id}>
              {m.isPending ? "Enrolling…" : "Enrol intern"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function CohortMentees({ cohort, mentors }: { cohort: Cohort; mentors: MentorRow[] }) {
  const q = useQuery({
    queryKey: ["internship", "mentees", { cohort: cohort.id }],
    queryFn: () => internshipApi.mentees(cohort.id),
  });
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Interns in this cohort</CardTitle>
          <CardDescription>Reassign a mentor or mark an internship as completed.</CardDescription>
        </div>
      </CardHeader>
      {q.isPending ? (
        <LoadingState rows={3} label="Loading interns" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState message="No interns enrolled in this cohort yet." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Intern</TH>
              <TH>Started</TH>
              <TH>Status</TH>
              <TH>Mentor</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {q.data.map((m) => (
              <EnrollmentRow key={m.enrollment_id} m={m} mentors={mentors} />
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

function EnrollmentRow({ m, mentors }: { m: Mentee; mentors: MentorRow[] }) {
  const qc = useQueryClient();
  const [mentorId, setMentorId] = useState(m.mentor_id);
  const patch = useMutation({
    mutationFn: (body: { mentor_id?: string; status?: "Active" | "Completed" }) => internshipApi.patchEnrollment(m.enrollment_id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internship"] }),
  });
  const known = mentors.some((x) => x.id === m.mentor_id);

  return (
    <TR>
      <TD>
        <p className="font-medium">{m.name}</p>
        <p className="text-xs text-muted">
          {m.username ? `@${m.username} · ` : ""}
          {m.email}
        </p>
        {patch.isError && <p className="mt-1 text-xs text-danger-700">{errorMessage(patch.error)}</p>}
      </TD>
      <TD className="whitespace-nowrap">{m.started_on}</TD>
      <TD>
        <Badge tone={m.status === "Active" ? "primary" : "success"}>{m.status}</Badge>
      </TD>
      <TD>
        <div className="flex items-center gap-2">
          <Select
            aria-label={`Mentor for ${m.name}`}
            className="h-8 text-xs"
            value={mentorId}
            onChange={(e) => setMentorId(e.target.value)}
            disabled={patch.isPending}
          >
            {!known && <option value={m.mentor_id}>{m.mentor_name}</option>}
            <MentorOptions mentors={mentors} />
          </Select>
          {mentorId !== m.mentor_id && (
            <Button size="sm" variant="secondary" disabled={patch.isPending} onClick={() => patch.mutate({ mentor_id: mentorId })}>
              Reassign
            </Button>
          )}
        </div>
      </TD>
      <TD className="text-right">
        {m.status === "Active" ? (
          <Button size="sm" variant="ghost" disabled={patch.isPending} onClick={() => patch.mutate({ status: "Completed" })}>
            Mark completed
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={patch.isPending} onClick={() => patch.mutate({ status: "Active" })}>
            Reactivate
          </Button>
        )}
      </TD>
    </TR>
  );
}

// ------------------------------------------------------------------ Blocker Co-Pilot docs

function CohortDocs({ cohort }: { cohort: Cohort }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const q = useQuery({ queryKey: ["internship", "docs", cohort.id], queryFn: () => internshipApi.docs(cohort.id) });
  const add = useMutation({
    mutationFn: () => internshipApi.addDoc(cohort.id, { title: title.trim(), body: body.trim() }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      void qc.invalidateQueries({ queryKey: ["internship", "docs", cohort.id] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => internshipApi.deleteDoc(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internship", "docs", cohort.id] }),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim() && body.trim()) add.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-4 text-muted" aria-hidden="true" />
            Blocker Co-Pilot knowledge docs
          </CardTitle>
          <CardDescription>
            The Co-Pilot only answers interns' blocker questions from these documents (this cohort's docs plus the
            built-in setup docs). If the answer isn't in them, it escalates to the mentor instead of guessing.
          </CardDescription>
        </div>
      </CardHeader>

      {q.isPending ? (
        <LoadingState rows={2} label="Loading docs" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <div className="space-y-4">
          {del.isError && <ErrorState message={errorMessage(del.error)} />}
          {q.data.docs.length === 0 ? (
            <EmptyState message="No cohort docs yet. Add setup guides, conventions or FAQs below." />
          ) : (
            <ul className="space-y-2">
              {q.data.docs.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-text">{d.title}</p>
                    <p className="line-clamp-2 text-xs text-muted">{d.body}</p>
                    <p className="mt-1 text-xs text-subtle">Added {new Date(d.created_at).toLocaleDateString()}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${d.title}`}
                    disabled={del.isPending && del.variables === d.id}
                    onClick={() => {
                      if (window.confirm(`Delete “${d.title}”? The Co-Pilot will stop using it.`)) del.mutate(d.id);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {q.data.builtin.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Built-in docs (read-only)</p>
              <div className="flex flex-wrap gap-1.5">
                {q.data.builtin.map((b) => (
                  <Badge key={b.id}>{b.title}</Badge>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={submit} className="space-y-3 border-t border-border pt-4">
            <div>
              <Label htmlFor="doc-title">Title</Label>
              <Input id="doc-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="doc-body">Content</Label>
              <Textarea id="doc-body" required rows={5} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            {add.isError && <ErrorState message={errorMessage(add.error)} />}
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" disabled={add.isPending || !title.trim() || !body.trim()}>
                {add.isPending ? "Adding…" : "Add doc"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Card>
  );
}
