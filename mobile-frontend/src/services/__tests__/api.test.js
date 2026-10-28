import AsyncStorage from "@react-native-async-storage/async-storage";

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
const apiService = require("../api").default;

describe("API Service", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("exposes the configured base URL", () => {
    expect(apiService.getBaseURL()).toBe("http://localhost:8000");
  });

  describe("auth token", () => {
    it("stores, reads and clears the token", async () => {
      await apiService.setAuthToken("abc");
      expect(await apiService.getAuthToken()).toBe("abc");

      await apiService.setAuthToken(null);
      expect(await apiService.getAuthToken()).toBeNull();
    });

    it("adds a bearer header when a token is stored", async () => {
      await apiService.setAuthToken("abc");

      const config = await mockHandlers.request({ headers: {} });

      expect(config.headers.Authorization).toBe("Bearer abc");
    });

    it("sends no auth header when signed out", async () => {
      const config = await mockHandlers.request({ headers: {} });

      expect(config.headers.Authorization).toBeUndefined();
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
      apiService.setUnauthorizedHandler(handler);
      await apiService.setAuthToken("abc");

      await expect(fail({ response: { status: 401 } })).rejects.toMatchObject({
        status: 401,
      });

      expect(await apiService.getAuthToken()).toBeNull();
      expect(handler).toHaveBeenCalledTimes(1);
      apiService.setUnauthorizedHandler(null);
    });
  });

  describe("endpoints", () => {
    it("logs in with the credentials", async () => {
      mockClient.post.mockResolvedValue({ data: { access_token: "t" } });

      await expect(
        apiService.login({ email: "a@b.c", password: "pw" }),
      ).resolves.toEqual({ access_token: "t" });
      expect(mockClient.post).toHaveBeenCalledWith("/auth/login", {
        email: "a@b.c",
        password: "pw",
      });
    });

    it("sends registration fields in the API's snake_case", async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await apiService.register({
        fullName: "Ada",
        email: "a@b.c",
        password: "pw123456",
      });

      expect(mockClient.post).toHaveBeenCalledWith("/auth/register", {
        full_name: "Ada",
        email: "a@b.c",
        password: "pw123456",
        organization: null,
        specialty: null,
      });
    });

    it("logout clears the token even if the request fails", async () => {
      await apiService.setAuthToken("abc");
      mockClient.post.mockRejectedValue(new Error("expired"));

      await apiService.logout();

      expect(await apiService.getAuthToken()).toBeNull();
    });

    it("turns the model registry into a list", async () => {
      mockClient.get.mockResolvedValue({
        data: {
          models: {
            deep_fm: { latest: { config: { version: "2.0.0" } } },
            survival_analysis: {},
          },
        },
      });

      await expect(apiService.getModels()).resolves.toEqual([
        {
          name: "deep_fm",
          displayName: "Deep Fm",
          version: "2.0.0",
          status: "Active",
        },
        {
          name: "survival_analysis",
          displayName: "Survival Analysis",
          version: "1.0.0",
          status: "Active",
        },
      ]);
    });

    it("tolerates an empty or malformed model registry", async () => {
      mockClient.get.mockResolvedValue({ data: {} });
      await expect(apiService.getModels()).resolves.toEqual([]);

      mockClient.get.mockResolvedValue({
        data: { models: { odd__name: null } },
      });
      await expect(apiService.getModels()).resolves.toEqual([
        expect.objectContaining({ displayName: "Odd Name", version: "1.0.0" }),
      ]);
    });

    it("sends the patient filters as query params", async () => {
      mockClient.get.mockResolvedValue({ data: { patients: [{ id: "P1" }] } });

      await expect(
        apiService.getPatients({
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

    it("returns [] when the response has no patient list", async () => {
      mockClient.get.mockResolvedValue({ data: {} });

      await expect(apiService.getPatients()).resolves.toEqual([]);
    });

    it("fetches one patient's details", async () => {
      mockClient.get.mockResolvedValue({ data: { id: "P1", name: "A" } });

      await expect(apiService.getPatientDetails("P1")).resolves.toEqual({
        id: "P1",
        name: "A",
      });
      expect(mockClient.get).toHaveBeenCalledWith("/patients/P1");
    });

    it("builds the prediction request body", async () => {
      mockClient.post.mockResolvedValue({ data: { request_id: "r" } });

      await apiService.makePrediction("deep_fm", undefined, {
        patient_id: "P1",
      });

      expect(mockClient.post).toHaveBeenCalledWith("/predict", {
        model_name: "deep_fm",
        model_version: undefined,
        patient_data: { patient_id: "P1" },
      });
    });

    it("recomputes risk for one patient", async () => {
      mockClient.post.mockResolvedValue({ data: { riskScore: 0.5 } });

      await expect(apiService.recomputeRisk("P1")).resolves.toEqual({
        riskScore: 0.5,
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/patients/P1/recompute-risk",
      );
    });
  });
});
