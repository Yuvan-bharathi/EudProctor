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

const TOPIC_PRESETS: Record<string, AIQuestionSuggestion[]> = {
  "full stack": [
    {
      id: "ai-q-fsd-1",
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
      id: "ai-q-fsd-2",
      topic: "Full Stack Data Fetching",
      difficulty: 2,
      marks: 2,
      body: "In Next.js App Router, how do Server Actions handle client mutations while maintaining cache consistency?",
      options: [
        { key: "A", text: "They run asynchronously on the server and trigger revalidation via revalidatePath / revalidateTag", is_correct: true },
        { key: "B", text: "They serialize local storage keys directly into URL query parameters", is_correct: false },
        { key: "C", text: "They restart the Node.js process upon every POST request", is_correct: false },
        { key: "D", text: "They bypass CORS policies by tunneling through WebSocket frames", is_correct: false },
      ],
      explanation: "Server Actions execute on the server in response to form submissions or client calls, updating databases and immediately invalidating cached route data.",
    },
    {
      id: "ai-q-fsd-3",
      topic: "Full Stack Auth & Session",
      difficulty: 3,
      marks: 4,
      body: "Which authentication strategy provides stateless scalability for microservices while mitigating token revocation latency?",
      options: [
        { key: "A", text: "Short-lived JWT access tokens paired with Redis-backed refresh token rotation", is_correct: true },
        { key: "B", text: "Storing plaintext passwords in browser sessionStorage", is_correct: false },
        { key: "C", text: "Basic Auth credentials passed in unencrypted GET query strings", is_correct: false },
        { key: "D", text: "Single persistent cookie with a 10-year expiration and no expiry checks", is_correct: false },
      ],
      explanation: "Short-lived JWTs (e.g. 15 min) allow stateless verification across distributed services, while centralized refresh tokens in Redis allow instant revocation.",
    },
  ],
  "frontend": [
    {
      id: "ai-q-fed-1",
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
      id: "ai-q-fed-2",
      topic: "Web Vitals & Performance",
      difficulty: 3,
      marks: 3,
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
      id: "ai-q-fed-3",
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
      id: "ai-q-bed-1",
      topic: "Database Isolation & ACID",
      difficulty: 3,
      marks: 4,
      body: "What concurrency anomaly occurs when Transaction A reads a row, Transaction B modifies it and commits, and Transaction A reads it again getting different values?",
      options: [
        { key: "A", text: "Non-repeatable read (Fuzzy read)", is_correct: true },
        { key: "B", text: "Dirty read", is_correct: false },
        { key: "C", text: "Phantom read", is_correct: false },
        { key: "D", text: "Lost update", is_correct: false },
      ],
      explanation: "A non-repeatable read occurs when data read twice within the same transaction changes because another transaction committed an update in between.",
    },
    {
      id: "ai-q-bed-2",
      topic: "API Architecture & Idempotency",
      difficulty: 2,
      marks: 3,
      body: "In RESTful API design, which HTTP method is specified as idempotent by RFC 9110?",
      options: [
        { key: "A", text: "PUT and DELETE", is_correct: true },
        { key: "B", text: "POST only", is_correct: false },
        { key: "C", text: "PATCH only", is_correct: false },
        { key: "D", text: "CONNECT only", is_correct: false },
      ],
      explanation: "PUT, DELETE, GET, and HEAD are idempotent; executing them multiple times produces the same server state as a single invocation.",
    },
    {
      id: "ai-q-bed-3",
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
  ],
  "data analyst": [
    {
      id: "ai-q-dat-1",
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
      id: "ai-q-dat-2",
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
    {
      id: "ai-q-dat-3",
      topic: "Pandas & Exploratory Data Analysis",
      difficulty: 2,
      marks: 2,
      body: "In Python Pandas, what is the difference between df.loc and df.iloc?",
      options: [
        { key: "A", text: "df.loc is label-based indexing, whereas df.iloc is purely integer position-based indexing", is_correct: true },
        { key: "B", text: "df.loc modifies the DataFrame in place while df.iloc creates a copy", is_correct: false },
        { key: "C", text: "df.iloc only works on DateTime indices", is_correct: false },
        { key: "D", text: "df.loc cannot filter rows using boolean conditions", is_correct: false },
      ],
      explanation: "loc accepts string/index labels, while iloc accepts integer positions (0 to length - 1).",
    },
  ],
  "ai engineer": [
    {
      id: "ai-q-aie-1",
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
      id: "ai-q-aie-2",
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
      id: "ai-q-aie-3",
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

// Aliases mapping for easy lookup
const TOPIC_ALIASES: Record<string, string> = {
  "fullstack": "full stack",
  "full stack development": "full stack",
  "react": "frontend",
  "next.js": "full stack",
  "nextjs": "full stack",
  "node": "backend",
  "database": "backend",
  "api": "backend",
  "sql": "data analyst",
  "data": "data analyst",
  "pandas": "data analyst",
  "analytics": "data analyst",
  "ai": "ai engineer",
  "llm": "ai engineer",
  "machine learning": "ai engineer",
  "ml": "ai engineer",
  "rag": "ai engineer",
  "prompt": "ai engineer",
};

/**
 * Generates AI-recommended questions for any requested topic.
 */
export function generateAIQuestions(topic: string, count = 3): AIQuestionSuggestion[] {
  const normTopic = topic.toLowerCase().trim();

  // 1. Direct or alias match
  for (const [key, questions] of Object.entries(TOPIC_PRESETS)) {
    if (normTopic === key || normTopic.includes(key) || key.includes(normTopic)) {
      return questions.slice(0, count);
    }
  }

  for (const [alias, targetKey] of Object.entries(TOPIC_ALIASES)) {
    if (normTopic.includes(alias)) {
      const questions = TOPIC_PRESETS[targetKey];
      if (questions) return questions.slice(0, count);
    }
  }

  // 2. Dynamic generation for any specialized technical topic
  const cleanTitle = topic.trim() || "Full Stack Architecture";
  return [
    {
      id: `ai-q-custom-${Date.now()}-1`,
      topic: cleanTitle,
      difficulty: 2,
      marks: 2,
      body: `When architecting scalable production systems using ${cleanTitle}, what is the recommended design pattern for high availability and fault isolation?`,
      options: [
        { key: "A", text: "Decoupled asynchronous message queues with exponential backoff and circuit breakers", is_correct: true },
        { key: "B", text: "Tight synchronous coupling of all microservices into a single point of failure", is_correct: false },
        { key: "C", text: "Disabling automated retries and logging on critical API paths", is_correct: false },
        { key: "D", text: "Hardcoding connection secrets directly in client bundle source code", is_correct: false },
      ],
      explanation: `For ${cleanTitle}, resilient architecture requires graceful degradation, circuit breaker patterns, and asynchronous message queues to prevent cascade failures.`,
    },
    {
      id: `ai-q-custom-${Date.now()}-2`,
      topic: cleanTitle,
      difficulty: 3,
      marks: 3,
      body: `In the context of ${cleanTitle}, how is performance profiling best conducted to identify runtime latency bottlenecks?`,
      options: [
        { key: "A", text: "Distributed tracing (e.g. OpenTelemetry) capturing spans, flame graphs, and p99 percentile metrics", is_correct: true },
        { key: "B", text: "Inserting synchronous console.log statements into high-frequency render loops", is_correct: false },
        { key: "C", text: "Relying exclusively on average response times while ignoring outliers and tail latencies", is_correct: false },
        { key: "D", text: "Disabling telemetry sampling across production nodes", is_correct: false },
      ],
      explanation: `Distributed tracing tracks request lifecycles across services, isolating bottlenecks via span latency and tail percentiles (p95/p99).`,
    },
    {
      id: `ai-q-custom-${Date.now()}-3`,
      topic: cleanTitle,
      difficulty: 1,
      marks: 2,
      body: `Which core principle ensures maintainability and testability when writing code for ${cleanTitle}?`,
      options: [
        { key: "A", text: "Single Responsibility Principle (SRP) and modular separation of concerns with unit coverage", is_correct: true },
        { key: "B", text: "Writing monolithic 5,000-line functions with global mutable variables", is_correct: false },
        { key: "C", text: "Avoiding automated CI/CD test suites before deploying to production", is_correct: false },
        { key: "D", text: "Coupling UI components directly to raw database queries", is_correct: false },
      ],
      explanation: `Clean architecture requires modular components, dependency injection, and comprehensive automated test coverage for maintainability.`,
    },
  ].slice(0, count);
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
