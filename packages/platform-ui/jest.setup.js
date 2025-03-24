// Add any global test setup here
global.CSS = {
  supports: jest.fn(() => false),
  escape: jest.fn((str) => str),
};

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
