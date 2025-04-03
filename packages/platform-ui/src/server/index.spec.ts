import { vi, describe, test, expect, beforeEach } from 'vitest';
import serverRequest from './index';
import { ServerRequestType, Status, CreateClassroom } from '@vue-skuilder/common';

// Instead of extending ServerRequest, directly use the CreateClassroom type
describe('serverRequest', () => {
  let mockXHR: {
    open: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    setRequestHeader: ReturnType<typeof vi.fn>;
    withCredentials: boolean;
    timeout: number;
    onload?: () => void;
    ontimeout?: () => void;
    onerror?: () => void;
    readyState?: number;
    status?: number;
    responseText?: string;
  };

  // Create a base test request that matches CreateClassroom exactly
  const baseTestRequest: CreateClassroom = {
    type: ServerRequestType.CREATE_CLASSROOM,
    user: 'testuser',
    data: {
      students: [],
      teachers: ['testuser'],
      name: 'Test Classroom',
      classMeetingSchedule: 'Never',
      peerAssist: false,
      joinCode: 'TEST123',
    },
    response: null,
  };

  beforeEach(() => {
    mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      withCredentials: false,
      timeout: 0,
    };

    // eslint-disable-next-line
    global.XMLHttpRequest = vi.fn(() => mockXHR) as any;
  });

  test('configures XMLHttpRequest correctly', async () => {
    // Create a valid request with a timeout
    const testRequest: CreateClassroom = {
      ...baseTestRequest,
      timeout: 7000,
    };

    // Start the request
    const requestPromise = serverRequest(testRequest);

    // Check that XMLHttpRequest was configured correctly
    expect(mockXHR.open).toHaveBeenCalledWith('POST', expect.any(String), true);
    expect(mockXHR.withCredentials).toBe(true);
    expect(mockXHR.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(mockXHR.timeout).toBe(7000);
    expect(mockXHR.send).toHaveBeenCalledWith(JSON.stringify(testRequest));

    // Simulate successful response with the expected format for CreateClassroom
    mockXHR.responseText = JSON.stringify({
      status: Status.ok,
      ok: true,
      joincode: 'ABC123',
      uuid: '123-456-789',
    });
    if (mockXHR.onload) mockXHR.onload();

    // Wait for the request to complete
    const result = await requestPromise;

    // Verify the result matches the expected format
    expect(result.response).toEqual({
      status: Status.ok,
      ok: true,
      joincode: 'ABC123',
      uuid: '123-456-789',
    });
  });

  test('handles successful response', async () => {
    // Create a promise that will complete when onload is triggered
    const requestPromise = serverRequest(baseTestRequest);

    // Simulate a successful response that matches the expected structure
    mockXHR.responseText = JSON.stringify({
      status: Status.ok,
      ok: true,
      joincode: 'TEST123',
      uuid: '123-456',
    });
    if (mockXHR.onload) mockXHR.onload();

    // Wait for the request to complete
    const result = await requestPromise;

    // Verify the response was processed correctly
    expect(result.response).toEqual({
      status: Status.ok,
      ok: true,
      joincode: 'TEST123',
      uuid: '123-456',
    });
  });

  test('handles JSON parse error in response', async () => {
    // Create a promise that will complete when onload is triggered
    const requestPromise = serverRequest(baseTestRequest);

    // Simulate an invalid JSON response
    mockXHR.responseText = 'Not valid JSON';
    if (mockXHR.onload) mockXHR.onload();

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
    const testRequest: CreateClassroom = {
      ...baseTestRequest,
      timeout: 5000,
    };

    // Create a promise
    const requestPromise = serverRequest(testRequest);

    // Verify timeout is set correctly
    expect(mockXHR.timeout).toBe(5000);

    // Simulate timeout
    if (mockXHR.ontimeout) mockXHR.ontimeout();

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
    const requestPromise = serverRequest(baseTestRequest);

    // Simulate network error
    if (mockXHR.onerror) mockXHR.onerror();

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
    const result = await serverRequest(baseTestRequest);

    // Verify error is caught and handled
    expect(result.response).toEqual({
      status: Status.error,
      ok: false,
      errorText: 'Connection refused',
    });
  });
});
