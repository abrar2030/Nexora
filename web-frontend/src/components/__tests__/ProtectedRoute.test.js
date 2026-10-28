import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AuthContext from "../../context/AuthContext";
import { makeAuth } from "../../test-utils";
import { ProtectedRoute, PublicOnlyRoute } from "../ProtectedRoute";

const Where = () => {
  const location = useLocation();
  return (
    <div data-testid="where">{`${location.pathname}${location.search}`}</div>
  );
};

// `guard` wraps only the route named by `guarded`; the others are plain pages,
// otherwise a redirect between two guarded routes would loop forever.
const renderGuard = (auth, entry, guard, guarded = "/secret") =>
  render(
    <MemoryRouter
      initialEntries={[entry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthContext.Provider value={auth}>
        <Routes>
          <Route
            path="/secret"
            element={
              guarded === "/secret" ? (
                guard(<div>Secret page</div>)
              ) : (
                <div>Secret page</div>
              )
            }
          />
          <Route
            path="/login"
            element={
              guarded === "/login" ? (
                guard(<div>Login page</div>)
              ) : (
                <div>Login page</div>
              )
            }
          />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
          <Route path="/patients" element={<div>Patients page</div>} />
        </Routes>
        <Where />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("ProtectedRoute", () => {
  const guard = (children) => <ProtectedRoute>{children}</ProtectedRoute>;

  it("renders the page for a signed-in user", () => {
    renderGuard(makeAuth(), "/secret", guard);
    expect(screen.getByText("Secret page")).toBeInTheDocument();
  });

  it("shows a loader while the session is being checked", () => {
    renderGuard(
      makeAuth({ loading: true, isAuthenticated: false }),
      "/secret",
      guard,
    );

    expect(screen.getByText("Checking your session…")).toBeInTheDocument();
    expect(screen.queryByText("Secret page")).not.toBeInTheDocument();
  });

  it("redirects anonymous users to the login page", () => {
    renderGuard(
      makeAuth({ user: null, isAuthenticated: false }),
      "/secret",
      guard,
    );

    expect(screen.getByTestId("where")).toHaveTextContent("/login");
  });
});

describe("PublicOnlyRoute", () => {
  const guard = (children) => <PublicOnlyRoute>{children}</PublicOnlyRoute>;

  it("renders the page for anonymous users", () => {
    renderGuard(
      makeAuth({ user: null, isAuthenticated: false }),
      "/login",
      guard,
      "/login",
    );
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("shows a loader while the session is being checked", () => {
    renderGuard(
      makeAuth({ loading: true, isAuthenticated: false }),
      "/login",
      guard,
      "/login",
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("sends signed-in users to the dashboard by default", () => {
    renderGuard(makeAuth(), "/login", guard, "/login");

    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard");
  });

  it("sends signed-in users back to the page they originally requested", () => {
    renderGuard(
      makeAuth(),
      {
        pathname: "/login",
        state: { from: { pathname: "/patients", search: "?risk=high" } },
      },
      guard,
      "/login",
    );

    expect(screen.getByTestId("where")).toHaveTextContent(
      "/patients?risk=high",
    );
  });
});
