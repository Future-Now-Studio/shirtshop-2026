# ShirtShop v2 — Rebuild Design

**Date:** 2026-06-26
**Status:** Approved (design phase)

## Goal

Rebuild the existing custom T-shirt shop from scratch in a new subfolder. Keep the
current frontend stack (Vite + React 18 + TypeScript + shadcn/ui + Tailwind +
React Query + Zustand + Fabric.js). Replace WooCommerce and the ad-hoc Express
backend (`server.js`) with a dedicated, self-managed backend on Supabase.

The system must handle, performantly and reliably:

- Up to **50 products**
- Each with up to **20 variations** (= colors)
- Each variation with **4 images** (front, back, left side, right side) — the product images
- Up to ~**4000 images** total
- A fully self-service **admin** where print areas, variant counts, colors, sizes,
  stock, pricing, and discounts are all configurable.

## Non-Goals

- No WooCommerce dependency of any kind in the runtime path (only a one-time import).
- No multi-tenant / multi-store support.
- No multiple admin roles (single admin login is sufficient).

## Architecture

New subfolder (working name `shirtshop-v2/`). Same frontend stack; Supabase backend.

```
Frontend (Vite + React + shadcn, on Netlify) ──► Supabase
  ├─ Shop (public)                                ├─ Postgres
  ├─ Designer (Fabric.js)                          ├─ Auth (1 admin)
  ├─ Checkout (Stripe)                             ├─ Storage + CDN (images)
  └─ Admin (protected)                             └─ Edge Functions
        │
        └─► Stripe (payment) + Email (order notification with design files)
```

- **Frontend** stays on Netlify, same deploy model as today.
- **Supabase** provides Postgres, Auth, Storage with CDN, and Edge Functions.
- **Edge Functions** replace `server.js`:
  - `create-payment-intent` — creates the Stripe PaymentIntent.
  - `stripe-webhook` — verifies Stripe events; source of truth for "paid".
  - `create-order` — writes the order to the DB after payment confirmation;
    never trusts client-supplied prices (recomputes server-side).
  - `send-order-email` — emails the shop owner the order with design files/links.
  - `import-woo` — one-time WooCommerce import (run manually).
- **Public reads** go through the Supabase client with Row Level Security: anyone
  may read `status = 'published'` products and their related rows. All writes
  require an authenticated admin session.
- **Images**: customers never hit WordPress. Variant images and rendered customer
  designs live in Supabase Storage, served via CDN.

### Performance approach (50 × 20 × 4)

- Product list loads exactly **one thumbnail per product** (not all variants).
- Product detail loads only the **selected color's 4 views**, lazily.
- Designer loads the 4 views of the chosen variant only.
- Images are CDN-served and lazy-loaded; the app never loads all 4000 at once.
- DB indexed on `product_id`, `variant_id`, `color_id`, and `status`.

## Data Model (Postgres)

### Global, reusable (color/size management)

- **`colors`** — `id, name, hex, sort_order`
- **`sizes`** — `id, name, sort_order`

Colors and sizes are created once and assigned to products — defined in one place,
referenced everywhere.

### Catalog

- **`products`** — `id, slug, name, description, category, base_price,
  design_element_price, status (draft | published), excluded_from_volume_discount (bool),
  created_at, updated_at`
  - Base price is always per product. Colors never change base price.
- **`variants`** — `id, product_id, color_id, sort_order`
  - One variant = one color of a product (~20 per product). No per-variant price.
- **`variant_images`** — `id, variant_id, view (front | back | left | right),
  storage_path, sort_order`
  - 4 per variant.
- **`product_sizes`** — `product_id, size_id`
  - Which sizes the product offers at all.
- **`variant_size_availability`** — `variant_id, size_id, available (bool), stock (int)`
  - The color × size matrix. Real stock counts per cell. `available` may be derived
    from `stock > 0` or set explicitly; both flags stored.

### Designer

- **`print_zones`** — `id, product_id, view (front | back | left | right),
  x, y, width, height, label, sort_order`
  - Relative coordinates (0–1) on the view image. Multiple zones per product.
    Identical across all colors of that product.

### Commerce

- **`orders`** — `id, created_at, status, customer_name, customer_email,
  customer_address (jsonb), total, stripe_payment_intent_id, email_sent (bool)`
