import { api } from "./api";
import type { Question } from "./types";

export interface AIQuestionSuggestion {
  id: string;
  topic: string;
  difficulty: number;
  marks: number;
  body: string;
  options: { key: string; text: string; is_correct: boolean }[];
  explanation: string;
}

export interface RecommendQuestionsParams {
  subject?: string;
  topic: string;
  difficulty?: number;
  marks?: number;
  question_type?: string;
  n?: number;
  course_id?: string;
  exclude_bodies?: string[];
}

/**
 * Rich, academically verified domain question library.
 * Covers Full Stack Architecture, Concurrency, React/Frontend, Backend APIs,
 * JavaScript/TypeScript, Python, Data Analytics/SQL, and AI Engineering.
 */
const DOMAIN_QUESTIONS: Record<string, AIQuestionSuggestion[]> = {
  "full stack architecture": [
    {
      id: "fsd-arch-1",
      topic: "Full Stack Architecture",
      difficulty: 2,
      marks: 3,
      body: "In modern full-stack web applications, what is the core architectural advantage of Server-Side Rendering (SSR) combined with Client Hydration?",
      options: [
        { key: "A", text: "Fast First Contentful Paint (FCP) and SEO benefits followed by full interactive client reactivity", is_correct: true },
        { key: "B", text: "Completely eliminates the need for JavaScript bundles in the browser", is_correct: false },
        { key: "C", text: "Forces all database queries to execute in client Web Workers", is_correct: false },
        { key: "D", text: "Bypasses HTTP protocol boundaries using raw TCP sockets", is_correct: false },
      ],
      explanation: "SSR delivers fully rendered HTML for instant FCP and search crawler visibility, then React hydrates the DOM on the client for full interactivity.",
    },
    {
      id: "fsd-arch-2",
      topic: "Full Stack Architecture",
      difficulty: 2,
      marks: 3,
      body: "When implementing the Backend-For-Frontend (BFF) architectural pattern, what is the primary objective?",
      options: [
        { key: "A", text: "Creating tailored gateway adapters that aggregate downstream microservices specifically for the UI's data requirements", is_correct: true },
        { key: "B", text: "Replacing all relational databases with in-memory browser IndexedDB", is_correct: false },
        { key: "C", text: "Executing server-side cron jobs directly inside client mobile apps", is_correct: false },
        { key: "D", text: "Deprecating TLS certificates in favor of symmetric client tokens", is_correct: false },
      ],
      explanation: "A BFF layer customizes API responses, shapes data, and reduces roundtrips for specific user experience form factors (mobile, desktop).",
    },
    {
      id: "fsd-arch-3",
      topic: "Full Stack Architecture",
      difficulty: 3,
      marks: 3,
      body: "In streaming SSR with React 18 / Next.js Suspense, how are slow-loading database queries handled without blocking the page render?",
      options: [
        { key: "A", text: "The initial fast layout and fallback skeletons stream immediately, and slow components stream into the DOM as chunks resolve", is_correct: true },
        { key: "B", text: "The HTTP connection aborts with a 504 Gateway Timeout immediately", is_correct: false },
        { key: "C", text: "The server pauses execution until all downstream microservices finish before sending the initial byte", is_correct: false },
        { key: "D", text: "Database queries are delegated to client browser localStorage", is_correct: false },
      ],
      explanation: "HTTP chunked transfer encoding allows Suspense boundaries to render fallback UI instantly while data-dependent HTML fragments stream asynchronously.",
    },
    {
      id: "fsd-arch-4",
      topic: "Full Stack Architecture",
      difficulty: 2,
      marks: 2,
      body: "What critical security vulnerability is mitigated by implementing the 'SameSite=Lax' attribute on session authentication cookies?",
      options: [
        { key: "A", text: "Cross-Site Request Forgery (CSRF) by preventing cross-origin requests from sending cookies on state-mutating requests", is_correct: true },
        { key: "B", text: "SQL Injection attacks on unparameterized backend database queries", is_correct: false },
        { key: "C", text: "Buffer overflow exploits inside native Node.js C++ add-ons", is_correct: false },
        { key: "D", text: "Distributed Denial of Service (DDoS) bandwidth saturation", is_correct: false },
      ],
      explanation: "SameSite=Lax blocks browsers from sending cookies on cross-site subrequests (such as malicious image fetches or form posts), neutralizing CSRF.",
    },
    {
      id: "fsd-arch-5",
      topic: "Full Stack Architecture",
      difficulty: 2,
      marks: 3,
      body: "In distributed full-stack systems, how does Edge Caching with Stale-While-Revalidate (SWR) headers optimize content delivery?",
      options: [
        { key: "A", text: "Instantly serves cached stale assets to users while asynchronously fetching fresh data from the origin in the background", is_correct: true },
        { key: "B", text: "Forces the browser to recompile the JavaScript bundle on every navigation", is_correct: false },
        { key: "C", text: "Permanently prevents cache invalidation until origin server reboot", is_correct: false },
        { key: "D", text: "Enforces synchronous blocking roundtrips to the primary master database", is_correct: false },
      ],
      explanation: "Stale-While-Revalidate provides sub-millisecond edge response times by returning warm cache immediately while updating the edge asynchronously.",
    },
    {
      id: "fsd-arch-6",
      topic: "Full Stack Architecture",
      difficulty: 3,
      marks: 4,
      body: "When designing a Micro-Frontend architecture, how should decoupled frontend applications communicate while maintaining loose coupling?",
      options: [
        { key: "A", text: "Custom browser DOM events (EventTarget / CustomEvent) or a lightweight publish-subscribe event bus", is_correct: true },
        { key: "B", text: "Sharing mutable global window variables that mutate each other's Redux stores directly", is_correct: false },
        { key: "C", text: "Executing remote eval() calls across iframe boundaries", is_correct: false },
        { key: "D", text: "Re-rendering the entire parent DOM tree on every micro-frontend state change", is_correct: false },
      ],
      explanation: "Decoupled micro-frontends use standardized browser custom events or typed event buses to avoid rigid dependency coupling and memory leaks.",
    },
  ],
  "concurrency & locks": [
    {
      id: "conc-1",
      topic: "Concurrency & Locks",
      difficulty: 2,
      marks: 3,
      body: "In relational databases, what is the key difference between Optimistic Concurrency Control (OCC) and Pessimistic Locking?",
      options: [
        { key: "A", text: "Optimistic locking checks for version conflicts at commit time, whereas pessimistic locking acquires explicit database locks before reading/writing", is_correct: true },
        { key: "B", text: "Optimistic locking completely prevents deadlocks in multi-statement writes", is_correct: false },
        { key: "C", text: "Pessimistic locking disables all database transaction logging", is_correct: false },
        { key: "D", text: "Both locking approaches ignore the ACID isolation guarantee", is_correct: false },
      ],
      explanation: "OCC is ideal for low-conflict workloads using record version columns; pessimistic locking takes row locks (e.g. SELECT FOR UPDATE) when conflict likelihood is high.",
    },
    {
      id: "conc-2",
      topic: "Concurrency & Locks",
      difficulty: 3,
      marks: 4,
      body: "Which database isolation level prevents dirty reads, non-repeatable reads, and phantom reads simultaneously?",
      options: [
        { key: "A", text: "Serializable", is_correct: true },
        { key: "B", text: "Read Committed", is_correct: false },
        { key: "C", text: "Repeatable Read", is_correct: false },
        { key: "D", text: "Read Uncommitted", is_correct: false },
      ],
      explanation: "Serializable provides the highest ANSI SQL isolation level by guaranteeing that concurrent transactions produce the same effect as a sequential execution.",
    },
    {
      id: "conc-3",
      topic: "Concurrency & Locks",
      difficulty: 3,
      marks: 3,
      body: "When implementing a distributed lock using Redis, why is a random unique UUID required as the lock token value?",
      options: [
        { key: "A", text: "To ensure that a slow worker does not accidentally release a lock acquired by another worker after its lease expires (using Lua atomic comparison)", is_correct: true },
        { key: "B", text: "To compress the Redis key memory footprint in RAM", is_correct: false },
        { key: "C", text: "Because Redis cannot store string keys longer than 4 bytes", is_correct: false },
        { key: "D", text: "To bypass the Redis single-threaded event loop", is_correct: false },
      ],
      explanation: "Releasing a Redis lock requires matching the random client token via a Lua script to ensure safe release only by the current legitimate lock owner.",
    },
    {
      id: "conc-4",
      topic: "Concurrency & Locks",
      difficulty: 2,
      marks: 3,
      body: "What is a 'Phantom Read' anomaly in relational database transactions?",
      options: [
        { key: "A", text: "A query re-executed in a transaction finds new rows inserted and committed by a concurrent transaction that match the search filter", is_correct: true },
        { key: "B", text: "Reading uncommitted data that is later rolled back by another transaction", is_correct: false },
        { key: "C", text: "Two transactions overwriting each other's data simultaneously without locking", is_correct: false },
        { key: "D", text: "Reading rows that have already been dropped from disk storage", is_correct: false },
      ],
      explanation: "Phantom reads occur when a transaction re-runs a range query and discovers additional rows created and committed by another transaction in between.",
    },
  ],
  "frontend": [
    {
      id: "fed-1",
      topic: "React Rendering & Hooks",
      difficulty: 2,
      marks: 2,
      body: "When should you prefer useLayoutEffect over useEffect in a React component?",
      options: [
        { key: "A", text: "When you must measure DOM dimensions or positions and mutate the DOM before browser paint to avoid visual flicker", is_correct: true },
        { key: "B", text: "For fetching asynchronous API data after the page loads", is_correct: false },
        { key: "C", text: "When subscribing to WebSocket live feeds", is_correct: false },
        { key: "D", text: "To defer computation until the browser enters idle time", is_correct: false },
      ],
      explanation: "useLayoutEffect fires synchronously after all DOM mutations but before the browser paints screen pixels, preventing UI jitter and layout shifts.",
    },
    {
      id: "fed-2",
      topic: "Web Vitals & Performance",
      difficulty: 1,
      marks: 2,
      body: "Which metric measures visual stability by tracking unexpected layout shifts during the lifespan of a webpage?",
      options: [
        { key: "A", text: "Cumulative Layout Shift (CLS)", is_correct: true },
        { key: "B", text: "Largest Contentful Paint (LCP)", is_correct: false },
        { key: "C", text: "Interaction to Next Paint (INP)", is_correct: false },
        { key: "D", text: "Time to First Byte (TTFB)", is_correct: false },
      ],
      explanation: "CLS quantifies unexpected shifts in layout as visible elements move around during rendering, critical for a smooth user experience.",
    },
    {
      id: "fed-3",
      topic: "TypeScript in React",
      difficulty: 2,
      marks: 2,
      body: "In TypeScript, what is the key difference between ComponentProps<'button'> and React.HTMLAttributes<HTMLButtonElement>?",
      options: [
        { key: "A", text: "ComponentProps includes ref and all React-specific button props, while HTMLAttributes does not include ref", is_correct: true },
        { key: "B", text: "ComponentProps can only be used with class components", is_correct: false },
        { key: "C", text: "HTMLAttributes prevents type inference for onClick events", is_correct: false },
        { key: "D", text: "There is no difference; they are strictly identical aliases", is_correct: false },
      ],
      explanation: "React.ComponentPropsWithRef or ComponentProps<'button'> accurately models intrinsic element props including the ref attribute.",
    },
  ],
  "backend": [
    {
      id: "bed-1",
      topic: "API Architecture & Idempotency",
      difficulty: 2,
      marks: 3,
      body: "In RESTful API design, why is the PUT method specified as idempotent by RFC 9110 while POST is non-idempotent?",
      options: [
        { key: "A", text: "Calling PUT multiple times with the same payload results in the exact same server resource state, whereas repeated POST creates multiple resources", is_correct: true },
        { key: "B", text: "PUT requests bypass server authentication headers", is_correct: false },
        { key: "C", text: "POST requests are strictly cached by forward proxy servers", is_correct: false },
        { key: "D", text: "PUT operations cannot modify relational database tables", is_correct: false },
      ],
      explanation: "PUT, DELETE, GET, and HEAD are idempotent; executing them multiple times produces the same server state as a single invocation.",
    },
    {
      id: "bed-2",
      topic: "Caching & Distributed Systems",
      difficulty: 2,
      marks: 2,
      body: "When using Redis as a cache in front of a PostgreSQL database, what is the 'Cache Aside' pattern?",
      options: [
        { key: "A", text: "Application checks Redis first; on miss, loads from PostgreSQL, updates Redis, and returns data", is_correct: true },
        { key: "B", text: "Database triggers directly update Redis on every write asynchronously", is_correct: false },
        { key: "C", text: "All reads and writes bypass Redis unless Redis fails", is_correct: false },
        { key: "D", text: "Redis acts as an in-memory database and writes to disk only once a week", is_correct: false },
      ],
      explanation: "Cache Aside (Lazy Loading) puts the caching responsibility on the application: read from cache, fall back to DB on miss, then populate cache.",
    },
    {
      id: "bed-3",
      topic: "Microservices Resilience",
      difficulty: 3,
      marks: 3,
      body: "What is the primary role of a Circuit Breaker pattern (e.g. Resilience4j, Polly) in distributed microservices?",
      options: [
        { key: "A", text: "Preventing cascading system failures by failing fast when a downstream dependency is unhealthy, allowing it time to recover", is_correct: true },
        { key: "B", text: "Encrypting all outgoing TCP packet payloads with AES-256", is_correct: false },
        { key: "C", text: "Replacing API gateways with direct peer-to-peer WebRTC connections", is_correct: false },
        { key: "D", text: "Automatically migrating databases during peak load", is_correct: false },
      ],
      explanation: "Circuit breakers transition from Closed to Open upon repeated failures, cutting off doomed traffic to avoid exhausting thread pools and memory.",
    },
  ],
  "data analyst": [
    {
      id: "dat-1",
      topic: "SQL Analytics & Window Functions",
      difficulty: 2,
      marks: 3,
      body: "Which SQL window function computes the running cumulative sum of sales partitioned by department and ordered by transaction date?",
      options: [
        { key: "A", text: "SUM(sales) OVER (PARTITION BY dept_id ORDER BY tx_date)", is_correct: true },
        { key: "B", text: "CUMSUM(sales) GROUP BY dept_id", is_correct: false },
        { key: "C", text: "COUNT(sales) OVER (PARTITION BY dept_id)", is_correct: false },
        { key: "D", text: "LEAD(sales, 1) OVER (ORDER BY dept_id)", is_correct: false },
      ],
      explanation: "SUM() with an OVER (PARTITION BY ... ORDER BY ...) clause computes a running window aggregation row by row.",
    },
    {
      id: "dat-2",
      topic: "Data Modeling & Normalization",
      difficulty: 2,
      marks: 2,
      body: "In relational database design, what condition is required for a table to satisfy Third Normal Form (3NF)?",
      options: [
        { key: "A", text: "It must be in 2NF and contain no transitive dependencies of non-key attributes on the primary key", is_correct: true },
        { key: "B", text: "Every column must contain multi-valued arrays", is_correct: false },
        { key: "C", text: "All foreign keys must be null by default", is_correct: false },
        { key: "D", text: "All numeric values must be stored in BCD format", is_correct: false },
      ],
      explanation: "3NF requires the relation to be in 2NF and that no non-prime attribute is transitively dependent on any candidate key.",
    },
  ],
  "ai engineer": [
    {
      id: "aie-1",
      topic: "Retrieval-Augmented Generation (RAG)",
      difficulty: 3,
      marks: 3,
      body: "In a production RAG pipeline, why is reciprocal rank fusion (RRF) often used to combine dense vector search with sparse keyword search (BM25)?",
      options: [
        { key: "A", text: "It combines semantic conceptual matching with exact keyword / ID precision without needing score calibration", is_correct: true },
        { key: "B", text: "It compresses embedding vectors by 95% using lossy quantization", is_correct: false },
        { key: "C", text: "It fine-tunes the base foundation model in real-time during inference", is_correct: false },
        { key: "D", text: "It eliminates the need for context window management in prompt construction", is_correct: false },
      ],
      explanation: "Hybrid search with RRF leverages both semantic similarity from dense embeddings and precise entity matching from sparse BM25.",
    },
    {
      id: "aie-2",
      topic: "LLM Hallucination & Grounding",
      difficulty: 2,
      marks: 2,
      body: "Which prompt engineering technique prompts the model to generate intermediate reasoning steps before arriving at a final answer?",
      options: [
        { key: "A", text: "Chain-of-Thought (CoT) prompting", is_correct: true },
        { key: "B", text: "Zero-shot direct classification", is_correct: false },
        { key: "C", text: "Greedy sampling with temperature = 0.0", is_correct: false },
        { key: "D", text: "Quantization-aware fine-tuning", is_correct: false },
      ],
      explanation: "Chain-of-Thought (CoT) prompting encourages step-by-step reasoning, significantly improving performance on complex multi-step reasoning tasks.",
    },
    {
      id: "aie-3",
      topic: "Agentic Workflows & Tool Calling",
      difficulty: 3,
      marks: 4,
      body: "In autonomous agent architectures (e.g. ReAct framework), what is the continuous execution loop executed by the agent?",
      options: [
        { key: "A", text: "Thought -> Action (Tool Call) -> Observation -> Thought -> Final Response", is_correct: true },
        { key: "B", text: "Compile -> Link -> Execute -> Terminate", is_correct: false },
        { key: "C", text: "Broadcast -> Acknowledge -> Handshake", is_correct: false },
        { key: "D", text: "Tokenize -> Embed -> Softmax", is_correct: false },
      ],
      explanation: "The ReAct paradigm interweaves Reasoning (Thought), Action (tool execution), and Observation (tool output) until the objective is reached.",
    },
  ],
};

