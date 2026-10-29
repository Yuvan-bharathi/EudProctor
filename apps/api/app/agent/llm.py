"""LLM client seam. Production uses the Anthropic SDK; tests install a scripted fake via set_llm_factory."""

from collections.abc import Callable
from typing import Any, Protocol

from app.core.config import get_settings


class AgentUnavailable(RuntimeError):
    pass


class LLM(Protocol):
    model: str

    def create(self, **kwargs: Any) -> Any: ...


class AnthropicLLM:
    def __init__(self, api_key: str, model: str):
        import anthropic

        self._client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    def create(self, **kwargs: Any) -> Any:
        return self._client.messages.create(model=self.model, **kwargs)


def _default_factory() -> LLM:
    s = get_settings()
    if s.agent_llm == "mock":
        if s.environment not in ("dev", "test"):
            raise AgentUnavailable("AGENT_LLM=mock is for development only")
        from app.agent.mock_llm import MockLLM

        return MockLLM()
    if not s.anthropic_api_key or not s.anthropic_model:
        raise AgentUnavailable(
            "AI agent is not configured: set ANTHROPIC_API_KEY and ANTHROPIC_MODEL in .env"
        )
    return AnthropicLLM(s.anthropic_api_key, s.anthropic_model)


_factory: Callable[[], LLM] = _default_factory


def get_llm() -> LLM:
    return _factory()


def set_llm_factory(factory: Callable[[], LLM] | None) -> None:
    global _factory
    _factory = factory or _default_factory
