import { Metadata } from "next"

import { listCategories } from "@lib/data/categories"
import { BUDGET_BANDS, budgetBand, findGifts } from "@lib/data/gift-finder"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { buildSeoMetadata } from "@lib/seo"
import { buildPillars } from "@lib/util/pillars"
import { HttpTypes } from "@medusajs/framework/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SurpriseProductPicker from "@modules/common/components/surprise-product-picker"
import ProductPreview from "@modules/products/components/product-preview"

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { countryCode } = await props.params

  return await buildSeoMetadata({
    title: "Gift Finder",
    description:
      "Find a Nepali gift by recipient, occasion, or budget, or open the surprise gift box for an instant recommendation.",
    countryCode,
    path: "/gifts/finder",
    keywords: [
      "gift finder Nepal",
      "Nepali gift ideas",
      "gift box recommendation",
      "handmade Nepal gifts",
    ],
  })
}

type SearchParams = {
  recipient?: string
  occasion?: string
  budget?: string
}

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<SearchParams>
}

const href = (base: SearchParams, patch: SearchParams) => {
  const merged = { ...base, ...patch }
  const qs = Object.entries(merged)
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join("&")
  return `/gifts/finder${qs ? `?${qs}` : ""}`
}

const Step = ({
  index,
  title,
  active,
  done,
  children,
}: {
  index: number
  title: string
  active: boolean
  done: boolean
  children?: React.ReactNode
}) => (
  <div
    className={
      active || done
        ? "border-l-2 border-brand-accent pl-6 pb-10"
        : "border-l-2 border-ui-border-base pl-6 pb-10 opacity-50"
    }
  >
    <div className="flex items-baseline gap-3">
      <span className="text-xsmall-regular uppercase tracking-[0.18em] text-brand-accent">
        Step {index}
      </span>
      <h2 className="font-playfair text-[22px] text-brand-heading">{title}</h2>
    </div>
    <div className="mt-4">{children}</div>
  </div>
)

const Choice = ({
  label,
  href: to,
  selected,
  testid,
}: {
  label: string
  href: string
  selected: boolean
  testid: string
}) => (
  <LocalizedClientLink
    href={to}
    data-testid={testid}
    className={
      selected
        ? "inline-block px-4 py-2.5 rounded-circle bg-brand-primary-deep text-brand-surface text-base-semi transition-colors duration-150"
        : "inline-block px-4 py-2.5 rounded-circle bg-brand-surface text-brand-slate text-base-regular hover:bg-brand-surface-tint transition-colors duration-150"
    }
  >
    {label}
  </LocalizedClientLink>
)