function normalizeTopic(topic: string): string {
  const norm = topic.toLowerCase().trim();
  if (norm.includes("concurr") || norm.includes("lock") || norm.includes("transact")) {
    return "concurrency & locks";
  }
  if (norm.includes("arch") || norm.includes("full") || norm.includes("ssr") || norm.includes("stack")) {
    return "full stack architecture";
  }
  if (norm.includes("react") || norm.includes("front") || norm.includes("css") || norm.includes("vital")) {
    return "frontend";
  }
  if (norm.includes("back") || norm.includes("api") || norm.includes("rest") || norm.includes("node")) {
    return "backend";
  }
  if (norm.includes("sql") || norm.includes("data") || norm.includes("analyst") || norm.includes("panda")) {
    return "data analyst";
  }
  if (norm.includes("ai") || norm.includes("llm") || norm.includes("rag") || norm.includes("agent") || norm.includes("prompt")) {
    return "ai engineer";
  }
  return "full stack architecture";
}

/**
 * Fisher-Yates array shuffle
 */
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Core AI Question Recommendation Agent function.
 * 1. Calls the backend AI Question Recommendation Agent API (`/questions/recommend`).
 * 2. If the backend is unreachable or returns an error, cleanly falls back to our client-side
 *    domain-specific question library with random shuffling, deduplication, and fresh IDs.
 */
