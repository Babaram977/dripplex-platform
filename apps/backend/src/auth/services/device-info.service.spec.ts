import { DeviceInfoService } from './device-info.service';

describe('DeviceInfoService', () => {
  const service = new DeviceInfoService();

  it('parses Chrome on Windows desktop', () => {
    const info = service.parse(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    );

    expect(info.browser).toBe('Chrome');
    expect(info.operatingSystem).toBe('Windows');
    expect(info.deviceType).toBe('desktop');
    expect(info.device).toContain('Windows');
  });

  it('parses Safari on iPhone', () => {
    const info = service.parse(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );

    expect(info.browser).toBe('Safari');
    expect(info.operatingSystem).toBe('iOS');
    expect(info.deviceType).toBe('mobile');
    expect(info.device).toBe('iPhone');
  });

  it('parses Android tablet', () => {
    const info = service.parse(
      'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    );

    expect(info.operatingSystem).toBe('Android');
    expect(info.deviceType).toBe('tablet');
  });

  it('returns unknown for empty user agent', () => {
    expect(service.parse(null)).toEqual({
      browser: 'Unknown',
      operatingSystem: 'Unknown',
      device: 'Unknown',
      deviceType: 'unknown',
    });
  });

  it('detects bots', () => {
    const info = service.parse('Googlebot/2.1 (+http://www.google.com/bot.html)');
    expect(info.deviceType).toBe('bot');
  });
});
