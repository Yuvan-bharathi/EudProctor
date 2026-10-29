"""Scripted stand-in for the Anthropic client: returns pre-built responses in order."""

import itertools
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any

_ids = itertools.count(1)


def text(t: str) -> SimpleNamespace:
    return SimpleNamespace(type="text", text=t)


def tool_use(name: str, **inp: Any) -> SimpleNamespace:
    return SimpleNamespace(type="tool_use", id=f"toolu_{next(_ids)}", name=name, input=inp)


def response(
    *blocks: SimpleNamespace, stop: str | None = None, tin: int = 100, tout: int = 50
) -> SimpleNamespace:
    stop_reason = stop or ("tool_use" if any(b.type == "tool_use" for b in blocks) else "end_turn")
    return SimpleNamespace(
        content=list(blocks),
        stop_reason=stop_reason,
        usage=SimpleNamespace(input_tokens=tin, output_tokens=tout),
    )


@dataclass
class FakeLLM:
    script: list[Any]
    model: str = "fake-model"
    calls: list[dict[str, Any]] = field(default_factory=list)

    def create(self, **kwargs: Any) -> Any:
        self.calls.append({**kwargs, "messages": list(kwargs["messages"])})  # snapshot: the loop mutates it
        step = self.script.pop(0)
        # a callable step can build its response from the tool results seen so far
        return step(kwargs) if callable(step) else step

    def tool_results(self, call_index: int) -> list[dict[str, Any]]:
        return self.calls[call_index]["messages"][-1]["content"]
