import { requestOpenAICompatibleCompletion } from './provider-request';

function logger() {
  return {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function success(content = '{"ok":true}') {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
  }), {
    status: 200,
    headers: { 'x-dashscope-request-id': 'req-success' },
  });
}

describe('requestOpenAICompatibleCompletion', () => {
  it('retries a transport failure and returns the recovered completion', async () => {
    const fetchImpl = jest.fn()
      .mockRejectedValueOnce(new TypeError('socket reset'))
      .mockResolvedValueOnce(success('recovered'));
    const sleepImpl = jest.fn().mockResolvedValue(undefined);
    const testLogger = logger();

    const result = await requestOpenAICompatibleCompletion({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'secret',
      model: 'qwen3.7-plus',
      operation: 'planning',
      requestBody: { model: 'qwen3.7-plus', messages: [] },
      logger: testLogger,
      fetchImpl,
      sleepImpl,
    });

    expect(result).toBe('recovered');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledTimes(1);
    expect(testLogger.warn).toHaveBeenCalledWith(expect.stringContaining('transport_error'));
    expect(testLogger.log).toHaveBeenCalledWith(expect.stringContaining('recovered'));
  });

  it('honors Retry-After for retryable upstream statuses', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(new Response('', {
        status: 429,
        headers: {
          'retry-after': '2',
          'x-request-id': 'req-rate-limit',
        },
      }))
      .mockResolvedValueOnce(success());
    const sleepImpl = jest.fn().mockResolvedValue(undefined);
    const testLogger = logger();

    await requestOpenAICompatibleCompletion({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'secret',
      model: 'qwen3.7-plus',
      operation: 'planning',
      requestBody: { model: 'qwen3.7-plus', messages: [] },
      logger: testLogger,
      fetchImpl,
      sleepImpl,
    });

    expect(sleepImpl).toHaveBeenCalledWith(2_000);
    expect(testLogger.warn).toHaveBeenCalledWith(expect.stringContaining('req-rate-limit'));
  });

  it('does not retry a non-retryable provider rejection', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('', {
      status: 400,
      headers: { 'x-request-id': 'req-invalid' },
    }));
    const sleepImpl = jest.fn().mockResolvedValue(undefined);
    const testLogger = logger();

    await expect(requestOpenAICompatibleCompletion({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'secret',
      model: 'qwen3.7-plus',
      operation: 'planning',
      requestBody: { model: 'qwen3.7-plus', messages: [] },
      logger: testLogger,
      fetchImpl,
      sleepImpl,
    })).rejects.toThrow('AI provider request failed (400) [req-invalid]');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).not.toHaveBeenCalled();
    expect(testLogger.error).toHaveBeenCalledWith(expect.stringContaining('"status":400'));
  });

  it('retries invalid JSON and empty content before failing over', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(new Response('not-json', { status: 200 }))
      .mockResolvedValueOnce(success(''))
      .mockResolvedValueOnce(success('usable'));
    const sleepImpl = jest.fn().mockResolvedValue(undefined);
    const testLogger = logger();

    const result = await requestOpenAICompatibleCompletion({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'secret',
      model: 'qwen3.7-plus',
      operation: 'planning',
      requestBody: { model: 'qwen3.7-plus', messages: [] },
      logger: testLogger,
      fetchImpl,
      sleepImpl,
    });

    expect(result).toBe('usable');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(testLogger.warn).toHaveBeenCalledTimes(2);
  });

  it('never writes the API key or request body into diagnostic logs', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('network unavailable'));
    const sleepImpl = jest.fn().mockResolvedValue(undefined);
    const testLogger = logger();

    await expect(requestOpenAICompatibleCompletion({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'super-secret-key',
      model: 'qwen3.7-plus',
      operation: 'planning',
      requestBody: { messages: [{ role: 'user', content: 'private planning text' }] },
      logger: testLogger,
      fetchImpl,
      sleepImpl,
      maxAttempts: 1,
    })).rejects.toThrow('transport failed');

    const logs = JSON.stringify([
      ...testLogger.warn.mock.calls,
      ...testLogger.error.mock.calls,
    ]);
    expect(logs).not.toContain('super-secret-key');
    expect(logs).not.toContain('private planning text');
  });
});
