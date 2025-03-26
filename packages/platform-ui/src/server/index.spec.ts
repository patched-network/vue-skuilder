import { vi, describe, test, expect, beforeEach } from 'vitest';
import serverRequest from './index';
import { ServerRequest, Status } from '@vue-skuilder/common';

// Create a minimal type that matches ServerRequest for testing
type TestRequest = ServerRequest & {
  type: 'TEST_REQUEST';
  timeout?: number;
};

describe('serverRequest', () => {
  let mockXHR: {
    open: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    setRequestHeader: ReturnType<typeof vi.fn>;
    withCredentials: boolean;
    onload?: () => void;
    ontimeout?: () => void;
    onerror?: () => void;
    readyState?: number;
    status?: number;
    responseText?: string;
  };

  beforeEach(() => {
    mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      withCredentials: false,
    };

    global.XMLHttpRequest = vi.fn(() => mockXHR) as any;
  });

  test('configures XMLHttpRequest correctly', async () => {
    // Set up the mock to do nothing on send
    mockXHR.send = vi.fn();

    // Create a promise that resolves when onload is called
    const responsePromise = new Promise<void>((resolve) => {
      mockXHR.onload = () => resolve();
    });

    // Start the request but don't wait for it
    const requestPromise = serverRequest<TestRequest>({ type: 'TEST_REQUEST' });

    // Check that XMLHttpRequest was configured correctly
    expect(mockXHR.open).toHaveBeenCalledWith('POST', expect.any(String), true);
    expect(mockXHR.withCredentials).toBe(true);
    expect(mockXHR.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(mockXHR.timeout).toBe(7000);
    expect(mockXHR.send).toHaveBeenCalledWith(JSON.stringify({ type: 'TEST_REQUEST' }));

    // Simulate successful response after validation
    mockXHR.responseText = JSON.stringify({ data: 'test', ok: true });
    mockXHR.onload && mockXHR.onload();

    // Wait for the request to complete
    const result = await requestPromise;

    // Verify the result
    expect(result.response).toEqual({ data: 'test', ok: true });
  });

  test('handles successful response', async () => {
    const responseData = { status: Status.success, ok: true, data: { id: '123' } };

    // Create a promise that will complete when onload is triggered
    const requestPromise = serverRequest<TestRequest>({ type: 'TEST_REQUEST' });

    // Simulate a successful response
    mockXHR.responseText = JSON.stringify(responseData);
    mockXHR.onload && mockXHR.onload();

    // Wait for the request to complete
    const result = await requestPromise;

    // Verify the response was processed correctly
    expect(result.response).toEqual(responseData);
  });

  test('handles JSON parse error in response', async () => {
    // Create a promise that will complete when onload is triggered
    const requestPromise = serverRequest<TestRequest>({ type: 'TEST_REQUEST' });

    // Simulate an invalid JSON response
    mockXHR.responseText = 'Not valid JSON';
    mockXHR.onload && mockXHR.onload();

    // Wait for the request to complete
    const result = await requestPromise;

    // Verify error handling
    expect(result.response).toEqual({
      status: Status.error,
      ok: false,
      errorText: expect.stringContaining('Failed to parse response'),
    });
  });

  test('handles request timeout', async () => {
    // Create a request with custom timeout
    const requestPromise = serverRequest<TestRequest>({
      type: 'TEST_REQUEST',
      timeout: 5000,
    });

    // Verify timeout is set correctly
    expect(mockXHR.timeout).toBe(5000);

    // Simulate timeout
    mockXHR.ontimeout && mockXHR.ontimeout();

    // Wait for the request to complete
    const result = await requestPromise;

    // Verify timeout handling
    expect(result.response).toEqual({
      status: Status.error,
      ok: false,
      errorText: 'Request timed out',
    });
  });

  test('handles network error', async () => {
    // Create a request
    const requestPromise = serverRequest<TestRequest>({ type: 'TEST_REQUEST' });

    // Simulate network error
    mockXHR.onerror && mockXHR.onerror();

    // Wait for the request to complete
    const result = await requestPromise;

    // Verify error handling
    expect(result.response).toEqual({
      status: Status.error,
      ok: false,
      errorText: 'Network error occurred',
    });
  });

  test('handles exception during request setup', async () => {
    // Make XMLHttpRequest.open throw an error
    mockXHR.open = vi.fn().mockImplementation(() => {
      throw new Error('Connection refused');
    });

    // Make the request which should catch the error
    const result = await serverRequest<TestRequest>({ type: 'TEST_REQUEST' });

    // Verify error is caught and handled
    expect(result.response).toEqual({
      status: Status.error,
      ok: false,
      errorText: 'Connection refused',
    });
  });
});
