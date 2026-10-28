// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// Chart.js needs a real <canvas>, which jsdom does not provide. Replace the
// react-chartjs-2 components with light stand-ins that expose their data so
// tests can still assert on what would be plotted.
jest.mock("react-chartjs-2", () => {
  const React = require("react");
  const makeChart = (kind) => {
    const Chart = ({ data }) =>
      React.createElement("div", {
        "data-testid": `${kind}-chart`,
        "data-labels": JSON.stringify(data?.labels ?? []),
        role: "img",
        "aria-label": `${kind} chart`,
      });
    Chart.displayName = `Mock${kind}Chart`;
    return Chart;
  };
  return {
    Line: makeChart("line"),
    Bar: makeChart("bar"),
    Doughnut: makeChart("doughnut"),
  };
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Suppress console errors during tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render") ||
        args[0].includes("Not implemented: HTMLFormElement.prototype.submit"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
