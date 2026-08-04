'use client';

import { useAuth } from '@dripplex/hooks';
import {
  SuperAppAddAddressSheet,
  SuperAppAddressPickerSheet,
  SuperAppCartEmptyState,
  SuperAppCartOrderSummary,
  SuperAppCheckoutAddressCard,
  SuperAppCheckoutMerchantCard,
  SuperAppCheckoutSkeleton,
  SuperAppCheckoutTermsCheckbox,
  SuperAppPaymentMethodSelector,
  SuperAppPlaceOrderBar,
  SuperAppPromoCodeCard,
  toast,
  type SuperAppFulfillmentType,
  type SuperAppNewAddressInput,
} from '@dripplex/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import type { CartDto, CustomerAddressDto } from '@dripplex/types';

import { formatPrice } from '@/lib/format';
import { describeSdkError, sdk } from '@/lib/sdk';
import { siteConfig } from '@/lib/site';

const PAYMENT_OPTIONS = [
  { key: 'PAYSTACK', icon: '💳', label: 'Paystack', sublabel: 'Card, bank transfer & USSD' },
  { key: 'FLUTTERWAVE', icon: '💳', label: 'Flutterwave', sublabel: 'Card, bank transfer & USSD' },
  { key: 'OPAY', icon: '📱', label: 'OPay', sublabel: 'Wallet & bank transfer' },
] as const;

function titleCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

