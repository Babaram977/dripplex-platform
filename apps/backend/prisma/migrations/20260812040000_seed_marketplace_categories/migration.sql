-- Seed the marketplace product-category taxonomy.
--
-- Before this, the only Category row was the demo "Food" category, so a merchant
-- selling anything other than food had nothing to pick in the product-category
-- dropdown. This seeds the browse categories the customer app (Figma source of
-- truth) exposes — Restaurants/Food, Groceries, Pharmacy, Fashion, Electronics,
-- Beauty, Home, Hardware, Furniture, Services, Wholesale — expanded to cover the
-- broader set of businesses DrippleX onboards.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING, so re-running never duplicates and
-- never clobbers categories added later (e.g. via an admin tool). Uses
-- gen_random_uuid() for ids (the id column has no DB default); pgcrypto is
-- ensured for environments where gen_random_uuid() is not already in core.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "categories" ("id", "name", "slug", "is_active", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Restaurants & Food',        'restaurants-food',        true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Groceries & Supermarkets',  'groceries-supermarkets',  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Drinks & Beverages',        'drinks-beverages',        true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Pharmacy & Health',         'pharmacy-health',         true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Beauty & Personal Care',    'beauty-personal-care',    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Fashion & Clothing',        'fashion-clothing',        true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Shoes & Bags',              'shoes-bags',              true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Jewelry & Watches',         'jewelry-watches',         true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Electronics',               'electronics',             true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Phones & Tablets',          'phones-tablets',          true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Computers & Accessories',   'computers-accessories',   true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Home & Kitchen',            'home-kitchen',            true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Furniture',                 'furniture',               true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Hardware & Building',       'hardware-building',       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Baby, Kids & Toys',         'baby-kids-toys',          true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Sports & Fitness',          'sports-fitness',          true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Automotive & Parts',        'automotive-parts',        true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Books & Stationery',        'books-stationery',        true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Office & Industrial',       'office-industrial',       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Agriculture & Farm Produce','agriculture-farm-produce',true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Pet Supplies',              'pet-supplies',            true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Arts & Crafts',             'arts-crafts',             true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Services',                  'services',                true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Wholesale & Bulk',          'wholesale-bulk',          true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
