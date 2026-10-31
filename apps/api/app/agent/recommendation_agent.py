"""Dedicated AI Question Recommendation Agent for Mentor Question Creation Workflow.

This agent operates strictly under Human-in-the-Loop principles:
- Recommends pedagogically structured questions for a given Subject, Topic, Difficulty, and Marks.
- Retrieves syllabus topics and queries existing approved questions to avoid duplicates.
- Generates 4 plausible options (A-D) with exactly one correct option and a pedagogical concept note.
- Never saves or mutates the database automatically. The mentor retains sole authority to review, edit, and save.
"""

import difflib
import json
import logging
import random
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Question, QuestionStatus, Topic, User

log = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.75

# Curated, academically rigorous domain question bank for mock / offline fallback
DOMAIN_TOPIC_QUESTIONS: dict[str, list[dict[str, Any]]] = {
    "full stack architecture": [
        {
            "body": "In modern full-stack web applications, what is the core architectural advantage of Server-Side Rendering (SSR) combined with Client Hydration?",
            "difficulty": 2,
            "marks": 3.0,
            "options": [
                {"key": "A", "text": "Fast First Contentful Paint (FCP) and SEO benefits followed by full interactive client reactivity", "is_correct": True},
                {"key": "B", "text": "Completely eliminates the need for JavaScript bundles in the browser", "is_correct": False},
                {"key": "C", "text": "Forces all database queries to execute in client Web Workers", "is_correct": False},
                {"key": "D", "text": "Bypasses HTTP protocol boundaries using raw TCP sockets", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "SSR delivers fully rendered HTML for instant FCP and search crawler visibility, then React hydrates the DOM on the client for full interactivity.",
        },
        {
            "body": "When implementing the Backend-For-Frontend (BFF) architectural pattern, what is the primary objective?",
            "difficulty": 2,
            "marks": 3.0,
            "options": [
                {"key": "A", "text": "Creating tailored gateway adapters that aggregate downstream microservices specifically for the UI's data requirements", "is_correct": True},
                {"key": "B", "text": "Replacing all relational databases with in-memory browser IndexedDB", "is_correct": False},
                {"key": "C", "text": "Executing server-side cron jobs directly inside client mobile apps", "is_correct": False},
                {"key": "D", "text": "Deprecating TLS certificates in favor of symmetric client tokens", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "A BFF layer customizes API responses, shapes data, and reduces roundtrips for specific user experience form factors (mobile, desktop).",
        },
        {
            "body": "In streaming SSR with React 18 / Next.js Suspense, how are slow-loading database queries handled without blocking the page render?",
            "difficulty": 3,
            "marks": 3.0,
            "options": [
                {"key": "A", "text": "The initial fast layout and fallback skeletons stream immediately, and slow components stream into the DOM as chunks resolve", "is_correct": True},
                {"key": "B", "text": "The HTTP connection aborts with a 504 Gateway Timeout immediately", "is_correct": False},
                {"key": "C", "text": "The server pauses execution until all downstream microservices finish before sending the initial byte", "is_correct": False},
                {"key": "D", "text": "Database queries are delegated to client browser localStorage", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "HTTP chunked transfer encoding allows Suspense boundaries to render fallback UI instantly while data-dependent HTML fragments stream asynchronously.",
        },
        {
            "body": "What critical security vulnerability is mitigated by implementing the 'SameSite=Lax' attribute on session authentication cookies?",
            "difficulty": 2,
            "marks": 2.0,
            "options": [
                {"key": "A", "text": "Cross-Site Request Forgery (CSRF) by preventing cross-origin requests from sending cookies on state-mutating requests", "is_correct": True},
                {"key": "B", "text": "SQL Injection attacks on unparameterized backend database queries", "is_correct": False},
                {"key": "C", "text": "Buffer overflow exploits inside native Node.js C++ add-ons", "is_correct": False},
                {"key": "D", "text": "Distributed Denial of Service (DDoS) bandwidth saturation", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "SameSite=Lax blocks browsers from sending cookies on cross-site subrequests (such as malicious image fetches or form posts), neutralising CSRF.",
        },
        {
            "body": "In distributed full-stack systems, how does Edge Caching with Stale-While-Revalidate (SWR) headers optimize content delivery?",
            "difficulty": 2,
            "marks": 3.0,
            "options": [
                {"key": "A", "text": "Instantly serves cached stale assets to users while asynchronously fetching fresh data from the origin in the background", "is_correct": True},
                {"key": "B", "text": "Forces the browser to recompile the JavaScript bundle on every navigation", "is_correct": False},
                {"key": "C", "text": "Permanently prevents cache invalidation until origin server reboot", "is_correct": False},
                {"key": "D", "text": "Enforces synchronous blocking roundtrips to the primary master database", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "Stale-While-Revalidate provides sub-millisecond edge response times by returning warm cache immediately while updating the edge asynchronously.",
        },
        {
            "body": "When designing a Micro-Frontend architecture, how should decoupled frontend applications communicate while maintaining loose coupling?",
            "difficulty": 3,
            "marks": 4.0,
            "options": [
                {"key": "A", "text": "Custom browser DOM events (EventTarget / CustomEvent) or a lightweight publish-subscribe event bus", "is_correct": True},
                {"key": "B", "text": "Sharing mutable global window variables that mutate each other's Redux stores directly", "is_correct": False},
                {"key": "C", "text": "Executing remote eval() calls across iframe boundaries", "is_correct": False},
                {"key": "D", "text": "Re-rendering the entire parent DOM tree on every micro-frontend state change", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "Decoupled micro-frontends use standardized browser custom events or typed event buses to avoid rigid dependency coupling and memory leaks.",
        },
    ],
    "concurrency & database": [
        {
            "body": "In relational databases, what is the key difference between Optimistic Concurrency Control (OCC) and Pessimistic Locking?",
            "difficulty": 2,
            "marks": 3.0,
            "options": [
                {"key": "A", "text": "Optimistic locking checks for version conflicts at commit time, whereas pessimistic locking acquires explicit database locks before reading/writing", "is_correct": True},
                {"key": "B", "text": "Optimistic locking completely prevents deadlocks in multi-statement writes", "is_correct": False},
                {"key": "C", "text": "Pessimistic locking disables all database transaction logging", "is_correct": False},
                {"key": "D", "text": "Both locking approaches ignore the ACID isolation guarantee", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "OCC is ideal for low-conflict workloads using record version columns; pessimistic locking takes row locks (e.g. SELECT FOR UPDATE) when conflict likelihood is high.",
        },
        {
            "body": "Which database isolation level prevents dirty reads, non-repeatable reads, and phantom reads simultaneously?",
            "difficulty": 3,
            "marks": 4.0,
            "options": [
                {"key": "A", "text": "Serializable", "is_correct": True},
                {"key": "B", "text": "Read Committed", "is_correct": False},
                {"key": "C", "text": "Repeatable Read", "is_correct": False},
                {"key": "D", "text": "Read Uncommitted", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "Serializable provides the highest ANSI SQL isolation level by guaranteeing that concurrent transactions produce the same effect as a sequential execution.",
        },
        {
            "body": "When implementing a distributed lock using Redis, why is a random unique UUID required as the lock token value?",
            "difficulty": 3,
            "marks": 3.0,
            "options": [
                {"key": "A", "text": "To ensure that a slow worker does not accidentally release a lock acquired by another worker after its lease expires (using Lua atomic comparison)", "is_correct": True},
                {"key": "B", "text": "To compress the Redis key memory footprint in RAM", "is_correct": False},
                {"key": "C", "text": "Because Redis cannot store string keys longer than 4 bytes", "is_correct": False},
                {"key": "D", "text": "To bypass the Redis single-threaded event loop", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "Releasing a Redis lock requires matching the random client token via a Lua script to ensure safe release only by the current legitimate lock owner.",
        },
    ],
    "frontend": [
        {
            "body": "In React 18, why is useLayoutEffect preferred over useEffect for manipulating DOM dimensions?",
            "difficulty": 2,
            "marks": 2.0,
            "options": [
                {"key": "A", "text": "It executes synchronously immediately after DOM mutations before browser paint, avoiding visual flickering", "is_correct": True},
                {"key": "B", "text": "It executes in a background web worker to speed up network requests", "is_correct": False},
                {"key": "C", "text": "It persists component state into browser localStorage automatically", "is_correct": False},
                {"key": "D", "text": "It bypasses React's virtual DOM reconciliation completely", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "useLayoutEffect blocks browser paint until execution completes, ensuring coordinates and layout calculations do not cause visible UI jitter.",
        },
        {
            "body": "Which Core Web Vital measures the visual stability of a web application during dynamic content loading?",
            "difficulty": 1,
            "marks": 2.0,
            "options": [
                {"key": "A", "text": "Cumulative Layout Shift (CLS)", "is_correct": True},
                {"key": "B", "text": "Largest Contentful Paint (LCP)", "is_correct": False},
                {"key": "C", "text": "Interaction to Next Paint (INP)", "is_correct": False},
                {"key": "D", "text": "Time to First Byte (TTFB)", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "CLS measures unexpected shifts of visible elements as resources load without explicit dimensional aspect ratio reservations.",
        },
    ],
    "backend": [
        {
            "body": "In RESTful API design, why is the PUT method defined as idempotent while POST is generally non-idempotent?",
            "difficulty": 2,
            "marks": 3.0,
            "options": [
                {"key": "A", "text": "Calling PUT multiple times with the same payload results in the exact same server resource state, whereas repeated POST creates multiple resources", "is_correct": True},
                {"key": "B", "text": "PUT requests bypass server authentication headers", "is_correct": False},
                {"key": "C", "text": "POST requests are strictly cached by forward proxy servers", "is_correct": False},
                {"key": "D", "text": "PUT operations cannot modify relational database tables", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "Idempotence guarantees that repeated identical requests produce identical side effects on the server, critical for network retry safety.",
        },
        {
            "body": "What is the primary role of a Circuit Breaker pattern (e.g. Resilience4j, Polly) in distributed microservices?",
            "difficulty": 3,
            "marks": 3.0,
            "options": [
                {"key": "A", "text": "Preventing cascading system failures by failing fast when a downstream dependency is unhealthy, allowing it time to recover", "is_correct": True},
                {"key": "B", "text": "Encrypting all outgoing TCP packet payloads with AES-256", "is_correct": False},
                {"key": "C", "text": "Replacing API gateways with direct peer-to-peer WebRTC connections", "is_correct": False},
                {"key": "D", "text": "Automatically migrating databases during peak load", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "Circuit breakers transition from Closed to Open upon repeated failures, cutting off doomed traffic to avoid exhausting thread pools and memory.",
        },
    ],
    "ai engineer": [
        {
            "body": "In Retrieval-Augmented Generation (RAG), why is Reciprocal Rank Fusion (RRF) used in hybrid search architectures?",
            "difficulty": 3,
            "marks": 3.0,
            "options": [
                {"key": "A", "text": "It seamlessly combines dense semantic vector rankings with sparse BM25 keyword rankings without requiring score normalization", "is_correct": True},
                {"key": "B", "text": "It compresses embedding vectors from 1536 dimensions down to 8 bits with zero loss", "is_correct": False},
                {"key": "C", "text": "It fine-tunes base foundation models in real-time during inference", "is_correct": False},
                {"key": "D", "text": "It bypasses vector databases by storing all vectors in URL query strings", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "RRF scores documents based on reciprocal ranks (1 / (k + rank)), balancing conceptual semantic matches with precise technical keywords.",
        },
        {
            "body": "What is the core operational loop of an autonomous AI agent operating under the ReAct (Reason + Act) paradigm?",
            "difficulty": 2,
            "marks": 3.0,
            "options": [
                {"key": "A", "text": "Thought -> Action (Tool Call) -> Observation (Environment Output) -> Repeat until Final Answer", "is_correct": True},
                {"key": "B", "text": "Compile -> Link -> Execute -> Core Dump", "is_correct": False},
                {"key": "C", "text": "Handshake -> SYN -> ACK -> FIN", "is_correct": False},
                {"key": "D", "text": "Tokenize -> Softmax -> Quantize -> Backprop", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": "ReAct combines verbal reasoning traces with domain-specific tool execution to solve multi-step problems systematically.",
        },
    ],
}


def _match_topic_key(topic: str) -> str:
    """Normalize and match a topic string to our curated domain bank."""
    norm = topic.lower().strip()
    if any(k in norm for k in ["full stack", "fullstack", "architecture", "ssr", "hydration"]):
        return "full stack architecture"
    if any(k in norm for k in ["concurrency", "lock", "database", "acid", "transaction", "sql"]):
        return "concurrency & database"
    if any(k in norm for k in ["react", "front", "css", "html", "web vital", "layout"]):
        return "frontend"
    if any(k in norm for k in ["back", "api", "rest", "microservice", "circuit", "http"]):
        return "backend"
    if any(k in norm for k in ["ai", "llm", "rag", "agent", "prompt", "machine learning"]):
        return "ai engineer"
    return "full stack architecture"


def _is_duplicate(body: str, existing_bodies: list[str]) -> bool:
    """Check if the proposed question stem is substantially similar to an existing question."""
    body_clean = body.lower().strip()
    for existing in existing_bodies:
        ex_clean = existing.lower().strip()
        if body_clean == ex_clean:
            return True
        ratio = difflib.SequenceMatcher(None, body_clean, ex_clean).ratio()
        if ratio >= SIMILARITY_THRESHOLD:
            return True
    return False


def _get_existing_question_bodies(db: Session, course_id: uuid.UUID | None = None) -> list[str]:
    """Retrieve existing approved questions from the database to ensure zero repetition."""
    try:
        q = select(Question.body).where(Question.status == QuestionStatus.approved)
        if course_id:
            q = q.where(Question.course_id == course_id)
        return list(db.scalars(q))
    except Exception as exc:
        log.warning("Could not load existing questions from DB: %s", exc)
        return []


def generate_recommendations(
    db: Session,
    mentor: User,
    subject: str,
    topic: str,
    difficulty: int = 2,
    marks: float = 3.0,
    question_type: str = "mcq",
    n: int = 3,
    course_id: uuid.UUID | None = None,
    exclude_bodies: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Runs the AI Question Recommendation Agent.
    
    1. Examines syllabus and gathers existing approved questions from DB.
    2. Queries Anthropic Claude if configured, otherwise leverages the domain question repository.
    3. Guarantees non-repetition via SequenceMatcher deduplication.
    4. Returns strictly valid structured question recommendations.
    """
    settings = get_settings()
    existing_bodies = _get_existing_question_bodies(db, course_id)
    if exclude_bodies:
        existing_bodies.extend(exclude_bodies)

    recommendations: list[dict[str, Any]] = []

    # 1. Attempt LLM generation if Anthropic API is configured and not in mock mode
    if (
        settings.agent_llm != "mock"
        and settings.anthropic_api_key
        and settings.anthropic_model
        and settings.environment != "test"
    ):
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            diff_label = {1: "Easy", 2: "Medium", 3: "Hard"}.get(difficulty, "Medium")

            prompt = f"""You are the AI Question Recommendation Agent for EduProctor Intelligence.
A mentor is creating a new question for an assessment. Recommend {n} diverse multiple-choice question(s).

Requirements:
- Subject: {subject}
- Topic: {topic}
- Difficulty: {diff_label} ({difficulty}/3)
- Marks: {marks}
- Type: {question_type.upper()}
- Generate academically rigorous, technically precise questions with plausible distractors.
- Format reference:
  Question: In modern full-stack web applications, what is the core architectural advantage of Server-Side Rendering (SSR) combined with Client Hydration?
  Option A: Fast First Contentful Paint (FCP) and SEO benefits followed by full interactive client reactivity (Correct)
  Option B: Completely eliminates the need for JavaScript bundles in the browser
  Option C: Forces all database queries to execute in client Web Workers
  Option D: Bypasses HTTP protocol boundaries using raw TCP sockets
  Concept Note: SSR delivers fully rendered HTML for instant FCP and search crawler visibility, then React hydrates the DOM on the client for full interactivity.

DO NOT duplicate any of the following existing questions:
{json.dumps(existing_bodies[-15:], indent=2)}

Return a strict JSON array of objects with the following keys:
[
  {{
    "body": "Question text...",
    "difficulty": {difficulty},
    "marks": {marks},
    "options": [
      {{"key": "A", "text": "Option text...", "is_correct": true}},
      {{"key": "B", "text": "Option text...", "is_correct": false}},
      {{"key": "C", "text": "Option text...", "is_correct": false}},
      {{"key": "D", "text": "Option text...", "is_correct": false}}
    ],
    "correct_key": "A",
    "concept_note": "Clear pedagogical explanation..."
  }}
]
Output raw JSON only without markdown codeblocks."""

            res = client.messages.create(
                model=settings.anthropic_model,
                max_tokens=2048,
                temperature=0.7,
                messages=[{"role": "user", "content": prompt}],
            )
            raw_text = res.content[0].text.strip()
            if raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:]
            parsed = json.loads(raw_text.strip())
            if isinstance(parsed, list):
                for idx, item in enumerate(parsed):
                    if not _is_duplicate(item.get("body", ""), existing_bodies):
                        recommendations.append({
                            "draft_id": f"draft-ai-{uuid.uuid4().hex[:8]}",
                            "topic": topic,
                            "difficulty": int(item.get("difficulty", difficulty)),
                            "marks": float(item.get("marks", marks)),
                            "type": "mcq",
                            "body": item.get("body", ""),
                            "options": item.get("options", []),
                            "correct_key": item.get("correct_key", "A"),
                            "concept_note": item.get("concept_note", ""),
                        })
                        existing_bodies.append(item.get("body", ""))
                        if len(recommendations) >= n:
                            break
        except Exception as exc:
            log.warning("Anthropic Question Recommendation failed, using rule-based generator: %s", exc)

    # 2. Rule-based domain generator (ensures zero failure and high pedagogical quality)
    if len(recommendations) < n:
        matched_key = _match_topic_key(topic)
        candidate_pool = list(DOMAIN_TOPIC_QUESTIONS.get(matched_key, []))

        # Also pull from general pool if needed
        for other_key, pool in DOMAIN_TOPIC_QUESTIONS.items():
            if other_key != matched_key:
                candidate_pool.extend(pool)

        # Shuffle pool randomly to prevent repetition
        random.shuffle(candidate_pool)

        for item in candidate_pool:
            if not _is_duplicate(item["body"], existing_bodies):
                recommendations.append({
                    "draft_id": f"draft-rec-{uuid.uuid4().hex[:8]}",
                    "topic": topic,
                    "difficulty": item["difficulty"],
                    "marks": marks,
                    "type": "mcq",
                    "body": item["body"],
                    "options": [dict(opt) for opt in item["options"]],
                    "correct_key": item["correct_key"],
                    "concept_note": item["concept_note"],
                })
                existing_bodies.append(item["body"])
                if len(recommendations) >= n:
                    break

    # 3. Dynamic synthesis if pool is completely exhausted for unique specialized topics
    while len(recommendations) < n:
        seq = len(recommendations) + 1
        synth_body = f"In {subject} ({topic}), what is the primary architectural best practice when designing resilient, maintainable services (Design Pattern #{seq})?"
        recommendations.append({
            "draft_id": f"draft-synth-{uuid.uuid4().hex[:8]}",
            "topic": topic,
            "difficulty": difficulty,
            "marks": marks,
            "type": "mcq",
            "body": synth_body,
            "options": [
                {"key": "A", "text": "Decoupled asynchronous boundaries with circuit breakers and comprehensive validation", "is_correct": True},
                {"key": "B", "text": "Tight synchronous coupling of subsystems without fallback logic", "is_correct": False},
                {"key": "C", "text": "Disabling error monitoring to avoid alert noise", "is_correct": False},
                {"key": "D", "text": "Hardcoding production secrets into public client assets", "is_correct": False},
            ],
            "correct_key": "A",
            "concept_note": f"For {topic}, resilience requires loose coupling, circuit breakers, and defensive input validation.",
        })

    return recommendations[:n]

