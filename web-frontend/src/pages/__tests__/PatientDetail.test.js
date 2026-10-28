import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router-dom";
import api from "../../services/api";
import { renderWithProviders } from "../../test-utils";
import PatientDetail from "../PatientDetail";

jest.mock("../../services/api");

const patient = {
  id: "P00001",
  name: "John Smith",
  age: 58,
  dob: "1967-05-12",
  gender: "Male",
  phone: "(555) 123-4567",
  email: "john@example.com",
  address: "123 Main St",
  primaryDiagnosis: "Type 2 Diabetes",
  riskScore: 0.75,
  riskBand: "high",
  labResults: [
    { date: "2025-01-10", glucose: 150, hemoglobin: 13.1 },
    { date: "2025-02-10", glucose: 142, hemoglobin: 13.4 },
  ],
  diagnoses: [
    { name: "Type 2 Diabetes", code: "E11.9", date: "2020-01-01" },
    { name: "Hypertension", code: "I10", date: "2021-06-15" },
  ],
  riskFactors: [
    { name: "HbA1c", impact: 0.32 },
    { name: "Age", impact: 0.18 },
  ],
  interventions: [
    {
      name: "Medication review",
      description: "Review current regimen",
      priority: "High",
    },
  ],
  medications: [
    { name: "Metformin", dosage: "1000mg", frequency: "Twice daily" },
  ],
  timeline: [
    { title: "Admission", date: "2025-01-01", description: "Admitted" },
    { title: "Discharge", date: "2025-01-05", description: "Discharged" },
  ],
};

const renderDetail = (route = "/patients/P00001") =>
  renderWithProviders(<PatientDetail />, {
    route,
    path: "/patients/:id",
    extraRoutes: (
      <Route path="/patients" element={<div>Patient list page</div>} />
    ),
  });

