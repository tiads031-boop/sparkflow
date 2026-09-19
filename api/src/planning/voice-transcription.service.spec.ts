import { BadRequestException } from '@nestjs/common';
import { VoiceTranscriptionService, validatePlanningAudio } from './voice-transcription.service';

describe('planning voice transcription', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts supported short audio', () => {
    expect(validatePlanningAudio({
      buffer: Buffer.from('voice'),
      size: 5,
      mimetype: 'audio/webm;codecs=opus',
    })).toEqual({ size: 5, mimetype: 'audio/webm' });
  });

  it('rejects unsupported audio types', () => {
    expect(() => validatePlanningAudio({
      buffer: Buffer.from('voice'),
      size: 5,
      mimetype: 'application/octet-stream',
    })).toThrow(BadRequestException);
  });

  it('sends base64 input_audio to configured OpenAI-compatible ASR', async () => {
    const config = {
      get: jest.fn((key: string) => ({
        STT_API_KEY: 'test-key',
        STT_BASE_URL: 'https://example.invalid/compatible-mode/v1',
        STT_MODEL: 'qwen3-asr-flash',
      })[key]),
    };
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '明天下午帮我安排两小时复习。' } }],
      }),
    } as Response);

    const service = new VoiceTranscriptionService(config as never);
    const result = await service.transcribe({
      buffer: Buffer.from('voice'),
      size: 5,
      mimetype: 'audio/webm',
    } as Express.Multer.File);

    expect(result.text).toBe('明天下午帮我安排两小时复习。');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(options?.body));
    expect(body.model).toBe('qwen3-asr-flash');
    expect(body.messages[0].content[0].type).toBe('input_audio');
    expect(body.messages[0].content[0].input_audio.data).toMatch(/^data:audio\/webm;base64,/);
    expect(body.asr_options.enable_itn).toBe(true);
  });
});
