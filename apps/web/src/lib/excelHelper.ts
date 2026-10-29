import * as XLSX from "xlsx";
import type { Question } from "./types";

export interface ParsedQuestionRow {
  body: string;
  options: { key: string; text: string; is_correct: boolean }[];
  marks: number;
  difficulty: number;
  topic: string;
  explanation?: string;
}

export const SAMPLE_TEMPLATE_ROWS = [
  {
    "Question": "In Next.js App Router, which file convention defines the unique UI rendered for a route segment?",
    "Option A": "page.tsx",
    "Option B": "layout.tsx",
    "Option C": "template.tsx",
    "Option D": "route.ts",
    "Correct Answer": "A",
    "Marks": 2,
    "Difficulty": "Easy",
    "Topic": "Full Stack Development",
    "Explanation": "page.tsx is the standard Next.js App Router convention for rendering a route's unique view.",
  },
  {
    "Question": "Which React Hook executes synchronously after all DOM mutations but before browser paint to prevent visual jitter?",
    "Option A": "useEffect",
    "Option B": "useMemo",
    "Option C": "useLayoutEffect",
    "Option D": "useTransition",
    "Correct Answer": "C",
    "Marks": 2,
    "Difficulty": "Medium",
    "Topic": "Frontend",
    "Explanation": "useLayoutEffect runs synchronously immediately after DOM mutations, before paint.",
  },
  {
    "Question": "What database isolation level strictly guarantees prevention of dirty reads, non-repeatable reads, and phantom reads?",
    "Option A": "Read Committed",
    "Option B": "Repeatable Read",
    "Option C": "Read Uncommitted",
    "Option D": "Serializable",
    "Correct Answer": "D",
    "Marks": 3,
    "Difficulty": "Hard",
    "Topic": "Backend",
    "Explanation": "Serializable is the highest isolation level and prevents all concurrency read anomalies.",
  },
  {
    "Question": "In SQL window functions, which function ranks rows without skipping rank numbers when values tie?",
    "Option A": "DENSE_RANK()",
    "Option B": "RANK()",
    "Option C": "ROW_NUMBER()",
    "Option D": "NTILE()",
    "Correct Answer": "A",
    "Marks": 2,
    "Difficulty": "Medium",
    "Topic": "Data Analyst",
    "Explanation": "DENSE_RANK() leaves no gaps between ranked positions for tied rows.",
  },
  {
    "Question": "In RAG pipelines, what is the primary purpose of text chunking with overlap before embedding?",
    "Option A": "Prevents semantic context loss across sentence boundaries for better retrieval quality",
    "Option B": "Compresses vector embedding size",
    "Option C": "Encrypts sensitive customer records",
    "Option D": "Converts Markdown to PDF",
    "Correct Answer": "A",
    "Marks": 3,
    "Difficulty": "Hard",
    "Topic": "AI Engineer",
    "Explanation": "Chunk overlapping ensures split sentences retain their surrounding semantic context.",
  },
];

/**
 * Downloads a sample Excel file (.xlsx) with pre-formatted column headers and sample thermodynamics questions.
 */
export function downloadSampleQuestionsTemplate() {
  const worksheet = XLSX.utils.json_to_sheet(SAMPLE_TEMPLATE_ROWS);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");

  // Generate buffer and trigger browser download
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "eduproctor_questions_template.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses an uploaded Excel (.xlsx, .xls) or CSV file into Question objects.
 */
export function parseQuestionsFromFile(file: File): Promise<ParsedQuestionRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new Error("No sheet found in the uploaded workbook.");
        }

        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        if (!rows || rows.length === 0) {
          throw new Error("Uploaded spreadsheet contains no data rows.");
        }

        const parsed: ParsedQuestionRow[] = rows.map((r, idx) => {
          const body = String(
            r["Question"] || r["question"] || r["Body"] || r["body"] || `Question ${idx + 1}`
          ).trim();

          const optA = String(r["Option A"] || r["option_a"] || r["A"] || r["Option 1"] || "Option A").trim();
          const optB = String(r["Option B"] || r["option_b"] || r["B"] || r["Option 2"] || "Option B").trim();
          const optC = String(r["Option C"] || r["option_c"] || r["C"] || r["Option 3"] || "Option C").trim();
          const optD = String(r["Option D"] || r["option_d"] || r["D"] || r["Option 4"] || "Option D").trim();

          const rawCorrect = String(
            r["Correct Answer"] || r["correct_answer"] || r["Answer"] || r["answer"] || "A"
          ).trim().toUpperCase();

          const correctKey = ["A", "B", "C", "D"].includes(rawCorrect) ? rawCorrect : "A";

          const marks = Math.max(1, Number(r["Marks"] || r["marks"] || 2));
          const diffStr = String(r["Difficulty"] || r["difficulty"] || "Medium").toLowerCase();
          const difficulty = diffStr.includes("hard") ? 3 : diffStr.includes("easy") ? 1 : 2;

          const topic = String(r["Topic"] || r["topic"] || "Thermodynamics").trim();
          const explanation = r["Explanation"] || r["explanation"] ? String(r["Explanation"] || r["explanation"]).trim() : undefined;

          return {
            body,
            options: [
              { key: "A", text: optA, is_correct: correctKey === "A" },
              { key: "B", text: optB, is_correct: correctKey === "B" },
              { key: "C", text: optC, is_correct: correctKey === "C" },
              { key: "D", text: optD, is_correct: correctKey === "D" },
            ],
            marks,
            difficulty,
            topic,
            explanation,
          };
        });

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Converts ParsedQuestionRow into full Question domain object with unique IDs
 */
