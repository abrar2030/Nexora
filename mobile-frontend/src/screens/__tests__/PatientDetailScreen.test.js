import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { mockPatientDetails } from "../../__mocks__/mockData";
import apiService from "../../services/api";
import PatientDetailScreen from "../PatientDetailScreen";

jest.mock("../../services/api");

const route = { params: { patientId: "p001", patientName: "John Doe" } };
const navigation = { setOptions: jest.fn(), navigate: jest.fn() };

const renderScreen = () =>
  render(<PatientDetailScreen route={route} navigation={navigation} />);

describe("PatientDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiService.getPatientDetails.mockResolvedValue(mockPatientDetails);
  });

  it("loads the patient named in the route", async () => {
    const { findByTestId } = renderScreen();

    expect(await findByTestId("patient-details")).toBeTruthy();
    expect(apiService.getPatientDetails).toHaveBeenCalledWith("p001");
    expect(navigation.setOptions).toHaveBeenCalledWith({ title: "John Doe" });
  });

  it("shows the risk score, band and patient summary", async () => {
    const { findByTestId, getByText } = renderScreen();

    expect((await findByTestId("risk-score")).props.children).toBe("75%");
    expect(getByText("High risk")).toBeTruthy();
    expect((await findByTestId("patient-name")).props.children).toBe(
      "John Doe · Age 65 · Male",
    );
  });

  it("lists risk factors, interventions and medications", async () => {
    const { findByText, getByText } = renderScreen();

    expect(await findByText("Prior admissions")).toBeTruthy();
    expect(getByText("30%")).toBeTruthy();
    expect(getByText("Medication review")).toBeTruthy();
    expect(getByText("Review regimen")).toBeTruthy();
    expect(getByText("Metformin: 1000mg, Twice daily")).toBeTruthy();
  });

  it("shows the patient timeline", async () => {
    const { findByTestId, getByText } = renderScreen();

    expect(await findByTestId("clinical-history-list")).toBeTruthy();
    expect(getByText("Admission")).toBeTruthy();
    expect(getByText("2024-04-18")).toBeTruthy();
  });

  it("shows placeholders when sections are empty", async () => {
    apiService.getPatientDetails.mockResolvedValue({
      ...mockPatientDetails,
      riskFactors: [],
      interventions: [],
      medications: [],
      timeline: [],
    });
    const { findByText, getByText } = renderScreen();

    expect(await findByText("No risk factor data available.")).toBeTruthy();
    expect(getByText("No interventions recommended.")).toBeTruthy();
    expect(getByText("No medications on record.")).toBeTruthy();
    expect(getByText("No timeline data available.")).toBeTruthy();
  });

  it("copes with a patient that has no score, age or gender", async () => {
    apiService.getPatientDetails.mockResolvedValue({
      ...mockPatientDetails,
      riskScore: null,
      riskBand: null,
      age: null,
      gender: null,
    });
    const { findByTestId, getByText, queryByText } = renderScreen();

    expect((await findByTestId("risk-score")).props.children).toBe("N/A");
    expect(getByText("Unknown risk")).toBeTruthy();
    expect((await findByTestId("patient-name")).props.children).toBe(
      "John Doe",
    );
    expect(queryByText(/null|NaN/)).toBeNull();
  });

  it("shows an error with a retry when loading fails", async () => {
    apiService.getPatientDetails.mockRejectedValueOnce(
      new Error("Server down"),
    );
    const { findByTestId, getByText, findByText } = renderScreen();

    expect((await findByTestId("error-message")).props.children).toBe(
      "Server down",
    );

    fireEvent.press(getByText("Retry"));

    expect(await findByText("Prior admissions")).toBeTruthy();
    expect(apiService.getPatientDetails).toHaveBeenCalledTimes(2);
  });

  it("recomputes the risk score and shows the new value", async () => {
    apiService.recomputeRisk.mockResolvedValue({
      ...mockPatientDetails,
      riskScore: 0.9,
    });
    const { findByText, findByTestId } = renderScreen();

    fireEvent.press(await findByText("Recompute Risk Score"));

    await waitFor(async () =>
      expect((await findByTestId("risk-score")).props.children).toBe("90%"),
    );
    expect(apiService.recomputeRisk).toHaveBeenCalledWith("p001");
  });

  it("shows an error, keeping the record, when recompute fails", async () => {
    apiService.recomputeRisk.mockRejectedValue(new Error("Model unavailable"));
    const { findByText, findByTestId, getByTestId } = renderScreen();

    fireEvent.press(await findByText("Recompute Risk Score"));

    expect((await findByTestId("recompute-error")).props.children).toBe(
      "Model unavailable",
    );
    expect(getByTestId("risk-score").props.children).toBe("75%");
  });
});
