import { fireEvent, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";
import { makeAuth, renderWithAuth } from "../../test-utils";
import LoginScreen from "../LoginScreen";

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const signedOut = (overrides = {}) =>
  makeAuth({ user: null, isAuthenticated: false, ...overrides });

const fill = (utils, email, password) => {
  if (email) fireEvent.changeText(utils.getByTestId("email-input"), email);
  if (password)
    fireEvent.changeText(utils.getByTestId("password-input"), password);
};

describe("LoginScreen", () => {
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => alertSpy.mockRestore());

  it("renders the sign-in form", () => {
    const { getByTestId, getByText } = renderWithAuth(
      <LoginScreen navigation={navigation} />,
      signedOut(),
    );

    expect(getByTestId("login-screen")).toBeTruthy();
    expect(getByText("NEXORA")).toBeTruthy();
    expect(getByText("Sign in to your account")).toBeTruthy();
    expect(getByText("Email address")).toBeTruthy();
    expect(getByText("Password")).toBeTruthy();
  });

  it("shows validation errors for empty fields", () => {
    const auth = signedOut();
    const { getByTestId, getByText } = renderWithAuth(
      <LoginScreen navigation={navigation} />,
      auth,
    );

    fireEvent.press(getByTestId("login-button"));

    expect(getByText("Email is required.")).toBeTruthy();
    expect(getByText("Password is required.")).toBeTruthy();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("only flags the field that is missing", () => {
    const { getByTestId, getByText, queryByText } = renderWithAuth(
      <LoginScreen navigation={navigation} />,
      signedOut(),
    );

    fill({ getByTestId }, "a@b.com", "");
    fireEvent.press(getByTestId("login-button"));

    expect(getByText("Password is required.")).toBeTruthy();
    expect(queryByText("Email is required.")).toBeNull();
  });

  it("signs in with the trimmed email", async () => {
    const auth = signedOut();
    const utils = renderWithAuth(<LoginScreen navigation={navigation} />, auth);

    fill(utils, "  a@b.com ", "secret123");
    fireEvent.press(utils.getByTestId("login-button"));

    await waitFor(() =>
      expect(auth.login).toHaveBeenCalledWith({
        email: "a@b.com",
        password: "secret123",
      }),
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("alerts with the server's message when sign-in fails", async () => {
    const auth = signedOut({
      login: jest
        .fn()
        .mockRejectedValue(new Error("Invalid email or password")),
    });
    const utils = renderWithAuth(<LoginScreen navigation={navigation} />, auth);

    fill(utils, "a@b.com", "wrong-pass");
    fireEvent.press(utils.getByTestId("login-button"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Sign In Failed",
        "Invalid email or password",
      ),
    );
  });

  it("disables the button and shows progress while signing in", async () => {
    let finish;
    const auth = signedOut({
      login: jest.fn(() => new Promise((resolve) => (finish = resolve))),
    });
    const utils = renderWithAuth(<LoginScreen navigation={navigation} />, auth);

    fill(utils, "a@b.com", "secret123");
    fireEvent.press(utils.getByTestId("login-button"));

    await waitFor(() =>
      expect(
        utils.getByTestId("login-button").props.accessibilityState.disabled,
      ).toBe(true),
    );

    finish();
    await waitFor(() =>
      expect(
        utils.getByTestId("login-button").props.accessibilityState.disabled,
      ).toBe(false),
    );
  });

  it("links to sign-up and back", () => {
    const { getByText } = renderWithAuth(
      <LoginScreen navigation={navigation} />,
      signedOut(),
    );

    fireEvent.press(getByText("Create one"));
    expect(navigation.navigate).toHaveBeenCalledWith("SignUp");

    fireEvent.press(getByText("Back"));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
