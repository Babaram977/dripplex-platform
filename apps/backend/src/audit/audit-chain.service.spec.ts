import { AuditChainService } from './audit-chain.service';

import type { AuditEventForAppend } from './repositories/audit-log.repository';

describe('AuditChainService', () => {
  let service: AuditChainService;

  const mockEvent: AuditEventForAppend = {
    action: 'WALLET_CREDITED',
    context: {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      ipAddress: '192.168.1.1',
      userAgent: 'chrome/latest',
    },
    details: {
      resource: 'wallet',
      resourceId: '550e8400-e29b-41d4-a716-446655440001',
      metadata: { amount: 1000, currency: 'NGN' },
    },
  };

  beforeEach(() => {
    service = new AuditChainService();
  });

  describe('canonicalizeEvent', () => {
    it('should canonicalize event to deterministic JSON', () => {
      const event = {
        action: 'TEST_ACTION',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
        resource: 'wallet',
        resourceId: 'wallet-456',
        metadata: { amount: 1000 },
        sequence: 1001n,
        segmentId: '550e8400-0000-0000-0000-000000000000',
        timestamp: new Date('2026-09-05T12:34:56.789Z'),
        predecessorHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456ab',
      };

      const canonical = service.canonicalizeEvent(event);

      // Canonical should be JSON string
      expect(typeof canonical).toBe('string');
      const parsed = JSON.parse(canonical);
      expect(parsed.action).toBe('TEST_ACTION');
      expect(parsed.userId).toBe('user-123');
      expect(parsed.sequence).toBe(1001); // BigInt → number
    });

    it('should produce identical canonical form for identical input', () => {
      const event = {
        action: 'TEST',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: null,
        resource: 'wallet',
        resourceId: 'wallet-1',
        metadata: null,
        sequence: 100n,
        segmentId: 'seg-1',
        timestamp: new Date('2026-09-05T12:00:00.000Z'),
        predecessorHash: 'abc',
      };

      const canonical1 = service.canonicalizeEvent(event);
      const canonical2 = service.canonicalizeEvent(event);

      expect(canonical1).toBe(canonical2);
    });

    it('should include null fields (not omit them)', () => {
      const event = {
        action: 'TEST',
        userId: undefined,
        ipAddress: null,
        userAgent: undefined,
        resource: null,
        resourceId: undefined,
        metadata: null,
        sequence: 1n,
        segmentId: 'seg-1',
        timestamp: new Date('2026-09-05T12:00:00.000Z'),
        predecessorHash: 'hash',
      };

      const canonical = service.canonicalizeEvent(event);
      const parsed = JSON.parse(canonical);

      expect(parsed.userId).toBeNull();
      expect(parsed.ipAddress).toBeNull();
      expect(parsed.userAgent).toBeNull();
      expect(parsed.resource).toBeNull();
      expect(parsed.resourceId).toBeNull();
      expect(parsed.metadata).toBeNull();
    });

    it('should serialize with alphabetical field order', () => {
      const event = {
        action: 'TEST',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'agent',
        resource: 'wallet',
        resourceId: 'wallet-1',
        metadata: {},
        sequence: 1n,
        segmentId: 'seg-1',
        timestamp: new Date('2026-09-05T12:00:00.000Z'),
        predecessorHash: 'hash',
      };

      const canonical = service.canonicalizeEvent(event);

      // Check that fields appear in alphabetical order
      const fieldOrder = [
        'action',
        'ipAddress',
        'metadata',
        'predecessorHash',
        'resource',
        'resourceId',
        'segmentId',
        'sequence',
        'timestamp',
        'userAgent',
        'userId',
      ];

      let lastIndex = -1;
      for (const field of fieldOrder) {
        const index = canonical.indexOf(`"${field}"`);
        if (index !== -1) {
          expect(index).toBeGreaterThan(lastIndex);
          lastIndex = index;
        }
      }
    });

    it('should convert BigInt to number in JSON', () => {
      const event = {
        action: 'TEST',
        userId: null,
        ipAddress: null,
        userAgent: null,
        resource: null,
        resourceId: null,
        metadata: null,
        sequence: 9007199254740992n, // Large BigInt
        segmentId: 'seg-1',
        timestamp: new Date('2026-09-05T12:00:00.000Z'),
        predecessorHash: 'hash',
      };

      const canonical = service.canonicalizeEvent(event);
      const parsed = JSON.parse(canonical);

      expect(typeof parsed.sequence).toBe('number');
      expect(parsed.sequence).toBe(9007199254740992);
    });
  });

  describe('calculateEventHash', () => {
    it('should calculate SHA-256 hash', () => {
      const hash = service.calculateEventHash(
        mockEvent,
        1001n,
        '550e8400-0000-0000-0000-000000000000',
        'abc123def456abc123def456abc123def456abc123def456abc123def456ab',
      );

      // SHA-256 hash should be 64-character hex string
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent hash for identical input', () => {
      const hash1 = service.calculateEventHash(
        mockEvent,
        1001n,
        '550e8400-0000-0000-0000-000000000000',
        'abc123def456abc123def456abc123def456abc123def456abc123def456ab',
      );

      const hash2 = service.calculateEventHash(
        mockEvent,
        1001n,
        '550e8400-0000-0000-0000-000000000000',
        'abc123def456abc123def456abc123def456abc123def456abc123def456ab',
      );

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash when sequence changes', () => {
      const predecessorHash = 'abc123def456abc123def456abc123def456abc123def456abc123def456ab';
      const segmentId = '550e8400-0000-0000-0000-000000000000';

      const hash1 = service.calculateEventHash(mockEvent, 1001n, segmentId, predecessorHash);

      const hash2 = service.calculateEventHash(mockEvent, 1002n, segmentId, predecessorHash);

      expect(hash1).not.toBe(hash2);
    });

    it('should include predecessorHash in calculation (chain binding)', () => {
      const segmentId = '550e8400-0000-0000-0000-000000000000';

      const hash1 = service.calculateEventHash(
        mockEvent,
        1001n,
        segmentId,
        'abc123def456abc123def456abc123def456abc123def456abc123def456ab',
      );

      const hash2 = service.calculateEventHash(
        mockEvent,
        1001n,
        segmentId,
        'def456abc123def456abc123def456abc123def456abc123def456abc123def4',
      );

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hash when event content changes', () => {
      const segmentId = '550e8400-0000-0000-0000-000000000000';
      const predecessorHash = 'abc123def456abc123def456abc123def456abc123def456abc123def456ab';

      const hash1 = service.calculateEventHash(mockEvent, 1001n, segmentId, predecessorHash);

      const eventWithDifferentAction: AuditEventForAppend = {
        ...mockEvent,
        action: 'WALLET_DEBITED',
      };

      const hash2 = service.calculateEventHash(
        eventWithDifferentAction,
        1001n,
        segmentId,
        predecessorHash,
      );

      expect(hash1).not.toBe(hash2);
    });
  });
});
