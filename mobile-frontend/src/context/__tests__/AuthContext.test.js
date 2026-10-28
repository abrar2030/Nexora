import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import api from "../../services/api";
import { AuthProvider, useAuth } from "../AuthContext";

jest.mock("../../services/api");

const user = { id: "u1", full_name: "Ada Lovelace", email: "ada@x.org" };
const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getAuthToken.mockResolvedValue(null);
    api.setAuthToken.mockResolvedValue(undefined);
    api.logout.mockResolvedValue(undefined);
  });

  it("throws when useAuth is used outside a provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider",
    );
    spy.mockRestore();
  });

  it("starts signed out when there is no stored token", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(api.getCurrentUser).not.toHaveBeenCalled();
  });

  it("restores the session from a stored token", async () => {
    api.getAuthToken.mockResolvedValue("stored");
    api.getCurrentUser.mockResolvedValue(user);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(user);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("drops an invalid stored token", async () => {
    api.getAuthToken.mockResolvedValue("stale");
    api.getCurrentUser.mockRejectedValue(new Error("401"));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.setAuthToken).toHaveBeenCalledWith(null);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("logs in, stores the token and exposes the user", async () => {
    api.login.mockResolvedValue({ access_token: "tok", user });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.login({ email: "a@b.c", password: "pw" }));

    expect(api.login).toHaveBeenCalledWith({ email: "a@b.c", password: "pw" });
    expect(api.setAuthToken).toHaveBeenCalledWith("tok");
    expect(result.current.user).toEqual(user);
  });

  it("records the error and rethrows when login fails", async () => {
    api.login.mockRejectedValue(new Error("Invalid email or password"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.login({ email: "a@b.c", password: "bad" }),
      ).rejects.toThrow("Invalid email or password");
    });

    expect(result.current.authError).toBe("Invalid email or password");
    expect(result.current.isAuthenticated).toBe(false);

    act(() => result.current.clearAuthError());
    expect(result.current.authError).toBeNull();
  });

  it("registers and signs the new user in", async () => {
    api.register.mockResolvedValue({ access_token: "new", user });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.register({ email: "a@b.c" }));

    expect(api.setAuthToken).toHaveBeenCalledWith("new");
    expect(result.current.user).toEqual(user);
  });

  it("logs out", async () => {
    api.login.mockResolvedValue({ access_token: "tok", user });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.login({ email: "a", password: "b" }));

    await act(() => result.current.logout());

    expect(api.logout).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("refreshes the user from the API", async () => {
    api.getCurrentUser.mockResolvedValue({ ...user, full_name: "Ada King" });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.refreshUser());

    expect(result.current.user.full_name).toBe("Ada King");
  });

  it("signs the user out when the API reports an expired session", async () => {
    api.getAuthToken.mockResolvedValue("stored");
    api.getCurrentUser.mockResolvedValue(user);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    const handler = api.setUnauthorizedHandler.mock.calls[0][0];
    act(() => handler());

    expect(result.current.isAuthenticated).toBe(false);
  });

  it("unregisters the unauthorized handler on unmount", async () => {
    const { result, unmount } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    unmount();

    expect(api.setUnauthorizedHandler).toHaveBeenLastCalledWith(null);
  });
});
