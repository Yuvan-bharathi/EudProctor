import { Eye, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { AiDraftCard } from "@/components/AiDraftCard";
import { FlagCounter } from "@/components/FlagCounter";
import { GlanceChip, RedFlagChip, SeverityBadge } from "@/components/ProctorChips";
import { StatCard } from "@/components/StatCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { TopicChip } from "@/components/TopicChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const swatches: { name: string; cls: string; use: string }[] = [
  { name: "bg", cls: "bg-bg", use: "Page" },
  { name: "surface", cls: "bg-surface", use: "Cards" },
  { name: "surface-muted", cls: "bg-surface-muted", use: "Headers, inputs" },
  { name: "border", cls: "bg-border", use: "Lines" },
  { name: "text", cls: "bg-text", use: "Body text" },
  { name: "text-muted", cls: "bg-muted", use: "Labels" },
  { name: "primary-50", cls: "bg-primary-50", use: "Tint" },
  { name: "primary-600", cls: "bg-primary-600", use: "Actions" },
  { name: "ai-50", cls: "bg-ai-50", use: "AI tint" },
  { name: "ai-500", cls: "bg-ai-500", use: "AI accent" },
  { name: "success-50", cls: "bg-success-50", use: "Strong" },
  { name: "warning-50", cls: "bg-warning-50", use: "Developing" },
  { name: "danger-50", cls: "bg-danger-50", use: "Flag / weak" },
  { name: "danger-500", cls: "bg-danger-500", use: "Flag dot" },
  { name: "info-50", cls: "bg-info-50", use: "Glance" },
  { name: "info-500", cls: "bg-info-500", use: "Info" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

export function StyleguidePage() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-text">
        Soft Mist light theme. All text pairs meet WCAG AA (≥ 4.5:1). Components use tokens only.
      </p>

      <Section title="Palette">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {swatches.map((s) => (
            <div key={s.name} className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className={`h-12 ${s.cls}`} />
              <div className="p-2 text-xs">
                <div className="font-semibold text-text">{s.name}</div>
                <div className="text-muted">{s.use}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button>
            <Plus aria-hidden="true" /> Primary
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Confirm delete</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badges and chips">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Neutral</Badge>
          <Badge tone="primary">Primary</Badge>
          <Badge tone="ai">AI</Badge>
          <Badge tone="success">Approved</Badge>
          <Badge tone="warning">Pending review</Badge>
          <Badge tone="danger">Weak</Badge>
          <Badge tone="info">Info</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FlagCounter count={0} max={3} />
          <FlagCounter count={1} max={3} />
          <FlagCounter count={3} max={3} />
          <GlanceChip source="eyes" durationMs={1400} />
          <GlanceChip source="head" />
          <RedFlagChip flagNo={2} max={3} source="eyes" />
          <RedFlagChip flagNo={null} max={3} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TopicChip name="Heat transfer" cls="strong" scorePct={88} />
          <TopicChip name="Entropy" cls="developing" scorePct={70} />
          <TopicChip name="First law" cls="weak" scorePct={45} />
          <TopicChip name="Cycles" cls="insufficient" scorePct={null} />
          <SeverityBadge severity="high" />
          <SeverityBadge severity="medium" />
          <SeverityBadge severity="low" />
        </div>
      </Section>

      <Section title="Flag notice (candidate)">
        <div className="inline-flex items-center gap-2 rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <Eye className="size-4" aria-hidden="true" />
          Flag 1 of 3 – please keep your eyes on the screen.
        </div>
      </Section>

      <Section title="Stat cards">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Red flags" value="2 / 3" tone="danger" />
          <StatCard label="Head glances" value={6} />
          <StatCard label="Eye glances" value={9} />
          <StatCard label="Other alerts" value={0} />
        </div>
      </Section>

      <Section title="Card and form">
        <Card className="max-w-md">
          <CardHeader>
            <div>
              <CardTitle>Thermodynamics · Unit test 2</CardTitle>
              <CardDescription>Question 7 of 20 · 24:18 left</CardDescription>
            </div>
            <FlagCounter count={1} max={3} />
          </CardHeader>
          <Label htmlFor="sg-input">Assessment title</Label>
          <Input id="sg-input" placeholder="e.g. Unit test 3" />
        </Card>
      </Section>

      <Section title="Table">
        <Table>
          <THead>
            <tr>
              <TH>Time</TH>
              <TH>Event</TH>
              <TH>Direction</TH>
              <TH>Duration</TH>
              <TH>Candidate notified</TH>
            </tr>
          </THead>
          <TBody>
            <TR>
              <TD className="font-mono text-[13px]">00:04:12</TD>
              <TD>
                <GlanceChip source="eyes" />
              </TD>
              <TD>Left</TD>
              <TD>1.4 s</TD>
              <TD>No</TD>
            </TR>
            <TR>
              <TD className="font-mono text-[13px]">00:09:37</TD>
              <TD>
                <RedFlagChip flagNo={1} max={3} source="head" />
              </TD>
              <TD>Right</TD>
              <TD>3.8 s</TD>
              <TD>Yes</TD>
            </TR>
          </TBody>
        </Table>
      </Section>

      <Section title="AI draft card">
        <AiDraftCard>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Strong:</span> <TopicChip name="Heat transfer" cls="strong" scorePct={88} />
            <span className="font-semibold">Weak:</span> <TopicChip name="First law" cls="weak" scorePct={45} />
          </div>
          <p className="mt-2 text-sm text-text">Recommended: 1. First law — mixes up heat and work sign convention.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary">Request changes</Button>
            <Button>Approve</Button>
          </div>
        </AiDraftCard>
        <AiDraftCard approvedBy="Mentor A">
          <p className="text-sm text-text">An approved summary looks like a normal card.</p>
        </AiDraftCard>
      </Section>

      <Section title="States">
        <div className="grid gap-4 lg:grid-cols-3">
          <LoadingState />
          <EmptyState message="No assessments yet." action={<Button size="sm">Create assessment</Button>} />
          <ErrorState message="Could not load results." onRetry={() => undefined} />
        </div>
      </Section>
    </div>
  );
}
