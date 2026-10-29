import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TopicClass } from "./TopicChip";
import { topicClassLabel } from "./TopicChip";

/** Chart colours from the design system (SKILL.md): strong success-500, developing warning-500, weak danger-500,
 * neutral series primary-500, gridlines border, axis text text-muted 12 px. */
export const CLASS_FILL: Record<TopicClass, string> = {
  strong: "var(--success-500)",
  developing: "var(--warning-500)",
  weak: "var(--danger-500)",
  insufficient: "var(--border-strong)",
};
export const NEUTRAL_FILL = "var(--primary-500)";
const AXIS = { fontSize: 12, fill: "var(--text-muted)" };
const GAP = { stroke: "var(--surface)", strokeWidth: 2 }; // 2px surface gap between adjacent fills

function TooltipBox({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text shadow-sm">{children}</div>;
}

export function TopicAverageChart({ data }: { data: { name: string; average_pct: number | null; average_cls: TopicClass }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" domain={[0, 100]} tick={AXIS} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={AXIS} width={120} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "var(--surface-muted)" }}
          content={({ payload }) =>
            payload?.[0] ? (
              <TooltipBox>
                {payload[0].payload.name}: {payload[0].payload.average_pct ?? "–"}% ·{" "}
                {topicClassLabel[payload[0].payload.average_cls as TopicClass]}
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="average_pct" radius={[0, 4, 4, 0]} barSize={18} {...GAP}>
          {data.map((d) => (
            <Cell key={d.name} fill={CLASS_FILL[d.average_cls]} />
          ))}
          <LabelList dataKey="average_pct" position="right" formatter={(v: number) => `${v}%`} style={AXIS} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ClassDistributionChart({
  data,
}: {
  data: { name: string; strong: number; developing: number; weak: number; insufficient: number }[];
}) {
  const keys: TopicClass[] = ["strong", "developing", "weak", "insufficient"];
  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-4 text-xs text-muted" aria-label="Legend">
        {keys.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: CLASS_FILL[k] }} aria-hidden="true" />
            {topicClassLabel[k]}
          </li>
        ))}
      </ul>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={AXIS} width={120} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-muted)" }}
            content={({ payload }) =>
              payload?.[0] ? (
                <TooltipBox>
                  <div className="font-medium">{payload[0].payload.name}</div>
                  {keys.map((k) => (
                    <div key={k}>
                      {topicClassLabel[k]}: {payload[0].payload[k]}
                    </div>
                  ))}
                </TooltipBox>
              ) : null
            }
          />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="c" fill={CLASS_FILL[k]} barSize={18} {...GAP} radius={i === keys.length - 1 ? [0, 4, 4, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreHistogram({ data }: { data: { range: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 16, left: -16, right: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="range" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "var(--surface-muted)" }}
          content={({ payload }) =>
            payload?.[0] ? (
              <TooltipBox>
                {payload[0].payload.range}%: {payload[0].payload.count} candidate(s)
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="count" fill={NEUTRAL_FILL} radius={[4, 4, 0, 0]} {...GAP}>
          <LabelList dataKey="count" position="top" style={AXIS} formatter={(v: number) => (v ? v : "")} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Grouped multi-bar chart comparing topic performance across Strong, Developing, and Weak tiers (Mentor Dashboard) */
export function RecentPerformanceMultiBarChart({
  data = [
    { topic: "Heat Transfer", strong: 30, developing: 14, weak: 8 },
    { topic: "Thermodynamics", strong: 26, developing: 20, weak: 14 },
    { topic: "Fluid Mechanics", strong: 21, developing: 19, weak: 13 },
    { topic: "Power Cycles", strong: 25, developing: 12, weak: 7 },
  ],
}: {
  data?: { topic: string; strong: number; developing: number; weak: number }[];
}) {
  return (
    <div className="space-y-3">
      <ul className="flex items-center gap-4 text-xs text-muted" aria-label="Performance legend">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: "var(--primary-500)" }} />
          <span>Strong</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: "var(--info-500)" }} />
          <span>Developing</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: "var(--ai-500)" }} />
          <span>Weak</span>
        </li>
      </ul>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="topic" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-muted)" }}
            content={({ payload, label }) =>
              payload && payload.length ? (
                <TooltipBox>
                  <div className="font-semibold">{label}</div>
                  <div className="text-primary-700">Strong: {payload[0]?.value} candidates</div>
                  <div className="text-info-700">Developing: {payload[1]?.value} candidates</div>
                  <div className="text-ai-700">Weak: {payload[2]?.value} candidates</div>
                </TooltipBox>
              ) : null
            }
          />
          <Bar dataKey="strong" fill="var(--primary-500)" radius={[4, 4, 0, 0]} barSize={12} />
          <Bar dataKey="developing" fill="var(--info-500)" radius={[4, 4, 0, 0]} barSize={12} />
          <Bar dataKey="weak" fill="var(--ai-500)" radius={[4, 4, 0, 0]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bar chart showing assessments taken over time (Admin Dashboard) */
export function AssessmentsOverTimeChart({
  data = [
    { date: "9 Jan", count: 18 },
    { date: "16 Jan", count: 26 },
    { date: "23 Jan", count: 32 },
    { date: "29 Jan", count: 36 },
  ],
}: {
  data?: { date: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "var(--surface-muted)" }}
          content={({ payload, label }) =>
            payload && payload.length ? (
              <TooltipBox>
                <div className="font-semibold">{label}</div>
                <div>{payload[0]?.value} assessments</div>
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="count" fill="var(--info-500)" radius={[4, 4, 0, 0]} barSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut/Progress display showing assessment completion rate (Admin Dashboard) */
export function AssessmentCompletionDonutChart({
  rates = { completed: 82, inProgress: 12, notStarted: 6 },
}: {
  rates?: { completed: number; inProgress: number; notStarted: number };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
      {/* SVG Ring Donut */}
      <div className="relative flex size-36 shrink-0 items-center justify-center">
        <svg className="size-36 -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle cx="50" cy="50" r="40" stroke="var(--border)" strokeWidth="12" fill="none" />
          {/* Completed ring */}
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="var(--primary-600)"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${rates.completed * 2.51} 251`}
            strokeDashoffset="0"
          />
          {/* In progress ring */}
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="var(--info-500)"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${rates.inProgress * 2.51} 251`}
            strokeDashoffset={`-${rates.completed * 2.51}`}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold text-text">{rates.completed}%</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">Completed</span>
        </div>
      </div>

      {/* Legend & Breakdown */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-primary-600" />
            <span className="text-muted">Completed</span>
          </span>
          <span className="font-semibold text-text">{rates.completed}%</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-info-500" />
            <span className="text-muted">In progress</span>
          </span>
          <span className="font-semibold text-text">{rates.inProgress}%</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="text-muted">Not started</span>
          </span>
          <span className="font-semibold text-text">{rates.notStarted}%</span>
        </div>
      </div>
    </div>
  );
}

/** Assessment activity multi-line spline chart (Scheduled, Completed, Flagged) */
export function AssessmentActivityLineChart({
  data,
}: {
  data: { date: string; scheduled: number; completed: number; flagged: number }[];
}) {
  return (
    <div className="space-y-3">
      <ul className="flex items-center gap-4 text-xs text-muted" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary-600" />
          <span>Scheduled</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-success-500" />
          <span>Completed</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-danger-500" />
          <span>Flagged</span>
        </li>
      </ul>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={({ payload, label }) =>
              payload?.length ? (
                <TooltipBox>
                  <div className="font-bold text-text mb-1">{label}</div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-primary-700">Scheduled:</span>
                      <span className="font-semibold">{payload[0]?.value}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-success-700">Completed:</span>
                      <span className="font-semibold">{payload[1]?.value}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-danger-700">Flagged:</span>
                      <span className="font-semibold">{payload[2]?.value}</span>
                    </div>
                  </div>
                </TooltipBox>
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="scheduled"
            stroke="var(--primary-600)"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: "var(--primary-600)" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="completed"
            stroke="var(--success-500)"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: "var(--success-500)" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="flagged"
            stroke="var(--danger-500)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--danger-500)" }}
            activeDot={{ r: 4.5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Assessment outcomes donut chart (6,920 Completions: Strong 38%, Developing 42%, Weak 20%) */
export function AssessmentOutcomesDonut({
  total = 6920,
  strong = 38,
  developing = 42,
  weak = 20,
}: {
  total?: number;
  strong?: number;
  developing?: number;
  weak?: number;
}) {
  const cStrong = strong * 2.51;
  const cDev = developing * 2.51;
  const cWeak = weak * 2.51;

  return (
    <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
      <div className="relative flex size-36 shrink-0 items-center justify-center">
        <svg className="size-36 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" stroke="var(--border)" strokeWidth="12" fill="none" />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="var(--success-500)"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${cStrong} 251`}
            strokeDashoffset="0"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="var(--ai-500)"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${cDev} 251`}
            strokeDashoffset={`-${cStrong}`}
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="var(--danger-500)"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${cWeak} 251`}
            strokeDashoffset={`-${cStrong + cDev}`}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-text">{total.toLocaleString()}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">Completions</span>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-success-500" />
            <span className="text-muted">Strong</span>
          </span>
          <span className="font-semibold text-text">{strong}%</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-ai-500" />
            <span className="text-muted">Developing</span>
          </span>
          <span className="font-semibold text-text">{developing}%</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-danger-500" />
            <span className="text-muted">Weak</span>
          </span>
          <span className="font-semibold text-text">{weak}%</span>
        </div>
      </div>
    </div>
  );
}

/** User distribution donut chart (Candidates, Mentors, Admins, Inactive) */
export function UserDistributionDonut({
  total = 1248,
  candidates = 86,
  mentors = 10,
  admins = 2,
  inactive = 2,
}: {
  total?: number;
  candidates?: number;
  mentors?: number;
  admins?: number;
  inactive?: number;
}) {
  const cCand = candidates * 2.51;
  const cMent = mentors * 2.51;
  const cAdm = admins * 2.51;
  const cInact = inactive * 2.51;

  return (
    <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
      <div className="relative flex size-36 shrink-0 items-center justify-center">
        <svg className="size-36 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" stroke="var(--border)" strokeWidth="12" fill="none" />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="var(--info-500)"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${cCand} 251`}
            strokeDashoffset="0"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="var(--ai-500)"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${cMent} 251`}
            strokeDashoffset={`-${cCand}`}
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="var(--danger-500)"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${cAdm} 251`}
            strokeDashoffset={`-${cCand + cMent}`}
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="var(--border-strong)"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${cInact} 251`}
            strokeDashoffset={`-${cCand + cMent + cAdm}`}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-text">{total.toLocaleString()}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">Total Users</span>
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-info-500" />
            <span className="text-muted">Candidates</span>
          </span>
          <span className="font-semibold text-text">{candidates}%</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-ai-500" />
            <span className="text-muted">Mentors</span>
          </span>
          <span className="font-semibold text-text">{mentors}%</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-danger-500" />
            <span className="text-muted">Admins</span>
          </span>
          <span className="font-semibold text-text">{admins}%</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="text-muted">Inactive</span>
          </span>
          <span className="font-semibold text-text">{inactive}%</span>
        </div>
      </div>
    </div>
  );
}