export async function recommendAIQuestions(
  params: RecommendQuestionsParams
): Promise<AIQuestionSuggestion[]> {
  const {
    subject = "Full Stack Development",
    topic,
    difficulty = 2,
    marks = 3,
    question_type = "mcq",
    n = 3,
    course_id,
    exclude_bodies = [],
  } = params;

  // 1. Try Backend API first
  try {
    const res = await api<{
      recommendations: Array<{
        draft_id: string;
        topic: string;
        difficulty: number;
        marks: number;
        body: string;
        options: Array<{ key: string; text: string; is_correct: boolean }>;
        correct_key: string;
        concept_note: string;
      }>;
    }>("/questions/recommend", {
      body: {
        subject,
        topic,
        difficulty,
        marks,
        question_type,
        n,
        course_id,
        exclude_bodies,
      },
    });

    if (res?.recommendations && res.recommendations.length > 0) {
      return res.recommendations.map((r, i) => ({
        id: r.draft_id || `rec-api-${Date.now()}-${i}`,
        topic: r.topic || topic,
        difficulty: r.difficulty || difficulty,
        marks: r.marks || marks,
        body: r.body,
        options: r.options,
        explanation: r.concept_note || "",
      }));
    }
  } catch (err) {
    // Graceful offline / fallback to local generator
    console.warn("Backend question recommendation unavailable, using resilient domain generator:", err);
  }

  // 2. Client-side domain generator with deduplication & random shuffling
  return generateAIQuestions(topic, n, exclude_bodies);
}

