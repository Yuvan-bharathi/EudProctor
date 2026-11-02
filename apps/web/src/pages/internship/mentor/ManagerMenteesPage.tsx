import { useQuery } from "@tanstack/react-query";
import { Circle, Mail, Phone, Users } from "lucide-react";
import { useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import {
  type DayStatus,
  type InternTaskStatus,
  internshipApi,
  type Mentee,
  type SkillScoreRow,
} from "@/lib/internshipApi";

type Tone = NonNullable<BadgeProps["tone"]>;

const DAY_TONE: Record<DayStatus, Tone> = {
  Present: "success",
  "Half Day": "warning",
  Short: "warning",
  Leave: "info",
  Absent: "danger",
  "In Progress": "primary",
  "Needs Correction": "danger",
};

const TASK_TONE: Record<InternTaskStatus, Tone> = {
  Assigned: "neutral",
  "In Progress": "primary",
  Review: "ai",
  Done: "success",
  Rework: "warning",
};

function pct(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : `${Math.round(v)}%`;
}

export function ManagerMenteesPage() {
  usePageTitle("My Mentees & Skill Matrix");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const menteesQ = useQuery({ queryKey: ["internship", "mentees"], queryFn: () => internshipApi.mentees() });
  const mentees = menteesQ.data ?? [];
  const activeId = selectedId ?? mentees[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="primary">
          <Users aria-hidden="true" />
          Internship mentoring
        </Badge>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-text sm:text-2xl">My Mentees & Skill Matrix</h1>
        <p className="text-sm text-muted">
          Attendance, tasks and skill levels for the interns you mentor. Skill levels come from weekly quiz results.
        </p>
        <p className="mt-1 text-xs text-subtle">
          Note: the programme caps how many active interns one mentor can guide; admins manage pairings.
        </p>
      </div>

      {menteesQ.isPending ? (
        <LoadingState rows={4} label="Loading mentees" />
      ) : menteesQ.isError ? (
        <ErrorState message={errorMessage(menteesQ.error)} onRetry={() => menteesQ.refetch()} />
      ) : mentees.length === 0 ? (
        <EmptyState message="No interns are assigned to you yet. An admin pairs interns with mentors from the cohorts page." />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>Intern</TH>
                <TH>Cohort</TH>
                <TH>Week / Month</TH>
                <TH>Today</TH>
                <TH>Attendance</TH>
                <TH>Tasks</TH>
                <TH>Skills</TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {mentees.map((m) => (
                <MenteeRow key={m.enrollment_id} m={m} active={m.id === activeId} onSelect={() => setSelectedId(m.id)} />
              ))}
            </TBody>
          </Table>

          {activeId && <MenteeDetail key={activeId} menteeId={activeId} />}
        </>
      )}
    </div>
  );
}

function MenteeRow({ m, active, onSelect }: { m: Mentee; active: boolean; onSelect: () => void }) {
  const assessed = (m.skills ?? []).filter((s) => s.level !== null).length;
  return (
    <TR className={active ? "bg-primary-50" : undefined}>
      <TD>
        <p className="font-medium text-text">{m.name}</p>
        <p className="text-xs text-muted">
          {m.username ? `@${m.username} · ` : ""}
          {m.email}
        </p>
      </TD>
      <TD>
        <p>{m.cohort_name}</p>
        <p className="text-xs text-muted">{m.track}</p>
      </TD>
      <TD className="whitespace-nowrap">
        Week {m.current_week} · Month {m.current_month}
      </TD>
      <TD>
        <div className="flex flex-col items-start gap-1">
          {m.today_status && <Badge tone={DAY_TONE[m.today_status]}>{m.today_status}</Badge>}
          <OnlineChip online={!!m.online} />
        </div>
      </TD>
      <TD>{pct(m.attendance_rate_pct)}</TD>
      <TD className="whitespace-nowrap">
        {m.tasks_done ?? 0} / {m.tasks_total ?? 0} done
        {(m.tasks_in_review ?? 0) > 0 && <p className="text-xs text-muted">{m.tasks_in_review} in review</p>}
      </TD>
      <TD className="whitespace-nowrap text-xs text-muted">
        {(m.skills ?? []).length === 0 ? "No data yet" : `${assessed} of ${(m.skills ?? []).length} assessed`}
      </TD>
      <TD className="text-right">
        <Button size="sm" variant={active ? "secondary" : "ghost"} onClick={onSelect} aria-pressed={active}>
          {active ? "Viewing" : "View"}
        </Button>
      </TD>
    </TR>
  );
}

function OnlineChip({ online }: { online: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${online ? "text-success-700" : "text-muted"}`}>
      <Circle className={`size-2 ${online ? "fill-success-500 text-success-500" : "text-subtle"}`} aria-hidden="true" />
      {online ? "Online now" : "Offline"}
    </span>
  );
}

function MenteeDetail({ menteeId }: { menteeId: string }) {
  const menteeQ = useQuery({ queryKey: ["internship", "mentee", menteeId], queryFn: () => internshipApi.mentee(menteeId) });
  const skillsQ = useQuery({ queryKey: ["internship", "skills", menteeId], queryFn: () => internshipApi.skills(menteeId) });
  const tasksQ = useQuery({
    queryKey: ["internship", "tasks", { mentee_id: menteeId }],
    queryFn: () => internshipApi.tasks({ mentee_id: menteeId }),
  });

  if (menteeQ.isPending) return <LoadingState rows={3} label="Loading intern" />;
  if (menteeQ.isError) return <ErrorState message={errorMessage(menteeQ.error)} onRetry={() => menteeQ.refetch()} />;
  const m = menteeQ.data;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-text">{m.name}</h2>
              <Badge tone="primary">{m.track}</Badge>
              <Badge>
                Week {m.current_week} · Month {m.current_month}
              </Badge>
              {m.status === "Completed" && <Badge tone="success">Completed</Badge>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-muted">
              {m.username && (
                <span>
                  Username: <strong className="text-text">{m.username}</strong>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Mail className="size-3.5" aria-hidden="true" />
                {m.email}
              </span>
              {m.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3.5" aria-hidden="true" />
                  {m.phone}
                </span>
              )}
              {m.roll_number && (
                <span>
                  Roll: <strong className="text-text">{m.roll_number}</strong>
                </span>
              )}
              <span>
                Cohort: <strong className="text-text">{m.cohort_name}</strong>
              </span>
              <span>Started {m.started_on}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Stat label="Attendance" value={pct(m.attendance_rate_pct)} />
            <Stat label="Tasks done" value={`${m.tasks_done ?? 0} / ${m.tasks_total ?? 0}`} />
            <Stat label="In review" value={String(m.tasks_in_review ?? 0)} />
            <div className="flex flex-col items-start gap-1">
              {m.today_status && <Badge tone={DAY_TONE[m.today_status]}>Today: {m.today_status}</Badge>}
              <OnlineChip online={!!m.online} />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Skill matrix</CardTitle>
            <CardDescription>
              Levels 1–5 are computed by the server from weekly quiz answers.
              {skillsQ.data &&
                ` A skill needs at least ${skillsQ.data.min_questions_per_skill} answered questions before it gets a level.`}
            </CardDescription>
          </div>
        </CardHeader>
        {skillsQ.isPending ? (
          <LoadingState rows={2} label="Loading skills" />
        ) : skillsQ.isError ? (
          <ErrorState message={errorMessage(skillsQ.error)} onRetry={() => skillsQ.refetch()} />
        ) : skillsQ.data.skills.length === 0 ? (
          <EmptyState message="No skill data yet. Levels appear once the intern has taken a weekly quiz." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {skillsQ.data.skills.map((s) => (
              <SkillCard key={s.skill} s={s} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>All tasks assigned to {m.name} in this cohort.</CardDescription>
          </div>
        </CardHeader>
        {tasksQ.isPending ? (
          <LoadingState rows={2} label="Loading tasks" />
        ) : tasksQ.isError ? (
          <ErrorState message={errorMessage(tasksQ.error)} onRetry={() => tasksQ.refetch()} />
        ) : tasksQ.data.length === 0 ? (
          <EmptyState message="No tasks assigned yet." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Task</TH>
                <TH>Week</TH>
                <TH>Priority</TH>
                <TH>Due</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {tasksQ.data.map((t) => (
                <TR key={t.id}>
                  <TD>
                    <p className="font-medium">{t.title}</p>
                    {t.skill_area && <p className="text-xs text-muted">{t.skill_area}</p>}
                  </TD>
                  <TD>{t.week_number}</TD>
                  <TD>{t.priority}</TD>
                  <TD className="whitespace-nowrap">{t.due_date ?? "—"}</TD>
                  <TD>
                    <Badge tone={TASK_TONE[t.status]}>{t.status}</Badge>
                    {t.flagged_blocked_at && (
                      <Badge tone="danger" className="ml-1">
                        Blocked
                      </Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[90px] rounded-lg bg-surface-muted p-3 text-center">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="text-xl font-bold text-text">{value}</p>
    </div>
  );
}

function SkillCard({ s }: { s: SkillScoreRow }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-text">{s.skill}</h3>
        {s.level === null ? (
          <Badge>Insufficient data</Badge>
        ) : (
          <Badge tone="primary">Level {s.level} / 5</Badge>
        )}
      </div>
      {s.level !== null && (
        <div className="mt-3 grid grid-cols-5 gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((lvl) => (
            <div key={lvl} className={`h-2 rounded-full ${lvl <= (s.level ?? 0) ? "bg-primary-500" : "bg-surface-muted"}`} />
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        {s.n_questions} question{s.n_questions === 1 ? "" : "s"} answered
        {s.level !== null && ` · ${Math.round(s.score_pct)}% correct`} · updated {new Date(s.updated_at).toLocaleDateString()}
      </p>
    </div>
  );
}
