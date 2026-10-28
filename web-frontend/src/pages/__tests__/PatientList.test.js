import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router-dom";
import api from "../../services/api";
import { renderWithProviders } from "../../test-utils";
import PatientList from "../PatientList";

jest.mock("../../services/api");

const patients = [
  {
    id: "P00001",
    name: "John Smith",
    age: 58,
    gender: "Male",
    diagnosis: "Type 2 Diabetes",
    riskScore: 0.75,
    lastVisit: "2025-03-15",
  },
  {
    id: "P00002",
    name: "Sarah Johnson",
    age: 45,
    gender: "Female",
    diagnosis: "Hypertension",
    riskScore: 0.35,
    lastVisit: "2025-03-10",
  },
  {
    id: "P00003",
    name: "Robert Williams",
    age: null,
    gender: null,
    diagnosis: "Heart Failure",
    riskScore: null,
    lastVisit: null,
  },
];

const renderList = (route = "/patients") =>
  renderWithProviders(<PatientList />, {
    route,
    path: "/patients",
    extraRoutes: (
      <Route path="/patients/:id" element={<div>Patient detail page</div>} />
    ),
  });

describe("PatientList", () => {
  let consoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    api.getPatients.mockResolvedValue(patients);
  });

  afterEach(() => consoleError.mockRestore());

  it("renders the title and a loading state first", async () => {
    renderList();

    expect(
      screen.getByRole("heading", { name: "Patient List" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    await screen.findByText("John Smith");
  });

  it("lists patients with their details", async () => {
    renderList();

    expect(await screen.findByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("Sarah Johnson")).toBeInTheDocument();
    expect(screen.getByText("P00001")).toBeInTheDocument();
    expect(screen.getByText("Type 2 Diabetes")).toBeInTheDocument();
    expect(screen.getByText("2025-03-15")).toBeInTheDocument();
  });

  it("shows risk chips with the right band", async () => {
    renderList();

    expect(await screen.findByText("75% High")).toBeInTheDocument();
    expect(screen.getByText("35% Low")).toBeInTheDocument();
  });

  it("shows 'Not scored' for patients without a risk score", async () => {
    renderList();

    expect(await screen.findByText("Not scored")).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText("0% Low")).not.toBeInTheDocument();
  });

  it("filters by search text across name, id and diagnosis", async () => {
    renderList();
    await screen.findByText("John Smith");
    const search = screen.getByPlaceholderText(/search/i);

    await userEvent.type(search, "hypertension");
    expect(screen.getByText("Sarah Johnson")).toBeInTheDocument();
    expect(screen.queryByText("John Smith")).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, "P00001");
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.queryByText("Sarah Johnson")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    renderList();
    await screen.findByText("John Smith");

    await userEvent.type(screen.getByPlaceholderText(/search/i), "zzzz");

    expect(screen.getByText(/no patients/i)).toBeInTheDocument();
  });

  it("applies the risk filter from the URL", async () => {
    renderList("/patients?risk=high");

    expect(await screen.findByText("John Smith")).toBeInTheDocument();
    expect(screen.queryByText("Sarah Johnson")).not.toBeInTheDocument();
    // Unscored patients never match a risk-band filter.
    expect(screen.queryByText("Robert Williams")).not.toBeInTheDocument();
  });

  it("filters by gender without crashing on patients with no gender", async () => {
    renderList();
    await screen.findByText("John Smith");

    await userEvent.click(screen.getByRole("button", { name: /filter/i }));
    const dialog = await screen.findByRole("dialog");
    const selects = within(dialog).getAllByRole("combobox");
    // Gender is the second select in the dialog (risk level is the first).
    await userEvent.click(selects[1]);
    await userEvent.click(await screen.findByRole("option", { name: "Male" }));
    await userEvent.click(
      within(dialog).getByRole("button", { name: /apply/i }),
    );

    await waitFor(() =>
      expect(screen.queryByText("Sarah Johnson")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.queryByText("Robert Williams")).not.toBeInTheDocument();
  });

  it("opens a patient's detail page when a row is clicked", async () => {
    renderList();

    await userEvent.click(await screen.findByText("Sarah Johnson"));

    expect(await screen.findByText("Patient detail page")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/patients/P00002",
    );
  });

  it("validates the add-patient form", async () => {
    renderList();
    await screen.findByText("John Smith");

    await userEvent.click(screen.getByRole("button", { name: /add patient/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /add patient/i }),
    );

    expect(
      await within(dialog).findByText(/name is required/i),
    ).toBeInTheDocument();
    expect(api.addPatient).not.toHaveBeenCalled();
  });

  it("adds a patient and reports the computed risk score", async () => {
    api.addPatient.mockResolvedValue({
      id: "P00004",
      name: "Jane Doe",
      riskScore: 0.4,
      gender: "Female",
    });
    renderList();
    await screen.findByText("John Smith");

    await userEvent.click(screen.getByRole("button", { name: /add patient/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: /full name/i }),
      "Jane Doe",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: /add patient/i }),
    );

    await waitFor(() => expect(api.addPatient).toHaveBeenCalledTimes(1));
    expect(api.addPatient.mock.calls[0][0]).toMatchObject({ name: "Jane Doe" });
    expect(
      await screen.findByText(
        "Jane Doe was added with a computed risk score of 40%.",
      ),
    ).toBeInTheDocument();
  });

  it("does not print NaN when a new patient has no score yet", async () => {
    api.addPatient.mockResolvedValue({ id: "P00005", name: "No Score" });
    renderList();
    await screen.findByText("John Smith");

    await userEvent.click(screen.getByRole("button", { name: /add patient/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: /full name/i }),
      "No Score",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: /add patient/i }),
    );

    expect(await screen.findByText("No Score was added.")).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("shows an error with a retry that reloads the list", async () => {
    api.getPatients.mockRejectedValueOnce(new Error("API Error"));
    renderList();

    expect(
      await screen.findByText("Failed to load patient list. Please try again."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("John Smith")).toBeInTheDocument();
    expect(api.getPatients).toHaveBeenCalledTimes(2);
  });
});
