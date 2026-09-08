# IMPLEMENTATION — Backend & Frontend

Prescriptive build guide for the remaining work. [INFO.md](INFO.md) records what exists and why;
[PLAN.md](PLAN.md) is the roadmap. **This document is how to actually build each piece.**

Every code sample follows the conventions this repo already enforces (`@medusajs/eslint-plugin`,
the Medusa agent skills, and the storefront's own patterns). Deviating from them usually means the
code is wrong, not merely unfashionable.

---

## 0. Rules that prevent breakage

Read once. Most incidents in this project traced back to violating one of these.

### Backend architecture — never bypass a layer

```
Module (data models + CRUD)
  ↓
Workflow (business logic + rollback)
  ↓
API Route (HTTP + validation)
  ↓
Frontend (via SDK)
```

| Rule | Why |
| --- | --- |
| **Workflows for ALL mutations** | Rollback. Never call a module service directly from a route |
| **Only GET, POST, DELETE** | Medusa does not route PUT/PATCH |
| **Module names camelCase** | `souvenir`, never `product-review` — dashes break container resolution |
| **One `defineLink` per file** | Exporting an array from one file silently does nothing |
| **`db:generate <module>` then `db:migrate`** | Two separate commands. Skipping the first means your model change never applies |
| **Prices are stored as-is** | `49.99` is `49.99`, not cents. Never `* 100` or `/ 100` |
| **`query.graph()` cannot filter by linked-module fields** | Query from the other side, or use `query.index()` |

### Frontend — the SDK is not optional

```ts
// ✅ custom route
await sdk.client.fetch("/store/gift-finder", { query: { recipient } })

// ✅ built-in
await sdk.store.product.list()

// ❌ never — missing publishable key, fails with an opaque error
await fetch("http://localhost:9000/store/products")

// ❌ never — SDK serialises for you; this double-encodes
body: JSON.stringify({ ... })
```

### Environment traps, learned the hard way

| Trap | Consequence | Avoid by |
| --- | --- | --- |
| `pkill -f "medusa"` | **Kills PostgreSQL** — its backend processes contain `medusashop` in their command line. Forces crash recovery | Target the PID: `lsof -nP -iTCP:9000 -sTCP:LISTEN` |
| `npm run build` (storefront) while its dev server runs | Both use `.next`; dev server 500s with `ENOENT … app-build-manifest.json` | Stop the storefront dev server first |
| Storefront build with backend down | `ECONNREFUSED` — the build prerenders pages | Backend **up**, storefront dev **down** |
| `next.config.js` has `typescript.ignoreBuildErrors: true` | A passing build proves nothing about types | `npx tsc --noEmit` is the real gate |
| `npm install` in a workspace | Can hoist a second `@types/react` and break JSX types repo-wide | Check `find . -name "@types/react" -path "*/node_modules/*"` after installs |

### The loop

```bash
# after edits
cd apps/backend && npx tsc --noEmit && npx medusa lint
cd apps/storefront && npx tsc --noEmit

# ONCE per phase, not per change
cd apps/backend && npm run build
# backend running, storefront dev stopped:
cd apps/storefront && npm run build
```

---

# PART 1 — BACKEND

## B1. Private media pipeline on Garage/VPS

The VPS bucket is S3-compatible but private. That means custom media must store object keys, not
public URLs, and reads must go back through the backend.

### Step 1 — env

```bash
# apps/backend/.env
S3_ENDPOINT=https://bucket.your-vps.com
S3_BUCKET=medusashop-media
S3_REGION=garage
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

# Provider aliases this repo also accepts:
S3_BUCKET_NAME_PUBLIC=medusashop-media
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

Document these in the root `.env.example` too — never commit real values.

### Step 2 — register the module

```ts
// apps/backend/medusa-config.ts
modules: [
  { resolve: "./src/modules/souvenir" },
  {
    resolve: "@medusajs/medusa/file",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/file-s3",
          id: "s3",
          options: {
            file_url: process.env.S3_FILE_URL,
            endpoint: process.env.S3_ENDPOINT,
            bucket: process.env.S3_BUCKET,
            region: process.env.S3_REGION,
            access_key_id: process.env.S3_ACCESS_KEY_ID,
            secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
            additional_client_config: {
              forcePathStyle: true, // REQUIRED for Garage
            },
          },
        },
      ],
    },
  },
]
```

### Step 3 — run the migration

```bash
cd apps/backend
npm exec medusa db:migrate
```

This adds `destination.hero_image_key` and `artisan.photo_key`.

### Step 4 — upload and persist keys

- `POST /admin/media/upload-url` with `access: "private"`
- upload the file to the returned presigned `PUT` URL
- store the returned `key` in `hero_image_key` or `photo_key`

`src/scripts/upload-media.ts` now does this automatically for destination and artisan assets.

### Step 5 — read through the backend

The storefront should keep consuming the existing destination endpoints. They now return stable
backend media URLs under `/store/media?key=...`, which redirect to a fresh presigned download URL.

### Gotchas, in the order they will bite

1. **`forcePathStyle: true` is mandatory.** Garage does not do virtual-host bucket addressing. Without
   it, every upload fails with a confusing DNS error.
2. **`region` must be set** even though Garage ignores it — the AWS SDK refuses to initialise without one.
3. **Do not persist presigned URLs.** They expire; store the object key only.
4. **Storefront cache and private media conflict** if the API returns raw presigned URLs. That is
   why the stable `/store/media` backend route exists.
5. **Core product images are still URL-based.** Do not push private keys into `product.thumbnail`
   or `product.images.url`; use a dedicated product-media model if products also need privacy.
6. **Registering the file module replaces the default local provider.** Admin uploads go to Garage
   immediately. Test with one product before bulk upload.

### Verify

```bash
cd apps/backend && npm run build
cd apps/backend && npm exec medusa db:migrate
# then:
# 1. POST /admin/media/upload-url
# 2. PUT the file to the returned presigned URL
# 3. save the returned key on a destination or artisan
# 4. GET /store/media?key=... and confirm it redirects to a working download URL
```

---

## B2. Artisans

The model, service and link already exist. Only data is missing — deliberately, because inventing
maker names would put false provenance on a store selling hand-made goods.

### Seed script

```ts
// apps/backend/src/scripts/seed-artisans.ts
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { SOUVENIR_MODULE } from "../modules/souvenir"

