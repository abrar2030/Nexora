import { render, waitFor } from "@testing-library/react-native";
import React from "react";
import App from "../../App";
import apiService from "../services/api";

jest.mock("../services/api");

const user = { id: "u1", full_name: "Ada Lovelace", email: "ada@x.org" };

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiService.getAuthToken.mockResolvedValue(null);
    apiService.setUnauthorizedHandler.mockImplementation(() => {});
    apiService.getDashboardData.mockResolvedValue({
      stats: {
        activePatients: 10,
        highRiskPatients: 2,
        avgLengthOfStay: 4.2,
        activeModels: 3,
      },
      patientRiskDistribution: { highRisk: 20, mediumRisk: 30, lowRisk: 50 },
    });
    apiService.getPatients.mockResolvedValue([]);
    apiService.getNotifications.mockResolvedValue({
      notifications: [],
      unread: 0,
    });
    apiService.getModels.mockResolvedValue([]);
  });

  it("shows the public homepage to signed-out users", async () => {
    const { findByText } = render(<App />);

    expect(await findByText("Clinical Prediction System")).toBeTruthy();
    expect(apiService.getCurrentUser).not.toHaveBeenCalled();
  });

  it("restores a stored session and opens the main tabs", async () => {
    apiService.getAuthToken.mockResolvedValue("stored-token");
    apiService.getCurrentUser.mockResolvedValue(user);
    const { findAllByText, queryByText } = render(<App />);

    expect((await findAllByText("Dashboard")).length).toBeGreaterThan(0);
    expect(queryByText("Clinical Prediction System")).toBeNull();
    for (const tab of ["Patients", "Models", "Alerts", "Settings"]) {
      expect((await findAllByText(tab)).length).toBeGreaterThan(0);
    }
  });

  it("falls back to the homepage when the stored token is rejected", async () => {
    apiService.getAuthToken.mockResolvedValue("stale-token");
    apiService.getCurrentUser.mockRejectedValue(new Error("401"));
    const { findByText } = render(<App />);

    expect(await findByText("Clinical Prediction System")).toBeTruthy();
    await waitFor(() =>
      expect(apiService.setAuthToken).toHaveBeenCalledWith(null),
    );
  });
});
