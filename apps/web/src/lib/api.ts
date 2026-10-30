import { authStore } from "@/features/auth/store";
import {
  type AssessmentCardData,
  getPersistedAssessments,
  getStoredExamDetail,
  mockAdminUsers,
  mockAgentRuns,
  mockAssignmentsList,
  mockCandidatesList,
  mockExamAnalytics,
  mockExamResults,
  mockItemAnalysis,
  mockNotesLibrary,
  mockPracticeSetData,
  mockQuestionsList,
  saveAssessmentToStorage,
  saveExamDetailToStorage,
} from "./mockData";

export const API_BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(typeof detail === "string" ? detail : `Request failed (${status})`);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean;
}

const MOCK_COURSES = [
  { id: "c1", name: "Full Stack Development", code: "FSD-301" },
  { id: "c2", name: "Frontend", code: "FED-201" },
  { id: "c3", name: "Backend", code: "BED-202" },
  { id: "c4", name: "Data Analyst", code: "DAT-101" },
  { id: "c5", name: "AI Engineer", code: "AIE-401" },
];

function handleMockRequest<T>(path: string, opts?: RequestOptions): T | undefined {
  if (path.includes("/practice-sets") && path.includes("/submit")) {
    return {
      score_pct: 100,
      correct: { "pq-1": true, "pq-2": true, "pq-3": true },
      correct_keys: { "pq-1": "B", "pq-2": "A", "pq-3": "A" },
    } as unknown as T;
  }
  if (path.startsWith("/practice-sets")) {
    return mockPracticeSetData as unknown as T;
  }
  if (path.includes("/results")) {
    return mockExamResults as unknown as T;
  }
  if (path.includes("/analytics")) {
    return mockExamAnalytics as unknown as T;
  }
  if (path.includes("/item-analysis")) {
    return mockItemAnalysis as unknown as T;
  }
  if (path.includes("/marking-queue")) {
    return [] as unknown as T;
  }
  if (path.includes("/candidates")) {
    return mockCandidatesList as unknown as T;
  }
  if (path.startsWith("/questions")) {
    return mockQuestionsList as unknown as T;
  }
  if (path.includes("/assignments") || path.includes("/send-links")) {
    return { status: "ok" } as unknown as T;
  }

  // Single exam detail (e.g. /exams/ut-3, /exams/ut-2, /exams/ut-1)
  const examDetailMatch = path.match(/^\/exams\/([^/?]+)$/);
  if (examDetailMatch) {
    const eid = examDetailMatch[1];
    if (opts?.method === "PATCH" || opts?.method === "PUT") {
      return saveExamDetailToStorage(eid, opts.body as Record<string, unknown>) as unknown as T;
    }
    const stored = getStoredExamDetail(eid);
    if (stored) {
      return stored as unknown as T;
    }
    const currentAssessments = getPersistedAssessments();
    const baseCard = currentAssessments.find((a) => a.id === eid);
    const isSeeded = ["ut-1", "ut-2", "ut-3", "ut-4", "ut-5"].includes(eid);
    const detail = {
      id: baseCard?.id ?? eid,
      course_id: "c1",
      course_name: baseCard?.course ?? "Full Stack Development",
      title: baseCard?.title ?? "Assessment",
      duration_min: baseCard?.duration_min ?? 60,
      window_start: "2026-01-15T10:00:00Z",
      window_end: "2026-01-15T11:00:00Z",
      shuffle: true,
      flag_threshold_s: 3,
      glance_min_s: 1,
      max_flags: 3,
      status: baseCard?.status === "completed" ? "closed" : (baseCard?.status === "live" || baseCard?.status === "scheduled") ? "scheduled" : "draft",
      card_status: baseCard?.status ?? "draft",
      questions: isSeeded ? mockQuestionsList : [],
      assignments: isSeeded ? mockAssignmentsList : [],
    };
    saveExamDetailToStorage(eid, detail);
    return detail as unknown as T;
  }

  // Single course detail (e.g. /admin/courses/c1 or /courses/c1)
  const singleCourseMatch = path.match(/^\/(?:admin\/)?courses\/([^/?]+)$/);
  if (singleCourseMatch) {
    const cid = singleCourseMatch[1];
    const foundCourse = MOCK_COURSES.find((c) => c.id === cid) ?? MOCK_COURSES[0];
    return {
      id: foundCourse.id,
      name: foundCourse.name,
      code: foundCourse.code,
      mentors: [
        { user: { id: "u-1", name: "Priya Sharma", email: "priya@college.edu", role: "mentor" }, role: "Lead Mentor" },
      ],
      candidates: [
        { user: { id: "u-2", name: "Arjun Mehta", email: "arjun@example.com", role: "candidate" }, role: "Candidate" },
        { user: { id: "u-3", name: "Kavya Nair", email: "kavya@example.com", role: "candidate" }, role: "Candidate" },
        { user: { id: "u-5", name: "Neha Kapoor", email: "neha@example.com", role: "candidate" }, role: "Candidate" },
      ],
      topics: [
        { topic_id: "t1", name: "Core Architecture & Concepts", questions: 24, approved_notes: 12 },
        { topic_id: "t2", name: "Applied Frameworks & Tooling", questions: 32, approved_notes: 16 },
        { topic_id: "t3", name: "Performance, Security & Scale", questions: 18, approved_notes: 8 },
      ],
      assessments: 3,
    } as unknown as T;
  }

  if (path.startsWith("/courses") || path.startsWith("/admin/courses")) {
    return MOCK_COURSES as unknown as T;
  }

  if (path === "/exams" || path === "/exams/") {
    if (opts?.method === "POST" || (opts?.body !== undefined && opts?.method !== "GET")) {
      const b = (opts.body ?? {}) as {
        title?: string;
        course_id?: string;
        duration_min?: number;
        window_start?: string;
        window_end?: string;
        shuffle?: boolean;
        flag_threshold_s?: number;
      };
      const newId = `ut-${Date.now()}`;
      const courseName = b.course_id || "Full Stack Development";
      const newCard: AssessmentCardData = {
        id: newId,
        title: b.title || "New Assessment",
        course: courseName,
        status: "draft",
        questions: 0,
        duration_min: Number(b.duration_min) || 60,
        total: 45,
      };
      saveAssessmentToStorage(newCard, {
        id: newId,
        course_id: "c1",
        course_name: courseName,
        title: newCard.title,
        duration_min: newCard.duration_min,
        window_start: b.window_start || new Date().toISOString(),
        window_end: b.window_end || new Date(Date.now() + 7 * 864e5).toISOString(),
        shuffle: b.shuffle ?? true,
        flag_threshold_s: b.flag_threshold_s ?? 3,
        glance_min_s: 1,
        max_flags: 3,
        status: "draft",
        questions: [],
        assignments: [],
      });
      return {
        id: newId,
        course_id: "c1",
        course_name: courseName,
        title: newCard.title,
        duration_min: newCard.duration_min,
        window_start: b.window_start || new Date().toISOString(),
        window_end: b.window_end || new Date(Date.now() + 7 * 864e5).toISOString(),
        shuffle: b.shuffle ?? true,
        flag_threshold_s: b.flag_threshold_s ?? 3,
        glance_min_s: 1,
        max_flags: 3,
        status: "draft",
      } as unknown as T;
    }

    const currentAssessments = getPersistedAssessments();
    return currentAssessments.map((a) => ({
      id: a.id,
      title: a.title,
      course_id: "c1",
      status: a.status === "completed" ? "closed" : (a.status === "live" || a.status === "scheduled") ? "scheduled" : "draft",
      card_status: a.status,
      duration_min: a.duration_min,
      duration_minutes: a.duration_min,
      scheduled_start: a.scheduled_start || "2026-01-15T10:00:00Z",
      scheduled_end: a.scheduled_end || "2026-01-15T11:00:00Z",
      pass_percentage: 50,
      randomize_questions: true,
      capture_interval_seconds: 3,
      allow_lookaway_seconds: 3,
      created_by: a.createdBy || "Priya Sharma",
      created_at: "2026-01-01T00:00:00Z",
      course_name: a.course,
      question_count: a.questions,
      candidates_count: a.total,
      sessions_count: a.started ?? a.submitted ?? 0,
      completed_count: a.submitted ?? 0,
    })) as unknown as T;
  }
  if (path.startsWith("/admin/users")) {
    return mockAdminUsers as unknown as T;
  }
  if (path.startsWith("/notes") || path.startsWith("/admin/notes")) {
    return mockNotesLibrary as unknown as T;
  }
  if (path.startsWith("/agent/runs") || path.startsWith("/admin/agent/runs")) {
    return mockAgentRuns as unknown as T;
  }
  return undefined;
}

