import { useQuery } from "@tanstack/react-query";
import { FileQuestion, LineChart } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import { internshipApi, type SkillScoreRow } from "@/lib/internshipApi";
import { SKILL_LEVEL_LABELS, type SkillLevel } from "@/lib/types";

const AXIS = { fontSize: 12, fill: "var(--text-muted)" };

function levelLabel(level: number): string {
  return SKILL_LEVEL_LABELS[level as SkillLevel] ?? "";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function SkillScoreChart({ skills }: { skills: SkillScoreRow[] }) {
  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-4 text-xs text-muted" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: "var(--primary-500)" }} aria-hidden="true" />
          Level assigned
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: "var(--border-strong)" }} aria-hidden="true" />
          Insufficient data
        </li>
      </ul>
      <ResponsiveContainer width="100%" height={Math.max(160, skills.length * 44)}>
        <BarChart data={skills} layout="vertical" margin={{ left: 8, right: 48 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={AXIS}
            tickFormatter={(v) => `${v}%`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis type="category" dataKey="skill" tick={AXIS} width={140} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-muted)" }}
            content={({ payload }) => {
              const row = payload?.[0]?.payload as SkillScoreRow | undefined;
              if (!row) return null;
              return (
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text shadow-sm">
                  {row.skill}: {row.score_pct}% ·{" "}
                  {row.level != null ? `Level ${row.level}` : "Insufficient data"} · {row.n_questions} questions
                </div>
              );
            }}
          />
          <Bar dataKey="score_pct" radius={[0, 4, 4, 0]} barSize={18}>
            {skills.map((s) => (
              <Cell key={s.skill} fill={s.level != null ? "var(--primary-500)" : "var(--border-strong)"} />
            ))}
            <LabelList dataKey="score_pct" position="right" formatter={(v: number) => `${v}%`} style={AXIS} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MenteeSkillMatrixPage() {
  usePageTitle("My Skill Matrix (1-5)");
  const skillsQ = useQuery({ queryKey: ["internship", "skills"], queryFn: () => internshipApi.skills() });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Badge tone="primary">
          <LineChart className="size-3.5" aria-hidden="true" />
          Skill levels 1–5
        </Badge>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-text sm:text-2xl">My Skill Matrix</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Your skill levels come only from your answers in the weekly knowledge checks. Each check adds to the
          score for the skills its questions cover. A level is shown once a skill has enough answered questions.
        </p>
      </div>

      {/* 5-Level ladder */}
      <Card>
        <CardHeader className="mb-3">
          <CardTitle className="text-sm">Skill ladder</CardTitle>
        </CardHeader>
        <ol className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-5">
          {([1, 2, 3, 4, 5] as const).map((lvl) => (
            <li key={lvl} className="rounded-lg border border-border bg-surface-muted p-2.5">
              <span className="font-semibold text-text">Level {lvl}</span>
              <p className="mt-0.5 text-muted">{SKILL_LEVEL_LABELS[lvl]}</p>
            </li>
          ))}
        </ol>
      </Card>

      {skillsQ.isPending ? (
        <LoadingState rows={5} label="Loading skills" />
      ) : skillsQ.isError ? (
        <ErrorState message={errorMessage(skillsQ.error)} onRetry={() => skillsQ.refetch()} />
      ) : skillsQ.data.skills.length === 0 ? (
        <EmptyState
          message="No skill data yet. Your skill levels appear after you submit your first weekly knowledge check."
          action={
            <Link to="/candidate/internship/mcq" className="text-sm font-medium text-primary-700 hover:underline">
              Go to weekly knowledge checks
            </Link>
          }
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Score by skill</CardTitle>
                <CardDescription>
                  Share of weekly-check questions answered correctly per skill. A level needs at least{" "}
                  {skillsQ.data.min_questions_per_skill} answered questions.
                </CardDescription>
              </div>
            </CardHeader>
            <SkillScoreChart skills={skillsQ.data.skills} />
          </Card>

          <section className="space-y-3" aria-labelledby="skills-table-title">
            <h2 id="skills-table-title" className="text-sm font-semibold text-text">
              Skills ({skillsQ.data.skills.length})
            </h2>
            <Table>
              <THead>
                <TR>
                  <TH>Skill</TH>
                  <TH>Level</TH>
                  <TH className="text-right">Score</TH>
                  <TH className="text-right">Questions</TH>
                  <TH>Last updated</TH>
                </TR>
              </THead>
              <TBody>
                {skillsQ.data.skills.map((s) => (
                  <TR key={s.skill}>
                    <TD className="font-medium">{s.skill}</TD>
                    <TD>
                      {s.level != null ? (
                        <Badge tone="primary">
                          Level {s.level}: {levelLabel(s.level)}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">
                          <FileQuestion className="size-3.5" aria-hidden="true" />
                          Insufficient data (needs {skillsQ.data.min_questions_per_skill} questions)
                        </Badge>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums">{s.score_pct}%</TD>
                    <TD className="text-right tabular-nums">{s.n_questions}</TD>
                    <TD className="text-muted">{formatDate(s.updated_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </section>
        </>
      )}
    </div>
  );
}
