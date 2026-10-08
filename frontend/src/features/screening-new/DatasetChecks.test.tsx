import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { invalidValidation, validValidation } from "../../test/fixtures";
import { DatasetChecks } from "./DatasetChecks";
import { precheckFile } from "./useNewScreening";

describe("DatasetChecks", () => {
  it("summarises a validated dataset", () => {
    render(<DatasetChecks validation={validValidation} />);
    expect(screen.getByText(/Dataset validated/)).toBeInTheDocument();
    expect(screen.getByText("998")).toBeInTheDocument(); // usable records
    expect(screen.getByText("37")).toBeInTheDocument(); // windows
    expect(screen.getByText("CSV readable")).toBeInTheDocument();
    expect(screen.getByText(/2 row\(s\) are unusable/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains missing columns with expected / found lists and hints", () => {
    render(<DatasetChecks validation={invalidValidation} />);
    expect(screen.getByText(/Dataset cannot be analyzed yet/)).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Missing required column")).toBeInTheDocument();
    expect(within(alert).getByText(/was not found/)).toHaveTextContent("collectorEmitterCurrent was not found");
    expect(within(alert).getByText(/Similar column in file/)).toHaveTextContent("collectorCurrent");
    expect(within(alert).getByText("Expected")).toBeInTheDocument();
    expect(within(alert).getByText("Found in file")).toBeInTheDocument();
  });

  it("marks later checks as not evaluated after a failure", () => {
    render(<DatasetChecks validation={invalidValidation} />);
    expect(screen.getAllByText("Not evaluated:").length).toBeGreaterThan(0);
  });
});

describe("precheckFile", () => {
  it("rejects non-CSV and empty files before any request", () => {
    expect(precheckFile(new File(["x"], "data.xlsx"))?.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(precheckFile(new File([], "data.csv"))?.code).toBe("EMPTY_FILE");
    expect(precheckFile(new File(["a,b"], "DATA.CSV"))).toBeNull();
  });
});
