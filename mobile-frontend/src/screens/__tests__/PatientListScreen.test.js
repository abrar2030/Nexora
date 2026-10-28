import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import apiService from "../../services/api";
import PatientListScreen from "../PatientListScreen";

jest.mock("../../services/api");

const patients = [
  { id: "P1", name: "John Smith", age: 58, riskScore: 0.75, lastVisit: null },
  {
    id: "P2",
    name: "Sarah Johnson",
    age: 45,
    riskScore: 0.35,
    lastVisit: null,
  },
  {
    id: "P3",
    name: "Robert Williams",
    age: null,
    riskScore: null,
    lastVisit: null,
  },
  { id: "P4", name: "Maria Garcia", age: 61, riskScore: 0.5, lastVisit: null },
];

const navigation = { navigate: jest.fn() };

const renderList = (route = {}) =>
  render(<PatientListScreen navigation={navigation} route={route} />);

// Names in the order the cards are rendered.
const names = (utils) =>
  utils
    .getAllByTestId(/^patient-item-/)
    .map(
      (card) =>
        patients.find((p) => `patient-item-${p.id}` === card.props.testID).name,
    );

describe("PatientListScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiService.getPatients.mockResolvedValue(patients);
  });

  it("loads and lists patients, highest risk first", async () => {
    const utils = renderList();

    await utils.findByText("John Smith");
    expect(names(utils)).toEqual([
      "John Smith",
      "Maria Garcia",
      "Sarah Johnson",
      "Robert Williams", // unscored patients sort last
    ]);
  });

  it("shows N/A for unscored patients instead of 0%", async () => {
    const utils = renderList();

    await utils.findByText("Robert Williams");
    expect(utils.getByText("N/A")).toBeTruthy();
    expect(utils.getByText("75%")).toBeTruthy();
    expect(utils.queryByText("0%")).toBeNull();
  });

  it("filters by search text on name and id", async () => {
    const utils = renderList();
    await utils.findByText("John Smith");

    fireEvent.changeText(utils.getByTestId("search-input"), "garcia");
    expect(names(utils)).toEqual(["Maria Garcia"]);

    fireEvent.changeText(utils.getByTestId("search-input"), "p2");
    expect(names(utils)).toEqual(["Sarah Johnson"]);
  });

  it("shows an empty state when nothing matches", async () => {
    const utils = renderList();
    await utils.findByText("John Smith");

    fireEvent.changeText(utils.getByTestId("search-input"), "zzzz");

    expect(utils.getByText("No patients match your criteria.")).toBeTruthy();
  });

  it("filters by risk band and excludes unscored patients", async () => {
    const utils = renderList();
    await utils.findByText("John Smith");

    fireEvent.press(utils.getByText("Filter: All Patients"));
    fireEvent.press(utils.getByText("Low Risk (< 40%)"));

    expect(names(utils)).toEqual(["Sarah Johnson"]);
  });

  it("applies the risk filter passed in the route", async () => {
    const utils = renderList({ params: { risk: "high" } });

    await utils.findByText("John Smith");
    expect(names(utils)).toEqual(["John Smith"]);
    expect(utils.getByText("Filter: High Risk (≥ 75%)")).toBeTruthy();
  });

  it("sorts by name and keeps unscored patients last when sorting by risk", async () => {
    const utils = renderList();
    await utils.findByText("John Smith");

    fireEvent.press(utils.getByText("Sort: Risk (High-Low)"));
    fireEvent.press(utils.getByText("Name (A-Z)"));
    expect(names(utils)).toEqual([
      "John Smith",
      "Maria Garcia",
      "Robert Williams",
      "Sarah Johnson",
    ]);

    fireEvent.press(utils.getByText("Sort: Name (A-Z)"));
    fireEvent.press(utils.getByText("Risk (Low-High)"));
    expect(names(utils)).toEqual([
      "Sarah Johnson",
      "Maria Garcia",
      "John Smith",
      "Robert Williams",
    ]);
  });

  it("opens a patient's detail screen", async () => {
    const utils = renderList();
    await utils.findByText("Sarah Johnson");

    fireEvent.press(utils.getByTestId("patient-item-P2"));

    expect(navigation.navigate).toHaveBeenCalledWith("PatientDetail", {
      patientId: "P2",
      patientName: "Sarah Johnson",
    });
  });

  it("validates the add-patient form", async () => {
    const utils = renderList();
    await utils.findByText("John Smith");

    fireEvent.press(utils.getByTestId("add-patient-button"));
    fireEvent.press(utils.getByText("Add Patient"));

    expect(utils.getByText("Patient name is required.")).toBeTruthy();
    expect(apiService.addPatient).not.toHaveBeenCalled();
  });

  it("adds a patient and refreshes the list", async () => {
    apiService.addPatient.mockResolvedValue({ id: "P5", name: "Jane Doe" });
    const utils = renderList();
    await utils.findByText("John Smith");

    fireEvent.press(utils.getByTestId("add-patient-button"));
    fireEvent.changeText(utils.getByPlaceholderText("Jane Doe"), " Jane Doe ");
    fireEvent.changeText(utils.getByPlaceholderText("58"), "44");
    fireEvent.press(utils.getByText("Add Patient"));

    await waitFor(() =>
      expect(apiService.addPatient).toHaveBeenCalledWith({
        name: "Jane Doe",
        age: 44,
        gender: "Female",
        diagnosis: undefined,
      }),
    );
    await waitFor(() =>
      expect(apiService.getPatients).toHaveBeenCalledTimes(2),
    );
    expect(utils.queryByText("Add New Patient")).toBeNull();
  });

  it("shows the API error inside the add form", async () => {
    apiService.addPatient.mockRejectedValue(new Error("Age must be positive"));
    const utils = renderList();
    await utils.findByText("John Smith");

    fireEvent.press(utils.getByTestId("add-patient-button"));
    fireEvent.changeText(utils.getByPlaceholderText("Jane Doe"), "Jane");
    fireEvent.press(utils.getByText("Add Patient"));

    expect(await utils.findByText("Age must be positive")).toBeTruthy();
  });

  it("shows an error with a retry when loading fails", async () => {
    apiService.getPatients.mockRejectedValueOnce(new Error("Server down"));
    const utils = renderList();

    expect(await utils.findByText("Server down")).toBeTruthy();
    fireEvent.press(utils.getByTestId("retry-button"));

    expect(await utils.findByText("John Smith")).toBeTruthy();
    expect(apiService.getPatients).toHaveBeenCalledTimes(2);
  });
});
