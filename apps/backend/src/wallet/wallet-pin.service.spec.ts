import * as bcrypt from 'bcrypt';

import {
  ConflictDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { WalletPinService } from './wallet-pin.service';

import type { AuditService } from '../audit/audit.service';
import type { AppConfigService } from '../config/app-config.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';

const userId = '11111111-1111-4111-8111-111111111111';

interface WalletPinPrismaMock {
  walletPin: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
}

describe('WalletPinService', () => {
  let prisma: WalletPinPrismaMock;
  let appConfig: { bcryptSaltRounds: number };
  let auditService: { record: jest.Mock };
  let eventBus: { emit: jest.Mock };
  let service: WalletPinService;

  beforeEach(() => {
    prisma = {
      walletPin: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    appConfig = { bcryptSaltRounds: 4 };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    eventBus = { emit: jest.fn().mockResolvedValue(undefined) };
    service = new WalletPinService(
      prisma as unknown as PrismaService,
      appConfig as unknown as AppConfigService,
      auditService as unknown as AuditService,
      eventBus as unknown as DomainEventBus,
    );
  });

  describe('hasPin', () => {
    it('returns false when no PIN row exists', async () => {
      prisma.walletPin.findUnique.mockResolvedValue(null);

      await expect(service.hasPin(userId)).resolves.toBe(false);
    });

    it('returns true when a PIN row exists', async () => {
      prisma.walletPin.findUnique.mockResolvedValue({ userId, pinHash: 'hash' });

      await expect(service.hasPin(userId)).resolves.toBe(true);
    });
  });

  describe('set', () => {
    it('rejects a non-4-digit PIN', async () => {
      await expect(service.set(userId, '12')).rejects.toThrow(ValidationDomainException);
      expect(prisma.walletPin.create).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric PIN', async () => {
      await expect(service.set(userId, 'abcd')).rejects.toThrow(ValidationDomainException);
    });

    it('stores a bcrypt hash, not the raw PIN', async () => {
      prisma.walletPin.findUnique.mockResolvedValue(null);
      prisma.walletPin.create.mockResolvedValue({ userId, pinHash: 'hashed' });

      await service.set(userId, '1234');

      const createCall = prisma.walletPin.create.mock.calls[0] as [{ data: { pinHash: string } }];
      expect(createCall[0].data.pinHash).not.toBe('1234');
      expect(auditService.record).toHaveBeenCalled();
    });

    it('refuses to overwrite an existing PIN', async () => {
      prisma.walletPin.findUnique.mockResolvedValue({ userId, pinHash: 'existing' });

      await expect(service.set(userId, '1234')).rejects.toThrow(ConflictDomainException);
      expect(prisma.walletPin.create).not.toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('throws when no PIN has been set', async () => {
      prisma.walletPin.findUnique.mockResolvedValue(null);

      await expect(service.verify(userId, '1234')).rejects.toThrow(ValidationDomainException);
    });

    it('throws when the PIN is wrong', async () => {
      const pinHash = await bcrypt.hash('1234', 4);
      prisma.walletPin.findUnique.mockResolvedValue({ userId, pinHash });

      await expect(service.verify(userId, '9999')).rejects.toThrow(ValidationDomainException);
    });

    it('resolves silently when the PIN is correct', async () => {
      const pinHash = await bcrypt.hash('1234', 4);
      prisma.walletPin.findUnique.mockResolvedValue({ userId, pinHash });

      await expect(service.verify(userId, '1234')).resolves.toBeUndefined();
    });
  });

  describe('change', () => {
    it('rejects an invalid new PIN', async () => {
      await expect(service.change(userId, '1234', '12')).rejects.toThrow(ValidationDomainException);
      expect(prisma.walletPin.update).not.toHaveBeenCalled();
    });

    it('rejects when the current PIN is wrong', async () => {
      const pinHash = await bcrypt.hash('1234', 4);
      prisma.walletPin.findUnique.mockResolvedValue({ userId, pinHash });

      await expect(service.change(userId, '9999', '5678')).rejects.toThrow(
        ValidationDomainException,
      );
      expect(prisma.walletPin.update).not.toHaveBeenCalled();
    });

    it('replaces the PIN hash when the current PIN verifies', async () => {
      const pinHash = await bcrypt.hash('1234', 4);
      prisma.walletPin.findUnique.mockResolvedValue({ userId, pinHash });
      prisma.walletPin.update.mockResolvedValue({ userId, pinHash: 'new-hash' });

      await service.change(userId, '1234', '5678');

      const updateCall = prisma.walletPin.update.mock.calls[0] as [
        { where: { userId: string }; data: { pinHash: string } },
      ];
      expect(updateCall[0].where).toEqual({ userId });
      expect(updateCall[0].data.pinHash).not.toBe('5678');
      expect(auditService.record).toHaveBeenCalled();
      expect(eventBus.emit).toHaveBeenCalledWith('WalletPinChanged', { userId });
    });
  });
});
