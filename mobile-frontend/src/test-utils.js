import { render } from "@testing-library/react-native";
import React from "react";
import AuthContext from "./context/AuthContext";

export const testUser = {
  id: "u1",
  full_name: "Ada Lovelace",
  email: "ada@hospital.org",
  role: "clinician",
  organization: "General Hospital",
  specialty: "Cardiology",
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

/** Render `ui` inside an AuthContext so screens can call useAuth(). */
export const renderWithAuth = (ui, auth = makeAuth()) => ({
  ...render(<AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>),
  auth,
});
