import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "../api/errors";
import { BackendStatusProvider } from "../hooks/useBackendStatus";
import { invalidValidation, makeResult, validValidation } from "../test/fixtures";
import NewScreeningPage from "./NewScreeningPage";

vi.mock("../api/health", () => ({ getHealth: vi.fn(async () => ({ status: "ok", app: "BurnInWatch API", version: "0.1.0", time: "", models: { response_focused: true, expanded: true } })) }));
vi.mock("../api/models", () => ({
  getModels: vi.fn(async () => ({
    default_model: "response_focused",
    models: [
      { name: "response_focused", version: "v2", description: "20 features.", is_default: true, feature_count: 20, features: [], window_size: 100, stride: 25, artifacts_available: true, missing_artifacts: [], loaded: false, thresholds: null },
      { name: "expanded", version: "v2", description: "31 features.", is_default: false, feature_count: 31, features: [], window_size: 100, stride: 25, artifacts_available: true, missing_artifacts: [], loaded: false, thresholds: null },
    ],
  })),
}));
vi.mock("../api/datasets", () => ({ validateDataset: vi.fn() }));
vi.mock("../api/screenings", () => ({ analyzeScreening: vi.fn() }));

import { validateDataset } from "../api/datasets";
import { analyzeScreening } from "../api/screenings";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/screenings/new"]}>
      <BackendStatusProvider>
        <Routes>
          <Route path="/screenings/new" element={<NewScreeningPage />} />
          <Route path="/screenings/:id" element={<div>RESULT PAGE</div>} />
        </Routes>
      </BackendStatusProvider>
    </MemoryRouter>,
  );
}

const csv = () => new File(["timeEpoch\n1"], "burnin_test.csv", { type: "text/csv" });
const startButton = () => screen.getByRole("button", { name: /start screening/i });

describe("New screening flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts empty with a disabled Start button and a clear empty state", async () => {
    renderPage();
    expect(screen.getByText("No dataset selected")).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
    expect(screen.getByText("Upload a dataset to begin.")).toBeInTheDocument();
  });

  it("validates the dataset, requires a device ID, then runs the analysis and opens the result", async () => {
    vi.mocked(validateDataset).mockResolvedValue(validValidation);
    vi.mocked(analyzeScreening).mockResolvedValue(makeResult([[false, false]]));
    const user = userEvent.setup();
    renderPage();

    await user.upload(screen.getByLabelText(/choose burn-in dataset csv/i), csv());
    expect(await screen.findByText(/Dataset validated/)).toBeInTheDocument();
    expect(validateDataset).toHaveBeenCalledOnce();
    expect(startButton()).toBeDisabled();
    expect(screen.getByText("Enter a valid device ID.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Device ID"), "IGBT-001");
    await waitFor(() => expect(startButton()).toBeEnabled());

    await user.click(startButton());
    await waitFor(() => expect(screen.getByText("RESULT PAGE")).toBeInTheDocument());
    expect(analyzeScreening).toHaveBeenCalledWith(expect.objectContaining({ deviceId: "IGBT-001", model: "response_focused" }));
  });

  it("blocks analysis for a dataset that failed validation and explains why", async () => {
    vi.mocked(validateDataset).mockResolvedValue(invalidValidation);
    const user = userEvent.setup();
    renderPage();
    await user.upload(screen.getByLabelText(/choose burn-in dataset csv/i), csv());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Missing required column");
    expect(alert).toHaveTextContent("collectorEmitterCurrent was not found");
    await user.type(screen.getByLabelText("Device ID"), "IGBT-001");
    expect(startButton()).toBeDisabled();
    expect(screen.getByText("This dataset did not pass validation.")).toBeInTheDocument();
  });

  it("shows a polished error when validation cannot reach the backend", async () => {
    vi.mocked(validateDataset).mockRejectedValue(new ApiError("network", "No response"));
    const user = userEvent.setup();
    renderPage();
    await user.upload(screen.getByLabelText(/choose burn-in dataset csv/i), csv());
    expect(await screen.findByText("Unable to connect to BurnInWatch")).toBeInTheDocument();
  });

  it("keeps the configuration and offers a retry when the analysis fails", async () => {
    vi.mocked(validateDataset).mockResolvedValue(validValidation);
    vi.mocked(analyzeScreening).mockRejectedValue(new ApiError("http", "boom", { status: 500, code: "INTERNAL_ERROR" }));
    const user = userEvent.setup();
    renderPage();
    await user.upload(screen.getByLabelText(/choose burn-in dataset csv/i), csv());
    await screen.findByText(/Dataset validated/);
    await user.type(screen.getByLabelText("Device ID"), "D1");
    await user.click(startButton());
    expect(await screen.findByText("Something went wrong while processing the screening")).toBeInTheDocument();
    expect(screen.getByText("The screening was not completed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry screening/i })).toBeInTheDocument();
    expect((screen.getByLabelText("Device ID") as HTMLInputElement).value).toBe("D1");
  });
});
