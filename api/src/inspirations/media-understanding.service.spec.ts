import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { MediaUnderstandingService, MAX_MEDIA_AI_BYTES } from './media-understanding.service';

function config(values: Record<string, string>) {
  return {
    get: jest.fn((key: string) => values[key]),
  };
}

describe('MediaUnderstandingService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends an image as a Base64 data URL to the configured vision model', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '图片里有三个截止日期和一项待办。' } }],
      }),
    } as Response);
    const service = new MediaUnderstandingService(config({
      AI_BASE_URL: 'https://example.invalid/compatible-mode/v1',
      AI_API_KEY: 'test-key',
      MEDIA_IMAGE_MODEL: 'qwen3-vl-plus',
    }) as never);

    const result = await service.analyzeImage(
      Buffer.from('image'),
      'image/png',
      '项目白板',
    );

    expect(result.summary).toContain('三个截止日期');
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://example.invalid/compatible-mode/v1/chat/completions');
    const body = JSON.parse(String(options?.body));
    expect(body.model).toBe('qwen3-vl-plus');
    expect(body.messages[1].content[0]).toEqual(expect.objectContaining({
      type: 'image_url',
      image_url: {
        url: expect.stringMatching(/^data:image\/png;base64,/),
      },
    }));
  });

  it('parses streamed Omni video JSON into transcript and summary', async () => {
    const raw = [
      'data: {"choices":[{"delta":{"content":"{\\\"transcript\\\":\\\"先做用户访谈，"}}]}',
      'data: {"choices":[{"delta":{"content":"再调整排期。\\\",\\\"summary\\\":\\\"视频讨论了访谈与排期。\\\"}"}}]}',
      'data: [DONE]',
      '',
    ].join('\n');
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => raw,
    } as Response);
    const service = new MediaUnderstandingService(config({
      MEDIA_AI_BASE_URL: 'https://example.invalid/compatible-mode/v1',
      MEDIA_AI_API_KEY: 'test-key',
      MEDIA_VIDEO_MODEL: 'qwen3.8-omni-flash',
    }) as never);

    const result = await service.analyzeVideo(
      Buffer.from('video'),
      'video/mp4',
      '会议视频',
    );

    expect(result).toEqual({
      transcript: '先做用户访谈，再调整排期。',
      summary: '视频讨论了访谈与排期。',
      model: 'qwen3.8-omni-flash',
    });
  });

  it('rejects files above the explicit media AI request boundary', async () => {
    const service = new MediaUnderstandingService(config({
      AI_BASE_URL: 'https://example.invalid/v1',
      AI_API_KEY: 'test-key',
    }) as never);

    await expect(service.analyzeImage(
      Buffer.alloc(MAX_MEDIA_AI_BYTES + 1),
      'image/png',
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails clearly when media AI is not configured', async () => {
    const service = new MediaUnderstandingService(config({}) as never);

    await expect(service.analyzeImage(
      Buffer.from('image'),
      'image/png',
    )).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