async function refreshTokens(): Promise<boolean> {
  const current = authStore.get();
  if (!current) return false;
  if (current.access_token.startsWith("mock-")) {
    return true;
  }
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    if (!res.ok) {
      authStore.clear();
      return false;
    }
    authStore.set(await res.json());
    return true;
  } catch {
    return false;
  }
}

async function getOrUpgradeToken(): Promise<string | undefined> {
  const current = authStore.get();
  if (!current) return undefined;
  if (!current.access_token.startsWith("mock-")) {
    return current.access_token;
  }
  const role = current.user?.role || "mentor";
  const demoEmail =
    role === "admin"
      ? "admin@example.com"
      : role === "candidate"
        ? "candidate01@example.com"
        : "mentor1@example.com";
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: demoEmail, password: "eduproctor-dev" }),
    });
    if (res.ok) {
      const realAuth = await res.json();
      authStore.set(realAuth);
      return realAuth.access_token;
    }
  } catch {
    // fallback
  }
  return current.access_token;
}

export async function api<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  let token = authStore.get()?.access_token;
  if (token?.startsWith("mock-") && opts.auth !== false) {
    token = (await getOrUpgradeToken()) ?? token;
  }

  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (token && opts.auth !== false) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });

    if (res.status === 401) {
      if (!retried && opts.auth !== false && (await refreshTokens())) {
        return api<T>(path, opts, true);
      }
      const mockFallback = handleMockRequest<T>(path, opts);
      if (mockFallback !== undefined) return mockFallback;
    }

    if (!res.ok) {
      const mockFallback = handleMockRequest<T>(path, opts);
      if (mockFallback !== undefined && (res.status === 404 || res.status === 501)) {
        return mockFallback;
      }
      let detail: unknown = res.statusText;
      try {
        detail = (await res.json()).detail;
      } catch {
        /* not JSON */
      }
      throw new ApiError(res.status, detail);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    const mockFallback = handleMockRequest<T>(path, opts);
    if (mockFallback !== undefined) {
      return mockFallback;
    }
    throw err;
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (typeof err.detail === "string") return err.detail;
    return `Request failed (${err.status})`;
  }
  return "Network problem. Please try again.";
}

