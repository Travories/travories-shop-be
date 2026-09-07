import { sdk } from "@lib/config"
import { getCacheOptions } from "./cookies"

export type GiftFinderResult = {
  product_ids: string[]
  count: number
  facets: { recipient?: string; occasion?: string }
  unknown_facet?: boolean
  // True when no product matched every facet and the results were relaxed to
  // the closest gifts (any facet), ranked by how many facets each matches.
  relaxed?: boolean
}

export const findGifts = async (params: {
  recipient?: string
  occasion?: string
}): Promise<GiftFinderResult> => {
  const next = { ...(await getCacheOptions("gift-finder")) }

  const query: Record<string, string> = {}
  if (params.recipient) {
    query.recipient = params.recipient
  }
  if (params.occasion) {
    query.occasion = params.occasion
  }

  return sdk.client
    .fetch<GiftFinderResult>("/store/gift-finder", {
      query,
      next,
      cache: "force-cache",
    })
    .catch(() => ({ product_ids: [], count: 0, facets: {} }))
}

export const BUDGET_BANDS = [
  { key: "under-1000", label: "Under NPR 1,000", min: 0, max: 1000 },
  { key: "1000-3000", label: "NPR 1,000 - 3,000", min: 1000, max: 3000 },
  { key: "3000-6000", label: "NPR 3,000 - 6,000", min: 3000, max: 6000 },
  { key: "over-6000", label: "NPR 6,000 and up", min: 6000, max: Infinity },
] as const

export type BudgetKey = (typeof BUDGET_BANDS)[number]["key"]

export const budgetBand = (key?: string) =>
  BUDGET_BANDS.find((b) => b.key === key)
