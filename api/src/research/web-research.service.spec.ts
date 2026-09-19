import { WebResearchService } from './web-research.service';

describe('WebResearchService', () => {
  it('deduplicates URLs across research requests and marks public institutions as official', async () => {
    const provider = {
      providerName: 'test',
      isConfigured: () => true,
      search: jest.fn()
        .mockResolvedValueOnce([
          {
            title: 'Official notice',
            url: 'https://example.gov.cn/notice',
            snippet: 'Registration closes on October 1.',
          },
          {
            title: 'Duplicate',
            url: 'https://example.gov.cn/notice',
            snippet: 'same',
          },
        ])
        .mockResolvedValueOnce([
          {
            title: 'University guide',
            url: 'https://guide.example.edu.cn/exam',
            snippet: 'Exam information.',
          },
        ]),
    };

    const service = new WebResearchService(provider as never);
    const result = await service.research([
      {
        query: 'exam registration',
        reason: 'deadline affects plan',
        highImpact: true,
        preferOfficial: true,
      },
      {
        query: 'exam guide',
        reason: 'verify exam information',
        highImpact: false,
        preferOfficial: true,
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].sourceType).toBe('official');
    expect(result[0].highImpact).toBe(true);
    expect(result[1].sourceType).toBe('official');
    expect(provider.search).toHaveBeenCalledTimes(2);
  });

  it('returns no evidence when the provider is not configured', async () => {
    const provider = {
      providerName: 'test',
      isConfigured: () => false,
      search: jest.fn(),
    };
    const service = new WebResearchService(provider as never);

    await expect(service.research([
      {
        query: 'latest official date',
        reason: 'verify date',
        highImpact: true,
        preferOfficial: true,
      },
    ])).resolves.toEqual([]);
    expect(provider.search).not.toHaveBeenCalled();
  });
});
