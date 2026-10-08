import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../../api/errors";
import { EmptyState, ErrorState, LoadingState, StatusBadge, DataTable } from ".";
import type { ScreeningStatus } from "../../types/api";

describe("StatusBadge", () => {
  it.each<[ScreeningStatus, string]>([
    ["NORMAL", "Normal"],
    ["REVIEW", "Review"],
    ["ANOMALY", "Anomaly"],
  ])("renders %s with a text label and an icon (not colour alone)", (status, label) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector(`[data-status="${status}"]`)).not.toBeNull();
  });
});

describe("EmptyState", () => {
  it("renders title, description and action", () => {
    render(<EmptyState title="No screening runs yet" description="Completed screenings will appear here." action={<button>Go</button>} />);
    expect(screen.getByText("No screening runs yet")).toBeInTheDocument();
    expect(screen.getByText("Completed screenings will appear here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });
});

describe("LoadingState", () => {
  it("is announced as a status with a label", () => {
    render(<LoadingState label="Validating dataset…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Validating dataset…");
  });
});

describe("ErrorState", () => {
  it("shows engineering wording and a retry action, not the raw message", async () => {
    const retry = vi.fn();
    render(<ErrorState error={new ApiError("network", "No response from the server.")} onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to connect to BurnInWatch");
    expect(screen.queryByText("No response from the server.")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("accepts non-ApiError values", () => {
    render(<ErrorState error={new Error("boom")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Request failed");
  });
});

describe("DataTable", () => {
  const cols = [{ key: "a", header: "A", render: (r: { a: number }) => r.a }];
  it("renders an empty state for no rows", () => {
    render(<DataTable caption="t" columns={cols} rows={[]} rowKey={(r) => r.a} empty={<EmptyState title="Nothing here" />} />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
  it("activates rows with click and keyboard", async () => {
    const onRow = vi.fn();
    render(<DataTable caption="t" columns={cols} rows={[{ a: 1 }, { a: 2 }]} rowKey={(r) => r.a} onRowClick={onRow} />);
    await userEvent.click(screen.getByText("2"));
    expect(onRow).toHaveBeenLastCalledWith({ a: 2 });
    screen.getByText("1").closest("tr")?.focus();
    await userEvent.keyboard("{Enter}");
    expect(onRow).toHaveBeenLastCalledWith({ a: 1 });
  });
});
