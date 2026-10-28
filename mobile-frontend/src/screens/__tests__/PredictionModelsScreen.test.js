import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import apiService from "../../services/api";
import PredictionModelsScreen from "../PredictionModelsScreen";

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

const runFor = async (utils, patientId) => {
  fireEvent.changeText(
    await utils.findByPlaceholderText("e.g. P00001"),
    patientId,
  );
  fireEvent.press(utils.getByText("Run Prediction"));
};

describe("PredictionModelsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiService.getModels.mockResolvedValue(models);
  });

  it("lists the registered models", async () => {
    const utils = render(<PredictionModelsScreen />);

    expect(await utils.findByText("Deep Fm")).toBeTruthy();
    expect(utils.getByText("Version 1.2.0")).toBeTruthy();
    expect(utils.getByText("Survival Analysis")).toBeTruthy();
  });

  it("shows the error when models cannot be loaded", async () => {
    apiService.getModels.mockRejectedValue(new Error("Registry offline"));
    const utils = render(<PredictionModelsScreen />);

    expect(await utils.findByText("Registry offline")).toBeTruthy();
  });

  it("asks for a patient id before running", async () => {
    const utils = render(<PredictionModelsScreen />);
    await utils.findByText("Deep Fm");

    fireEvent.press(utils.getByText("Run Prediction"));

    expect(
      utils.getByText("Enter a patient ID to run a prediction."),
    ).toBeTruthy();
    expect(apiService.makePrediction).not.toHaveBeenCalled();
  });

  it("runs a prediction with the selected model and shows the score", async () => {
    apiService.makePrediction.mockResolvedValue({
      predictions: { risk_score: 0.425, top_features: ["HbA1c", "Age"] },
    });
    const utils = render(<PredictionModelsScreen />);
    await utils.findByText("Deep Fm");

    fireEvent.press(utils.getByText("Survival Analysis"));
    await runFor(utils, " P7 ");

    expect(await utils.findByText("42.5%")).toBeTruthy();
    expect(utils.getByText("HbA1c, Age")).toBeTruthy();
    expect(apiService.makePrediction).toHaveBeenCalledWith(
      "survival_analysis",
      undefined,
      { patient_id: "P7", demographics: {}, clinical_events: [] },
    );
  });

  it("shows N/A rather than 0.0% when the model returns no score", async () => {
    apiService.makePrediction.mockResolvedValue({ predictions: {} });
    const utils = render(<PredictionModelsScreen />);
    await utils.findByText("Deep Fm");

    await runFor(utils, "P1");

    expect(await utils.findByText("N/A")).toBeTruthy();
    expect(utils.queryByText(/0\.0%/)).toBeNull();
  });

  it("shows the API error when a prediction fails", async () => {
    apiService.makePrediction.mockRejectedValue(new Error("Model not loaded"));
    const utils = render(<PredictionModelsScreen />);
    await utils.findByText("Deep Fm");

    await runFor(utils, "P1");

    await waitFor(() =>
      expect(utils.getByText("Model not loaded")).toBeTruthy(),
    );
  });
});
