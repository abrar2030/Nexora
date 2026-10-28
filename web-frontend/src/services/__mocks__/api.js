// Manual Jest mock for src/services/api.js.
//
// Activate with `jest.mock("../../services/api")` in a test file. Every method
// of the default export is a jest.fn() that resolves to `undefined` unless a
// test configures it, and the same functions are re-exported by name so both
// `import api from ...` and `import { getPatients } from ...` see one mock.
const methods = [
  "register",
  "login",
  "getCurrentUser",
  "updateProfile",
  "changePassword",
  "logout",
  "checkHealth",
  "getModels",
  "makePrediction",
  "getPredictionFromFHIR",
  "getPatients",
  "getPatientDetail",
  "addPatient",
  "updatePatient",
  "deletePatient",
  "recomputeRisk",
  "getDashboardData",
  "getNotifications",
  "markNotificationRead",
  "markAllNotificationsRead",
];

const api = {
  setAuthToken: jest.fn(),
  getAuthToken: jest.fn(() => null),
  setUnauthorizedHandler: jest.fn(),
};
methods.forEach((name) => {
  api[name] = jest.fn(() => Promise.resolve());
});

module.exports = {
  __esModule: true,
  default: api,
  ...api,
};