const ARTISANS = [
  {
    name: "REAL NAME",
    slug: "real-name",
    craft: "Thangka painting",
    bio: "…",
    workshop_location: "Patan",
    destination_slug: "kathmandu-valley",   // resolved to destination_id below
    product_handles: ["thangka-painting"],  // linked to these products
  },
]

export default async function seedArtisans({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const souvenir: any = container.resolve(SOUVENIR_MODULE)

  const destinations = await souvenir.listDestinations({})
  const bySlug = new Map(destinations.map((d: any) => [d.slug, d.id]))

  for (const a of ARTISANS) {
    const { destination_slug, product_handles, ...fields } = a
    const [existing] = await souvenir.listArtisans({ slug: fields.slug })
    const artisan = existing ?? (await souvenir.createArtisans({
      ...fields,
      destination_id: bySlug.get(destination_slug),
    }))

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "handle"],
      filters: { handle: product_handles },
    })

    for (const p of products) {
      // Order MUST match defineLink: product first, then artisan.
      await link.create({
        [Modules.PRODUCT]: { product_id: p.id },
        [SOUVENIR_MODULE]: { artisan_id: artisan.id },
      })
    }
    logger.info(`  ${fields.name}: ${products.length} products`)
  }
}
```

```bash
npx medusa exec ./src/scripts/seed-artisans.ts
```

The destination page already renders a **"Makers in …"** section the moment artisans exist — no
frontend change needed.

---

## B3. Destination hero images and Travories links

Six rows to update once you have the assets and the real trek URLs.

```ts
// apps/backend/src/scripts/update-destinations.ts
const UPDATES = [
  { slug: "everest-region", hero_image_key: "private/destinations/2026-09-01/uuid-everest.jpg",
    travories_url: "https://travories.com/treks/everest-base-camp" },
  // …five more
]

export default async function updateDestinations({ container }) {
  const souvenir: any = container.resolve(SOUVENIR_MODULE)
  for (const { slug, ...data } of UPDATES) {
    const [d] = await souvenir.listDestinations({ slug })
    if (d) await souvenir.updateDestinations({ id: d.id, ...data })
  }
}
```

The "Plan a trip here on Travories →" link renders **only** when `travories_url` is set, so partial
data degrades cleanly. `hero_image` is stored but not yet rendered — see [F4](#f4-image-treatment).

---

## B4. Personalisation / engraving

Custom text per line item. No new module — this is cart metadata.

### Storefront sends it

```ts
// when adding to cart
await sdk.store.cart.createLineItem(cartId, {
  variant_id: variantId,
  quantity: 1,
  metadata: { engraving: "For Aama, 2026" },
})
```

### Backend validates it

Do **not** validate in the route. Business rules belong in a workflow step:

```ts
// apps/backend/src/workflows/steps/validate-engraving.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

