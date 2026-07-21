# `@dripplex/sdk`

Typed HTTP client for Dripplex REST APIs under `/api/v1`.

## Usage

```ts
import { DripplexClient } from '@dripplex/sdk';

const client = new DripplexClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getAccessToken: () => localStorage.getItem('accessToken'),
});

await client.auth.login({ email, password });
```

## Merchant onboarding (S1-C8)

```ts
await client.merchant.createBusiness({
  businessName: 'Ada Foods',
  businessType: 'SOLE_PROPRIETORSHIP',
  registrationNumber: 'RC123456',
  email: 'biz@example.com',
  phone: '+2348012345678',
  country: 'Nigeria',
  state: 'Lagos',
  city: 'Ikeja',
  address: '12 Allen Avenue',
  latitude: 6.6018,
  longitude: 3.3515,
});

await client.merchant.submitKyc({
  documentType: 'CAC_CERTIFICATE',
  documentNumber: 'RC123456',
  frontImage: 'https://cdn.example/front.jpg',
});

const merchants = await client.adminMerchants.listMerchants({
  status: 'UNDER_REVIEW',
  page: 1,
  limit: 20,
});

await client.adminMerchants.verifyKyc(merchantUserId, 'Documents clear');
await client.adminMerchants.approve(merchantUserId);
```

Shared DTOs live in `@dripplex/types` (`BusinessDto`, `MerchantKycDto`, `BankAccountDto`, `MerchantProfileDto`, `MerchantApprovalDto`).

## Customer addresses (S1-C9)

```ts
await client.addresses.create({
  label: 'HOME',
  recipientName: 'Ada Customer',
  phone: '+2348012345678',
  addressLine1: '12 Allen Avenue',
  city: 'Ikeja',
  state: 'Lagos',
  country: 'Nigeria',
  latitude: 6.6018,
  longitude: 3.3515,
  isDefault: true,
});

const list = await client.addresses.list();
const def = await client.addresses.getDefault();
await client.addresses.setDefault(list.items[0].id);
```

## Shopping cart (S1-C10)

```ts
await client.cart.addItem({
  merchantId,
  productId,
  productName: 'Jollof Rice',
  unitPrice: 2500,
  quantity: 2,
});

const cart = await client.cart.get();
await client.cart.updateItem(cart!.items[0].id, { quantity: 3 });
await client.cart.recalculate();
await client.cart.clear();
```
