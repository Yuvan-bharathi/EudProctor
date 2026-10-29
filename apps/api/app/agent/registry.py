"""Allow-listed tool registry. An agent can only call tools listed in its AgentSpec."""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.models import AgentRun


class ToolError(Exception):
    """Validation failure returned to the model as an is_error tool_result (the run continues)."""


@dataclass
class ToolContext:
    db: Session
    run: AgentRun
    params: dict[str, Any]  # trusted, server-side parameters (course_id, session_id, ...), never model input
    state: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[ToolContext, dict[str, Any]], Any]
    read_only: bool = True

    def to_api(self) -> dict[str, Any]:
        return {"name": self.name, "description": self.description, "input_schema": self.input_schema}


@dataclass(frozen=True)
class AgentSpec:
    name: str
    prompt_version: str
    system_prompt: str
    tools: tuple[Tool, ...]
    max_turns: int = 12

    def tool(self, name: str) -> Tool | None:
        return next((t for t in self.tools if t.name == name), None)