export const validateEngravingStep = createStep(
  "validate-engraving",
  async (input: { text?: string }) => {
    if (input.text && input.text.length > 40) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Engraving must be 40 characters or fewer"
      )
    }
    return new StepResponse(input.text)
  }
)
```

Metadata flows automatically from cart line item → order line item, so fulfilment sees it in the admin
order detail without extra work.

**Which products allow it?** Add a product `metadata.engravable = true` in the seed, and have the
product page show the input only when set.

---

## B5. Gift cards

Medusa ships these natively — `is_giftcard` already exists on `CreateProductDTO`.

1. Create a gift-card product in the seed with `is_giftcard: true` and denomination variants.
2. Storefront: a purchase surface, plus a redeem field at checkout (`POST /store/carts/:id/promotions`).
3. Verify by buying one and redeeming it on a second order.

Smallest real feature on the list. Do it when you want a quick win.

---

## B6. Payment provider

`pp_system_default` is fake. Nothing takes real money until this is replaced. **This is the hard
launch blocker.**

| Option | Effort | Note |
| --- | --- | --- |
| **Stripe** (`@medusajs/payment-stripe`) | Low — config only | Card payments; check Nepal availability for your entity |
| **eSewa / Khalti** | High — custom provider module | What Nepali customers actually expect |
| **Manual / bank transfer** | Low | Viable interim: order placed, payment confirmed out of band |

A custom provider implements Medusa's `AbstractPaymentProvider` (initiate, authorize, capture, refund,
webhook). Budget real time for the webhook path — it is where these integrations break.

---

## B7. Multi-vendor seam

Not now. When it comes: a `seller` module plus `defineLink` from Seller to Product, Order and Stock
Location. Two rules keep it cheap, both already followed:

1. **Never hardcode a stock location or shipping profile** — resolve them.
2. **`Artisan` is already its own entity.** That is what becomes `Seller`.

---

# PART 2 — FRONTEND

## F1. Design tokens and type scale

Tokens live in [globals.css](apps/storefront/src/styles/globals.css); the Tailwind mapping is in
[tailwind.config.js](apps/storefront/tailwind.config.js).

```
--brand-primary    257 25% 45%    #65558f, the travories.com theme-color
--brand-slate      213 21% 30%    body text on light
--brand-terracotta  16 53% 46%    accents, hover, eyebrow labels
--brand-saffron     47 99% 50%    highlights on dark only
--brand-sand        38 35% 88%    chips, hover fills
--brand-paper       38 44% 96%    section backgrounds
```

**Never define a CSS-variable colour without `/ <alpha-value>`** in the Tailwind mapping, or opacity
modifiers (`text-brand-paper/70`) silently do nothing.

### Type scale to apply

Playfair is currently headings-only. Formalise it:

| Use | Class |
| --- | --- |
| Page title | `font-playfair text-[34px] small:text-[50px] leading-tight` |
| Section heading | `font-playfair text-[26px] small:text-[30px]` |
| Card title | `font-playfair text-[22px]` |
| Body | `text-base-regular` (starter class, 145 usages — do not remove) |
| Long-form story | `text-base-regular small:text-large-regular leading-relaxed max-w-2xl` |

`max-w-2xl` on prose is not decoration — unbounded line length is the single most common readability
failure on destination pages.

---

## F2. Scroll reveal

Lenis is installed and mounted. Reveal-on-scroll needs no library.

```tsx
// apps/storefront/src/modules/common/components/reveal/index.tsx
"use client"

import { useEffect, useRef, useState } from "react"

const Reveal = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // Respect the same accessibility promise globals.css makes.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true)
      return
    }
    const el = ref.current
    if (!el) return

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={
        shown
          ? "opacity-100 translate-y-0 transition-all duration-700 ease-out"
          : "opacity-0 translate-y-4 transition-all duration-700 ease-out"
      }
    >
      {children}
    </div>
  )
}

