import { Injectable } from '@nestjs/common';

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export interface DeviceInfo {
  browser: string;
  operatingSystem: string;
  device: string;
  deviceType: DeviceType;
}

/**
 * Parses User-Agent headers without external APIs or databases.
 */
@Injectable()
export class DeviceInfoService {
  public parse(userAgent: string | null | undefined): DeviceInfo {
    if (!userAgent || userAgent.trim().length === 0) {
      return {
        browser: 'Unknown',
        operatingSystem: 'Unknown',
        device: 'Unknown',
        deviceType: 'unknown',
      };
    }

    const ua = userAgent.trim();
    const browser = this.detectBrowser(ua);
    const operatingSystem = this.detectOs(ua);
    const deviceType = this.detectDeviceType(ua);
    const device = this.detectDevice(ua, deviceType, operatingSystem);

    return { browser, operatingSystem, device, deviceType };
  }

  private detectBrowser(ua: string): string {
    if (/Edg\//i.test(ua)) {
      return 'Edge';
    }
    if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
      return 'Opera';
    }
    if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
      return 'Chrome';
    }
    if (/Firefox\//i.test(ua)) {
      return 'Firefox';
    }
    if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
      return 'Safari';
    }
    if (/MSIE|Trident\//i.test(ua)) {
      return 'Internet Explorer';
    }
    return 'Unknown';
  }

  private detectOs(ua: string): string {
    if (/Android/i.test(ua)) {
      return 'Android';
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return 'iOS';
    }
    if (/Windows NT/i.test(ua)) {
      return 'Windows';
    }
    if (/Mac OS X|Macintosh/i.test(ua)) {
      return 'macOS';
    }
    if (/Linux/i.test(ua)) {
      return 'Linux';
    }
    if (/CrOS/i.test(ua)) {
      return 'ChromeOS';
    }
    return 'Unknown';
  }

  private detectDeviceType(ua: string): DeviceType {
    if (/bot|crawler|spider|slurp|facebookexternalhit/i.test(ua)) {
      return 'bot';
    }
    if (/iPad|Tablet|PlayBook/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
      return 'tablet';
    }
    if (/Mobile|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  private detectDevice(ua: string, deviceType: DeviceType, os: string): string {
    if (/iPhone/i.test(ua)) {
      return 'iPhone';
    }
    if (/iPad/i.test(ua)) {
      return 'iPad';
    }
    if (/Android/i.test(ua)) {
      return 'Android Device';
    }
    if (deviceType === 'desktop') {
      return `${os} Computer`;
    }
    if (deviceType === 'bot') {
      return 'Bot';
    }
    return 'Unknown Device';
  }
}