export default async function GiftFinderPage(props: Props) {
  const { countryCode } = await props.params
  const sp = await props.searchParams
  const { recipient, occasion, budget } = sp

  const [categories, region] = await Promise.all([
    listCategories().catch(() => []),
    getRegion(countryCode),
  ])

  const pillars = buildPillars(categories ?? [])
  const gifts = pillars.find((p) => p.handle === "gifts")
  const recipients =
    gifts?.groups.find((g) => g.title === "By Recipient")?.items ?? []
  const occasions =
    gifts?.groups.find((g) => g.title === "By Occasion")?.items ?? []

  // Every leaf gift category - the search space when budget is the only
  // answer given.
  const giftCategoryIds = (gifts?.groups ?? []).flatMap((g) =>
    g.items.map((i) => i.id)
  )

  const hasFacet = Boolean(recipient || occasion)
  const band = budgetBand(budget)
  // Budget stands on its own. The page promises you can skip the questions
  // you do not have an answer to, so a budget alone still has to search.
  const hasChoice = hasFacet || Boolean(band)

  const result = hasFacet ? await findGifts({ recipient, occasion }) : null
  const giftCatalogue = giftCategoryIds.length
    ? await listProducts({
        countryCode,
        queryParams: { category_id: giftCategoryIds, limit: 100 },
      }).then(({ response }) =>
        Array.from(new Map(response.products.map((p) => [p.id, p])).values())
      )
    : []

  let products: HttpTypes.StoreProduct[] = []

  if (hasFacet) {
    const ids = result?.product_ids ?? []
    if (ids.length) {
      const fetched = await listProducts({
        countryCode,
        queryParams: { id: ids, limit: 100 },
      }).then(({ response }) => response.products)

      // The products endpoint does not preserve the id order, but that order
      // now encodes closeness when the result was relaxed - keep it.
      const rank = new Map(ids.map((id, i) => [id, i]))
      products = fetched.sort(
        (a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)
      )
    }
  } else if (band) {
    products = giftCatalogue
  }

  // Only a genuine two-facet miss relaxes; flag it once there are results to show.
  const relaxed = Boolean(result?.relaxed)

  // Budget is applied here rather than in the API because the price depends on
  // the region the shopper is browsing in.
  if (band && products.length) {
    products = products.filter((p) => {
      const amounts = (p.variants ?? [])
        .map((v) => v.calculated_price?.calculated_amount)
        .filter((n): n is number => typeof n === "number")
      if (!amounts.length) {
        return false
      }
      const cheapest = Math.min(...amounts)
      return cheapest >= band.min && cheapest < band.max
    })
  }

  return (
    <>
      <section className="bg-brand-primary-deep text-brand-surface">
        <div className="content-container py-14 small:py-16 text-center">
          <span className="text-xsmall-regular uppercase tracking-[0.22em] text-brand-accent-light">
            Not sure what to pick
          </span>
          <h1 className="font-playfair text-[32px] small:text-[44px] leading-tight mt-3">
            Gift finder
          </h1>
          <p className="text-base-regular text-brand-surface/75 max-w-lg mx-auto mt-3">
            Three questions. Answer what you know and skip the rest.
          </p>
        </div>
      </section>

      <section className="content-container py-12 small:py-16 grid grid-cols-1 small:grid-cols-[minmax(0,22rem)_1fr] gap-x-12">
        <div>
          <Step index={1} title="Who is it for?" active done={Boolean(recipient)}>
            <div className="flex flex-wrap gap-2">
              {recipients.map((r) => (
                <Choice
                  key={r.id}
                  label={r.name}
                  testid={`finder-recipient-${r.handle}`}
                  selected={recipient === r.handle}
                  href={href(sp, {
                    recipient: recipient === r.handle ? undefined : r.handle,
                  })}
                />
              ))}
            </div>
          </Step>

          <Step
            index={2}
            title="What is the occasion?"
            active
            done={Boolean(occasion)}
          >
            <div className="flex flex-wrap gap-2">
              {occasions.map((o) => (
                <Choice
                  key={o.id}
                  label={o.name}
                  testid={`finder-occasion-${o.handle}`}
                  selected={occasion === o.handle}
                  href={href(sp, {
                    occasion: occasion === o.handle ? undefined : o.handle,
                  })}
                />
              ))}
            </div>
          </Step>

          <Step index={3} title="Budget?" active done={Boolean(budget)}>
            <div className="flex flex-wrap gap-2">
              {BUDGET_BANDS.map((b) => (
                <Choice
                  key={b.key}
                  label={b.label}
                  testid={`finder-budget-${b.key}`}
                  selected={budget === b.key}
                  href={href(sp, {
                    budget: budget === b.key ? undefined : b.key,
                  })}
                />
              ))}
            </div>
          </Step>

          {hasChoice && (
            <LocalizedClientLink
              href="/gifts/finder"
              className="text-small-regular text-ui-fg-muted hover:text-brand-accent transition-colors duration-150"
              data-testid="finder-reset"
            >
              Start over
            </LocalizedClientLink>
          )}
        </div>

        <div className="mt-12 small:mt-0" data-testid="finder-results">
          {!hasChoice ? (
            <SurpriseProductPicker
              products={giftCatalogue}
              compact
              title="Open the gift box if you want one instant idea"
              description="For indecisive shoppers: tap the box, let it do the arcade-style shuffle, and it will unlock one real gift from the catalogue."
              boxLabel="Gift drop"
              retryLabel="Pick another"
            />
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-playfair text-[24px] text-brand-heading">
                    {products.length}{" "}
                    {relaxed
                      ? products.length === 1
                        ? "closest match"
                        : "closest matches"
                      : products.length === 1
                        ? "match"
                        : "matches"}
                  </h2>
                  {band && (
                    <span className="text-small-regular text-ui-fg-muted">
                      {band.label}
                    </span>
                  )}
                </div>

                {relaxed && products.length > 0 && (
                  <p
                    className="text-small-regular text-ui-fg-muted mt-2"
                    data-testid="finder-relaxed-note"
                  >
                    No gift matches every answer, so here are the closest - the
                    ones matching the most.
                  </p>
                )}
              </div>

              {products.length && region ? (
                <>
                  <SurpriseProductPicker
                    products={products}
                    title={`Let the gift box pick from ${products.length} matches`}
                    description="Open the box when you want one instant suggestion before browsing the full grid."
                    boxLabel="Gift drop"
                    retryLabel="Pick another"
                  />

                  <div className="mb-6 flex items-baseline justify-between gap-4">
                    <h3 className="font-playfair text-[22px] text-brand-heading">
                      Browse all matches
                    </h3>
                    <span className="text-small-regular text-ui-fg-muted">
                      Prefer to choose yourself
                    </span>
                  </div>

                  <ul className="grid grid-cols-2 medium:grid-cols-3 gap-x-6 gap-y-8">
                    {products.map((product) => (
                      <li key={product.id}>
                        <ProductPreview product={product} region={region} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="border border-dashed border-ui-border-base rounded-large p-10 text-center">
                  <p className="text-base-regular text-ui-fg-subtle">
                    Nothing matches all of that yet.
                  </p>
                  <p className="text-small-regular text-ui-fg-muted mt-2">
                    Try removing the budget, or the occasion.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  )
}
