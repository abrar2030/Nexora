import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router-dom";
import api from "../../services/api";
import { makeAuth, renderWithProviders } from "../../test-utils";
import Layout from "../Layout";

jest.mock("../../services/api");

const renderLayout = (options = {}) =>
  renderWithProviders(<Layout />, {
    route: "/dashboard",
    extraRoutes: <Route path="/" element={<div>Home page</div>} />,
    ...options,
  });

describe("Layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getNotifications.mockResolvedValue({ notifications: [], unread: 0 });
    api.checkHealth.mockResolvedValue({ status: "healthy" });
  });

  it("renders the app title", async () => {
    renderLayout();

    expect(screen.getByText("NEXORA")).toBeInTheDocument();
    expect(screen.getByText("Clinical Prediction System")).toBeInTheDocument();
    await screen.findByText("All systems operational");
  });

  it("renders every navigation item with the right link", async () => {
    renderLayout();

    const expected = {
      Dashboard: "/dashboard",
      Patients: "/patients",
      Models: "/models",
      Alerts: "/alerts",
      Settings: "/settings",
    };
    Object.entries(expected).forEach(([label, href]) => {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    });
    await screen.findByText("All systems operational");
  });

  it("reports a healthy backend", async () => {
    renderLayout();

    expect(screen.getByText("System Status")).toBeInTheDocument();
    expect(await screen.findByText("All systems operational")).toBeVisible();
  });

  it("reports an unreachable backend", async () => {
    api.checkHealth.mockRejectedValue(new Error("Network Error"));
    renderLayout();

    expect(await screen.findByText("Backend unreachable")).toBeVisible();
  });

  it("shows the unread notification count from the API", async () => {
    api.getNotifications.mockResolvedValue({
      notifications: [{ id: "n1" }, { id: "n2" }, { id: "n3" }],
      unread: 3,
    });
    renderLayout();

    // One badge in the app bar and one on the Alerts nav item.
    await waitFor(() => expect(screen.getAllByText("3")).toHaveLength(2));
  });

  it("falls back to no badge when notifications fail to load", async () => {
    api.getNotifications.mockRejectedValue(new Error("boom"));
    renderLayout();

    await screen.findByText("All systems operational");
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("shows the user's initials and details in the account menu", async () => {
    renderLayout();
    expect(screen.getByText("AL")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("account"));

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@hospital.org")).toBeInTheDocument();
    expect(screen.getByText("Profile & Settings")).toBeInTheDocument();
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("navigates to settings from the account menu", async () => {
    renderLayout();

    await userEvent.click(screen.getByLabelText("account"));
    await userEvent.click(await screen.findByText("Profile & Settings"));

    expect(screen.getByTestId("location")).toHaveTextContent("/settings");
  });

  it("signs out and returns to the home page", async () => {
    const auth = makeAuth();
    renderLayout({ auth });

    await userEvent.click(screen.getByLabelText("account"));
    await userEvent.click(await screen.findByText("Sign Out"));

    await waitFor(() => expect(auth.logout).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("shows a placeholder avatar when the user has no name", async () => {
    renderLayout({ auth: makeAuth({ user: { email: "x@y.z" } }) });

    expect(screen.getByText("?")).toBeInTheDocument();
    await screen.findByText("All systems operational");
  });

  it("has a working drawer toggle button", async () => {
    renderLayout();

    const toggle = screen.getByLabelText("toggle drawer");
    await userEvent.click(toggle);
    await userEvent.click(toggle);

    expect(toggle).toBeInTheDocument();
    await screen.findByText("All systems operational");
  });
});
