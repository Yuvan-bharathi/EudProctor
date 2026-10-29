"""Single source of truth for configuration and policy thresholds.

Every threshold the PRD names (glance/flag seconds, max flags, topic percentages, ...) lives here and is
read from the environment. Code must reference these settings, never literal numbers.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../../.env"), extra="ignore")

    app_name: str = "EduProctor Intelligence"
    environment: str = "production"  # fail closed: dev/test gates need an explicit ENVIRONMENT
    database_url: str = "postgresql+psycopg://eduproctor:eduproctor@localhost:5432/eduproctor"
    redis_url: str = "redis://localhost:6379/0"
    chroma_url: str = "http://localhost:8001"
    web_base_url: str = "http://localhost:5173"
    cors_origins: list[str] = ["http://localhost:5173"]

    jwt_secret: str = "change-me"
    jwt_access_minutes: int = 30
    jwt_refresh_days: int = 7

    anthropic_api_key: str = ""
    anthropic_model: str = ""
    agent_llm: str = "anthropic"  # anthropic / mock (rule-based stand-in, dev and test only)
    # USD per million tokens, for the agent dashboard's cost estimate
    agent_price_in_per_mtok: float = 4.0
    agent_price_out_per_mtok: float = 20.0
    max_suggested_questions: int = 10

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    mail_from: str = "no-reply@eduproctor.example.com"
    mail_backend: str = "smtp"  # smtp (falls back to file outbox if unreachable) / file / memory

    evidence_encryption_key: str = ""
    storage_dir: str = "storage"
    retention_days: int = 90

    # proctoring policy (PRD section 4)
    glance_min_s: float = 1.0
    flag_threshold_s: float = 3.0
    flag_threshold_min_s: float = 3.0
    flag_threshold_max_s: float = 5.0
    max_flags: int = 3
    yaw_limit_deg: float = 30.0
    pitch_limit_deg: float = 20.0
    face_absent_s: float = 3.0
    face_absent_high_s: float = 30.0
    multi_face_s: float = 2.0
    tab_switch_s: float = 2.0
    return_to_screen_s: float = 0.5
    tab_switch_repeat_medium: int = 3
    snapshot_max_bytes: int = 200_000
    snapshot_max_width: int = 640
    max_events_per_batch: int = 200
    event_clock_skew_s: int = 10
    ws_ticket_ttl_s: int = 60

    # identity (Phase 4)
    consent_version: str = "2026-10-v1"
    identity_engine: str = "dev"  # insightface in production; "dev" is NOT face recognition (dev/test only)
    identity_match_threshold: float = 0.45  # ArcFace cosine similarity
    identity_uncertain_threshold: float = 0.30
    identity_max_attempts: int = 2
    identity_random_checks: int = 2
    enrol_min_images: int = 3
    enrol_max_images: int = 5
    liveness_window_s: int = 20
    liveness_min_frame_diff: float = 2.0  # mean absolute grey-level change between challenge crops
    max_face_image_bytes: int = 300_000
    max_face_image_px: int = 1024

    # evaluation rules (PRD section 5)
    strong_topic_pct: float = 80.0
    weak_topic_pct: float = 60.0
    min_questions_per_topic: int = 3
    misconception_min_count: int = 2
    item_group_fraction: float = 0.27
    # priority = mastery - topic score; defaults to STRONG_TOPIC_PCT
    priority_mastery_pct: float | None = None

    # evaluation summary / practice (Phase 7)
    evaluation_jobs: str = "background"  # background / off
    practice_min_questions: int = 5
    practice_max_questions: int = 10
    practice_due_days: int = 7
    summary_max_message_words: int = 150
    summary_score_tolerance: float = 0.01

    # assessments
    autosave_min_interval_s: int = 10
    late_sync_grace_s: int = 600  # accept answers buffered offline before the deadline for this long after it
    deadline_sweep_interval_s: int = 15
    link_ttl_hours: int = 72


class InsecureConfigError(RuntimeError):
    pass


def validate_settings(s: Settings) -> None:
    """Refuse to start outside dev/test with a default or short JWT secret."""
    if s.environment not in {"dev", "test"} and (s.jwt_secret == "change-me" or len(s.jwt_secret) < 32):
        raise InsecureConfigError("JWT_SECRET must be set to a random value of at least 32 characters")


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    validate_settings(s)
    return s
