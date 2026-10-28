import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router-dom";
import { makeAuth, renderWithProviders } from "../../test-utils";
import Login from "../Login";

const renderLogin = (auth, route = "/login") =>
  renderWithProviders(<Login />, {
    auth,
    route,
    path: "/login",
    extraRoutes: (
      <>
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
        <Route path="/patients" element={<div>Patients page</div>} />
      </>
    ),
  });

const fillAndSubmit = async (email, password) => {
  if (email)
    await userEvent.type(screen.getByLabelText(/email address/i), email);
  if (password)
    await userEvent.type(screen.getByLabelText(/^password/i), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("Login", () => {
  it("renders the sign-in form", () => {
    renderLogin(makeAuth({ user: null, isAuthenticated: false }));

    expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
  });

  it("requires both email and password", async () => {
    const auth = makeAuth({ user: null, isAuthenticated: false });
    renderLogin(auth);

    await fillAndSubmit("a@b.com", "");

    expect(
      await screen.findByText("Please enter both your email and password."),
    ).toBeInTheDocument();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("signs in with trimmed credentials and goes to the dashboard", async () => {
    const auth = makeAuth({ user: null, isAuthenticated: false });
    renderLogin(auth);

    await fillAndSubmit("  a@b.com ", "secret123");

    await waitFor(() =>
      expect(auth.login).toHaveBeenCalledWith({
        email: "a@b.com",
        password: "secret123",
      }),
    );
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("returns to the page the user was trying to reach", async () => {
    const auth = makeAuth({ user: null, isAuthenticated: false });
    renderLogin(auth, {
      pathname: "/login",
      state: { from: { pathname: "/patients" } },
    });

    await fillAndSubmit("a@b.com", "secret123");

    expect(await screen.findByText("Patients page")).toBeInTheDocument();
  });

  it("shows the server's error when sign-in fails", async () => {
    const auth = makeAuth({
      user: null,
      isAuthenticated: false,
      login: jest
        .fn()
        .mockRejectedValue(new Error("Invalid email or password")),
    });
    renderLogin(auth);

    await fillAndSubmit("a@b.com", "wrong-pass");

    expect(
      await screen.findByText("Invalid email or password"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
  });
});
