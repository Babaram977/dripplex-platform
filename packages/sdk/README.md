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

## Checkout & orders (S1-C11)

```ts
const { order } = await client.orders.checkout({
  fulfillmentType: 'DELIVERY',
  deliveryAddressId,
});

const page = await client.orders.getOrders({ page: 1, pageSize: 20 });
const one = await client.orders.getOrder(order.id);
await client.orders.cancelOrder(order.id, { reason: 'Changed mind' });

// Admin
await client.orders.adminGetOrders({ status: 'PENDING_PAYMENT', merchantId });
await client.orders.adminGetOrder(order.id);
```

## Payments (S1-C12)

```ts
const init = await client.payments.payOrder(order.id, { provider: 'PAYSTACK' });
// redirect customer to init.authorizationUrl

const verified = await client.payments.verifyOrderPayment(order.id, {
  reference: init.reference,
});

const status = await client.payments.getOrderPayment(order.id);

// Also available on orders client:
await client.orders.payOrder(order.id);
await client.orders.verifyOrderPayment(order.id, { reference: init.reference });
await client.orders.getOrderPayment(order.id);
```

## Delivery fulfillment (S1-C13)

```ts
// Customer tracking
const delivery = await client.delivery.getDelivery(order.id);
const tracking = await client.delivery.getTracking(order.id);
const eta = await client.delivery.getEta(order.id);

// Rider lifecycle
await client.riderDelivery.updateAvailability({
  online: true,
  acceptingOrders: true,
  latitude: 6.5244,
  longitude: 3.3792,
});

const jobs = await client.riderDelivery.listJobs();
await client.riderDelivery.accept(jobs[0].id);
await client.riderDelivery.pickUp(jobs[0].id);
await client.riderDelivery.location(jobs[0].id, {
  latitude: 6.535,
  longitude: 3.39,
});
await client.riderDelivery.arrived(jobs[0].id);
await client.riderDelivery.deliver(jobs[0].id, {
  proofType: 'PHOTO',
  photoUrl: 'https://cdn.example/proof.jpg',
});

// Admin dispatch
const page = await client.adminDelivery.listJobs({ status: 'PENDING', page: 1, pageSize: 20 });
await client.adminDelivery.assign(page.items[0].id, {
  riderId,
  method: 'MANUAL',
});
await client.adminDelivery.cancel(page.items[0].id, { reason: 'Customer unavailable' });
```

Shared DTOs live in `@dripplex/types` (`DeliveryJobDto`, `DeliveryTrackingDto`, `DeliveryEtaDto`, `DeliverOrderDto`, `UpdateRiderAvailabilityDto`).