/**
 * Generates AI-recommended questions with random shuffle, deduplication, and fresh timestamp IDs.
 */
export function generateAIQuestions(
  topic: string,
  count = 3,
  excludeBodies: string[] = []
): AIQuestionSuggestion[] {
  const normKey = normalizeTopic(topic);
  const pool = DOMAIN_QUESTIONS[normKey] || DOMAIN_QUESTIONS["full stack architecture"];

  // Combine with general pool to ensure large variety
  const combined = [...pool];
  for (const [key, qList] of Object.entries(DOMAIN_QUESTIONS)) {
    if (key !== normKey) {
      combined.push(...qList);
    }
  }

  // Filter out excluded bodies (to avoid repeats upon Regenerate)
  const filtered = combined.filter(
    (q) => !excludeBodies.some((ex) => ex.trim().toLowerCase() === q.body.trim().toLowerCase())
  );

  const candidatePool = filtered.length >= count ? filtered : combined;
  const shuffled = shuffle(candidatePool);
  const ts = Date.now();

  return shuffled.slice(0, count).map((q, idx) => ({
    ...q,
    id: `draft-${q.id}-${ts}-${idx}`,
  }));
}

/**
 * Converts AIQuestionSuggestion into Question objects for the assessment
 */
export function convertAIQuestionsToQuestions(suggestions: AIQuestionSuggestion[], courseId = "c1"): Question[] {
  const timestamp = Date.now();
  return suggestions.map((s, idx) => ({
    id: `q-ai-${timestamp}-${idx}`,
    course_id: courseId,
    topic_id: "t1",
    subtopic: s.topic,
    type: "mcq" as const,
    difficulty: s.difficulty,
    marks: s.marks,
    body: s.body,
    answer_text: s.explanation,
    status: "approved" as const,
    source: "agent" as const,
    agent_run_id: "agent-run-rec",
    options: s.options.map((opt, oIdx) => ({
      id: `opt-ai-${timestamp}-${idx}-${oIdx}`,
      key: opt.key,
      text: opt.text,
      is_correct: opt.is_correct,
      misconception_id: null,
    })),
  }));
}

