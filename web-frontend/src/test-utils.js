import { ThemeProvider } from "@mui/material/styles";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import theme from "./assets/styles/theme";
import AuthContext from "./context/AuthContext";

export const testUser = {
  id: "u1",
  full_name: "Ada Lovelace",
  email: "ada@hospital.org",
  role: "clinician",
  organization: "General Hospital",
  specialty: "Cardiology",
  created_at: "2025-01-02T10:00:00Z",
  last_login_at: null,
};

export const makeAuth = (overrides = {}) => ({
  user: testUser,
  isAuthenticated: true,
  loading: false,
  authError: null,
  login: jest.fn().mockResolvedValue(testUser),
  register: jest.fn().mockResolvedValue(testUser),
  logout: jest.fn().mockResolvedValue(undefined),
  refreshUser: jest.fn().mockResolvedValue(testUser),
  clearAuthError: jest.fn(),
  ...overrides,
});

// Shows the router's current location so tests can assert on navigation.
export const LocationDisplay = () => {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
};

/**
 * Render `ui` inside the providers the app normally supplies: a router, the
 * MUI theme and an AuthContext. `path` is the route pattern `ui` is mounted at
 * (needed for pages that read URL params), `route` the URL to start on.
 */
export const renderWithProviders = (
  ui,
  { route = "/", path = "*", auth = makeAuth(), extraRoutes = null } = {},
) => {
  const result = render(
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ThemeProvider theme={theme}>
        <AuthContext.Provider value={auth}>
          <Routes>
            <Route path={path} element={ui} />
            {extraRoutes}
          </Routes>
          <LocationDisplay />
        </AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>,
  );
  return { ...result, auth };
};