- **`order_items`** — `id, order_id, product_id, variant_id, size_id, qty,
  unit_price, design_data (jsonb), design_render_paths (text[])`
  - `design_data` = raw Fabric.js JSON (re-editable). `design_render_paths` =
    Storage paths to rendered PNGs per used view.
- **`volume_discounts`** — `id, min_qty, discount_percent`
  - Global tiers. Products flagged `excluded_from_volume_discount` do not count
    toward the qty threshold and do not receive the discount.

### Settings

- **`settings`** — singleton row: default `design_element_price`, order-notification
  email recipient, and other shop-wide defaults.

## Pricing

- Line price = `base_price + (design_element_count × design_element_price)`.
- `design_element_price` is configurable (per product, defaulting from settings).
- **Volume discount**: configurable tiers (`min_qty → discount_percent`) applied to
  the count of eligible products in the cart. Products marked
  `excluded_from_volume_discount` are excluded from both the count and the discount.
- Prices are always **recomputed server-side** in the `create-order` Edge Function;
  the client price is display-only.

## Admin (`/admin`, protected)

Single admin login via Supabase Auth. Built fresh using the frontend-design skill.

- **Colors & Sizes** — global lists. Create once, reuse. Color = name + hex picker.
- **Products** — list + editor:
  - Basics: name, category, base price, design-element price, status,
    exclude-from-discount toggle.
  - **Variants (colors)**: add a color from the global list, then upload the 4 view
    images (drag-and-drop, auto-uploaded to Storage). Reorderable.
  - **Size matrix**: a grid of color × size; each cell has an availability toggle and
    a stock number.
  - **Print zones**: choose a view, draw one or more rectangles on the image, label
    each. Visual editor overlaid on the variant image. Zones apply to all colors.
- **Orders** — list + detail with design renders and raw design data; status changes;
  resend notification email.
- **Discounts** — manage volume tiers (`min_qty → percent`).
- **Settings** — email recipient, default design-element price, other defaults.

## Shop & Designer (public, rebuilt with frontend-design skill)

- **Shop**: product grid (one CDN thumbnail per product), filter by category/color.
- **Product detail**: color swatches from global colors; size picker that greys out
  unavailable sizes per the matrix; 4-view image gallery.
- **Designer (Fabric.js)**:
  - Loads the selected variant's 4 view images as canvas backgrounds.
  - Print zones drawn as boundaries; artwork outside a zone is clipped or warned.
  - Add image/text elements per zone; switch between views (per-view canvas).
  - Live price = base + (elements × element price).
  - On add-to-cart: render each used view to PNG and store the design JSON plus PNGs.
- **Cart / Checkout**:
  - Zustand cart. Volume discount applied on eligible product count.
  - Stripe payment (card / PayPal / Apple Pay / Google Pay via automatic methods).
  - On payment success → `create-order` Edge Function writes the order, uploads the
    design renders, and triggers `send-order-email` to the shop owner with the files.

## Build Order

Each numbered item becomes its own spec → plan → implementation cycle:

1. **Foundation** — Supabase project, schema, RLS policies, storage buckets.
2. **Admin** — colors/sizes, products, variants + image upload, size matrix, print zones.
3. **Public shop** — product grid + product detail.
4. **Designer** — Fabric.js designer bound to print zones.
5. **Checkout** — cart, Stripe, order Edge Functions, owner email notification.
6. **Import** — one-time WooCommerce import script.
7. **Marketing pages** — Filialen, Impressum, AGB, Datenschutz, etc., rethought with
   the frontend-design skill.

## Open Decisions Resolved

- Backend: **Supabase** (DB + Auth + Storage/CDN + Edge Functions).
- Variation = **color**; each has its own 4 images.
- Colors and sizes are **global and reusable**.
- Size availability is a **per-product color × size matrix** with real stock counts.
- Print zones: **multiple per product, per view, identical across colors**.
- Pricing: **base + per-design-element**, plus **configurable volume discount** with
  per-product exclusion.
- Payment: **Stripe**, plus **email notification** with design files.
- Migration: **one-time WooCommerce import**.
- Admin: **single login** (Supabase Auth).
- Designer + marketing: **rebuilt fresh** with the frontend-design skill.
