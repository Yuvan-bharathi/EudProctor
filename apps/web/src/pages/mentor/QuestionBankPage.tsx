import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Sparkles, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { AiDraftCard } from "@/components/AiDraftCard";
import { EmptyState, ErrorState, QueryState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CoursePicker } from "@/features/mentor/CoursePicker";
import { api, errorMessage } from "@/lib/api";
import { difficultyLabel, type Misconception, type Question, type Topic } from "@/lib/types";

const KEYS = ["A", "B", "C", "D"];

function QuestionForm({ topics, onCreated }: { topics: Topic[]; onCreated: () => void }) {
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [difficulty, setDifficulty] = useState(2);
  const [marks, setMarks] = useState(1);
  const [correct, setCorrect] = useState("A");
  const [texts, setTexts] = useState<string[]>(["", "", "", ""]);
  const [miscs, setMiscs] = useState<string[]>(["", "", "", ""]);
  const misc = useQuery({
    queryKey: ["misconceptions", topicId],
    queryFn: () => api<Misconception[]>(`/topics/${topicId}/misconceptions`),
    enabled: Boolean(topicId),
  });
  const create = useMutation({
    mutationFn: () =>
      api<Question>("/questions", {
        body: {
          topic_id: topicId,
          body,
          difficulty,
          marks,
          options: KEYS.map((k, i) => ({
            key: k,
            text: texts[i],
            is_correct: k === correct,
            misconception_id: k !== correct && miscs[i] ? miscs[i] : null,
          })).filter((o) => o.text.trim()),
        },
      }),
    onSuccess: () => {
      setBody("");
      setTexts(["", "", "", ""]);
      setMiscs(["", "", "", ""]);
      onCreated();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="q-topic">Topic</Label>
          <Select id="q-topic" className="w-full" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="q-difficulty">Difficulty</Label>
          <Select id="q-difficulty" className="w-full" value={difficulty} onChange={(e) => setDifficulty(+e.target.value)}>
            {[1, 2, 3].map((d) => (
              <option key={d} value={d}>
                {difficultyLabel[d]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="q-marks">Marks</Label>
          <Input id="q-marks" type="number" min={0.5} step={0.5} value={marks} onChange={(e) => setMarks(+e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="q-body">Question</Label>
        <Textarea id="q-body" value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium text-muted">Options (select the correct one)</legend>
        {KEYS.map((k, i) => (
          <div key={k} className="flex flex-wrap items-center gap-2">
            <input
              type="radio"
              name="correct"
              aria-label={`Option ${k} is correct`}
              checked={correct === k}
              onChange={() => setCorrect(k)}
              className="size-4 accent-primary-600"
            />
            <span className="w-4 text-sm font-medium">{k}</span>
            <Input
              aria-label={`Option ${k} text`}
              className="min-w-48 flex-1"
              value={texts[i]}
              onChange={(e) => setTexts(texts.map((t, j) => (j === i ? e.target.value : t)))}
            />
            <Select
              aria-label={`Option ${k} misconception`}
              className="w-56"
              disabled={k === correct}
              value={miscs[i]}
              onChange={(e) => setMiscs(miscs.map((m, j) => (j === i ? e.target.value : m)))}
            >
              <option value="">No misconception tag</option>
              {(misc.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.description}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </fieldset>
      {create.isError && <ErrorState message={errorMessage(create.error)} />}
      <Button type="submit" disabled={!topicId || !body.trim() || create.isPending}>
        Save question
      </Button>
    </form>
  );
}

function TopicPanel({ courseId, topics }: { courseId: string; topics: Topic[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [miscTopic, setMiscTopic] = useState("");
  const [miscText, setMiscText] = useState("");
  const addTopic = useMutation({
    mutationFn: () => api<Topic>("/topics", { body: { course_id: courseId, name } }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["topics", courseId] });
    },
  });
  const addMisc = useMutation({
    mutationFn: () => api(`/topics/${miscTopic}/misconceptions`, { body: { description: miscText } }),
    onSuccess: () => {
      setMiscText("");
      qc.invalidateQueries({ queryKey: ["misconceptions", miscTopic] });
    },
  });
  return (
    <Card className="space-y-4">
      <CardTitle>Topics</CardTitle>
      <ul className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <li key={t.id}>
            <Badge tone="primary">{t.name}</Badge>
          </li>
        ))}
      </ul>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addTopic.mutate();
        }}
      >
        <div className="flex-1">
          <Label htmlFor="topic-name">New topic</Label>
          <Input id="topic-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary" disabled={!name.trim()}>
          <Plus aria-hidden="true" /> Add
        </Button>
      </form>
      {addTopic.isError && <ErrorState message={errorMessage(addTopic.error)} />}
      {addMisc.isError && <ErrorState message={errorMessage(addMisc.error)} />}
      {topics.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addMisc.mutate();
          }}
        >
          <div>
            <Label htmlFor="misc-topic">Misconception for</Label>
            <Select id="misc-topic" value={miscTopic} onChange={(e) => setMiscTopic(e.target.value)}>
              <option value="">Choose topic</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-48 flex-1">
            <Label htmlFor="misc-text">Description</Label>
            <Input id="misc-text" value={miscText} onChange={(e) => setMiscText(e.target.value)} />
          </div>
          <Button type="submit" variant="secondary" disabled={!miscTopic || miscText.trim().length < 3}>
            Add
          </Button>
        </form>
      )}
    </Card>
  );
}

function SuggestPanel({ courseId, topics }: { courseId: string; topics: Topic[] }) {
  const qc = useQueryClient();
  const [topicId, setTopicId] = useState("");
  const [n, setN] = useState(3);
  const drafts = useQuery({
    queryKey: ["questions", courseId, "draft"],
    queryFn: () => api<Question[]>(`/questions?course_id=${courseId}&status=draft`),
  });
  const suggest = useMutation({
    mutationFn: () =>
      api<{ status: string; error: string | null }>("/questions/suggest", {
        body: { course_id: courseId, topic_id: topicId || null, n },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["questions", courseId] }),
  });
  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "skip" }) =>
      api(`/questions/${id}/${action}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["questions", courseId] }),
  });

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardTitle>AI question ideas</CardTitle>
          <CardDescription>Suggestions stay drafts until you accept them. Drafts cannot be used in assessments.</CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="sg-topic">Topic</Label>
            <Select id="sg-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-20">
            <Label htmlFor="sg-n">How many</Label>
            <Input id="sg-n" type="number" min={1} max={10} value={n} onChange={(e) => setN(+e.target.value)} />
          </div>
          <Button variant="secondary" onClick={() => suggest.mutate()} disabled={suggest.isPending || topics.length === 0}>
            <Sparkles aria-hidden="true" /> {suggest.isPending ? "Drafting…" : "Suggest questions"}
          </Button>
        </div>
      </div>
      {suggest.isError && <ErrorState message={errorMessage(suggest.error)} />}
      {decide.isError && <ErrorState message={errorMessage(decide.error)} />}
      {suggest.data?.status === "failed" && (
        <ErrorState message={`The agent could not finish: ${suggest.data.error ?? "unknown error"}`} />
      )}
      <QueryState query={drafts} isEmpty={(d) => d.length === 0} emptyMessage="No AI drafts waiting for review.">
        {(list) => (
          <div className="space-y-3">
            {list.map((q) => (
              <AiDraftCard key={q.id}>
                <p className="text-sm font-medium text-text">{q.body}</p>
                <ul className="mt-2 space-y-1 text-sm text-text">
                  {q.options.map((o) => (
                    <li key={o.id}>
                      <span className="font-medium">{o.key}.</span> {o.text}
                      {o.is_correct && (
                        <Badge tone="success" className="ml-2">
                          Correct
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ai-700">
                  {topics.find((t) => t.id === q.topic_id)?.name} · {difficultyLabel[q.difficulty]} · {q.marks} mark(s)
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: q.id, action: "skip" })} disabled={decide.isPending}>
                    <X aria-hidden="true" /> Skip
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => decide.mutate({ id: q.id, action: "accept" })}
                    disabled={decide.isPending}
                  >
                    <Check aria-hidden="true" /> Accept
                  </Button>
                </div>
              </AiDraftCard>
            ))}
          </div>
        )}
      </QueryState>
    </Card>
  );
}

export function QuestionBankPage() {
  usePageTitle("Question bank");
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState("");
  const topics = useQuery({
    queryKey: ["topics", courseId],
    queryFn: () => api<Topic[]>(`/topics?course_id=${courseId}`),
    enabled: Boolean(courseId),
  });
  const questions = useQuery({
    queryKey: ["questions", courseId, "approved"],
    queryFn: () => api<Question[]>(`/questions?course_id=${courseId}&status=approved`),
    enabled: Boolean(courseId),
  });
  const topicName = (id: string) => topics.data?.find((t) => t.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <CoursePicker value={courseId} onChange={setCourseId} />
      {courseId && !topics.data && (
        <QueryState query={topics} emptyMessage="">
          {() => null}
        </QueryState>
      )}
      {courseId && topics.data && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <TopicPanel courseId={courseId} topics={topics.data} />
            <Card>
              <CardTitle className="mb-4">New question</CardTitle>
              {topics.data.length ? (
                <QuestionForm
                  key={courseId}
                  topics={topics.data}
                  onCreated={() => qc.invalidateQueries({ queryKey: ["questions", courseId] })}
                />
              ) : (
                <EmptyState message="Add a topic first." />
              )}
            </Card>
          </div>
          <SuggestPanel courseId={courseId} topics={topics.data} />
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Approved questions</h2>
            <QueryState query={questions} isEmpty={(d) => d.length === 0} emptyMessage="No approved questions yet.">
              {(list) => (
                <Table>
                  <THead>
                    <tr>
                      <TH>Question</TH>
                      <TH>Topic</TH>
                      <TH>Difficulty</TH>
                      <TH>Marks</TH>
                      <TH>Source</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {list.map((q) => (
                      <TR key={q.id}>
                        <TD className="max-w-md truncate">{q.body}</TD>
                        <TD>{topicName(q.topic_id)}</TD>
                        <TD>{difficultyLabel[q.difficulty]}</TD>
                        <TD>{q.marks}</TD>
                        <TD>{q.source === "agent" ? <Badge tone="ai">AI, accepted</Badge> : <Badge>Mentor</Badge>}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </QueryState>
          </section>
        </>
      )}
    </div>
  );
}
