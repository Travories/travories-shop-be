import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type CategoryRow = {
  id: string
  handle: string
  products?: { id: string }[]
}

/**
 * GET /store/gift-finder?recipient=for-her&occasion=birthday
 *
 * Returns the products matching ALL supplied facets. The store products
 * endpoint treats repeated category_id as OR, so the intersection is resolved
 * here instead - queried from the category side, where `products` is a
 * same-module relation and needs no cross-module filtering.
 *
 * When two facets are given and nothing matches both, the result relaxes to the
 * closest gifts: any product matching at least one facet, ranked by how many it
 * matches. `relaxed: true` tells the storefront to say so. This keeps a sparse
 * catalogue from turning the two-question path into a dead end.
 *
 * Pricing is deliberately not resolved here. The storefront fetches these IDs
 * through the standard products endpoint so region pricing and VAT inclusivity
 * come from the core.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const asHandle = (value: unknown) =>
    typeof value === "string" && value.length ? value : undefined

  const recipient = asHandle(req.query.recipient)
  const occasion = asHandle(req.query.occasion)
  const facets = [recipient, occasion].filter(Boolean) as string[]

  if (!facets.length) {
    res.json({ product_ids: [], count: 0, facets: {} })
    return
  }

  const sets: (Set<string> | null)[] = []

  for (const handle of facets) {
    const { data } = await query.graph({
      entity: "product_category",
      fields: ["id", "handle", "products.id"],
      filters: { handle },
    })

    const row = (data as unknown as CategoryRow[])[0]
    sets.push(row ? new Set((row.products ?? []).map((p) => p.id)) : null)
  }

  // An unknown handle means no such category, so nothing can match.
  if (sets.some((s) => s === null)) {
    res.json({
      product_ids: [],
      count: 0,
      facets: { recipient, occasion },
      unknown_facet: true,
    })
    return
  }

  const nonNull = sets as Set<string>[]
  const [first, ...rest] = nonNull
  const intersection = [...first].filter((id) => rest.every((s) => s.has(id)))

  // A strict match, or only one facet to satisfy: return it as-is.
  if (intersection.length || facets.length < 2) {
    res.json({
      product_ids: intersection,
      count: intersection.length,
      facets: { recipient, occasion },
    })
    return
  }

  // Nothing matches every facet. Relax to the closest gifts: rank every product
  // that matches at least one facet by how many facets it hits.
  const score = new Map<string, number>()
  for (const set of nonNull) {
    for (const id of set) {
      score.set(id, (score.get(id) ?? 0) + 1)
    }
  }

  const ranked = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)

  res.json({
    product_ids: ranked,
    count: ranked.length,
    facets: { recipient, occasion },
    relaxed: true,
  })
}
