import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import api from "../../services/api";
import { makeAuth, renderWithProviders } from "../../test-utils";
import Dashboard from "../Dashboard";

jest.mock("../../services/api");

const dashboardData = {
  stats: {
    activePatients: 1284,
    highRiskPatients: 256,
    avgLengthOfStay: 4.2,
    activeModels: 5,
  },
  patientRiskDistribution: { highRisk: 25, mediumRisk: 45, lowRisk: 30 },
  admissionsData: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    admissions: [65, 59, 80, 81, 56, 55],
    readmissions: [28, 48, 40, 19, 36, 27],
  },
  modelPerformance: {
    labels: ["Deep Fm", "Survival Analysis"],
    scores: [0.82, 0.78],
  },
};

describe("Dashboard", () => {
  let consoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    api.getDashboardData.mockResolvedValue(dashboardData);
  });

  afterEach(() => consoleError.mockRestore());

  it("greets the signed-in user by first name", async () => {
    renderWithProviders(<Dashboard />);

    expect(
      await screen.findByRole("heading", { name: "Welcome back, Ada" }),
    ).toBeInTheDocument();
  });

  it("falls back to a generic title without a user name", async () => {
    renderWithProviders(<Dashboard />, { auth: makeAuth({ user: null }) });

    expect(
      await screen.findByRole("heading", { name: "Clinical Dashboard" }),
    ).toBeInTheDocument();
  });

  it("shows a loading indicator until data arrives", async () => {
    renderWithProviders(<Dashboard />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument(),
    );
  });

  it("displays the summary statistics", async () => {
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("1,284")).toBeInTheDocument();
    expect(screen.getByText("256")).toBeInTheDocument();
    expect(screen.getByText("4.2 days")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("19.9% of total patients")).toBeInTheDocument();
  });

  it("labels each stat card", async () => {
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("Active Patients")).toBeInTheDocument();
    expect(screen.getByText("High Risk Patients")).toBeInTheDocument();
    expect(screen.getByText("Avg. Length of Stay")).toBeInTheDocument();
    expect(screen.getByText("Active Models")).toBeInTheDocument();
  });

  it("renders the three chart sections with the API's data", async () => {
    renderWithProviders(<Dashboard />);

    expect(
      await screen.findByText("Admissions & Readmissions Trend"),
    ).toBeInTheDocument();
    expect(screen.getByText("Patient Risk Distribution")).toBeInTheDocument();
    expect(
      screen.getByText("Model Performance Metrics (AUC)"),
    ).toBeInTheDocument();

    expect(screen.getByTestId("line-chart")).toHaveAttribute(
      "data-labels",
      JSON.stringify(dashboardData.admissionsData.labels),
    );
    expect(screen.getByTestId("doughnut-chart")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toHaveAttribute(
      "data-labels",
      JSON.stringify(dashboardData.modelPerformance.labels),
    );
  });

  it("shows 0.0% instead of NaN% when there are no patients", async () => {
    api.getDashboardData.mockResolvedValue({
      ...dashboardData,
      stats: { ...dashboardData.stats, activePatients: 0, highRiskPatients: 0 },
    });
    renderWithProviders(<Dashboard />);

    expect(
      await screen.findByText("0.0% of total patients"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("shows an error with a retry that reloads the data", async () => {
    api.getDashboardData.mockRejectedValueOnce(new Error("API Error"));
    renderWithProviders(<Dashboard />);

    expect(
      await screen.findByText(
        "Failed to load dashboard data. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("1,284")).toBeInTheDocument();
    expect(api.getDashboardData).toHaveBeenCalledTimes(2);
  });

  it("refreshes the data on demand", async () => {
    renderWithProviders(<Dashboard />);
    await screen.findByText("1,284");

    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(api.getDashboardData).toHaveBeenCalledTimes(2));
  });

  it("links to the high-risk patient list", async () => {
    renderWithProviders(<Dashboard />);
    await screen.findByText("1,284");

    await userEvent.click(
      screen.getByRole("button", { name: "View High-Risk Patients" }),
    );

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/patients?risk=high",
    );
  });
});