export default function CheckoutPage(): React.JSX.Element {
  const router = useRouter();
  const { hydrated, isAuthenticated } = useAuth();

  const [cart, setCart] = React.useState<CartDto | null>(null);
  const [merchantName, setMerchantName] = React.useState<string | null>(null);
  const [addresses, setAddresses] = React.useState<CustomerAddressDto[]>([]);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [fulfillmentType, setFulfillmentType] = React.useState<SuperAppFulfillmentType>('DELIVERY');
  const [note, setNote] = React.useState('');
  const [paymentProvider, setPaymentProvider] = React.useState<string>(PAYMENT_OPTIONS[0].key);
  const [termsChecked, setTermsChecked] = React.useState(false);
  const [placing, setPlacing] = React.useState(false);

  const [promoCode, setPromoCode] = React.useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = React.useState(0);
  const [promoError, setPromoError] = React.useState<string | null>(null);

  const [showAddressPicker, setShowAddressPicker] = React.useState(false);
  const [showAddAddress, setShowAddAddress] = React.useState(false);
  const [savingAddress, setSavingAddress] = React.useState(false);

  React.useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (!isAuthenticated) {
      setLoaded(true);
      return;
    }
    Promise.all([sdk.cart.get(), sdk.addresses.list()])
      .then(async ([cartData, addressData]) => {
        setCart(cartData);
        setAddresses(addressData.items);
        const defaultAddress = addressData.items.find((a) => a.isDefault) ?? addressData.items[0];
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
        }
        if (cartData?.items[0]?.productId) {
          try {
            const product = await sdk.products.get(cartData.items[0].productId);
            setMerchantName(product.merchant?.businessName ?? null);
          } catch {
            setMerchantName(null);
          }
        }
      })
      .catch((loadError: unknown) => {
        setError(describeSdkError(loadError).description);
      })
      .finally(() => {
        setLoaded(true);
      });
  }, [hydrated, isAuthenticated]);

  const onApplyPromo = async (code: string): Promise<void> => {
    if (!cart) return;
    setPromoError(null);
    try {
      const result = await sdk.promotions.validate({
        subtotal: cart.totals.subtotal,
        merchantId: cart.merchantId,
        couponCode: code,
      });
      if (!result.valid || result.discountTotal <= 0) {
        setPromoError('This code is not valid for your order.');
        return;
      }
      setPromoCode(code);
      setPromoDiscount(result.discountTotal);
    } catch (validateError) {
      setPromoError(describeSdkError(validateError).description);
    }
  };

  const onRemovePromo = (): void => {
    setPromoCode(null);
    setPromoDiscount(0);
    setPromoError(null);
  };

  const onAddAddress = async (input: SuperAppNewAddressInput): Promise<void> => {
    if (input.latitude === null || input.longitude === null) {
      return;
    }
    setSavingAddress(true);
    try {
      const created = await sdk.addresses.create({
        label: input.label,
        recipientName: input.recipientName,
        phone: input.phone,
        addressLine1: input.addressLine1,
        ...(input.addressLine2 ? { addressLine2: input.addressLine2 } : {}),
        city: input.city,
        state: input.state,
        country: 'Nigeria',
        latitude: input.latitude,
        longitude: input.longitude,
      });
      setAddresses((prev) => [...prev, created]);
      setSelectedAddressId(created.id);
      setShowAddAddress(false);
      toast({ title: 'Address saved', description: `${created.recipientName}'s address added.` });
    } catch (createError) {
      const described = describeSdkError(createError);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    } finally {
      setSavingAddress(false);
    }
  };

  const onPlaceOrder = async (): Promise<void> => {
    if (!cart || placing) return;
    if (fulfillmentType === 'DELIVERY' && !selectedAddressId) {
      toast({
        title: 'Address required',
        description: 'Add or select a delivery address to continue.',
      });
      return;
    }
    setPlacing(true);

    let orderId: string;
    try {
      const checkoutResult = await sdk.orders.checkout({
        cartId: cart.id,
        fulfillmentType,
        ...(fulfillmentType === 'DELIVERY' && selectedAddressId
          ? { deliveryAddressId: selectedAddressId }
          : {}),
        ...(promoCode ? { couponCode: promoCode } : {}),
        ...(note.trim() ? { notes: note.trim() } : {}),
      });
      orderId = checkoutResult.order.id;
    } catch (checkoutError) {
      const described = describeSdkError(checkoutError);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
      setPlacing(false);
      return;
    }

    try {
      const payment = await sdk.orders.payOrder(orderId, {
        provider: paymentProvider as 'PAYSTACK' | 'FLUTTERWAVE' | 'OPAY',
      });
      window.location.href = payment.authorizationUrl;
    } catch (paymentError) {
      // The order already exists (and its cart is now locked) even though
      // payment initialization failed — send the customer to the order
      // screen so they can retry or cancel, instead of stranding them here
      // with a cart that can no longer be modified.
      const described = describeSdkError(paymentError);
      toast({
        title: described.title,
        description: `${described.description} Your order was saved — cancel it from the order screen to free up your cart.`,
        variant: 'destructive',
      });
      router.push(`/marketplace/tracking/${orderId}`);
    }
  };

  if (!hydrated || !loaded) {
    return (
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <SuperAppCheckoutSkeleton />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        <SuperAppCartEmptyState
          onBrowse={() => {
            router.push(siteConfig.links.login);
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-sm text-white/70" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        <SuperAppCartEmptyState
          onBrowse={() => {
            router.push('/marketplace/cart');
          }}
        />
      </div>
    );
  }

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;
  const deliveryFee = fulfillmentType === 'PICKUP' ? 0 : cart.totals.deliveryFee;
  const grandTotal = Math.max(
    0,
    cart.totals.subtotal - cart.totals.discount - promoDiscount + cart.totals.tax + deliveryFee,
  );

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 pb-44 pt-6" style={{ scrollbarWidth: 'none' }}>
        <div className="mb-4">
          {selectedAddress ? (
            <SuperAppCheckoutAddressCard
              address={{
                label: titleCase(selectedAddress.label),
                recipientName: selectedAddress.recipientName,
                phone: selectedAddress.phone,
                line1: selectedAddress.addressLine1,
                line2: [selectedAddress.addressLine2, selectedAddress.city, selectedAddress.state]
                  .filter(Boolean)
                  .join(', '),
              }}
              onChangeAddress={() => {
                setShowAddressPicker(true);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowAddAddress(true);
              }}
              className="w-full rounded-2xl border border-dashed border-white/20 p-4 text-center text-[13px] text-white/70"
            >
              + Add a delivery address to continue
            </button>
          )}
        </div>

        <div className="mb-4">
          <SuperAppCheckoutMerchantCard
            merchantName={merchantName ?? 'Your Order'}
            itemCount={cart.items.length}
            subtotalLabel={formatPrice(cart.totals.subtotal, cart.currency)}
            fulfillmentType={fulfillmentType}
            deliveryFeeLabel={formatPrice(cart.totals.deliveryFee, cart.currency)}
            note={note}
            onFulfillmentType={setFulfillmentType}
            onNoteChange={setNote}
          />
        </div>

        <div className="mb-4">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-white/40">
            Payment Method
          </p>
          <SuperAppPaymentMethodSelector
            options={[...PAYMENT_OPTIONS]}
            selectedKey={paymentProvider}
            onSelect={setPaymentProvider}
          />
        </div>

        <SuperAppPromoCodeCard
          applied={promoCode !== null}
          discountLabel={promoCode ? formatPrice(promoDiscount, cart.currency) : undefined}
          errorMessage={promoError ?? undefined}
          onApply={(code) => {
            void onApplyPromo(code);
          }}
          onRemove={onRemovePromo}
        />

        <SuperAppCartOrderSummary
          title="Order Summary"
          itemsTotalLabel={formatPrice(cart.totals.subtotal, cart.currency)}
          deliveryFeeLabel={deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee, cart.currency)}
          discountLabel={
            cart.totals.discount + promoDiscount > 0
              ? `−${formatPrice(cart.totals.discount + promoDiscount, cart.currency)}`
              : undefined
          }
          taxLabel={formatPrice(cart.totals.tax, cart.currency)}
          totalLabel="Final Total"
          grandTotalLabel={formatPrice(grandTotal, cart.currency)}
        />

        <SuperAppCheckoutTermsCheckbox
          checked={termsChecked}
          onToggle={() => {
            setTermsChecked((v) => !v);
          }}
        />
      </div>

      <SuperAppPlaceOrderBar
        totalLabel={formatPrice(grandTotal, cart.currency)}
        disabled={!termsChecked}
        placing={placing}
        onPlaceOrder={() => {
          void onPlaceOrder();
        }}
        navTab="marketplace"
      />

      {showAddressPicker ? (
        <SuperAppAddressPickerSheet
          addresses={addresses.map((a) => ({
            id: a.id,
            label: titleCase(a.label),
            recipientName: a.recipientName,
            line1: a.addressLine1,
            line2: [a.addressLine2, a.city, a.state].filter(Boolean).join(', '),
          }))}
          selectedId={selectedAddressId}
          onSelect={(id) => {
            setSelectedAddressId(id);
            setShowAddressPicker(false);
          }}
          onAddNew={() => {
            setShowAddressPicker(false);
            setShowAddAddress(true);
          }}
          onClose={() => {
            setShowAddressPicker(false);
          }}
        />
      ) : null}

      {showAddAddress ? (
        <SuperAppAddAddressSheet
          submitting={savingAddress}
          onSubmit={(input) => {
            void onAddAddress(input);
          }}
          onClose={() => {
            setShowAddAddress(false);
          }}
        />
      ) : null}
    </div>
  );
}
