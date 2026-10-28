import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import api from "../../services/api";
import { makeAuth, renderWithProviders, testUser } from "../../test-utils";
import Settings from "../Settings";

jest.mock("../../services/api");

const goToTab = (name) => userEvent.click(screen.getByRole("tab", { name }));

describe("Settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.checkHealth.mockResolvedValue({
      status: "healthy",
      version: "1.3.0",
      timestamp: "2025-03-15T10:00:00Z",
    });
    api.updateProfile.mockResolvedValue(testUser);
    api.changePassword.mockResolvedValue({});
  });

  it("renders the title and the three tabs", async () => {
    renderWithProviders(<Settings />);

    expect(
      screen.getByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    ["Profile", "Security", "System"].forEach((name) =>
      expect(screen.getByRole("tab", { name })).toBeInTheDocument(),
    );
    await waitFor(() => expect(api.checkHealth).toHaveBeenCalled());
  });

  it("pre-fills the profile form from the signed-in user", async () => {
    renderWithProviders(<Settings />);

    expect(await screen.findByDisplayValue("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByDisplayValue("General Hospital")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cardiology")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("Email")).toHaveValue("ada@hospital.org");
  });

  it("saves profile edits and refreshes the user", async () => {
    const { auth } = renderWithProviders(<Settings />);
    const name = await screen.findByLabelText("Full Name");

    await userEvent.clear(name);
    await userEvent.type(name, "Ada King");
    await userEvent.click(screen.getByRole("button", { name: "Save Profile" }));

    await waitFor(() =>
      expect(api.updateProfile).toHaveBeenCalledWith({
        fullName: "Ada King",
        organization: "General Hospital",
        specialty: "Cardiology",
      }),
    );
    expect(auth.refreshUser).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Profile updated successfully."),
    ).toBeInTheDocument();
  });

  it("shows the API error when saving the profile fails", async () => {
    api.updateProfile.mockRejectedValue(new Error("Name too short"));
    renderWithProviders(<Settings />);
    await screen.findByLabelText("Full Name");

    await userEvent.click(screen.getByRole("button", { name: "Save Profile" }));

    expect(await screen.findByText("Name too short")).toBeInTheDocument();
  });

  it("copes with a missing user", async () => {
    renderWithProviders(<Settings />, { auth: makeAuth({ user: null }) });

    expect(await screen.findByLabelText("Full Name")).toHaveValue("");
    expect(screen.getByText(/Account created N\/A/)).toBeInTheDocument();
  });

  it("keeps the password button disabled until required fields are filled", async () => {
    renderWithProviders(<Settings />);
    await goToTab("Security");

    const button = screen.getByRole("button", { name: "Update Password" });
    expect(button).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText("Current Password"),
      "old-pass1",
    );
    await userEvent.type(screen.getByLabelText(/^New Password/), "new-pass12");
    expect(button).toBeEnabled();
  });

  it("rejects mismatching passwords without calling the API", async () => {
    renderWithProviders(<Settings />);
    await goToTab("Security");

    await userEvent.type(
      screen.getByLabelText("Current Password"),
      "old-pass1",
    );
    await userEvent.type(screen.getByLabelText(/^New Password/), "new-pass12");
    await userEvent.type(
      screen.getByLabelText("Confirm New Password"),
      "different1",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Update Password" }),
    );

    expect(
      await screen.findByText("New passwords do not match."),
    ).toBeInTheDocument();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it("rejects passwords shorter than 8 characters", async () => {
    renderWithProviders(<Settings />);
    await goToTab("Security");

    await userEvent.type(
      screen.getByLabelText("Current Password"),
      "old-pass1",
    );
    await userEvent.type(screen.getByLabelText(/^New Password/), "short1");
    await userEvent.type(
      screen.getByLabelText("Confirm New Password"),
      "short1",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Update Password" }),
    );

    expect(
      await screen.findByText("New password must be at least 8 characters."),
    ).toBeInTheDocument();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it("changes the password and clears the form", async () => {
    renderWithProviders(<Settings />);
    await goToTab("Security");

    await userEvent.type(
      screen.getByLabelText("Current Password"),
      "old-pass1",
    );
    await userEvent.type(screen.getByLabelText(/^New Password/), "new-pass12");
    await userEvent.type(
      screen.getByLabelText("Confirm New Password"),
      "new-pass12",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Update Password" }),
    );

    await waitFor(() =>
      expect(api.changePassword).toHaveBeenCalledWith({
        currentPassword: "old-pass1",
        newPassword: "new-pass12",
      }),
    );
    expect(
      await screen.findByText("Password changed successfully."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Current Password")).toHaveValue("");
  });

  it("shows the server's message when the password change is refused", async () => {
    api.changePassword.mockRejectedValue(
      new Error("Current password is wrong"),
    );
    renderWithProviders(<Settings />);
    await goToTab("Security");

    await userEvent.type(
      screen.getByLabelText("Current Password"),
      "bad-pass1",
    );
    await userEvent.type(screen.getByLabelText(/^New Password/), "new-pass12");
    await userEvent.type(
      screen.getByLabelText("Confirm New Password"),
      "new-pass12",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Update Password" }),
    );

    expect(
      await screen.findByText("Current password is wrong"),
    ).toBeInTheDocument();
  });

  it("shows backend health on the System tab", async () => {
    renderWithProviders(<Settings />);
    await goToTab("System");

    expect(
      await screen.findByText(/Backend is healthy \(v1\.3\.0\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace (clinician)")).toBeInTheDocument();
    expect(screen.getByText("Nexora v1.3.0")).toBeInTheDocument();
  });

  it("shows an error and can re-check health", async () => {
    api.checkHealth.mockRejectedValueOnce(new Error("Backend down"));
    renderWithProviders(<Settings />);
    await goToTab("System");

    expect(await screen.findByText("Backend down")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Check Health" }));

    expect(await screen.findByText(/Backend is healthy/)).toBeInTheDocument();
    expect(screen.queryByText("Backend down")).not.toBeInTheDocument();
    expect(api.checkHealth).toHaveBeenCalledTimes(2);
  });
});
