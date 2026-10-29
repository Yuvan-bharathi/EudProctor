import { act, render, screen } from "@testing-library/react";
import { FlagCounter } from "./FlagCounter";
import { FlagNotice } from "./FlagNotice";
import { TopicChip } from "./TopicChip";

describe("FlagCounter", () => {
  it("shows the count and never exceeds max", () => {
    render(<FlagCounter count={5} max={3} />);
    expect(screen.getByTestId("flag-counter")).toHaveTextContent("Flags 3 of 3");
  });
});

describe("FlagNotice", () => {
  it("is a polite status region and auto-hides after 5 s", () => {
    vi.useFakeTimers();
    render(<FlagNotice flagNo={1} max={3} />);
    expect(screen.getByRole("status")).toHaveTextContent("Flag 1 of 3 – please keep your eyes on the screen.");
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("status").firstElementChild).toHaveAttribute("data-visible", "false");
    vi.useRealTimers();
  });

  it("shows nothing after the limit", () => {
    render(<FlagNotice flagNo={4} max={3} />);
    expect(screen.getByRole("status")).not.toHaveTextContent("Flag");
  });

  it("hides immediately when going from flag 3 to post-limit", () => {
    vi.useFakeTimers();
    const { rerender } = render(<FlagNotice flagNo={3} max={3} />);
    expect(screen.getByRole("status")).toHaveTextContent("Flag 3 of 3");
    rerender(<FlagNotice flagNo={4} max={3} />);
    expect(screen.getByRole("status")).not.toHaveTextContent("Flag");
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByRole("status")).not.toHaveTextContent("Flag");
    vi.useRealTimers();
  });
});

describe("TopicChip", () => {
  it("includes the score and a text label, not colour alone", () => {
    render(<TopicChip name="Thermodynamics" cls="weak" scorePct={54} />);
    expect(screen.getByTitle("Weak")).toHaveTextContent("Thermodynamics · 54% (Weak)");
  });
});
