// Capture the axios instance and interceptors that api.js registers so the
// service can be exercised without a network.
const mockHandlers = {};
const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn((ok) => (mockHandlers.request = ok)) },
    response: {
      use: jest.fn((ok, err) => {
        mockHandlers.responseError = err;
      }),
    },
  },
};
jest.mock("axios", () => ({
  __esModule: true,
  default: { create: jest.fn(() => mockClient) },
}));

// A plain require (not an import) so it runs after `mockClient` is defined;
// imports are hoisted above the const declarations by Babel.
const api = require("../api").default;

describe("api service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe("auth token", () => {
    it("stores, reads and clears the token", () => {
      api.setAuthToken("abc");
      expect(api.getAuthToken()).toBe("abc");
      api.setAuthToken(null);
      expect(api.getAuthToken()).toBeNull();
    });

    it("adds a bearer header to requests when signed in", () => {
      api.setAuthToken("abc");
      expect(mockHandlers.request({ headers: {} }).headers.Authorization).toBe(
        "Bearer abc",
      );
    });

    it("sends no auth header when signed out", () => {
      expect(
        mockHandlers.request({ headers: {} }).headers.Authorization,
      ).toBeUndefined();
    });
  });

  describe("error handling", () => {
    const fail = (error) => mockHandlers.responseError(error);

    it("uses a string `detail` from FastAPI", async () => {
      await expect(
        fail({ response: { status: 400, data: { detail: "Email taken" } } }),
      ).rejects.toMatchObject({ message: "Email taken", status: 400 });
    });

    it("joins validation error messages", async () => {
      await expect(
        fail({
          response: {
            status: 422,
            data: { detail: [{ msg: "too short" }, { msg: "needs a digit" }] },
          },
        }),
      ).rejects.toThrow("too short needs a digit");
    });

    it("explains network failures", async () => {
      await expect(fail({ message: "Network Error" })).rejects.toThrow(
        /Can't reach the Nexora backend/,
      );
    });

    it("falls back to a generic message", async () => {
      await expect(fail({ response: { status: 500 } })).rejects.toThrow(
        "Request failed.",
      );
    });

    it("clears the token and notifies the app on a 401", async () => {
      const handler = jest.fn();
      api.setUnauthorizedHandler(handler);
      api.setAuthToken("abc");

      await expect(fail({ response: { status: 401 } })).rejects.toMatchObject({
        status: 401,
      });

      expect(api.getAuthToken()).toBeNull();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("endpoints", () => {
    it("logs in with the credentials", async () => {
      mockClient.post.mockResolvedValue({ data: { access_token: "t" } });

      await expect(
        api.login({ email: "a@b.c", password: "pw" }),
      ).resolves.toEqual({
        access_token: "t",
      });
      expect(mockClient.post).toHaveBeenCalledWith("/auth/login", {
        email: "a@b.c",
        password: "pw",
      });
    });

    it("maps profile fields to snake_case", async () => {
      mockClient.patch.mockResolvedValue({ data: {} });

      await api.updateProfile({
        fullName: "A",
        organization: "B",
        specialty: "C",
      });

      expect(mockClient.patch).toHaveBeenCalledWith("/auth/me", {
        full_name: "A",
        organization: "B",
        specialty: "C",
      });
    });

    it("logout clears the token even if the request fails", async () => {
      api.setAuthToken("abc");
      mockClient.post.mockRejectedValue(new Error("expired"));

      await api.logout();

      expect(api.getAuthToken()).toBeNull();
    });

    it("turns the model registry into a list", async () => {
      mockClient.get.mockResolvedValue({
        data: {
          models: {
            deep_fm: {
              latest: { config: { version: "2.0.0" }, path: "/m/deep" },
            },
            survival_analysis: {},
          },
        },
      });

      await expect(api.getModels()).resolves.toEqual([
        {
          name: "deep_fm",
          displayName: "Deep Fm",
          version: "2.0.0",
          status: "Active",
          path: "/m/deep",
        },
        {
          name: "survival_analysis",
          displayName: "Survival Analysis",
          version: "1.0.0",
          status: "Active",
          path: undefined,
        },
      ]);
    });

    it("tolerates an empty or malformed model registry", async () => {
      mockClient.get.mockResolvedValue({ data: {} });
      await expect(api.getModels()).resolves.toEqual([]);

      mockClient.get.mockResolvedValue({
        data: { models: { odd__name: null } },
      });
      await expect(api.getModels()).resolves.toEqual([
        expect.objectContaining({ displayName: "Odd Name", version: "1.0.0" }),
      ]);
    });

    it("sends the patient filters as query params", async () => {
      mockClient.get.mockResolvedValue({ data: { patients: [{ id: "P1" }] } });

      await expect(
        api.getPatients({
          search: "smith",
          riskBand: "high",
          page: 2,
          pageSize: 10,
        }),
      ).resolves.toEqual([{ id: "P1" }]);
      expect(mockClient.get).toHaveBeenCalledWith("/patients", {
        params: { search: "smith", risk_band: "high", page: 2, page_size: 10 },
      });
    });

    it("omits empty filters and returns [] for a missing patient list", async () => {
      mockClient.get.mockResolvedValue({ data: {} });

      await expect(api.getPatients({ riskBand: "all" })).resolves.toEqual([]);
      expect(mockClient.get).toHaveBeenCalledWith("/patients", {
        params: {
          search: undefined,
          risk_band: undefined,
          page: 1,
          page_size: 200,
        },
      });
    });

    it("builds the prediction request body", async () => {
      mockClient.post.mockResolvedValue({ data: { request_id: "r" } });

      await api.makePrediction("deep_fm", undefined, { patient_id: "P1" });

      expect(mockClient.post).toHaveBeenCalledWith("/predict", {
        model_name: "deep_fm",
        model_version: undefined,
        patient_data: { patient_id: "P1" },
      });
    });

    it("recomputes risk for one patient", async () => {
      mockClient.post.mockResolvedValue({ data: { riskScore: 0.5 } });

      await expect(api.recomputeRisk("P1")).resolves.toEqual({
        riskScore: 0.5,
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/patients/P1/recompute-risk",
      );
    });
  });
});
