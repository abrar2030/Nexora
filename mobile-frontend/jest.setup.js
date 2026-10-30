// Jest setup file for Nexora Mobile Frontend
// This file runs before each test suite

// Setup jest-expo preset which handles most React Native mocks
require("@testing-library/react-native/extend-expect");
const { configure } = require("@testing-library/react-native");

// The first render in a cold Jest worker can take several seconds on CI.
configure({ asyncUtilTimeout: 15000 });

// Mock @react-native-async-storage/async-storage
import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

// Mock expo-constants.
// The real module's named exports (ExecutionEnvironment, etc.) are read at
// import time by expo-asset / expo-font, which @expo/vector-icons pulls in, so
// the mock has to provide them or any screen importing an icon crashes.
jest.mock("expo-constants", () => {
  const Constants = {
    expoConfig: { extra: { apiBaseUrl: "http://localhost:8000" } },
    executionEnvironment: "bare",
  };
  return {
    __esModule: true,
    default: Constants,
    ExecutionEnvironment: {
      Bare: "bare",
      Standalone: "standalone",
      StoreClient: "storeClient",
    },
    ...Constants,
  };
});

// @expo/vector-icons loads fonts asynchronously and updates state after a test
// has finished, which causes act() warnings. Render each icon synchronously as
// text so tests can still see which icon was requested.
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const makeIcon = (family) => {
    const Icon = ({ name, size, color, ...rest }) =>
      React.createElement(Text, rest, `${family}:${name}`);
    Icon.displayName = `${family}IconStub`;
    return Icon;
  };
  return new Proxy(
    { __esModule: true },
    {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        if (typeof prop !== "string" || prop === "then") return undefined;
        return makeIcon(prop);
      },
    },
  );
});

// Mock react-native-chart-kit
jest.mock("react-native-chart-kit", () => ({
  LineChart: "LineChart",
  BarChart: "BarChart",
  PieChart: "PieChart",
  ProgressChart: "ProgressChart",
  ContributionGraph: "ContributionGraph",
  StackedBarChart: "StackedBarChart",
}));

// Mock react-native-svg
jest.mock("react-native-svg", () => ({
  Svg: "Svg",
  Circle: "Circle",
  Rect: "Rect",
  Path: "Path",
  G: "G",
  Text: "Text",
  Line: "Line",
  Polygon: "Polygon",
  Polyline: "Polyline",
  Ellipse: "Ellipse",
  ClipPath: "ClipPath",
  Defs: "Defs",
  LinearGradient: "LinearGradient",
  RadialGradient: "RadialGradient",
  Stop: "Stop",
}));

// Mock gesture handler
jest.mock("react-native-gesture-handler", () => {
  const View = require("react-native/Libraries/Components/View/View");
  return {
    GestureHandlerRootView: View,
    gestureHandlerRootHOC: (Component) => Component,
    PanGestureHandler: View,
    TapGestureHandler: View,
    State: {},
    Directions: {},
  };
});

// Mock axios
jest.mock("axios", () => {
  const mockAxios = {
    create: jest.fn(function () {
      return {
        get: jest.fn(() => Promise.resolve({ data: [] })),
        post: jest.fn(() => Promise.resolve({ data: {} })),
        interceptors: {
          request: {
            use: jest.fn((onFulfilled) => onFulfilled),
            eject: jest.fn(),
          },
          response: {
            use: jest.fn((onFulfilled) => onFulfilled),
            eject: jest.fn(),
          },
        },
      };
    }),
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: {
        use: jest.fn(),
        eject: jest.fn(),
      },
      response: {
        use: jest.fn(),
        eject: jest.fn(),
      },
    },
  };
  return mockAxios;
});

// Suppress console warnings/errors during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// SafeAreaProvider renders nothing until the native side reports insets, which
// never happens under Jest. The library ships an official mock for this.
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
