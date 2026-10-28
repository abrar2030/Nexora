import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import api from "../../services/api";
import { renderWithProviders } from "../../test-utils";
import PredictionModels from "../PredictionModels";

jest.mock("../../services/api");

const models = [
  {
    name: "deep_fm",
    displayName: "Deep Fm",
    version: "1.2.0",
    status: "Active",
  },
  {
    name: "survival_analysis",
    displayName: "Survival Analysis",
    version: "1.0.5",
    status: "Active",
  },
];

const patients = [
  { id: "P1", name: "John Smith", age: 58, gender: "Male", diagnosis: "T2D" },
  { id: "P2", name: "Jane Roe", age: 44, gender: "Female", diagnosis: "HTN" },
];

const prediction = {
  request_id: "req-123",
  model_name: "deep_fm",
  model_version: "1.2.0",
  timestamp: "2025-03-15T10:00:00Z",
  predictions: { risk_score: 0.425, top_features: ["HbA1c", "Age"] },
};

const openRunTab = async () => {
  await screen.findByRole("heading", { name: "Prediction Models" });
  await userEvent.click(screen.getByRole("tab", { name: "Run Prediction" }));
};

describe("PredictionModels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getModels.mockResolvedValue(models);
    api.getDashboardData.mockResolvedValue({
      modelPerformance: {
        labels: ["Deep Fm", "Survival"],
        scores: [0.82, 0.78],
      },
    });
    api.getPatients.mockResolvedValue(patients);
    api.makePrediction.mockResolvedValue(prediction);
  });

  it("shows a loading state first", async () => {
    renderWithProviders(<PredictionModels />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("Loading prediction models…")).toBeInTheDocument();
    await screen.findByRole("heading", { name: "Prediction Models" });
  });

  it("lists the registered models", async () => {
    renderWithProviders(<PredictionModels />);

    expect(await screen.findByText("Available Models")).toBeInTheDocument();
    expect(screen.getByText("Version 1.2.0")).toBeInTheDocument();
    expect(screen.getByText("Version 1.0.5")).toBeInTheDocument();
    expect(screen.getByText("Survival Analysis")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(2);
  });

  it("selects the first model and shows its overview", async () => {
    renderWithProviders(<PredictionModels />);

    expect(
      await screen.findByRole("heading", { name: "Deep Fm" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Factorization-machine/)).toBeInTheDocument();
    expect(screen.getByText("1.2.0")).toBeInTheDocument();
  });

  it("switches the overview when another model is chosen", async () => {
    renderWithProviders(<PredictionModels />);
    await screen.findByRole("heading", { name: "Deep Fm" });

    await userEvent.click(screen.getByText("Survival Analysis"));

    expect(
      screen.getByRole("heading", { name: "Survival Analysis" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Time-to-event survival model/),
    ).toBeInTheDocument();
  });

  it("plots model performance from the dashboard data", async () => {
    renderWithProviders(<PredictionModels />);

    expect(await screen.findByTestId("bar-chart")).toHaveAttribute(
      "data-labels",
      JSON.stringify(["Deep Fm", "Survival"]),
    );
  });

  it("says performance is unavailable when it cannot be loaded", async () => {
    api.getDashboardData.mockRejectedValue(new Error("down"));
    renderWithProviders(<PredictionModels />);

    expect(
      await screen.findByText("Performance metrics unavailable."),
    ).toBeInTheDocument();
  });

  it("shows an empty state when no models are registered", async () => {
    api.getModels.mockResolvedValue([]);
    renderWithProviders(<PredictionModels />);

    expect(
      await screen.findByText("No models are currently registered."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Select a model from the list to see details."),
    ).toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    api.getModels.mockRejectedValueOnce(new Error("Registry offline"));
    renderWithProviders(<PredictionModels />);

    expect(await screen.findByText("Registry offline")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Available Models")).toBeInTheDocument();
    expect(api.getModels).toHaveBeenCalledTimes(2);
  });

  it("refreshes the model list", async () => {
    renderWithProviders(<PredictionModels />);
    await screen.findByText("Available Models");

    await userEvent.click(screen.getByLabelText("refresh"));

    await waitFor(() => expect(api.getModels).toHaveBeenCalledTimes(2));
  });

  it("asks for a patient before running a prediction", async () => {
    renderWithProviders(<PredictionModels />);
    await openRunTab();

    await userEvent.click(
      screen.getByRole("button", { name: "Run Prediction" }),
    );

    expect(
      screen.getByText("Choose a patient or enter a patient ID."),
    ).toBeInTheDocument();
    expect(api.makePrediction).not.toHaveBeenCalled();
  });

  it("runs a prediction for a manually entered patient id", async () => {
    renderWithProviders(<PredictionModels />);
    await openRunTab();

    await userEvent.type(
      screen.getByLabelText("…or enter a patient ID"),
      " P77 ",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Run Prediction" }),
    );

    await waitFor(() =>
      expect(api.makePrediction).toHaveBeenCalledWith("deep_fm", undefined, {
        patient_id: "P77",
        demographics: {},
        clinical_events: [],
      }),
    );
    expect(await screen.findByText("42.5%")).toBeInTheDocument();
    expect(screen.getByText("HbA1c")).toBeInTheDocument();
    expect(screen.getByText(/Request ID: req-123/)).toBeInTheDocument();
  });

  it("sends demographics when an existing patient is selected", async () => {
    renderWithProviders(<PredictionModels />);
    await openRunTab();

    await userEvent.click(screen.getByLabelText("Search existing patient"));
    await userEvent.click(await screen.findByText("Jane Roe (P2)"));
    await userEvent.click(
      screen.getByRole("button", { name: "Run Prediction" }),
    );

    await waitFor(() =>
      expect(api.makePrediction).toHaveBeenCalledWith("deep_fm", undefined, {
        patient_id: "P2",
        demographics: { age: 44, gender: "Female", diagnosis: "HTN" },
        clinical_events: [],
      }),
    );
  });

  it("shows N/A rather than 0.0% when the model returns no score", async () => {
    api.makePrediction.mockResolvedValue({ ...prediction, predictions: {} });
    renderWithProviders(<PredictionModels />);
    await openRunTab();

    await userEvent.type(screen.getByLabelText("…or enter a patient ID"), "P1");
    await userEvent.click(
      screen.getByRole("button", { name: "Run Prediction" }),
    );

    expect(await screen.findByText("N/A")).toBeInTheDocument();
    expect(screen.queryByText("0.0%")).not.toBeInTheDocument();
  });

  it("shows the API error when a prediction fails", async () => {
    api.makePrediction.mockRejectedValue(new Error("Model not loaded"));
    renderWithProviders(<PredictionModels />);
    await openRunTab();

    await userEvent.type(screen.getByLabelText("…or enter a patient ID"), "P1");
    await userEvent.click(
      screen.getByRole("button", { name: "Run Prediction" }),
    );

    expect(await screen.findByText("Model not loaded")).toBeInTheDocument();
  });
});