export default Reveal
```

**Apply sparingly** — hero, pillar split, destination story, product grid. Wrapping everything makes a
page feel slow rather than considered. Never wrap nav, cart or checkout.

---

## F3. Product card

The starter card is functional and plain: [product-preview](apps/storefront/src/modules/products/components/product-preview/index.tsx).

Improvements, in order of impact:

1. **Aspect-locked image** — `aspect-[3/4] overflow-hidden rounded-large` so grids never jump.
2. **Hover** — `group-hover:scale-[1.03] transition-transform duration-500` on the image only.
3. **Price emphasis** — price in `text-base-semi text-brand-primary`, title in `text-ui-fg-subtle`.
4. **Destination badge** — the differentiator. A small `Kathmandu Valley` chip makes the two-pillar
   model visible at a glance. Requires passing the linked destination into the card.
5. **Sold-out state** — currently indistinguishable from in-stock.

Do 1–3 first; they apply to every grid on the site at once.

---

## F4. Image treatment

Blocked on [B1](#b1-garage-image-pipeline) and real photography. When unblocked:

- `hero_image` on destination pages — full-bleed, `object-cover`, with a deep-purple gradient overlay so the
  white heading text stays legible over any photo.
- Blur-up placeholders via `next/image` `placeholder="blur"`.
- Set `images.unoptimized: false` in `next.config.js` **after** `remotePatterns` is verified.
- Product galleries: keep the existing thumbnail component, add aspect-ratio locking.

Until then the placeholder component renders correctly — nothing is broken, it is just plain.

---

## F5. Loading and empty states

Currently bare, which reads as broken during navigation.

```tsx
// apps/storefront/src/app/[countryCode]/(main)/destinations/loading.tsx
export default function Loading() {
  return (
    <div className="content-container py-16">
      <div className="grid grid-cols-1 xsmall:grid-cols-2 small:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 rounded-large bg-brand-paper animate-pulse" />
        ))}
      </div>
    </div>
  )
}
```

Add `loading.tsx` for `destinations`, `destinations/[slug]`, `gifts/finder`, `store`, `categories`.
Skeletons must match the real layout's dimensions or you trade a blank screen for layout shift.

Empty states already exist on the gift finder and destination pages — reuse that dashed-border pattern.

---

## F6. Mixed-cart shipping UI

**A known, reproducible gap.** A cart containing a fragile item *and* a standard item requires a
shipping method **per shipping profile**. The API enforces this correctly; the checkout UI offers only
one selection, so such a cart cannot complete.

Verified behaviour:

| Cart | Methods chosen | Result |
| --- | --- | --- |
| Fragile only | Fragile Handling | Order placed |
| Standard only | Standard Delivery | Order placed |
| **Mixed** | Standard only | **Rejected** — "cart items require shipping profiles that are not satisfied" |
| Mixed | Standard **and** Fragile | Order placed |

### Fix

In [checkout/components/shipping](apps/storefront/src/modules/checkout/components/shipping):

1. Group `GET /store/shipping-options?cart_id=` results by `shipping_profile_id`.
2. Derive the required profiles from the cart's line items.
3. Render one radio group **per required profile**, labelled ("Standard items", "Fragile items").
4. Disable "Continue" until every required profile has a selection.
5. Show the combined shipping total.

Until this is built, mixed carts are a dead end in the UI. Prioritise it before launch.

---

## F7. Checkout polish — last, deliberately

Do not restyle `cart`, `checkout` or `account` until everything else is done. They work today, and a
regression there costs real money rather than aesthetics. When you do:

- Keep every `data-testid` — they are the only integration-test hooks.
- Change classes, not structure.
- Place a real test order after each change (see verification below).

---

# Sequencing

```
1. B1  Garage pipeline          ← unblocks everything visual
2. —   Real photography         ← biggest single visual gain; parallel, no code
3. F3  Product card             ← applies to every grid at once
4. F5  Loading states           ← removes the "is it broken?" moment
5. F2  Scroll reveal            ← polish, once content is real
6. B2  Artisans                 ← needs real people
7. B3  Hero images + Travories  ← needs assets and real URLs
8. F6  Mixed-cart shipping      ← correctness gap, must precede launch
9. B6  Payment provider         ← hard launch blocker
10. F7 Checkout polish          ← last
```

Items 1 and 2 gate most of the rest. No amount of layout work compensates for placeholder images.

---

# Verification

## Per change
```bash
cd apps/backend  && npx tsc --noEmit && npx medusa lint
cd apps/storefront && npx tsc --noEmit          # the ONLY type gate — the build ignores errors
```

## Per phase (once)
```bash
cd apps/backend && npm run build
# backend running, storefront dev stopped:
cd apps/storefront && npm run build
```

## The test that actually matters

Pages returning 200 proved nothing during this build. Placing a real order surfaced both the
shipping-profile behaviour and the tax-inclusivity bug. Run this after any change touching cart,
pricing, shipping or checkout:

```
create cart → add line item → set email + address → get shipping options
→ add a method per required profile → create payment collection
→ create payment session (pp_system_default) → complete cart
```

Assert: order created, `total` matches the listed price (VAT **inclusive**), correct region and currency.

---

# Definition of done, per feature

- [ ] `tsc --noEmit` clean, both apps
- [ ] `medusa lint` clean
- [ ] Both builds pass
- [ ] Feature verified against a real request, not just a 200
- [ ] Reduced-motion respected if it animates
- [ ] Works at 375px width
- [ ] No fabricated content — no invented artisans, provenance, or URLs
- [ ] [INFO.md](INFO.md) updated if a decision or gotcha was discovered