describe("PatientDetail", () => {
  let consoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    api.getPatientDetail.mockResolvedValue(patient);
  });

  afterEach(() => consoleError.mockRestore());

  it("shows a loading state then fetches the patient from the URL id", async () => {
    renderDetail();

    expect(screen.getByText("Loading patient record…")).toBeInTheDocument();
    expect(await screen.findByText("John Smith")).toBeInTheDocument();
    expect(api.getPatientDetail).toHaveBeenCalledWith("P00001");
  });

  it("renders the patient summary", async () => {
    renderDetail();

    expect(
      await screen.findByRole("heading", { name: "Patient Details" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ID: P00001")).toBeInTheDocument();
    expect(screen.getByText("58 years (1967-05-12)")).toBeInTheDocument();
    expect(screen.getByText("Male")).toBeInTheDocument();
    expect(screen.getByText("75% Risk")).toBeInTheDocument();
    expect(screen.getByText(/\(555\) 123-4567/)).toBeInTheDocument();
    expect(screen.getByText(/john@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
  });

  it("shows initials in the avatar", async () => {
    renderDetail();

    expect(await screen.findByText("JS")).toBeInTheDocument();
  });

  it("copes with missing optional fields", async () => {
    api.getPatientDetail.mockResolvedValue({
      ...patient,
      age: null,
      dob: null,
      riskScore: null,
      riskBand: null,
      labResults: undefined,
      diagnoses: undefined,
      interventions: undefined,
      medications: undefined,
      timeline: undefined,
    });
    renderDetail();

    expect(await screen.findByText("Not scored")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
    expect(screen.queryByText(/NaN|null/)).not.toBeInTheDocument();
    // All tabs still render without throwing.
    for (const tab of ["Risk Analysis", "Medications", "Timeline"]) {
      await userEvent.click(screen.getByRole("tab", { name: tab }));
    }
  });

  it("shows lab results and diagnoses on the first tab", async () => {
    renderDetail();

    expect(await screen.findByText("Lab Results")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toHaveAttribute(
      "data-labels",
      JSON.stringify(["2025-01-10", "2025-02-10"]),
    );
    expect(screen.getByText("Hypertension")).toBeInTheDocument();
    expect(
      screen.getByText("Diagnosed: 2021-06-15 | ICD-10: I10"),
    ).toBeInTheDocument();
  });

  it("shows risk factors and interventions on the Risk Analysis tab", async () => {
    renderDetail();
    await screen.findByText("John Smith");

    await userEvent.click(screen.getByRole("tab", { name: "Risk Analysis" }));

    expect(screen.getByText("Risk Factor Impact (SHAP)")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toHaveAttribute(
      "data-labels",
      JSON.stringify(["HbA1c", "Age"]),
    );
    expect(screen.getByText("Medication review")).toBeInTheDocument();
    expect(screen.getByText("Review current regimen")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("lists medications on the Medications tab", async () => {
    renderDetail();
    await screen.findByText("John Smith");

    await userEvent.click(screen.getByRole("tab", { name: "Medications" }));

    expect(screen.getByText("Metformin")).toBeInTheDocument();
    expect(screen.getByText("1000mg")).toBeInTheDocument();
    expect(screen.getByText("Frequency: Twice daily")).toBeInTheDocument();
  });

  it("marks the newest event on the Timeline tab", async () => {
    renderDetail();
    await screen.findByText("John Smith");

    await userEvent.click(screen.getByRole("tab", { name: "Timeline" }));

    expect(screen.getByText("Admission")).toBeInTheDocument();
    expect(screen.getByText("Discharge")).toBeInTheDocument();
    expect(screen.getAllByText("Latest")).toHaveLength(1);
    expect(screen.getByText("2025-01-05: Discharged")).toBeInTheDocument();
  });

  it("recomputes the risk score and updates the page", async () => {
    api.recomputeRisk.mockResolvedValue({
      ...patient,
      riskScore: 0.9,
      riskBand: "high",
    });
    renderDetail();
    await screen.findByText("John Smith");

    await userEvent.click(
      screen.getByRole("button", { name: "Recompute Risk Score" }),
    );

    expect(api.recomputeRisk).toHaveBeenCalledWith("P00001");
    expect(
      await screen.findByText("Risk score refreshed: 90% (high risk)."),
    ).toBeInTheDocument();
    expect(screen.getByText("90% Risk")).toBeInTheDocument();
  });

  it("reports a failed recompute and keeps the existing record", async () => {
    api.recomputeRisk.mockRejectedValue(new Error("nope"));
    renderDetail();
    await screen.findByText("John Smith");

    await userEvent.click(
      screen.getByRole("button", { name: "Recompute Risk Score" }),
    );

    expect(
      await screen.findByText(
        "Failed to recompute risk score. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("75% Risk")).toBeInTheDocument();
  });

  it("shows demo feedback for download and scheduling", async () => {
    renderDetail();
    await screen.findByText("John Smith");

    await userEvent.click(
      screen.getByRole("button", { name: "Download Records" }),
    );
    expect(
      await screen.findByText("Downloading patient records… (demo)"),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Schedule Follow-up" }),
    );
    expect(
      await screen.findByText("Follow-up scheduling opened (demo)"),
    ).toBeInTheDocument();
  });

  it("goes back to the patient list", async () => {
    renderDetail();
    await screen.findByText("John Smith");

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText("Patient list page")).toBeInTheDocument();
  });

  it("shows an error and retries by refetching (without a page reload)", async () => {
    api.getPatientDetail.mockRejectedValueOnce(new Error("API Error"));
    renderDetail();

    expect(
      await screen.findByText(
        "Failed to load patient details. Please try again.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("John Smith")).toBeInTheDocument();
    expect(api.getPatientDetail).toHaveBeenCalledTimes(2);
  });

  it("explains when the patient does not exist", async () => {
    api.getPatientDetail.mockResolvedValue(null);
    renderDetail("/patients/P99999");

    expect(
      await screen.findByText("Patient record not found for ID: P99999"),
    ).toBeInTheDocument();
  });
});
