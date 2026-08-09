import {
  BusinessStatus,
  BusinessType,
  BusinessVerificationStatus,
  KycDocumentType,
  KycVerificationStatus,
  MerchantStatus,
  OnboardingStatus,
  type Business,
  type MerchantKyc,
  type BankAccount,
} from '@prisma/client';

import {
  ConflictDomainException,
  EmailNotVerifiedDomainException,
  ForbiddenDomainException,
  NotFoundDomainException,
  PhoneNotVerifiedDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { StorageAssetService } from '../uploads/storage-asset.service';

import { MERCHANT_AUDIT_ACTIONS } from './merchant.constants';
import { MerchantsService } from './merchants.service';

import type { AuditService } from '../audit/audit.service';
import type { AppConfigService } from '../config/app-config.service';
import type { NotificationService } from '../notifications/notification.service';
import type { MerchantsRepository } from './repositories/merchants.repository';

const merchantId = '11111111-1111-1111-1111-111111111111';
const adminId = '22222222-2222-2222-2222-222222222222';
const businessId = '33333333-3333-3333-3333-333333333333';
const kycId = '44444444-4444-4444-4444-444444444444';
const bankId = '55555555-5555-5555-5555-555555555555';
const profileId = '66666666-6666-6666-6666-666666666666';

const verifiedUser = {
  id: merchantId,
  email: 'merchant@dripplex.test',
  phone: '+2348012345678',
  firstName: 'Ada',
  lastName: 'Merchant',
  emailVerifiedAt: new Date('2026-01-01'),
  phoneVerifiedAt: new Date('2026-01-01'),
  passwordHash: 'hash',
  status: 'ACTIVE',
  registrationChannel: 'MERCHANT_PORTAL',
  lastLoginAt: null,
  lastActiveAt: null,
  passwordChangedAt: null,
  blockedAt: null,
  blockedReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const profile = {
  id: profileId,
  userId: merchantId,
  status: MerchantStatus.PENDING,
  isApproved: false,
  approvedAt: null,
  approvedBy: null,
  rejectedReason: null,
  suspendedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  user: verifiedUser,
};

const business = {
  id: businessId,
  merchantId,
  businessName: 'Ada Foods',
  businessType: BusinessType.SOLE_PROPRIETORSHIP,
  registrationNumber: 'RC123456',
  taxNumber: null,
  description: 'Local meals',
  email: 'biz@dripplex.test',
  phone: '+2348012345678',
  country: 'Nigeria',
  state: 'Lagos',
  city: 'Ikeja',
  address: '12 Allen Avenue',
  latitude: 6.6018,
  longitude: 3.3515,
  logoUrl: null,
  coverPhotoUrl: null,
  status: BusinessStatus.SUBMITTED,
  verificationStatus: BusinessVerificationStatus.UNDER_REVIEW,
  approvedBy: null,
  approvedAt: null,
  rejectedReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Business;

const pendingKyc = {
  id: kycId,
  merchantId,
  businessId,
  documentType: KycDocumentType.CAC_CERTIFICATE,
  documentNumber: 'RC123456',
  frontImage: 'https://cdn.example/front.jpg',
  backImage: null,
  selfieImage: null,
  verificationStatus: KycVerificationStatus.PENDING,
  reviewedBy: null,
  reviewedAt: null,
  remarks: null,
  createdAt: new Date(),
} as MerchantKyc;

const verifiedKyc = {
  ...pendingKyc,
  verificationStatus: KycVerificationStatus.VERIFIED,
  reviewedBy: adminId,
  reviewedAt: new Date(),
} as MerchantKyc;

const bankAccount = {
  id: bankId,
  merchantId,
  bankName: 'Access Bank',
  accountName: 'Ada Foods',
  accountNumber: '0123456789',
  currency: 'NGN',
  isDefault: true,
  verifiedAt: null,
  createdAt: new Date(),
} as BankAccount;

const createBusinessDto = {
  businessName: 'Ada Foods',
  businessType: BusinessType.SOLE_PROPRIETORSHIP,
  registrationNumber: 'rc123456',
  email: 'biz@dripplex.test',
  phone: '+2348012345678',
  country: 'Nigeria',
  state: 'Lagos',
  city: 'Ikeja',
  address: '12 Allen Avenue',
  latitude: 6.6018,
  longitude: 3.3515,
};

describe('MerchantsService', () => {
  const repository: jest.Mocked<MerchantsRepository> = {
    findMerchantProfileByUserId: jest.fn(),
    findMerchantProfileById: jest.fn(),
    findBusinessByMerchantId: jest.fn(),
    setBusinessPauseState: jest.fn(),
    findBusinessByRegistrationNumber: jest.fn(),
    createBusiness: jest.fn(),
    updateBusiness: jest.fn(),
    createKyc: jest.fn(),
    findLatestKycByMerchantId: jest.fn(),
    findActivePendingKyc: jest.fn(),
    listKycByMerchantId: jest.fn(),
    verifyKyc: jest.fn(),
    rejectKyc: jest.fn(),
    createBankAccount: jest.fn(),
    findBankAccountById: jest.fn(),
    findBankAccountByNumber: jest.fn(),
    listBankAccounts: jest.fn(),
    setDefaultBankAccount: jest.fn(),
    listMerchants: jest.fn(),
    getMerchantAdminDetail: jest.fn(),
    updateMerchantLifecycle: jest.fn(),
    getAuditSummary: jest.fn(),
  };

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const notifications = {
    notifyMerchantLifecycle: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationService>;

  // Storage disabled in unit tests: ownership checks no-op, signing passes URLs through.
  const storageAssets = {
    assertOwned: jest.fn(),
    assertOwnedOptional: jest.fn(),
    assertOwnedMany: jest.fn(),
    toSignedGetUrl: jest.fn((url: string) => Promise.resolve(url)),
    toSignedGetUrlOptional: jest.fn((url: string | null | undefined) => Promise.resolve(url)),
  } as unknown as StorageAssetService;

  const service = new MerchantsService(repository, auditService, notifications, storageAssets);
  const context = { userId: merchantId, ipAddress: '127.0.0.1' };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findMerchantProfileByUserId.mockResolvedValue(profile as never);
  });

  describe('createBusiness', () => {
    it('creates a business, audits, and notifies', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue(null);
      repository.findBusinessByRegistrationNumber.mockResolvedValue(null);
      repository.createBusiness.mockResolvedValue(business);

      const result = await service.createBusiness(merchantId, createBusinessDto, context);

      expect(result.businessName).toBe('Ada Foods');
      expect(repository.createBusiness).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationNumber: 'RC123456',
          status: BusinessStatus.SUBMITTED,
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        MERCHANT_AUDIT_ACTIONS.BUSINESS_CREATED,
        expect.any(Object),
        expect.objectContaining({ resource: 'business' }),
      );
      expect(notifications.notifyMerchantLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'business_submitted' }),
      );
    });

    it('rejects when email is not verified', async () => {
      repository.findMerchantProfileByUserId.mockResolvedValue({
        ...profile,
        user: { ...verifiedUser, emailVerifiedAt: null },
      } as never);

      await expect(
        service.createBusiness(merchantId, createBusinessDto, context),
      ).rejects.toBeInstanceOf(EmailNotVerifiedDomainException);
    });

    it('rejects when phone is not verified', async () => {
      repository.findMerchantProfileByUserId.mockResolvedValue({
        ...profile,
        user: { ...verifiedUser, phoneVerifiedAt: null },
      } as never);

      await expect(
        service.createBusiness(merchantId, createBusinessDto, context),
      ).rejects.toBeInstanceOf(PhoneNotVerifiedDomainException);
    });

    it('rejects duplicate active business', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue(business);

      await expect(
        service.createBusiness(merchantId, createBusinessDto, context),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('rejects duplicate CAC/registration number', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue(null);
      repository.findBusinessByRegistrationNumber.mockResolvedValue(business);

      await expect(
        service.createBusiness(merchantId, createBusinessDto, context),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('rejects invalid coordinates', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue(null);
      repository.findBusinessByRegistrationNumber.mockResolvedValue(null);

      await expect(
        service.createBusiness(merchantId, { ...createBusinessDto, latitude: 120 }, context),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });
  });

  describe('updateBusiness', () => {
    it('updates editable fields and audits', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue(business);
      repository.updateBusiness.mockResolvedValue({
        ...business,
        businessName: 'Ada Kitchen',
      });

      const result = await service.updateBusiness(
        merchantId,
        { businessName: 'Ada Kitchen' },
        context,
      );

      expect(result.businessName).toBe('Ada Kitchen');
      expect(auditService.record).toHaveBeenCalledWith(
        MERCHANT_AUDIT_ACTIONS.BUSINESS_UPDATED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('throws when business missing', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue(null);
      await expect(
        service.updateBusiness(merchantId, { businessName: 'X' }, context),
      ).rejects.toBeInstanceOf(NotFoundDomainException);
    });
  });

  describe('pauseStore / resumeStore', () => {
    it('pauses an active store and audits', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue({
        ...business,
        status: BusinessStatus.ACTIVE,
      });
      repository.setBusinessPauseState.mockResolvedValue({
        ...business,
        status: BusinessStatus.PAUSED,
        pausedAt: new Date(),
        pauseReason: 'Out of ingredients',
      });

      const result = await service.pauseStore(merchantId, 'Out of ingredients', context);

      expect(result.status).toBe('PAUSED');
      expect(repository.setBusinessPauseState).toHaveBeenCalledWith(businessId, {
        status: BusinessStatus.PAUSED,
        pausedAt: expect.any(Date),
        pauseReason: 'Out of ingredients',
      });
      expect(auditService.record).toHaveBeenCalledWith(
        MERCHANT_AUDIT_ACTIONS.STORE_PAUSED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('rejects pausing a non-active store', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue({
        ...business,
        status: BusinessStatus.PAUSED,
      });

      await expect(service.pauseStore(merchantId, undefined, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('resumes a paused store and audits', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue({
        ...business,
        status: BusinessStatus.PAUSED,
      });
      repository.setBusinessPauseState.mockResolvedValue({
        ...business,
        status: BusinessStatus.ACTIVE,
        pausedAt: null,
        pauseReason: null,
      });

      const result = await service.resumeStore(merchantId, context);

      expect(result.status).toBe('ACTIVE');
      expect(repository.setBusinessPauseState).toHaveBeenCalledWith(businessId, {
        status: BusinessStatus.ACTIVE,
        pausedAt: null,
        pauseReason: null,
      });
      expect(auditService.record).toHaveBeenCalledWith(
        MERCHANT_AUDIT_ACTIONS.STORE_RESUMED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('rejects resuming a non-paused store', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue({
        ...business,
        status: BusinessStatus.ACTIVE,
      });

      await expect(service.resumeStore(merchantId, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });
  });

  describe('KYC', () => {
    it('submits KYC documents', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue(business);
      repository.findActivePendingKyc.mockResolvedValue(null);
      repository.createKyc.mockResolvedValue(pendingKyc);

      const result = await service.submitKyc(
        merchantId,
        {
          documentType: KycDocumentType.CAC_CERTIFICATE,
          documentNumber: 'RC123456',
          frontImage: 'https://cdn.example/front.jpg',
        },
        context,
      );

      expect(result.verificationStatus).toBe('PENDING');
      expect(auditService.record).toHaveBeenCalledWith(
        MERCHANT_AUDIT_ACTIONS.KYC_SUBMITTED,
        expect.any(Object),
        expect.any(Object),
      );
      expect(notifications.notifyMerchantLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'kyc_submitted' }),
      );
    });

    it('rejects duplicate pending KYC', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue(business);
      repository.findActivePendingKyc.mockResolvedValue(pendingKyc);

      await expect(
        service.submitKyc(
          merchantId,
          {
            documentType: KycDocumentType.PASSPORT,
            documentNumber: 'A123',
            frontImage: 'https://cdn.example/p.jpg',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('(DPX-STORAGE-001 D) rejects a KYC front image that is a foreign / cross-user URL', async () => {
      repository.findBusinessByMerchantId.mockResolvedValue(business);
      repository.findActivePendingKyc.mockResolvedValue(null);
      // A merchants service wired with configured storage so the ownership guard runs.
      const guarded = new MerchantsService(
        repository,
        auditService,
        notifications,
        new StorageAssetService(
          {
            objectStorageConfigured: true,
            objectStorageEndpoint: 'https://s3.example.com',
            objectStorageBucket: 'dripplex-assets',
            objectStoragePublicBaseUrl: '',
          } as unknown as AppConfigService,
          {
            createPresignedPutUrl: jest.fn(),
            createPresignedGetUrl: jest.fn(),
          },
        ),
      );

      await expect(
        guarded.submitKyc(
          merchantId,
          {
            documentType: KycDocumentType.PASSPORT,
            documentNumber: 'A123',
            frontImage: 'https://evil.example.com/kyc-documents/other/p.jpg',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ForbiddenDomainException);
      expect(repository.createKyc).not.toHaveBeenCalled();
    });

    it('returns KYC status list', async () => {
      repository.listKycByMerchantId.mockResolvedValue([pendingKyc] as never);
      const result = await service.getKycStatus(merchantId);
      expect(result.latest?.id).toBe(kycId);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('bank accounts', () => {
    it('creates a bank account', async () => {
      repository.findBankAccountByNumber.mockResolvedValue(null);
      repository.createBankAccount.mockResolvedValue(bankAccount);

      const result = await service.createBankAccount(
        merchantId,
        {
          bankName: 'Access Bank',
          accountName: 'Ada Foods',
          accountNumber: '0123456789',
        },
        context,
      );

      expect(result.accountNumber).toBe('0123456789');
      expect(auditService.record).toHaveBeenCalledWith(
        MERCHANT_AUDIT_ACTIONS.BANK_CREATED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('rejects duplicate account number', async () => {
      repository.findBankAccountByNumber.mockResolvedValue(bankAccount);
      await expect(
        service.createBankAccount(
          merchantId,
          {
            bankName: 'Access Bank',
            accountName: 'Ada Foods',
            accountNumber: '0123456789',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('lists bank accounts', async () => {
      repository.listBankAccounts.mockResolvedValue([bankAccount] as never);
      const result = await service.listBankAccounts(merchantId);
      expect(result).toHaveLength(1);
    });

    it('sets default bank account', async () => {
      repository.findBankAccountById.mockResolvedValue(bankAccount);
      repository.setDefaultBankAccount.mockResolvedValue(bankAccount);

      const result = await service.setDefaultBankAccount(merchantId, bankId, context);
      expect(result.isDefault).toBe(true);
      expect(auditService.record).toHaveBeenCalledWith(
        MERCHANT_AUDIT_ACTIONS.BANK_UPDATED,
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('admin list and detail', () => {
    it('lists merchants with pagination metadata', async () => {
      repository.listMerchants.mockResolvedValue({
        items: [
          {
            ...profile,
            user: verifiedUser,
            business,
            kycDocuments: [pendingKyc],
            bankAccounts: [bankAccount],
            onboarding: { id: 'o1', status: OnboardingStatus.SUBMITTED },
          },
        ] as never,
        total: 1,
      });

      const result = await service.listMerchants({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(repository.listMerchants).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('applies filters when listing', async () => {
      repository.listMerchants.mockResolvedValue({ items: [], total: 0 });
      await service.listMerchants({
        page: 2,
        limit: 10,
        status: MerchantStatus.UNDER_REVIEW,
        country: 'Nigeria',
        state: 'Lagos',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      });

      expect(repository.listMerchants).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          status: MerchantStatus.UNDER_REVIEW,
          country: 'Nigeria',
          state: 'Lagos',
        }),
      );
    });

    it('returns merchant profile with audit summary', async () => {
      repository.getMerchantAdminDetail.mockResolvedValue({
        ...profile,
        user: verifiedUser,
        business,
        kycDocuments: [pendingKyc],
        bankAccounts: [bankAccount],
        onboarding: null,
      } as never);
      repository.getAuditSummary.mockResolvedValue([
        { action: 'merchant.business.created', count: 1, lastAt: new Date() },
      ]);

      const result = await service.getMerchantProfile(merchantId);
      expect(result.profile.business?.id).toBe(businessId);
      expect(result.auditSummary[0]?.action).toBe('merchant.business.created');
    });
  });

  describe('admin approval workflow', () => {
    const adminDetail = {
      ...profile,
      status: MerchantStatus.UNDER_REVIEW,
      user: verifiedUser,
      business,
      kycDocuments: [verifiedKyc],
      bankAccounts: [bankAccount],
      onboarding: { id: 'o1', status: OnboardingStatus.SUBMITTED },
    };

    it('verifies KYC', async () => {
      repository.findActivePendingKyc.mockResolvedValue(pendingKyc);
      repository.verifyKyc.mockResolvedValue(verifiedKyc);

      const result = await service.verifyKyc(merchantId, adminId, 'ok', context);
      expect(result.verificationStatus).toBe('VERIFIED');
      expect(auditService.record).toHaveBeenCalledWith(
        MERCHANT_AUDIT_ACTIONS.KYC_VERIFIED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('approves merchant when KYC verified and business exists', async () => {
      repository.getMerchantAdminDetail.mockResolvedValue(adminDetail as never);
      repository.updateMerchantLifecycle.mockResolvedValue(adminDetail as never);

      const result = await service.approveMerchant(merchantId, adminId, context);
      expect(result.status).toBe('APPROVED');
      expect(repository.updateMerchantLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MerchantStatus.APPROVED,
          businessStatus: BusinessStatus.ACTIVE,
          onboardingStatus: OnboardingStatus.APPROVED,
        }),
      );
      expect(notifications.notifyMerchantLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'merchant_approved' }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        MERCHANT_AUDIT_ACTIONS.APPROVED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('rejects approval without verified KYC', async () => {
      repository.getMerchantAdminDetail.mockResolvedValue({
        ...adminDetail,
        kycDocuments: [pendingKyc],
      } as never);

      await expect(service.approveMerchant(merchantId, adminId, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('rejects approval without business', async () => {
      repository.getMerchantAdminDetail.mockResolvedValue({
        ...adminDetail,
        business: null,
      } as never);

      await expect(service.approveMerchant(merchantId, adminId, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('rejects merchant with reason', async () => {
      repository.getMerchantAdminDetail.mockResolvedValue(adminDetail as never);
      repository.updateMerchantLifecycle.mockResolvedValue(adminDetail as never);

      const result = await service.rejectMerchant(
        merchantId,
        adminId,
        'Incomplete documents',
        context,
      );

      expect(result.status).toBe('REJECTED');
      expect(result.rejectedReason).toBe('Incomplete documents');
      expect(notifications.notifyMerchantLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'merchant_rejected' }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        MERCHANT_AUDIT_ACTIONS.REJECTED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('suspends an approved merchant', async () => {
      repository.getMerchantAdminDetail.mockResolvedValue({
        ...adminDetail,
        status: MerchantStatus.APPROVED,
      } as never);
      repository.updateMerchantLifecycle.mockResolvedValue(adminDetail as never);

      const result = await service.suspendMerchant(
        merchantId,
        adminId,
        'Policy violation',
        context,
      );
      expect(result.status).toBe('SUSPENDED');
      expect(notifications.notifyMerchantLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'merchant_suspended' }),
      );
    });

    it('reactivates a suspended merchant', async () => {
      repository.getMerchantAdminDetail.mockResolvedValue({
        ...adminDetail,
        status: MerchantStatus.SUSPENDED,
      } as never);
      repository.updateMerchantLifecycle.mockResolvedValue(adminDetail as never);

      const result = await service.reactivateMerchant(merchantId, adminId, context);
      expect(result.status).toBe('APPROVED');
      expect(notifications.notifyMerchantLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'merchant_reactivated' }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        MERCHANT_AUDIT_ACTIONS.REACTIVATED,
        expect.any(Object),
        expect.any(Object),
      );
    });
  });
});
