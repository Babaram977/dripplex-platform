import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  BusinessStatus,
  BusinessVerificationStatus,
  KycVerificationStatus,
  MerchantCategory,
  MerchantStatus,
  OnboardingStatus,
} from '@prisma/client';

import { GEOCODER, type Geocoder } from '../addresses/geocoding/geocoder';
import { AuditService } from '../audit/audit.service';
import {
  ConflictDomainException,
  EmailNotVerifiedDomainException,
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../notifications/notification.service';
import { StorageAssetService } from '../uploads/storage-asset.service';

import { geocodableAddress, hasKnownLocation } from './business-location';
import { MERCHANT_AUDIT_ACTIONS, requiredKycDocumentTypes } from './merchant.constants';
import {
  toBankAccountDto,
  toBusinessDto,
  toMerchantKycDto,
  toMerchantProfileDto,
} from './merchant.mapper';
import {
  MERCHANTS_REPOSITORY,
  type MerchantAdminDetail,
  type MerchantProfileWithUser,
  type MerchantsRepository,
} from './repositories/merchants.repository';

import type { CreateBankAccountDto } from './dto/create-bank-account.dto';
import type { CreateBusinessDto } from './dto/create-business.dto';
import type { ListMerchantsQueryDto } from './dto/list-merchants-query.dto';
import type { SubmitKycDto } from './dto/submit-kyc.dto';
import type { UpdateBusinessDto } from './dto/update-business.dto';
import type { AuditContext } from '../audit/audit.service';
import type {
  BankAccountDto,
  BusinessDto,
  MerchantApprovalDto,
  MerchantKycDto,
  MerchantProfileDto,
} from '@dripplex/types';

@Injectable()
export class MerchantsService {
  private readonly logger = new Logger(MerchantsService.name);

  constructor(
    @Inject(MERCHANTS_REPOSITORY)
    private readonly merchantsRepository: MerchantsRepository,
    private readonly auditService: AuditService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifications: NotificationService,
    private readonly storageAssets: StorageAssetService,
    @Optional()
    @Inject(GEOCODER)
    private readonly geocoder?: Geocoder,
    @Optional()
    private readonly eventBus?: DomainEventBus,
  ) {}

  /**
   * Coordinates for a business, derived from its registered address.
   *
   * Minimal onboarding takes a single free-text address and no coordinates, so
   * without this a merchant trades with latitude/longitude at 0 and delivery
   * dispatch has nothing to work from.
   *
   * Best-effort on purpose: a maps outage must not block a merchant from
   * onboarding or editing their store. When it cannot resolve, the business
   * keeps whatever it had and DeliveryService geocodes again — and refuses to
   * guess — at the point where a wrong location would actually cost money.
   */
  private async coordinatesFromAddress(
    place: {
      address: string;
      city?: string | null;
      state?: string | null;
      country?: string | null;
    },
    explicitLatitude?: number,
    explicitLongitude?: number,
  ): Promise<{ latitude: number; longitude: number } | null> {
    if (explicitLatitude !== undefined || explicitLongitude !== undefined) {
      return null; // the merchant gave real coordinates; never override them
    }
    // Everything the business knows about where it is, not just the street
    // line. Minimal onboarding collects one free-text field, so a bare street
    // with no settlement was often all the geocoder got — and the only two live
    // merchants that resolved were the two whose address carried its own
    // qualifier. See geocodableAddress.
    const query = geocodableAddress(place);
    if (query === '' || !this.geocoder) {
      return null;
    }
    try {
      const located = await this.geocoder.geocode(query);
      return { latitude: located.latitude, longitude: located.longitude };
    } catch (error) {
      this.logger.warn(
        `Could not geocode business address "${query}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /** DPX-STORAGE-001 (F) — merchant KYC documents are private; return signed GET URLs. */
  private async signMerchantKyc(dto: MerchantKycDto): Promise<MerchantKycDto> {
    const [frontImage, backImage, selfieImage] = await Promise.all([
      this.storageAssets.toSignedGetUrl(dto.frontImage),
      this.storageAssets.toSignedGetUrlOptional(dto.backImage),
      this.storageAssets.toSignedGetUrlOptional(dto.selfieImage),
    ]);
    return { ...dto, frontImage, backImage: backImage ?? null, selfieImage: selfieImage ?? null };
  }

  /** Sign the KYC documents embedded in a merchant profile DTO, if any. */
  private async signMerchantProfile(dto: MerchantProfileDto): Promise<MerchantProfileDto> {
    if (dto.kyc === null) return dto;
    return { ...dto, kyc: await this.signMerchantKyc(dto.kyc) };
  }

  public async createBusiness(
    merchantUserId: string,
    dto: CreateBusinessDto,
    context: AuditContext,
  ): Promise<BusinessDto> {
    const profile = await this.requireMerchantProfile(merchantUserId);
    // Merchant onboarding is email-first (PORTAL_EMAIL_ACTIVATION), so business
    // creation gates on a verified email only — phone verification is not part of
    // the email-first partner flow and would otherwise block onboarding.
    if (!profile.user.emailVerifiedAt) {
      throw new EmailNotVerifiedDomainException(
        'Email must be verified before merchant onboarding',
      );
    }

    const existing = await this.merchantsRepository.findBusinessByMerchantId(merchantUserId);
    if (existing && existing.status !== BusinessStatus.SUSPENDED) {
      throw new ConflictDomainException('Merchant already has an active business');
    }
    if (existing) {
      throw new ConflictDomainException('Merchant already has a business profile');
    }

    // Minimal onboarding (founder decision): only businessName + businessType are
    // required. Everything else is optional and completed/verified before Ops
    // approval. Fill draft-safe defaults so the NOT NULL columns are satisfied
    // without inventing real business facts.
    const providedRegistration = dto.registrationNumber?.trim().toUpperCase();
    if (providedRegistration) {
      const duplicateReg =
        await this.merchantsRepository.findBusinessByRegistrationNumber(providedRegistration);
      if (duplicateReg) {
        throw new ConflictDomainException('Registration/CAC number already registered');
      }
    }
    // A unique per-merchant placeholder for the required-unique column until the
    // merchant supplies their real CAC/registration number.
    const registrationNumber = providedRegistration ?? `DRAFT-${merchantUserId.toUpperCase()}`;

    const email = dto.email?.trim().toLowerCase() ?? profile.user.email;
    const phone = dto.phone?.trim() ?? profile.user.phone ?? '';
    // country is validated @MinLength(2) when present, so it is never an empty
    // string here — only a real value or undefined (→ default).
    const country = dto.country?.trim() ?? 'Nigeria';
    const state = dto.state?.trim() ?? '';
    const city = dto.city?.trim() ?? '';
    const address = dto.address?.trim() ?? '';
    const located = await this.coordinatesFromAddress(
      { address, city, state, country },
      dto.latitude,
      dto.longitude,
    );
    const latitude = dto.latitude ?? located?.latitude ?? 0;
    const longitude = dto.longitude ?? located?.longitude ?? 0;

    // Only enforce full location validation when the merchant actually supplied it.
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      this.assertValidCoordinates(latitude, longitude);
    }
    // Minimal onboarding (founder decision): Store Setup has a single free-text
    // address field and no separate city/state inputs, so a free-text address
    // alone is accepted — city/state/country are completed and verified before
    // Ops approval. The complete structured-address check only applies when the
    // merchant actually supplies structured location fields (city/state).
    if (dto.city !== undefined || dto.state !== undefined) {
      this.assertAddress({ address, city, state, country });
    }

    const business = await this.merchantsRepository.createBusiness({
      merchantId: merchantUserId,
      businessName: dto.businessName.trim(),
      businessType: dto.businessType,
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      registrationNumber,
      email,
      phone,
      country,
      state,
      city,
      address,
      latitude,
      longitude,
      status: BusinessStatus.SUBMITTED,
      verificationStatus: BusinessVerificationStatus.UNDER_REVIEW,
      ...(dto.taxNumber !== undefined ? { taxNumber: dto.taxNumber.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      ...(dto.coverPhotoUrl !== undefined ? { coverPhotoUrl: dto.coverPhotoUrl } : {}),
      ...(dto.operatingHours !== undefined ? { operatingHours: dto.operatingHours } : {}),
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.BUSINESS_CREATED,
      { ...context, userId: merchantUserId },
      {
        resource: 'business',
        resourceId: business.id,
        metadata: { businessName: business.businessName },
      },
    );

    await this.notifications.notifyMerchantLifecycle({
      email: profile.user.email,
      event: 'business_submitted',
      merchantId: merchantUserId,
      businessName: business.businessName,
    });

    return toBusinessDto(business);
  }

  public async getBusiness(merchantUserId: string): Promise<BusinessDto> {
    await this.requireMerchantProfile(merchantUserId);
    const business = await this.merchantsRepository.findBusinessByMerchantId(merchantUserId);
    if (!business) {
      throw new NotFoundDomainException('Business not found');
    }
    return toBusinessDto(business);
  }

  public async updateBusiness(
    merchantUserId: string,
    dto: UpdateBusinessDto,
    context: AuditContext,
  ): Promise<BusinessDto> {
    await this.requireMerchantProfile(merchantUserId);
    const business = await this.merchantsRepository.findBusinessByMerchantId(merchantUserId);
    if (!business) {
      throw new NotFoundDomainException('Business not found');
    }

    if (business.status === BusinessStatus.SUSPENDED) {
      throw new ForbiddenDomainException('Suspended businesses cannot be updated');
    }

    if (dto.registrationNumber) {
      const normalized = dto.registrationNumber.trim().toUpperCase();
      const duplicate = await this.merchantsRepository.findBusinessByRegistrationNumber(normalized);
      if (duplicate && duplicate.id !== business.id) {
        throw new ConflictDomainException('Registration/CAC number already registered');
      }
    }

    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      this.assertValidCoordinates(
        dto.latitude ?? Number(business.latitude),
        dto.longitude ?? Number(business.longitude),
      );
    }

    // Mirror createBusiness: a free-text address update alone is accepted for
    // minimal onboarding; the complete structured-address check only applies
    // when the merchant is setting structured location (city/state/country).
    if (dto.city !== undefined || dto.state !== undefined || dto.country !== undefined) {
      this.assertAddress({
        address: dto.address ?? business.address,
        city: dto.city ?? business.city,
        state: dto.state ?? business.state,
        country: dto.country ?? business.country,
      });
    }

    // A merchant correcting their address should move on the map with it.
    const relocated =
      dto.address !== undefined
        ? await this.coordinatesFromAddress(
            {
              address: dto.address,
              // The values being written in this same update, not the stale
              // ones on the record — a merchant correcting city and address
              // together must be geocoded against both new values.
              city: dto.city ?? business.city,
              state: dto.state ?? business.state,
              country: dto.country ?? business.country,
            },
            dto.latitude,
            dto.longitude,
          )
        : null;

    const updated = await this.merchantsRepository.updateBusiness(business.id, {
      ...(dto.businessName !== undefined ? { businessName: dto.businessName.trim() } : {}),
      ...(dto.businessType !== undefined ? { businessType: dto.businessType } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.registrationNumber !== undefined
        ? { registrationNumber: dto.registrationNumber.trim().toUpperCase() }
        : {}),
      ...(dto.taxNumber !== undefined ? { taxNumber: dto.taxNumber.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.country !== undefined ? { country: dto.country.trim() } : {}),
      ...(dto.state !== undefined ? { state: dto.state.trim() } : {}),
      ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
      ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
      ...(dto.latitude !== undefined
        ? { latitude: dto.latitude }
        : relocated
          ? { latitude: relocated.latitude }
          : {}),
      ...(dto.longitude !== undefined
        ? { longitude: dto.longitude }
        : relocated
          ? { longitude: relocated.longitude }
          : {}),
      ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      ...(dto.coverPhotoUrl !== undefined ? { coverPhotoUrl: dto.coverPhotoUrl } : {}),
      ...(dto.operatingHours !== undefined ? { operatingHours: dto.operatingHours } : {}),
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.BUSINESS_UPDATED,
      { ...context, userId: merchantUserId },
      {
        resource: 'business',
        resourceId: updated.id,
        metadata: { fields: Object.keys(dto) },
      },
    );

    return toBusinessDto(updated);
  }

  public async pauseStore(
    merchantUserId: string,
    reason: string | undefined,
    context: AuditContext,
  ): Promise<BusinessDto> {
    await this.requireMerchantProfile(merchantUserId);
    const business = await this.merchantsRepository.findBusinessByMerchantId(merchantUserId);
    if (!business) {
      throw new NotFoundDomainException('Business not found');
    }
    if (business.status !== BusinessStatus.ACTIVE) {
      throw new ValidationDomainException('Only active stores can be paused');
    }

    const updated = await this.merchantsRepository.setBusinessPauseState(business.id, {
      status: BusinessStatus.PAUSED,
      pausedAt: new Date(),
      pauseReason: reason ?? null,
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.STORE_PAUSED,
      { ...context, userId: merchantUserId },
      { resource: 'business', resourceId: updated.id, metadata: { reason: reason ?? null } },
    );

    await this.eventBus?.emit(
      DOMAIN_EVENTS.STORE_PAUSED,
      { merchantId: merchantUserId, businessId: updated.id, reason: reason ?? null },
      { actorUserId: merchantUserId },
    );

    return toBusinessDto(updated);
  }

  public async resumeStore(merchantUserId: string, context: AuditContext): Promise<BusinessDto> {
    await this.requireMerchantProfile(merchantUserId);
    const business = await this.merchantsRepository.findBusinessByMerchantId(merchantUserId);
    if (!business) {
      throw new NotFoundDomainException('Business not found');
    }
    if (business.status !== BusinessStatus.PAUSED) {
      throw new ValidationDomainException('Only paused stores can be resumed');
    }

    const updated = await this.merchantsRepository.setBusinessPauseState(business.id, {
      status: BusinessStatus.ACTIVE,
      pausedAt: null,
      pauseReason: null,
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.STORE_RESUMED,
      { ...context, userId: merchantUserId },
      { resource: 'business', resourceId: updated.id, metadata: {} },
    );

    await this.eventBus?.emit(
      DOMAIN_EVENTS.STORE_RESUMED,
      { merchantId: merchantUserId, businessId: updated.id },
      { actorUserId: merchantUserId },
    );

    return toBusinessDto(updated);
  }

  public async submitKyc(
    merchantUserId: string,
    dto: SubmitKycDto,
    context: AuditContext,
  ): Promise<MerchantKycDto> {
    const profile = await this.requireMerchantProfile(merchantUserId);
    this.assertIdentityVerified(profile.user);

    const business = await this.merchantsRepository.findBusinessByMerchantId(merchantUserId);
    if (!business) {
      throw new NotFoundDomainException('Create a business before submitting KYC');
    }

    // Only block a duplicate pending submission of the SAME document type — a
    // merchant legitimately submits several different documents back to back.
    const pending = await this.merchantsRepository.findActivePendingKyc(
      merchantUserId,
      dto.documentType,
    );
    if (pending) {
      throw new ConflictDomainException('This document is already submitted and awaiting review');
    }

    // DPX-STORAGE-001 (D) — only DrippleX-controlled URLs owned by this merchant.
    this.storageAssets.assertOwned(dto.frontImage, {
      folder: 'kyc-documents',
      ownerId: merchantUserId,
    });
    this.storageAssets.assertOwnedOptional(dto.backImage, {
      folder: 'kyc-documents',
      ownerId: merchantUserId,
    });
    this.storageAssets.assertOwnedOptional(dto.selfieImage, {
      folder: 'kyc-documents',
      ownerId: merchantUserId,
    });

    const kyc = await this.merchantsRepository.createKyc({
      merchantId: merchantUserId,
      businessId: business.id,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber.trim(),
      frontImage: dto.frontImage,
      ...(dto.backImage !== undefined ? { backImage: dto.backImage } : {}),
      ...(dto.selfieImage !== undefined ? { selfieImage: dto.selfieImage } : {}),
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.KYC_SUBMITTED,
      { ...context, userId: merchantUserId },
      {
        resource: 'merchant_kyc',
        resourceId: kyc.id,
        metadata: { documentType: kyc.documentType },
      },
    );

    await this.notifications.notifyMerchantLifecycle({
      email: profile.user.email,
      event: 'kyc_submitted',
      merchantId: merchantUserId,
      documentType: kyc.documentType,
    });

    return await this.signMerchantKyc(toMerchantKycDto(kyc));
  }

  public async getKycStatus(merchantUserId: string): Promise<{
    latest: MerchantKycDto | null;
    items: MerchantKycDto[];
  }> {
    await this.requireMerchantProfile(merchantUserId);
    const items = await this.merchantsRepository.listKycByMerchantId(merchantUserId);
    const signed = await Promise.all(
      items.map((item) => this.signMerchantKyc(toMerchantKycDto(item))),
    );
    return {
      latest: signed[0] ?? null,
      items: signed,
    };
  }

  public async createBankAccount(
    merchantUserId: string,
    dto: CreateBankAccountDto,
    context: AuditContext,
  ): Promise<BankAccountDto> {
    await this.requireMerchantProfile(merchantUserId);

    const duplicate = await this.merchantsRepository.findBankAccountByNumber(
      merchantUserId,
      dto.accountNumber,
    );
    if (duplicate) {
      throw new ConflictDomainException('Bank account number already exists for this merchant');
    }

    const account = await this.merchantsRepository.createBankAccount({
      merchantId: merchantUserId,
      bankName: dto.bankName.trim(),
      accountName: dto.accountName.trim(),
      accountNumber: dto.accountNumber,
      currency: (dto.currency ?? 'NGN').toUpperCase(),
      isDefault: dto.isDefault ?? false,
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.BANK_CREATED,
      { ...context, userId: merchantUserId },
      {
        resource: 'bank_account',
        resourceId: account.id,
        metadata: { bankName: account.bankName },
      },
    );

    return toBankAccountDto(account);
  }

  public async listBankAccounts(merchantUserId: string): Promise<BankAccountDto[]> {
    await this.requireMerchantProfile(merchantUserId);
    const accounts = await this.merchantsRepository.listBankAccounts(merchantUserId);
    return accounts.map(toBankAccountDto);
  }

  public async setDefaultBankAccount(
    merchantUserId: string,
    accountId: string,
    context: AuditContext,
  ): Promise<BankAccountDto> {
    await this.requireMerchantProfile(merchantUserId);
    const account = await this.merchantsRepository.findBankAccountById(accountId);
    if (account?.merchantId !== merchantUserId) {
      throw new NotFoundDomainException('Bank account not found');
    }

    const updated = await this.merchantsRepository.setDefaultBankAccount(merchantUserId, accountId);

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.BANK_UPDATED,
      { ...context, userId: merchantUserId },
      {
        resource: 'bank_account',
        resourceId: updated.id,
        metadata: { isDefault: true },
      },
    );

    return toBankAccountDto(updated);
  }

  public async listMerchants(query: ListMerchantsQueryDto): Promise<{
    items: MerchantProfileDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (query.page - 1) * query.limit;
    const { items, total } = await this.merchantsRepository.listMerchants({
      skip,
      take: query.limit,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.verificationStatus !== undefined
        ? { verificationStatus: query.verificationStatus }
        : {}),
      ...(query.country !== undefined ? { country: query.country } : {}),
      ...(query.state !== undefined ? { state: query.state } : {}),
      ...(query.dateFrom !== undefined ? { createdFrom: new Date(query.dateFrom) } : {}),
      ...(query.dateTo !== undefined ? { createdTo: new Date(query.dateTo) } : {}),
    });

    const signedItems = await Promise.all(
      items.map((item) =>
        this.signMerchantProfile(
          toMerchantProfileDto({
            profile: item,
            user: item.user,
            business: item.business,
            kyc: this.representativeKyc(item.kycDocuments),
            bankAccounts: item.bankAccounts,
          }),
        ),
      ),
    );

    return {
      items: signedItems,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async getMerchantProfile(merchantUserId: string): Promise<{
    profile: MerchantProfileDto;
    auditSummary: { action: string; count: number; lastAt: string | null }[];
  }> {
    const detail = await this.merchantsRepository.getMerchantAdminDetail(merchantUserId);
    if (!detail) {
      throw new NotFoundDomainException('Merchant not found');
    }

    const auditSummary = await this.merchantsRepository.getAuditSummary(merchantUserId);

    return {
      profile: await this.signMerchantProfile(
        toMerchantProfileDto({
          profile: detail,
          user: detail.user,
          business: detail.business,
          kyc: this.representativeKyc(detail.kycDocuments),
          bankAccounts: detail.bankAccounts,
        }),
      ),
      auditSummary: auditSummary.map((row) => ({
        action: row.action,
        count: row.count,
        lastAt: row.lastAt ? row.lastAt.toISOString() : null,
      })),
    };
  }

  public async verifyKyc(
    merchantUserId: string,
    adminUserId: string,
    remarks: string | undefined,
    context: AuditContext,
  ): Promise<MerchantKycDto> {
    const pending = await this.merchantsRepository.findActivePendingKyc(merchantUserId);
    if (!pending) {
      throw new NotFoundDomainException('No pending KYC submission found');
    }

    const verified = await this.merchantsRepository.verifyKyc(pending.id, adminUserId, remarks);

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.KYC_VERIFIED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant_kyc',
        resourceId: verified.id,
        metadata: { merchantId: merchantUserId },
      },
    );

    await this.notifyMerchantKycDecision(merchantUserId, {
      event: 'kyc_verified',
      documentType: verified.documentType,
    });

    return await this.signMerchantKyc(toMerchantKycDto(verified));
  }

  public async rejectKyc(
    merchantUserId: string,
    adminUserId: string,
    remarks: string,
    context: AuditContext,
  ): Promise<MerchantKycDto> {
    if (!remarks.trim() || remarks.trim().length < 3) {
      throw new ValidationDomainException('KYC rejection remarks are required');
    }

    const pending = await this.merchantsRepository.findActivePendingKyc(merchantUserId);
    if (!pending) {
      throw new NotFoundDomainException('No pending KYC submission found');
    }

    const rejected = await this.merchantsRepository.rejectKyc(
      pending.id,
      adminUserId,
      remarks.trim(),
    );

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.KYC_REJECTED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant_kyc',
        resourceId: rejected.id,
        metadata: { merchantId: merchantUserId, remarks },
      },
    );

    // Name the document AND the reason — "your KYC was rejected" leaves a
    // merchant with two required documents guessing which one to replace.
    await this.notifyMerchantKycDecision(merchantUserId, {
      event: 'kyc_rejected',
      documentType: rejected.documentType,
      reason: remarks,
    });

    return await this.signMerchantKyc(toMerchantKycDto(rejected));
  }

  /**
   * Email a merchant about a decision on ONE of their documents. KYC review is
   * keyed by merchant, but the address lives on the profile, so it is fetched
   * here rather than threaded through every call site.
   */
  private async notifyMerchantKycDecision(
    merchantUserId: string,
    input: { event: 'kyc_verified' | 'kyc_rejected'; documentType: string; reason?: string },
  ): Promise<void> {
    const profile = await this.merchantsRepository.findMerchantProfileByUserId(merchantUserId);
    if (!profile?.user.email) {
      return;
    }
    await this.notifications.notifyMerchantLifecycle({
      email: profile.user.email,
      merchantId: merchantUserId,
      ...input,
    });
  }

  /**
   * Ops sets what a merchant SELLS, on their behalf.
   *
   * A merchant can set this themselves in the portal. This exists because
   * every merchant onboarded before the field existed has none, and an
   * uncategorised merchant is invisible to every marketplace category filter
   * — so somebody has to be able to sort out the ones already trading without
   * waiting for each of them to log in.
   *
   * Passing `null` returns them to uncategorised. That is deliberate: OTHER is
   * a claim about a business, and "we do not know yet" is not the same claim.
   */
  public async setMerchantCategory(
    merchantUserId: string,
    category: MerchantCategory | null,
    adminUserId: string,
    context: AuditContext,
  ): Promise<BusinessDto> {
    const detail = await this.requireAdminDetail(merchantUserId);
    if (!detail.business) {
      throw new ValidationDomainException('Merchant has no business profile to categorise');
    }

    const previous = detail.business.category;
    const updated = await this.merchantsRepository.updateBusiness(detail.business.id, {
      category,
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.BUSINESS_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'business',
        resourceId: updated.id,
        // Both sides recorded: a category change moves a merchant in and out of
        // customer-facing listings, so "what did it used to be" matters.
        metadata: { field: 'category', from: previous, to: category, byAdmin: adminUserId },
      },
    );

    return toBusinessDto(updated);
  }

  public async approveMerchant(
    merchantUserId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<MerchantApprovalDto> {
    const detail = await this.requireAdminDetail(merchantUserId);
    if (!detail.business) {
      throw new ValidationDomainException('Business profile is required before approval');
    }

    // KYC is multi-document: a merchant holds one MerchantKyc record per document
    // type, so this aggregates over all of them rather than trusting whichever
    // record happens to sort first (documents submitted in the same batch tie on
    // createdAt). EVERY required document must be verified — approving on any
    // single verified document let a merchant go live with only the CAC while
    // the portal still marked the director's NIN Required. Founder decision
    // 2026-08-15.
    //
    // Which documents are required depends on the business's legal structure: a
    // sole trader cannot obtain a CAC certificate at all, so demanding one made
    // them permanently unapprovable. See requiredKycDocumentTypes.
    const required = requiredKycDocumentTypes(detail.business.businessType);
    const missing = required.filter(
      (type) =>
        !detail.kycDocuments.some(
          (doc) =>
            doc.documentType === type && doc.verificationStatus === KycVerificationStatus.VERIFIED,
        ),
    );
    if (missing.length > 0) {
      // Name what is outstanding — "KYC must be verified" gave an operator no
      // clue which document was still holding the approval up.
      throw new ValidationDomainException(
        `Verify every required document before approval. Outstanding: ${missing
          .map((type) => type.replace(/_/g, ' ').toLowerCase())
          .join(', ')}`,
      );
    }

    if (detail.status === MerchantStatus.APPROVED) {
      throw new ConflictDomainException('Merchant is already approved');
    }

    const now = new Date();
    const updated = await this.merchantsRepository.updateMerchantLifecycle({
      merchantUserId,
      status: MerchantStatus.APPROVED,
      isApproved: true,
      approvedAt: now,
      approvedBy: adminUserId,
      rejectedReason: null,
      suspendedAt: null,
      businessStatus: BusinessStatus.ACTIVE,
      businessVerificationStatus: BusinessVerificationStatus.VERIFIED,
      businessApprovedBy: adminUserId,
      businessApprovedAt: now,
      businessRejectedReason: null,
      onboardingStatus: OnboardingStatus.APPROVED,
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.APPROVED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant',
        resourceId: merchantUserId,
        metadata: { approvedBy: adminUserId },
      },
    );

    await this.notifications.notifyMerchantLifecycle({
      email: updated.user.email,
      event: 'merchant_approved',
      merchantId: merchantUserId,
      ...(updated.business ? { businessName: updated.business.businessName } : {}),
    });

    return {
      merchantId: merchantUserId,
      status: MerchantStatus.APPROVED,
      approvedAt: now.toISOString(),
      approvedBy: adminUserId,
    };
  }

  /**
   * Re-resolve a business's coordinates from the address already on file.
   *
   * The repair half of the Null Island problem. Geocoding at onboarding is
   * best-effort by design — a maps outage must never block a merchant from
   * signing up — so a business whose address did not resolve keeps 0,0 for
   * ever, with nothing anywhere prompting another attempt. On 2026-08-28 three
   * of the five live merchants were in that state, each with a good Kano street
   * address sitting unused on the record.
   *
   * Operations-triggered rather than automatic: a sweep that re-geocoded every
   * business on a timer would spend money on addresses that are simply wrong,
   * and would move a shop that someone had deliberately pinned. This is a
   * button next to the problem, pressed by whoever can see it.
   *
   * Only ever writes a location it actually resolved. A failure leaves the
   * record exactly as it was and says so — silently keeping 0,0 while
   * reporting success is the whole bug.
   */
  public async relocateBusiness(
    merchantUserId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<BusinessDto> {
    const detail = await this.requireAdminDetail(merchantUserId);
    if (!detail.business) {
      throw new ValidationDomainException('Merchant has no business profile to locate');
    }
    if (detail.business.address.trim() === '') {
      // Nothing to work from. Telling an operator to collect the address beats
      // a geocoder call that cannot succeed.
      throw new ValidationDomainException(
        'This business has no address on file. Ask the merchant to add one, then try again.',
      );
    }
    if (!this.geocoder) {
      throw new ValidationDomainException(
        'Address lookup is not configured on this environment, so the location cannot be resolved.',
      );
    }

    const query = geocodableAddress(detail.business);
    let located: { latitude: number; longitude: number };
    try {
      const result = await this.geocoder.geocode(query);
      located = { latitude: result.latitude, longitude: result.longitude };
    } catch (error) {
      this.logger.warn(
        `Could not relocate business ${detail.business.id} from "${query}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ValidationDomainException(
        `Could not find "${query}" on the map. Check the address with the merchant, correct it, then try again.`,
      );
    }

    // A geocoder that answers 0,0 has told us nothing, and writing it back
    // would look like a successful repair.
    if (!hasKnownLocation(located)) {
      throw new ValidationDomainException(
        `"${query}" did not resolve to a real location. Check the address with the merchant.`,
      );
    }

    const before = hasKnownLocation(detail.business);
    const updated = await this.merchantsRepository.updateBusiness(detail.business.id, {
      latitude: located.latitude,
      longitude: located.longitude,
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.BUSINESS_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'business',
        resourceId: detail.business.id,
        metadata: {
          action: 'relocated',
          query,
          hadLocation: before,
          latitude: located.latitude,
          longitude: located.longitude,
        },
      },
    );

    return toBusinessDto(updated);
  }

  public async rejectMerchant(
    merchantUserId: string,
    adminUserId: string,
    reason: string,
    context: AuditContext,
  ): Promise<MerchantApprovalDto> {
    const detail = await this.requireAdminDetail(merchantUserId);

    const updated = await this.merchantsRepository.updateMerchantLifecycle({
      merchantUserId,
      status: MerchantStatus.REJECTED,
      isApproved: false,
      approvedAt: null,
      approvedBy: adminUserId,
      rejectedReason: reason,
      businessRejectedReason: reason,
      onboardingStatus: OnboardingStatus.REJECTED,
      ...(detail.business
        ? {
            businessStatus: BusinessStatus.DRAFT,
            businessVerificationStatus: BusinessVerificationStatus.REJECTED,
          }
        : {}),
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.REJECTED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant',
        resourceId: merchantUserId,
        metadata: { reason },
      },
    );

    await this.notifications.notifyMerchantLifecycle({
      email: updated.user.email,
      event: 'merchant_rejected',
      merchantId: merchantUserId,
      reason,
    });

    return {
      merchantId: merchantUserId,
      status: MerchantStatus.REJECTED,
      rejectedReason: reason,
      approvedBy: adminUserId,
    };
  }

  public async suspendMerchant(
    merchantUserId: string,
    adminUserId: string,
    reason: string,
    context: AuditContext,
  ): Promise<MerchantApprovalDto> {
    const detail = await this.requireAdminDetail(merchantUserId);
    if (detail.status !== MerchantStatus.APPROVED) {
      throw new ValidationDomainException('Only approved merchants can be suspended');
    }

    const now = new Date();
    const updated = await this.merchantsRepository.updateMerchantLifecycle({
      merchantUserId,
      status: MerchantStatus.SUSPENDED,
      isApproved: false,
      suspendedAt: now,
      rejectedReason: reason,
      ...(detail.business ? { businessStatus: BusinessStatus.SUSPENDED } : {}),
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.SUSPENDED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant',
        resourceId: merchantUserId,
        metadata: { reason },
      },
    );

    await this.notifications.notifyMerchantLifecycle({
      email: updated.user.email,
      event: 'merchant_suspended',
      merchantId: merchantUserId,
      reason,
    });

    return {
      merchantId: merchantUserId,
      status: MerchantStatus.SUSPENDED,
      rejectedReason: reason,
      approvedBy: adminUserId,
    };
  }

  public async reactivateMerchant(
    merchantUserId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<MerchantApprovalDto> {
    const detail = await this.requireAdminDetail(merchantUserId);
    if (detail.status !== MerchantStatus.SUSPENDED) {
      throw new ValidationDomainException('Only suspended merchants can be reactivated');
    }

    const now = new Date();
    const updated = await this.merchantsRepository.updateMerchantLifecycle({
      merchantUserId,
      status: MerchantStatus.APPROVED,
      isApproved: true,
      approvedAt: now,
      approvedBy: adminUserId,
      rejectedReason: null,
      suspendedAt: null,
      onboardingStatus: OnboardingStatus.APPROVED,
      ...(detail.business ? { businessStatus: BusinessStatus.ACTIVE } : {}),
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.REACTIVATED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant',
        resourceId: merchantUserId,
      },
    );

    await this.notifications.notifyMerchantLifecycle({
      email: updated.user.email,
      event: 'merchant_reactivated',
      merchantId: merchantUserId,
      ...(updated.business ? { businessName: updated.business.businessName } : {}),
    });

    return {
      merchantId: merchantUserId,
      status: MerchantStatus.APPROVED,
      approvedAt: now.toISOString(),
      approvedBy: adminUserId,
    };
  }

  private async requireMerchantProfile(merchantUserId: string): Promise<MerchantProfileWithUser> {
    const profile = await this.merchantsRepository.findMerchantProfileByUserId(merchantUserId);
    if (!profile) {
      throw new NotFoundDomainException('Merchant profile not found');
    }
    return profile;
  }

  // The single KYC record the admin views should represent should reflect the
  // merchant's overall KYC standing, not just the newest submission: prefer a
  // VERIFIED document (so the "KYC Verified" chip is stable and matches the
  // approval gate), otherwise the newest record (already sorted createdAt desc).
  /**
   * The one document that stands for the merchant on the approvals desk.
   *
   * A merchant submits several documents, and a PENDING one is the only state
   * that needs an operator. Surfacing a VERIFIED document first hid the fact
   * that another was still awaiting review — the desk showed "KYC Verified"
   * with no action left, and the outstanding document could never be actioned.
   * Pending therefore wins, oldest first, matching the order
   * `findActivePendingKyc` hands to verifyKyc/rejectKyc.
   */
  private representativeKyc<
    T extends { verificationStatus: KycVerificationStatus; createdAt: Date },
  >(kycDocuments: T[]): T | null {
    const oldestPending = kycDocuments
      .filter((doc) => doc.verificationStatus === KycVerificationStatus.PENDING)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

    return (
      oldestPending ??
      kycDocuments.find((doc) => doc.verificationStatus === KycVerificationStatus.VERIFIED) ??
      kycDocuments[0] ??
      null
    );
  }

  private async requireAdminDetail(merchantUserId: string): Promise<MerchantAdminDetail> {
    const detail = await this.merchantsRepository.getMerchantAdminDetail(merchantUserId);
    if (!detail) {
      throw new NotFoundDomainException('Merchant not found');
    }
    return detail;
  }

  private assertIdentityVerified(user: { emailVerifiedAt: Date | null }): void {
    // Merchant onboarding is email-first (PORTAL_EMAIL_ACTIVATION): KYC submission
    // gates on a verified email only, consistent with business creation. Phone
    // verification is not part of the email-first partner flow and requiring it
    // here would block an otherwise-valid merchant from submitting KYC.
    if (!user.emailVerifiedAt) {
      throw new EmailNotVerifiedDomainException(
        'Email must be verified before merchant onboarding',
      );
    }
  }

  private assertValidCoordinates(latitude: number, longitude: number): void {
    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new ValidationDomainException('Invalid latitude/longitude coordinates');
    }
  }

  private assertAddress(input: {
    address: string;
    city: string;
    state: string;
    country: string;
  }): void {
    if (
      !input.address.trim() ||
      !input.city.trim() ||
      !input.state.trim() ||
      !input.country.trim()
    ) {
      throw new ValidationDomainException('Complete address is required');
    }
  }
}
