import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  Code2,
  Database,
  Layout,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Course } from "@/lib/types";

export interface CourseTrack {
  id: string;
  name: string;
  code: string;
  desc: string;
  track: string;
  iconName: "fullstack" | "frontend" | "backend" | "data" | "ai";
}

export const RECOMMENDED_COURSES: CourseTrack[] = [
  {
    id: "c-fsd",
    name: "Full Stack Development",
    code: "FSD-301",
    desc: "React, Next.js, Node.js, TypeScript & Cloud Architecture",
    track: "Full Stack",
    iconName: "fullstack",
  },
  {
    id: "c-fed",
    name: "Frontend",
    code: "FED-201",
    desc: "Modern React, TypeScript, Tailwind, State Management & Web Vitals",
    track: "Frontend",
    iconName: "frontend",
  },
  {
    id: "c-bed",
    name: "Backend",
    code: "BED-202",
    desc: "Node.js, Go, Microservices, PostgreSQL, Redis & API Security",
    track: "Backend",
    iconName: "backend",
  },
  {
    id: "c-dat",
    name: "Data Analyst",
    code: "DAT-101",
    desc: "Advanced SQL, Python, Pandas, Power BI & Statistical Modeling",
    track: "Data Analytics",
    iconName: "data",
  },
  {
    id: "c-aie",
    name: "AI Engineer",
    code: "AIE-401",
    desc: "LLMs, LangChain, PyTorch, RAG Pipelines & Agentic Orchestration",
    track: "AI & ML",
    iconName: "ai",
  },
];

function TrackIcon({ type }: { type: CourseTrack["iconName"] }) {
  switch (type) {
    case "fullstack":
      return <Code2 className="size-4 text-primary-600" />;
    case "frontend":
      return <Layout className="size-4 text-info-700" />;
    case "backend":
      return <Database className="size-4 text-success-700" />;
    case "data":
      return <BarChart3 className="size-4 text-warning-700" />;
    case "ai":
      return <Bot className="size-4 text-ai-700" />;
    default:
      return <BookOpen className="size-4 text-primary-600" />;
  }
}

export function useCourses() {
  return useQuery({
    queryKey: ["courses"],
    queryFn: () => api<Course[]>("/courses"),
  });
}

interface CoursePickerProps {
  value: string;
  onChange: (courseName: string) => void;
  label?: string;
}

/**
 * Course Combobox: Input box with dropdown recommendations and suggested chips.
 * Allows typing custom course names or selecting from recommended tech tracks.
 */
export function CoursePicker({ value, onChange, label = "Course Name" }: CoursePickerProps) {
  const coursesQuery = useCourses();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const coursesList: CourseTrack[] = coursesQuery.data?.length
    ? coursesQuery.data.map((c) => {
        const found = RECOMMENDED_COURSES.find(
          (rc) => rc.name.toLowerCase() === c.name.toLowerCase() || rc.id === c.id
        );
        return (
          found ?? {
            id: c.id,
            name: c.name,
            code: c.code,
            desc: "Accredited Technology Specialization",
            track: "Tech Track",
            iconName: "fullstack",
          }
        );
      })
    : RECOMMENDED_COURSES;

  // Filter recommendations based on current input text
  const filteredCourses = coursesList.filter((c) => {
    if (!value) return true;
    const q = value.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      c.track.toLowerCase().includes(q)
    );
  });

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (courseName: string) => {
    onChange(courseName);
    setIsOpen(false);
  };

  return (
    <div className="relative space-y-1.5" ref={containerRef}>
      <Label htmlFor="course-input">{label}</Label>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
          <BookOpen className="size-4" />
        </div>

        <input
          id="course-input"
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="e.g. Full Stack Development or type custom course..."
          className="h-10 w-full rounded-xl border border-border bg-surface pl-9.5 pr-9 text-xs text-text placeholder:text-muted shadow-2xs transition-all focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
          autoComplete="off"
        />

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-text transition-colors"
          aria-label="Toggle recommendation dropdown"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {/* Suggested Quick-Pick Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[11px] text-muted">Suggestions:</span>
        {RECOMMENDED_COURSES.map((rc) => (
          <button
            key={rc.id}
            type="button"
            onClick={() => handleSelect(rc.name)}
            className="rounded-md border border-border bg-surface-muted/60 px-2 py-0.5 text-[10px] font-medium text-text transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
          >
            {rc.name}
          </button>
        ))}
      </div>

      {/* Dropdown Recommendations */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl animate-in fade-in zoom-in-95">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-border flex items-center gap-1.5 bg-surface-muted/30 rounded-t-lg">
            <Sparkles className="size-3 text-primary-600" />
            <span>Recommended Technology Tracks</span>
          </div>

          <div className="divide-y divide-border/60">
            {filteredCourses.length > 0 ? (
              filteredCourses.map((c) => {
                const isSelected = value.toLowerCase() === c.name.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c.name)}
                    className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-muted/80 ${
                      isSelected ? "bg-primary-50/80 text-primary-900" : "text-text"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted border border-border shadow-2xs">
                        <TrackIcon type={c.iconName} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-text truncate">{c.name}</span>
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-mono text-muted shrink-0">
                            {c.code}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted truncate mt-0.5">{c.desc}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 pl-2">
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted">
                        {c.track}
                      </span>
                      {isSelected ? (
                        <Check className="size-4 text-primary-600 shrink-0" />
                      ) : (
                        <div className="size-4" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-muted">
                No predefined track matching &ldquo;{value}&rdquo;.
              </div>
            )}
          </div>

          {/* Option to use custom typed course */}
          {value.trim() && !coursesList.some((c) => c.name.toLowerCase() === value.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => handleSelect(value.trim())}
              className="flex w-full items-center gap-2 border-t border-border px-3.5 py-2.5 text-left text-xs font-semibold text-primary-700 hover:bg-primary-50 transition-colors"
            >
              <Sparkles className="size-3.5" />
              <span>Use custom course: &ldquo;{value.trim()}&rdquo;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