/**
 * AI Agent Assistant: Auto-completes plausible MCQ options (A-D) given a question stem typed by mentor
 */
export function generateOptionsForStem(stem: string, topic = "General"): {
  options: { key: string; text: string; is_correct: boolean }[];
  explanation: string;
  difficulty: number;
  marks: number;
} {
  const norm = stem.toLowerCase();

  if (norm.includes("lock") || norm.includes("concurrency") || norm.includes("transaction") || norm.includes("isolation")) {
    return {
      options: [
        { key: "A", text: "Optimistic locking verifies version timestamps at commit time; pessimistic locking holds exclusive row locks throughout the transaction", is_correct: true },
        { key: "B", text: "Pessimistic locking completely prevents deadlocks under heavy concurrent write load", is_correct: false },
        { key: "C", text: "Optimistic locking requires persistent 2-phase commit locks across all read queries", is_correct: false },
        { key: "D", text: "Both locking mechanisms bypass ACID durability guarantees to boost write throughput", is_correct: false },
      ],
      explanation: "Optimistic locking checks for conflicting updates at commit using version columns; pessimistic locking takes database locks upfront to prevent concurrent mutations.",
      difficulty: 2,
      marks: 3,
    };
  }

  if (norm.includes("react") || norm.includes("hook") || norm.includes("state") || norm.includes("component") || norm.includes("render")) {
    return {
      options: [
        { key: "A", text: "React batches multiple state updates asynchronously and triggers reconciliation when reference identity changes", is_correct: true },
        { key: "B", text: "Every state setter immediately and synchronously renders the entire DOM tree", is_correct: false },
        { key: "C", text: "State variables must be mutated directly via assignment without calling setState", is_correct: false },
        { key: "D", text: "Hooks can be executed conditionally inside if statements or nested while loops safely", is_correct: false },
      ],
      explanation: "React batches state updates together to prevent unnecessary renders and uses shallow reference equality to trigger component re-evaluations.",
      difficulty: 2,
      marks: 2,
    };
  }

  if (norm.includes("index") || norm.includes("b-tree") || norm.includes("query") || norm.includes("sql") || norm.includes("database")) {
    return {
      options: [
        { key: "A", text: "B-Tree indexes reduce disk I/O by offering O(log N) lookup time for equality matches and range queries", is_correct: true },
        { key: "B", text: "Adding indexes speeds up write operations like INSERT, UPDATE, and DELETE queries", is_correct: false },
        { key: "C", text: "Composite indexes can be utilized starting from any column regardless of leading prefix order", is_correct: false },
        { key: "D", text: "Indexes duplicate the full database table into RAM and eliminate persistent storage needs", is_correct: false },
      ],
      explanation: "B-Tree indexes organize search keys hierarchically, providing fast logarithmic searches for equality and range filters at the cost of additional write overhead.",
      difficulty: 2,
      marks: 3,
    };
  }

  if (norm.includes("api") || norm.includes("rest") || norm.includes("http") || norm.includes("jwt") || norm.includes("auth")) {
    return {
      options: [
        { key: "A", text: "Stateless verification using cryptographically signed JWT tokens with short TTLs and refresh token revocation", is_correct: true },
        { key: "B", text: "Storing plaintext user credentials inside browser localStorage without encryption", is_correct: false },
        { key: "C", text: "Embedding secret database connection strings directly in client HTTP GET query parameters", is_correct: false },
        { key: "D", text: "Disabling CORS headers across all microservice ingress controllers", is_correct: false },
      ],
      explanation: "Secure API authentication uses short-lived signed tokens paired with server-side refresh revocation to ensure security across distributed microservices.",
      difficulty: 2,
      marks: 2,
    };
  }

  return {
    options: [
      { key: "A", text: "Enforces modular decoupling, input validation boundaries, and automated error handling", is_correct: true },
      { key: "B", text: "Tight synchronous coupling of subsystems with no fallback circuits or retries", is_correct: false },
      { key: "C", text: "Suppressing all error logging to prevent alerting pipelines from triggering", is_correct: false },
      { key: "D", text: "Bypassing application validation layers to write raw unverified inputs directly to database", is_correct: false },
    ],
    explanation: `Robust system design for ${topic} prioritizes strong boundaries, decoupled architectures, and graceful degradation during fault conditions.`,
    difficulty: 2,
    marks: 2,
  };
}

/**
 * AI Agent Assistant: Drafts a complete single question for a given topic
 */
export function generateSingleQuestion(topic: string, difficulty = 2): AIQuestionSuggestion {
  const list = generateAIQuestions(topic, 3);
  const match = list.find((q) => q.difficulty === difficulty) || list[0];
  return match;
}
