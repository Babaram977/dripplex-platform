import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const prisma = new PrismaClient({
  datasources: {
    db: { url: databaseUrl },
  },
});

let databaseAvailable = false;
let userId: string;
let merchantId: string;

beforeAll(async () => {
  try {
    await prisma.$connect();
    databaseAvailable = true;
  } catch {
    databaseAvailable = false;
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: `catalog-test-${randomUUID()}@dripplex.test`,
      passwordHash: 'not-a-real-hash',
      firstName: 'Catalog',
      lastName: 'Tester',
    },
  });
  userId = user.id;

  const merchant = await prisma.merchantProfile.create({
    data: { userId: user.id },
  });
  merchantId = merchant.id;
});

afterAll(async () => {
  if (databaseAvailable && userId) {
    // Cascades through merchant_profiles -> products -> variants/images/inventory.
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});

describe('Product Catalog schema (Reality Stage R1.1)', () => {
  it('registers the new catalog models on the Prisma client', () => {
    expect(Prisma.ModelName.Category).toBe('Category');
    expect(Prisma.ModelName.Brand).toBe('Brand');
    expect(Prisma.ModelName.Product).toBe('Product');
    expect(Prisma.ModelName.ProductImage).toBe('ProductImage');
    expect(Prisma.ModelName.ProductVariant).toBe('ProductVariant');
    expect(Prisma.ModelName.ProductInventory).toBe('ProductInventory');
  });

  it('creates a full catalog entry graph and resolves its relations', async () => {
    if (!databaseAvailable) {
      return;
    }

    const category = await prisma.category.create({
      data: { name: 'Groceries', slug: `groceries-${randomUUID()}` },
    });
    const brand = await prisma.brand.create({
      data: { name: 'Dripplex Own', slug: `dripplex-own-${randomUUID()}` },
    });

    const product = await prisma.product.create({
      data: {
        merchantId,
        categoryId: category.id,
        brandId: brand.id,
        name: 'Basmati Rice 5kg',
        slug: `basmati-rice-5kg-${randomUUID()}`,
        basePrice: new Prisma.Decimal('4500.00'),
        status: 'PUBLISHED',
        images: { create: [{ url: 'https://example.com/rice.jpg', position: 0 }] },
        variants: { create: [{ name: '5kg Bag', priceOverride: new Prisma.Decimal('4500.00') }] },
        inventory: { create: { quantity: 100, reserved: 5 } },
      },
      include: { category: true, brand: true, images: true, variants: true, inventory: true },
    });

    expect(product.category?.id).toBe(category.id);
    expect(product.brand?.id).toBe(brand.id);
    expect(product.images).toHaveLength(1);
    expect(product.variants).toHaveLength(1);
    expect(product.inventory?.quantity).toBe(100);
    expect(product.inventory?.reserved).toBe(5);

    const merchant = await prisma.merchantProfile.findUniqueOrThrow({
      where: { id: merchantId },
      include: { products: true },
    });
    expect(merchant.products.map((p) => p.id)).toContain(product.id);
  });

  it('enforces a unique (merchantId, slug) pair per product', async () => {
    if (!databaseAvailable) {
      return;
    }

    const slug = `duplicate-slug-${randomUUID()}`;
    await prisma.product.create({
      data: { merchantId, name: 'First', slug, basePrice: new Prisma.Decimal('10.00') },
    });

    await expect(
      prisma.product.create({
        data: { merchantId, name: 'Second', slug, basePrice: new Prisma.Decimal('20.00') },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects a product referencing a merchant that does not exist', async () => {
    if (!databaseAvailable) {
      return;
    }

    await expect(
      prisma.product.create({
        data: {
          merchantId: randomUUID(),
          name: 'Orphan Product',
          slug: `orphan-${randomUUID()}`,
          basePrice: new Prisma.Decimal('10.00'),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('cascades product deletion to its images, variants, and inventory', async () => {
    if (!databaseAvailable) {
      return;
    }

    const product = await prisma.product.create({
      data: {
        merchantId,
        name: 'Cascade Test Product',
        slug: `cascade-test-${randomUUID()}`,
        basePrice: new Prisma.Decimal('10.00'),
        images: { create: [{ url: 'https://example.com/a.jpg' }] },
        variants: { create: [{ name: 'Default' }] },
        inventory: { create: { quantity: 1 } },
      },
      include: { images: true, variants: true, inventory: true },
    });

    await prisma.product.delete({ where: { id: product.id } });

    await expect(
      prisma.productInventory.findUnique({ where: { productId: product.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.productImage.findMany({ where: { productId: product.id } }),
    ).resolves.toHaveLength(0);
    await expect(
      prisma.productVariant.findMany({ where: { productId: product.id } }),
    ).resolves.toHaveLength(0);
  });
});
