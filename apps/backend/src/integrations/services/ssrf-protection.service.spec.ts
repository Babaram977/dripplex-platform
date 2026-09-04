import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { SsrfProtectionService } from './ssrf-protection.service';

describe('SsrfProtectionService', () => {
  let service: SsrfProtectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SsrfProtectionService],
    }).compile();

    service = module.get<SsrfProtectionService>(SsrfProtectionService);
  });

  describe('Valid URLs', () => {
    it('should allow legitimate external HTTPS URLs', () => {
      expect(() => { service.validateUrl('https://webhook.example.com/endpoint'); }).not.toThrow();
    });

    it('should allow legitimate external HTTP URLs', () => {
      expect(() => { service.validateUrl('http://webhook.example.com/endpoint'); }).not.toThrow();
    });

    it('should allow URLs with query parameters', () => {
      expect(() =>
        { service.validateUrl('https://webhook.example.com/endpoint?key=value&foo=bar'); },
      ).not.toThrow();
    });

    it('should allow URLs with fragments', () => {
      expect(() =>
        { service.validateUrl('https://webhook.example.com/endpoint#section'); },
      ).not.toThrow();
    });

    it('should allow URLs with port numbers', () => {
      expect(() => { service.validateUrl('https://webhook.example.com:8443/endpoint'); }).not.toThrow();
    });

    it('should allow complex external domain names', () => {
      expect(() =>
        { service.validateUrl('https://api.webhooks.service.co.uk/v1/endpoint'); },
      ).not.toThrow();
    });
  });

  describe('Blocked - Loopback addresses', () => {
    it('should reject 127.0.0.1', () => {
      expect(() => { service.validateUrl('http://127.0.0.1:8000/endpoint'); }).toThrow(
        BadRequestException,
      );
    });

    it('should reject 127.255.255.255', () => {
      expect(() => { service.validateUrl('http://127.255.255.255/endpoint'); }).toThrow(
        BadRequestException,
      );
    });

    it('should reject localhost', () => {
      expect(() => { service.validateUrl('http://localhost/endpoint'); }).toThrow(BadRequestException);
    });

    it('should reject localhost variations', () => {
      expect(() => { service.validateUrl('http://localhost.localdomain/endpoint'); }).toThrow(
        BadRequestException,
      );
    });

    it('should reject IPv6 loopback ::1', () => {
      expect(() => { service.validateUrl('http://[::1]/endpoint'); }).toThrow(BadRequestException);
    });

    it('should reject IPv6 loopback without brackets', () => {
      expect(() => { service.validateUrl('http://::1/endpoint'); }).toThrow(BadRequestException);
    });
  });

  describe('Blocked - Private IP ranges (RFC1918)', () => {
    it('should reject 10.0.0.0/8', () => {
      expect(() => { service.validateUrl('http://10.0.0.1/endpoint'); }).toThrow(BadRequestException);
      expect(() => { service.validateUrl('http://10.255.255.255/endpoint'); }).toThrow(
        BadRequestException,
      );
    });

    it('should reject 172.16.0.0/12', () => {
      expect(() => { service.validateUrl('http://172.16.0.1/endpoint'); }).toThrow(BadRequestException);
      expect(() => { service.validateUrl('http://172.31.255.255/endpoint'); }).toThrow(
        BadRequestException,
      );
    });

    it('should reject 192.168.0.0/16', () => {
      expect(() => { service.validateUrl('http://192.168.0.1/endpoint'); }).toThrow(BadRequestException);
      expect(() => { service.validateUrl('http://192.168.255.255/endpoint'); }).toThrow(
        BadRequestException,
      );
    });

    it('should allow 172.15.255.255 (just outside range)', () => {
      expect(() => { service.validateUrl('http://172.15.255.255/endpoint'); }).not.toThrow();
    });

    it('should allow 172.32.0.0 (just outside range)', () => {
      expect(() => { service.validateUrl('http://172.32.0.0/endpoint'); }).not.toThrow();
    });
  });

  describe('Blocked - Link-local addresses', () => {
    it('should reject 169.254.0.0/16 (IPv4 link-local)', () => {
      expect(() => { service.validateUrl('http://169.254.0.1/endpoint'); }).toThrow(BadRequestException);
      expect(() => { service.validateUrl('http://169.254.255.255/endpoint'); }).toThrow(
        BadRequestException,
      );
    });

    it('should reject IPv6 link-local fe80::/10', () => {
      expect(() => { service.validateUrl('http://[fe80::1]/endpoint'); }).toThrow(BadRequestException);
      expect(() => { service.validateUrl('http://[fe80::ffff]/endpoint'); }).toThrow(
        BadRequestException,
      );
    });
  });

  describe('Blocked - Cloud metadata endpoints', () => {
    it('should reject AWS metadata endpoint', () => {
      expect(() => { service.validateUrl('http://169.254.169.254/latest/meta-data'); }).toThrow(
        BadRequestException,
      );
    });

    it('should reject AWS metadata fallback', () => {
      expect(() => { service.validateUrl('http://169.254.169.253/latest/meta-data'); }).toThrow(
        BadRequestException,
      );
    });

    it('should reject ECS task metadata', () => {
      expect(() => { service.validateUrl('http://169.254.170.2/v2/metadata'); }).toThrow(
        BadRequestException,
      );
    });

    it('should reject Azure metadata endpoint', () => {
      expect(() => { service.validateUrl('http://168.63.129.16/metadata/instance'); }).toThrow(
        BadRequestException,
      );
    });
  });

  describe('Blocked - Multicast addresses', () => {
    it('should reject IPv4 multicast 224.0.0.0/4', () => {
      expect(() => { service.validateUrl('http://224.0.0.1/endpoint'); }).toThrow(BadRequestException);
      expect(() => { service.validateUrl('http://239.255.255.255/endpoint'); }).toThrow(
        BadRequestException,
      );
    });

    it('should reject IPv6 multicast ff00::/8', () => {
      expect(() => { service.validateUrl('http://[ff00::1]/endpoint'); }).toThrow(BadRequestException);
      expect(() => { service.validateUrl('http://[ffff::1]/endpoint'); }).toThrow(BadRequestException);
    });
  });

  describe('Invalid URLs', () => {
    it('should reject invalid URL format', () => {
      expect(() => { service.validateUrl('not a valid url'); }).toThrow(BadRequestException);
    });

    it('should reject non-HTTP/HTTPS protocols', () => {
      expect(() => { service.validateUrl('ftp://example.com/file'); }).toThrow(BadRequestException);
      expect(() => { service.validateUrl('file:///etc/passwd'); }).toThrow(BadRequestException);
      expect(() => { service.validateUrl('gopher://example.com'); }).toThrow(BadRequestException);
    });

    it('should reject empty URL', () => {
      expect(() => { service.validateUrl(''); }).toThrow(BadRequestException);
    });
  });

  describe('Edge cases', () => {
    it('should handle IPv6 with port number', () => {
      expect(() => { service.validateUrl('https://[2001:db8::1]:8443/endpoint'); }).not.toThrow();
    });

    it('should handle domain names with many levels', () => {
      expect(() =>
        { service.validateUrl('https://webhook.v1.stage.api.example.com/endpoint'); },
      ).not.toThrow();
    });

    it('should handle URLs with special characters in path', () => {
      expect(() =>
        { service.validateUrl('https://example.com/webhook?api_key=abc123&sig=xyz'); },
      ).not.toThrow();
    });
  });
});
