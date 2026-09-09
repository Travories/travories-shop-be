export type Seller = {
  id: string
  name: string
  handle: string
  email: string
  status: "pending" | "active" | "suspended" | "rejected"
  commission_rate?: number | null
}

export type ProductStatus = "draft" | "proposed" | "published" | "rejected"

export type Product = {
  id: string
  title: string
  handle?: string
  status: ProductStatus
  thumbnail?: string | null
  variants?: { id: string; title: string }[]
}

export type ProductPrice = {
  id?: string
  amount: number
  currency_code: string
}

export type ProductVariantDetail = {
  id: string
  title: string
  sku?: string | null
  manage_inventory?: boolean
  prices?: ProductPrice[]
  options?: { option?: { title?: string }; value?: string }[]
  inventory_items?: {
    inventory?: { location_levels?: { stocked_quantity: number }[] }
  }[]
}

export type ProductDetail = {
  id: string
  title: string
  subtitle?: string | null
  handle?: string
  status: ProductStatus
  description?: string | null
  thumbnail?: string | null
  material?: string | null
  weight?: number | null
  metadata?: Record<string, unknown> | null
  collection?: { id: string } | null
  categories?: { id: string; name: string }[]
  tags?: { value: string }[]
  images?: { url: string }[]
  variants?: ProductVariantDetail[]
  options?: { id: string; title: string; values?: { value: string }[] }[]
  destination?: { id: string; name: string } | null
  artisan?: { id: string; name: string } | null
}

export type Taxon = { id: string; name: string }
export type Collection = { id: string; title: string }
export type Category = { id: string; name: string; handle: string }

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

type UploadResponse = {
  upload: {
    url: string
    method: string
    headers?: Record<string, string>
    public_url?: string | null
    store_url?: string | null
  }
}

/**
 * Uploads a product image: asks the backend for a presigned URL, PUTs the file
 * straight to storage, then returns the public URL to store on the product.
 */
export async function uploadVendorMedia(
  file: File,
  token: string
): Promise<string> {
  const { upload } = await api<UploadResponse>("/vendor/media/upload-url", {
    method: "POST",
    token,
    body: { filename: file.name, content_type: file.type },
  })

  const putResponse = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: file,
  })

  if (!putResponse.ok) {
    throw new Error("Image upload failed")
  }

  const url = upload.public_url ?? upload.store_url
  if (!url) {
    throw new Error("Upload did not return a public URL")
  }

  return url
}
