export type Seller = {
  id: string
  name: string
  handle: string
  email: string
  status: "pending" | "active" | "suspended" | "rejected"
  commission_rate?: number | null
}

export type Product = {
  id: string
  title: string
  handle?: string
  status: "draft" | "proposed" | "published" | "rejected"
  thumbnail?: string | null
  variants?: { id: string; title: string }[]
}

export type Payout = {
  id: string
  amount: number | string
  reversed_amount: number | string
  currency_code: string
  status: "pending" | "paid" | "partially_reversed" | "reversed"
  order_id: string
  reference?: string | null
  created_at: string
}

export type VendorOrder = {
  id: string
  display_id: number
  status: string
  currency_code: string
  created_at: string
  seller_subtotal: number
  seller_fulfillment_status:
    | "not_fulfilled"
    | "fulfilled"
    | "shipped"
    | "delivered"
  seller_fulfillment?: {
    id: string
    shipped_at?: string | null
    delivered_at?: string | null
    labels?: {
      id: string
      tracking_number: string
      tracking_url: string
    }[]
  } | null
  items: {
    id: string
    title: string
    quantity: number
    fulfilled_quantity: number
    unit_price: number | string
  }[]
}

type ApiOptions = {
  method?: "GET" | "POST"
  token?: string
  body?: unknown
}

export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.token
        ? { authorization: `Bearer ${options.token}` }
        : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Request failed")
  }

  return data as T
}
