import {
  BookMarked,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { mockNotesLibrary, type NoteLibraryRow } from "@/lib/mockData";

type NoteFilter = "all" | "by_topic" | "pending" | "withdrawn";

export function AdminNotesPage() {
  usePageTitle("Notes Library · Admin");

  const [activeTab, setActiveTab] = useState<NoteFilter>("all");
  const [search, setSearch] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [notesList, setNotesList] = useState<NoteLibraryRow[]>(mockNotesLibrary);

  // New Note state
  const [newTitle, setNewTitle] = useState("");
  const [newTopic, setNewTopic] = useState("Full Stack Development");
  const [newLevel, setNewLevel] = useState<"Intro" | "Core" | "Advanced">("Core");

  const filteredNotes = notesList.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(search.toLowerCase()) || n.topic.toLowerCase().includes(search.toLowerCase());
    const matchesTab =
      activeTab === "all"
        ? true
        : activeTab === "pending"
          ? n.status === "Pending review"
          : activeTab === "withdrawn"
            ? n.status === "Withdrawn"
            : true;
    return matchesSearch && matchesTab;
  });

  const handleToggleStatus = (id: string) => {
    setNotesList((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const nextStatus = n.status === "Approved" ? "Pending review" : "Approved";
          return { ...n, status: nextStatus };
        }
        return n;
      }),
    );
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const note: NoteLibraryRow = {
      id: `n-${Date.now()}`,
      title: newTitle,
      topic: newTopic,
      level: newLevel,
      status: "Pending review",
    };
    setNotesList([note, ...notesList]);
    setAddModal(false);
    setNewTitle("");
  };

  return (
    <div className="space-y-6">
      {/* Top Header matching Screen 11 */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text">Notes Library</h2>
          <p className="text-xs text-muted">
            Manage approved learning notes for the AI evaluation agent and candidates.
          </p>
        </div>

        <Button
          onClick={() => setAddModal(true)}
          className="flex items-center gap-2 bg-primary-600 text-white hover:bg-primary-700 shadow-xs"
        >
          <Plus className="size-4" />
          <span>Add note</span>
        </Button>
      </div>

      {/* Filter Tabs matching Screen 11:
          All notes, By topic, Pending approval (1), Withdrawn */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { key: "all", label: "All notes", count: notesList.length },
          { key: "by_topic", label: "By topic", count: "3 Topics" },
          { key: "pending", label: "Pending approval", count: notesList.filter((n) => n.status === "Pending review").length },
          { key: "withdrawn", label: "Withdrawn", count: notesList.filter((n) => n.status === "Withdrawn").length },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as NoteFilter)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary-50 text-primary-700 shadow-2xs"
                : "text-muted hover:bg-surface-muted hover:text-text"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Search & Action Filter Bar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 size-4 text-muted" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-xs text-text placeholder:text-muted focus:border-primary-500 focus:bg-surface focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="flex items-center gap-1.5 text-xs text-muted hover:text-text">
            <Filter className="size-3.5" />
            <span>Filters</span>
          </Button>
        </div>
      </div>

      {/* Notes Table matching Screen 11 */}
      <div className="rounded-xl border border-border bg-surface shadow-2xs overflow-hidden">
        <Table>
          <THead>
            <tr>
              <TH>Title</TH>
              <TH>Topic</TH>
              <TH>Level</TH>
              <TH>Status</TH>
              <TH className="text-right">Action</TH>
            </tr>
          </THead>
          <TBody>
            {filteredNotes.map((note) => (
              <TR key={note.id} className="transition-colors hover:bg-surface-muted/50">
                <TD>
                  <div className="flex items-center gap-2.5">
                    <BookMarked className="size-4 text-primary-600 shrink-0" />
                    <span className="font-semibold text-xs text-text">{note.title}</span>
                  </div>
                </TD>

                <TD className="text-xs text-muted">{note.topic}</TD>

                <TD>
                  <span className="rounded bg-surface-muted px-2 py-0.5 text-[11px] text-muted">
                    {note.level}
                  </span>
                </TD>

                <TD>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      note.status === "Approved"
                        ? "bg-success-50 text-success-700"
                        : note.status === "Pending review"
                          ? "bg-warning-50 text-warning-800"
                          : "bg-surface-muted text-muted"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        note.status === "Approved"
                          ? "bg-success-500"
                          : note.status === "Pending review"
                            ? "bg-warning-500"
                            : "bg-border-strong"
                      }`}
                    />
                    {note.status}
                  </span>
                </TD>

                <TD className="text-right">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(note.id)}
                    className="text-xs font-semibold text-primary-700 hover:underline"
                  >
                    {note.status === "Approved" ? "Withdraw" : "Approve"}
                  </button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>

        {/* Guardrail Note */}
        <div className="border-t border-border bg-surface-muted/60 p-3 text-xs text-muted flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary-600" />
            <span>
              Strict AI Guardrail: The Claude Assessment Evaluation Agent can ONLY select and recommend notes from this
              pre-approved library.
            </span>
          </span>
          <span className="text-[11px] font-semibold text-primary-700">Enforced by Vector Registry</span>
        </div>
      </div>

      {/* "+ Add Note" Modal Dialog */}
      {addModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold text-text">Add Learning Note</h3>
              <button
                type="button"
                onClick={() => setAddModal(false)}
                className="rounded p-1 text-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleAddNote} className="space-y-4">
              <div>
                <Label htmlFor="note-title">Note Title</Label>
                <Input
                  id="note-title"
                  placeholder="e.g. Energy balance basics"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="note-topic">Topic</Label>
                <select
                  id="note-topic"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text shadow-2xs focus:border-primary-500 focus:outline-hidden"
                >
                  <option value="Full Stack Development">Full Stack Development</option>
                  <option value="Frontend">Frontend</option>
                  <option value="Backend">Backend</option>
                  <option value="Data Analyst">Data Analyst</option>
                  <option value="AI Engineer">AI Engineer</option>
                </select>
              </div>

              <div>
                <Label htmlFor="note-level">Curriculum Level</Label>
                <select
                  id="note-level"
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value as typeof newLevel)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text shadow-2xs focus:border-primary-500 focus:outline-hidden"
                >
                  <option value="Intro">Introductory</option>
                  <option value="Core">Core Syllabus</option>
                  <option value="Advanced">Advanced Concepts</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button type="button" variant="secondary" onClick={() => setAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary-600 text-white hover:bg-primary-700">
                  Save to library
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
