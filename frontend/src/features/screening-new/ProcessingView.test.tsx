import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProcessingView } from "./ProcessingView";

describe("ProcessingView", () => {
  it("shows real upload progress while uploading", () => {
    render(<ProcessingView stage="uploading" uploadFraction={0.42} startedAt={Date.now()} onCancel={() => {}} />);
    expect(screen.getByRole("progressbar", { name: /upload progress/i })).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByText("Analyzing burn-in data")).toBeInTheDocument();
  });

  it("states that server steps run in a single request instead of faking per-step progress", () => {
    render(<ProcessingView stage="server" uploadFraction={1} startedAt={Date.now()} onCancel={() => {}} />);
    expect(screen.getByText(/single server request/i)).toBeInTheDocument();
    expect(screen.getByText("Generating measurement windows")).toBeInTheDocument();
    expect(screen.getByText(/Analysis on the server/)).toHaveTextContent("in progress");
  });

  it("can be cancelled", async () => {
    const cancel = vi.fn();
    render(<ProcessingView stage="uploading" uploadFraction={0} startedAt={Date.now()} onCancel={cancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalled();
  });
});