export function convertToQuestions(rows: ParsedQuestionRow[], courseId = "c1"): Question[] {
  const timestamp = Date.now();
  return rows.map((r, idx) => ({
    id: `q-custom-${timestamp}-${idx}`,
    course_id: courseId,
    topic_id: "t1",
    subtopic: r.topic,
    type: "mcq" as const,
    difficulty: r.difficulty,
    marks: r.marks,
    body: r.body,
    answer_text: null,
    status: "approved" as const,
    source: "mentor" as const,
    agent_run_id: null,
    options: r.options.map((opt, oIdx) => ({
      id: `opt-${timestamp}-${idx}-${oIdx}`,
      key: opt.key,
      text: opt.text,
      is_correct: opt.is_correct,
      misconception_id: null,
    })),
  }));
}

export interface ParsedCandidateRow {
  name: string;
  email: string;
  phone: string;
  rollNumber?: string;
  department?: string;
  batch?: string;
}

export const SAMPLE_CANDIDATE_ROWS = [
  {
    "Candidate Name": "Aarav Sharma",
    "Email": "aarav.sharma@example.com",
    "Mobile Number": "+91 98765 11223",
    "Roll Number": "EP-2026-CS-101",
    "Department": "Computer Science",
    "Batch": "Batch 2026 - Campus Hiring",
  },
  {
    "Candidate Name": "Pooja Hegde",
    "Email": "pooja.h@example.com",
    "Mobile Number": "+91 98765 22334",
    "Roll Number": "EP-2026-CS-102",
    "Department": "Information Technology",
    "Batch": "Batch 2026 - Campus Hiring",
  },
  {
    "Candidate Name": "Rahul Verma",
    "Email": "rahul.v@example.com",
    "Mobile Number": "+91 98765 33445",
    "Roll Number": "EP-2026-CS-103",
    "Department": "Computer Science",
    "Batch": "Batch 2026 - Lateral Devs",
  },
  {
    "Candidate Name": "Divya Krishnan",
    "Email": "divya.k@example.com",
    "Mobile Number": "+91 98765 44556",
    "Roll Number": "EP-2026-CS-104",
    "Department": "Data Science",
    "Batch": "Batch 2026 - Campus Hiring",
  },
];

/**
 * Downloads a sample Excel file (.xlsx) for bulk importing candidates into an assessment.
 */
export function downloadSampleCandidatesTemplate() {
  const worksheet = XLSX.utils.json_to_sheet(SAMPLE_CANDIDATE_ROWS);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Candidates");

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "eduproctor_candidates_import_template.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses an uploaded Excel (.xlsx, .xls) or CSV file containing candidates.
 */
export function parseCandidatesFromFile(file: File): Promise<ParsedCandidateRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

        if (!rawJson || rawJson.length === 0) {
          throw new Error("Uploaded file is empty or does not contain recognizable rows.");
        }

        const parsed: ParsedCandidateRow[] = rawJson.map((row) => {
          const name = String(row["Candidate Name"] || row["Name"] || row["Full Name"] || "").trim();
          const email = String(row["Email"] || row["Email Address"] || "").trim();
          const phone = String(row["Mobile Number"] || row["Phone"] || row["Mobile"] || row["Contact"] || "").trim();
          const rollNumber = String(row["Roll Number"] || row["Candidate ID"] || row["ID"] || "").trim();
          const department = String(row["Department"] || row["Dept"] || "Engineering").trim();
          const batch = String(row["Batch"] || row["Batch Name"] || "Batch 2026").trim();

          if (!name || !email) {
            throw new Error("Each candidate row must have at least a Name and a valid Email address.");
          }

          return {
            name,
            email,
            phone: phone || "+91 98765 00000",
            rollNumber: rollNumber || `EP-${Math.floor(1000 + Math.random() * 9000)}`,
            department,
            batch,
          };
        });

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.readAsArrayBuffer(file);
  });
}
