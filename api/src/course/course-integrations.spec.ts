import { ConfigService } from '@nestjs/config';
import { CourseService } from './course.service';
import { CourseIntegrationsService, parseHolidays, webdavTarget } from './course-integrations.service';

describe('course integrations', () => {
  const backup = { format: 'sparkflow-courses', version: 1, semesters: [], courses: [] };
  function service() {
    return new CourseIntegrationsService(new ConfigService({ WEBDAV_ALLOWED_ORIGINS: 'https://dav.example.com,https://other.example.com', WEBDAV_URL: 'https://dav.example.com/courses/', WEBDAV_USERNAME: 'server-user', WEBDAV_PASSWORD: 'server-password' }), { exportSchedule: jest.fn().mockResolvedValue(backup) } as unknown as CourseService);
  }
  afterEach(() => jest.restoreAllMocks());
  it('excludes make-up workdays and rejects invalid holiday dates', () => {
    expect(parseHolidays({ year: 2026, days: [{ date: '2026-10-01', isOffDay: true }, { date: '2026-10-10', isOffDay: false }] }, 2026)).toEqual(['2026-10-01']);
    expect(() => parseHolidays({ year: 2026, days: [{ date: '2026-99-01', isOffDay: true }] }, 2026)).toThrow();
    expect(() => parseHolidays({ year: 2027, days: [] }, 2026)).toThrow();
  });
  it('rejects unconfigured origins and credentials embedded in URLs', () => {
    expect(() => webdavTarget('http://127.0.0.1/private', ['https://dav.example.com'], 'u')).toThrow();
    expect(() => webdavTarget('https://name:password@dav.example.com/', ['https://dav.example.com'], 'u')).toThrow();
    expect(webdavTarget('https://dav.example.com/courses/', ['https://dav.example.com'], 'a/b').pathname).toBe('/courses/sparkflow-courses-a%2Fb.json');
  });
  it('uses create-only PUT for a new backup and rejects concurrent changes', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 412 }));
    await expect(service().writeDav('u', {})).rejects.toThrow('远端文件已变化');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PUT', redirect: 'error', headers: { 'If-None-Match': '*' } });
  });
  it('uses If-Match for explicit replacement and never follows redirects', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 201, headers: { ETag: '"v2"' } }));
    await expect(service().writeDav('u', { etag: '"v1"' })).resolves.toEqual({ saved: true, etag: '"v2"' });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error', headers: { 'If-Match': '"v1"' } });
    await expect(service().writeDav('u', { etag: 'W/"v1"' })).rejects.toThrow();
  });
  it('does not send configured credentials to another allowed origin', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    await service().readDav('u', { url: 'https://other.example.com/folder/' });
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Basic Og==' });
  });
  it('validates remote backups before allowing restore preview', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{"version":99}', { status: 200 }));
    await expect(service().readDav('u', {})).rejects.toThrow();
  });
  it('retains holiday cache when the provider is unavailable', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-09-01T00:00:00Z') });
    try {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ year: 2026, days: [{ date: '2026-10-01', isOffDay: true }] }))).mockRejectedValueOnce(new Error('offline'));
      const s = service(); await s.holidays(2026);
      jest.setSystemTime(Date.parse('2026-09-03T00:00:00Z'));
      expect(await s.holidays(2026)).toMatchObject({ dates: ['2026-10-01'], stale: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally { jest.useRealTimers(); }
  });
});
