"use client"

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  api,
  Category,
  Collection,
  Payout,
  Product,
  ProductDetail,
  ProductVariantDetail,
  Seller,
  Taxon,
  uploadVendorMedia,
  VendorOrder,
} from "../lib/api"

type View = "overview" | "products" | "orders" | "payouts"
type AuthMode = "login" | "register"

const TOKEN_KEY = "marketplace-seller-token"

const money = (amount: number | string, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(Number(amount))

const payoutNet = (payout: Payout) =>
  Number(payout.amount) - Number(payout.reversed_amount ?? 0)

export function VendorPortal() {
  const [token, setToken] = useState<string | null>(null)
  const [seller, setSeller] = useState<Seller | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<VendorOrder[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [view, setView] = useState<View>("overview")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadWorkspace = useCallback(async (accessToken: string) => {
    const [profile, productList, orderList, payoutList] = await Promise.all([
      api<{ seller: Seller }>("/vendor/sellers/me", { token: accessToken }),
      api<{ products: Product[] }>("/vendor/products", { token: accessToken }),
      api<{ orders: VendorOrder[] }>("/vendor/orders", { token: accessToken }),
      api<{ payouts: Payout[] }>("/vendor/payouts", { token: accessToken }),
    ])
    setSeller(profile.seller)
    setProducts(productList.products)
    setOrders(orderList.orders)
    setPayouts(payoutList.payouts)
  }, [])

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_KEY)
    if (!savedToken) {
      setLoading(false)
      return
    }

    setToken(savedToken)
    loadWorkspace(savedToken)
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY)
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [loadWorkspace])

  const handleAuthenticated = async (accessToken: string) => {
    window.localStorage.setItem(TOKEN_KEY, accessToken)
    setToken(accessToken)
    setLoading(true)
    setError("")
    try {
      await loadWorkspace(accessToken)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    window.localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setSeller(null)
    setProducts([])
    setOrders([])
    setPayouts([])
    setView("overview")
  }

  if (loading) {
    return <div className="loading-screen">Opening Seller Studio…</div>
  }

  if (!token || !seller) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />
  }

  const pendingTotal = payouts
    .filter((payout) => payout.status === "pending")
    .reduce((sum, payout) => sum + payoutNet(payout), 0)
  const paidTotal = payouts
    .filter((payout) => payout.status === "paid")
    .reduce((sum, payout) => sum + payoutNet(payout), 0)

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-mark">SS</div>
          <p className="eyebrow">Marketplace</p>
          <h1>Seller Studio</h1>
        </div>

        <nav aria-label="Seller workspace">
          {(["overview", "products", "orders", "payouts"] as View[]).map((item) => (
            <button
              className={view === item ? "nav-item active" : "nav-item"}
              key={item}
              onClick={() => setView(item)}
            >
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>

        <button className="text-button" onClick={logout}>Sign out</button>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{seller.handle}</p>
            <h2>{seller.name}</h2>
          </div>
          <span className={`status status-${seller.status}`}>{seller.status}</span>
        </header>

        {error && <div className="alert error">{error}</div>}
        {seller.status !== "active" && (
          <div className="alert">
            {seller.status === "pending"
              ? "Your application is awaiting approval. Product publishing unlocks once an administrator activates your account."
              : `Your seller account is ${seller.status}. Contact the marketplace team for help.`}
          </div>
        )}

        {view === "overview" && (
          <Overview
            products={products}
            orders={orders}
            payouts={payouts}
            pendingTotal={pendingTotal}
            paidTotal={paidTotal}
          />
        )}
        {view === "products" && (
          <Products
            products={products}
            seller={seller}
            token={token}
            onChange={setProducts}
            onError={setError}
          />
        )}
        {view === "orders" && (
          <Orders
            orders={orders}
            token={token}
            onChange={setOrders}
            onError={setError}
          />
        )}
        {view === "payouts" && <Payouts payouts={payouts} />}
      </main>
    </div>
  )
}

function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (token: string) => Promise<void>
}) {
  const [mode, setMode] = useState<AuthMode>("login")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "")
    const password = String(form.get("password") ?? "")
    setBusy(true)
    setError("")

    try {
      if (mode === "register") {
        const registered = await api<{ token: string }>(
          "/auth/seller/emailpass/register",
          { method: "POST", body: { email, password } }
        )
        await api("/vendor/sellers", {
          method: "POST",
          token: registered.token,
          body: {
            name: String(form.get("name") ?? ""),
            handle: String(form.get("handle") ?? ""),
            email,
            phone: String(form.get("phone") ?? "") || undefined,
          },
        })
      }

      const session = await api<{ token: string }>("/auth/seller/emailpass", {
        method: "POST",
        body: { email, password },
      })
      await onAuthenticated(session.token)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="brand-mark">SS</div>
        <p className="eyebrow">Marketplace workspace</p>
        <h1>Build your shop.<br />Share your craft.</h1>
        <p>
          Publish products, follow every order payout, and keep your catalog
          ready for customers from one calm workspace.
        </p>
      </section>

      <section className="auth-panel">
        <div className="mode-switch">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Apply to sell</button>
        </div>
        <h2>{mode === "login" ? "Welcome back" : "Open your seller account"}</h2>
        <p className="muted">
          {mode === "login"
            ? "Enter the credentials for your seller account."
            : "Applications are reviewed before products can be published."}
        </p>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <label>Shop name<input name="name" minLength={2} required /></label>
              <label>Shop handle<input name="handle" minLength={2} pattern="[a-z0-9-]+" placeholder="himalayan-crafts" required /></label>
              <label>Phone <span>(optional)</span><input name="phone" /></label>
            </>
          )}
          <label>Email<input type="email" name="email" required /></label>
          <label>Password<input type="password" name="password" minLength={8} required /></label>
          <button className="primary-button" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Submit application"}
          </button>
        </form>
      </section>
    </main>
  )
}

function Overview({
  products,
  orders,
  payouts,
  pendingTotal,
  paidTotal,
}: {
  products: Product[]
  orders: VendorOrder[]
  payouts: Payout[]
  pendingTotal: number
  paidTotal: number
}) {
  const currency = payouts[0]?.currency_code ?? "npr"
  return (
    <section>
      <div className="section-heading">
        <div><p className="eyebrow">At a glance</p><h3>Your marketplace</h3></div>
      </div>
      <div className="metric-grid">
        <article className="metric-card"><span>Products</span><strong>{products.length}</strong><small>in your catalog</small></article>
        <article className="metric-card"><span>Orders</span><strong>{orders.length}</strong><small>containing your products</small></article>
        <article className="metric-card warm"><span>Pending payout</span><strong>{money(pendingTotal, currency)}</strong><small>awaiting settlement</small></article>
        <article className="metric-card dark"><span>Paid out</span><strong>{money(paidTotal, currency)}</strong><small>all-time ledger</small></article>
      </div>
      <div className="note-card">
        <p className="eyebrow">How settlement works</p>
        <h3>Every order becomes a clear ledger entry.</h3>
        <p>The marketplace collects customer payment, deducts your configured commission, and records your share here. A reference appears once the transfer is marked paid.</p>
      </div>
    </section>
  )
}

function Orders({
  orders,
  token,
  onChange,
  onError,
}: {
  orders: VendorOrder[]
  token: string
  onChange: (orders: VendorOrder[]) => void
  onError: (message: string) => void
}) {
  const [busyId, setBusyId] = useState("")

  const fulfill = async (order: VendorOrder) => {
    const items = order.items
      .map((item) => ({
        id: item.id,
        quantity: item.quantity - item.fulfilled_quantity,
      }))
      .filter((item) => item.quantity > 0)

    setBusyId(order.id)
    onError("")
    try {
      const trackingNumber = window.prompt(
        "Tracking number (optional — leave blank for local delivery)"
      )?.trim()
      const trackingUrl = trackingNumber
        ? window.prompt("Tracking URL (optional)")?.trim()
        : ""
      const response = await api<{ fulfillment: { id: string } }>(
        `/vendor/orders/${order.id}/fulfillments`, {
        method: "POST",
        token,
        body: {
          items,
          labels: trackingNumber
            ? [{
              tracking_number: trackingNumber,
              tracking_url: trackingUrl || "",
              label_url: "",
            }]
            : undefined,
        },
      })
      onChange(orders.map((current) => current.id === order.id
        ? {
          ...current,
          seller_fulfillment_status: "shipped",
          seller_fulfillment: { id: response.fulfillment.id },
          items: current.items.map((item) => ({
            ...item,
            fulfilled_quantity: item.quantity,
          })),
        }
        : current
      ))
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Fulfillment failed")
    } finally {
      setBusyId("")
    }
  }

  const deliver = async (order: VendorOrder) => {
    if (!order.seller_fulfillment?.id) {
      return
    }
    setBusyId(order.id)
    onError("")
    try {
      await api(
        `/vendor/orders/${order.id}/fulfillments/${order.seller_fulfillment.id}/deliver`,
        { method: "POST", token }
      )
      onChange(orders.map((current) => current.id === order.id
        ? { ...current, seller_fulfillment_status: "delivered" }
        : current
      ))
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Delivery update failed")
    } finally {
      setBusyId("")
    }
  }

  return (
    <section>
      <div className="section-heading">
        <div><p className="eyebrow">Sales</p><h3>Orders</h3></div>
        <strong>{orders.length} total</strong>
      </div>
      <div className="table-card">
        <div className="table-row order-row table-head"><span>Order</span><span>Your items</span><span>Your subtotal</span><span>Fulfillment</span><span></span></div>
        {orders.length === 0 ? <p className="empty">No orders yet.</p> : orders.map((order) => (
          <div className="table-row order-row" key={order.id}>
            <strong>#{order.display_id}</strong>
            <span>{order.items.map((item) => `${item.quantity} × ${item.title}`).join(", ")}</span>
            <span>{money(order.seller_subtotal, order.currency_code)}</span>
            <span className={`status status-${order.seller_fulfillment_status}`}>{order.seller_fulfillment_status.replaceAll("_", " ")}</span>
            <button
              className="text-button"
              disabled={
                busyId === order.id ||
                order.seller_fulfillment_status === "delivered" ||
                order.seller_fulfillment_status === "fulfilled"
              }
              onClick={() => order.seller_fulfillment_status === "shipped"
                ? deliver(order)
                : fulfill(order)
              }
            >
              {order.seller_fulfillment_status === "not_fulfilled"
                ? "Ship"
                : order.seller_fulfillment_status === "shipped"
                  ? "Deliver"
                  : "Done"}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

type OptionDraft = { key: number; title: string; values: string }
type VariantDraft = {
  key: number
  id?: string
  title: string
  sku: string
  price: string
  manage_inventory: boolean
  inventory_quantity: string
  options: Record<string, string>
}
type FormState = {
  title: string
  subtitle: string
  handle: string
  description: string
  material: string
  weight: string
  tags: string
  thumbnail: string
  images: string[]
  category_ids: string[]
  collection_id: string
  destination_id: string
  artisan_id: string
  options: OptionDraft[]
  variants: VariantDraft[]
}

type Taxonomy = {
  categories: Category[]
  collections: Collection[]
  destinations: Taxon[]
  artisans: Taxon[]
}

let draftKey = 0
const nextKey = () => ++draftKey

const blankVariant = (): VariantDraft => ({
  key: nextKey(),
  title: "",
  sku: "",
  price: "",
  manage_inventory: false,
  inventory_quantity: "",
  options: {},
})

const emptyForm = (): FormState => ({
  title: "",
  subtitle: "",
  handle: "",
  description: "",
  material: "",
  weight: "",
  tags: "",
  thumbnail: "",
  images: [],
  category_ids: [],
  collection_id: "",
  destination_id: "",
  artisan_id: "",
  options: [],
  variants: [blankVariant()],
})

const nprPrice = (variant: { prices?: { amount: number; currency_code: string }[] }) =>
  variant.prices?.find((price) => price.currency_code === "npr")?.amount

const currentStock = (variant: ProductVariantDetail) =>
  (variant.inventory_items ?? [])
    .flatMap((item) => item.inventory?.location_levels ?? [])
    .reduce((sum, level) => sum + (level.stocked_quantity ?? 0), 0)

function detailToForm(detail: ProductDetail): FormState {
  return {
    title: detail.title ?? "",
    subtitle: detail.subtitle ?? "",
    handle: detail.handle ?? "",
    description: detail.description ?? "",
    material: detail.material ?? "",
    weight: detail.weight != null ? String(detail.weight) : "",
    tags: (detail.tags ?? []).map((tag) => tag.value).join(", "),
    thumbnail: detail.thumbnail ?? "",
    images: (detail.images ?? []).map((image) => image.url),
    category_ids: (detail.categories ?? []).map((category) => category.id),
    collection_id: detail.collection?.id ?? "",
    destination_id: detail.destination?.id ?? "",
    artisan_id: detail.artisan?.id ?? "",
    options: (detail.options ?? []).map((option) => ({
      key: nextKey(),
      title: option.title,
      values: (option.values ?? []).map((value) => value.value).join(", "),
    })),
    variants:
      (detail.variants ?? []).length > 0
        ? (detail.variants ?? []).map((variant) => ({
            key: nextKey(),
            id: variant.id,
            title: variant.title,
            sku: variant.sku ?? "",
            price: nprPrice(variant) != null ? String(nprPrice(variant)) : "",
            manage_inventory: variant.manage_inventory ?? false,
            inventory_quantity: variant.manage_inventory
              ? String(currentStock(variant))
              : "",
            options: Object.fromEntries(
              (variant.options ?? [])
                .filter((option) => option.option?.title)
                .map((option) => [option.option!.title!, option.value ?? ""])
            ),
          }))
        : [blankVariant()],
  }
}

function buildPayload(form: FormState, status: "draft" | "proposed") {
  const definedOptions = form.options
    .filter((option) => option.title.trim() && option.values.trim())
    .map((option) => ({
      title: option.title.trim(),
      values: option.values
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    }))

  let variants = form.variants.map((variant) => ({
    ...(variant.id ? { id: variant.id } : {}),
    title: variant.title.trim() || "Default",
    sku: variant.sku.trim() || undefined,
    prices: variant.price
      ? [{ currency_code: "npr", amount: Number(variant.price) }]
      : undefined,
    manage_inventory: variant.manage_inventory,
    inventory_quantity:
      variant.manage_inventory && variant.inventory_quantity
        ? Number(variant.inventory_quantity)
        : undefined,
    options: Object.fromEntries(
      definedOptions.map((option) => [
        option.title,
        variant.options[option.title] ?? "",
      ])
    ),
  }))

  let options = definedOptions
  // No explicit options: synthesize one from the variant titles so every
  // variant has a unique option value (Medusa requires option assignments).
  if (options.length === 0) {
    options = [
      {
        title: "Variant",
        values: form.variants.map(
          (variant, index) => variant.title.trim() || `Variant ${index + 1}`
        ),
      },
    ]
    variants = variants.map((variant, index) => ({
      ...variant,
      options: {
        Variant: form.variants[index].title.trim() || `Variant ${index + 1}`,
      },
    }))
  }

  return {
    status,
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || undefined,
    handle: form.handle.trim() || undefined,
    description: form.description.trim() || undefined,
    material: form.material.trim() || undefined,
    weight: form.weight ? Number(form.weight) : undefined,
    tags: form.tags
      ? form.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : undefined,
    thumbnail: form.thumbnail || form.images[0] || undefined,
    images: form.images.map((url) => ({ url })),
    category_ids: form.category_ids.length ? form.category_ids : undefined,
    collection_id: form.collection_id || undefined,
    destination_id: form.destination_id || undefined,
    artisan_id: form.artisan_id || undefined,
    options,
    variants,
  }
}

function ProductForm({
  token,
  productId,
  taxonomy,
  onDone,
  onCancel,
  onError,
}: {
  token: string
  productId?: string
  taxonomy: Taxonomy
  onDone: (product: Product) => void
  onCancel: () => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(Boolean(productId))
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState<"draft" | "proposed" | "">("")

  useEffect(() => {
    if (!productId) {
      return
    }
    let active = true
    api<{ product: ProductDetail }>(`/vendor/products/${productId}`, { token })
      .then((response) => {
        if (active) {
          setForm(detailToForm(response.product))
        }
      })
      .catch((caught) =>
        onError(caught instanceof Error ? caught.message : "Failed to load product")
      )
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [productId, token, onError])

  const patch = (changes: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...changes }))

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (!files.length) {
      return
    }
    setUploading(true)
    onError("")
    try {
      const urls = await Promise.all(
        files.map((file) => uploadVendorMedia(file, token))
      )
      setForm((current) => ({
        ...current,
        images: [...current.images, ...urls],
        thumbnail: current.thumbnail || urls[0],
      }))
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (url: string) =>
    setForm((current) => ({
      ...current,
      images: current.images.filter((image) => image !== url),
      thumbnail: current.thumbnail === url ? "" : current.thumbnail,
    }))

  const toggleCategory = (id: string) =>
    setForm((current) => ({
      ...current,
      category_ids: current.category_ids.includes(id)
        ? current.category_ids.filter((value) => value !== id)
        : [...current.category_ids, id],
    }))

  const updateOption = (key: number, changes: Partial<OptionDraft>) =>
    setForm((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.key === key ? { ...option, ...changes } : option
      ),
    }))

  const updateVariant = (key: number, changes: Partial<VariantDraft>) =>
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant) =>
        variant.key === key ? { ...variant, ...changes } : variant
      ),
    }))

  const submit = async (status: "draft" | "proposed") => {
    if (!form.title.trim()) {
      onError("A product title is required")
      return
    }
    setSaving(status)
    onError("")
    try {
      const body = buildPayload(form, status)
      const response = productId
        ? await api<{ product: Product | Product[] }>(
            `/vendor/products/${productId}`,
            { method: "POST", token, body }
          )
        : await api<{ product: Product }>("/vendor/products", {
            method: "POST",
            token,
            body,
          })
      const product = Array.isArray(response.product)
        ? response.product[0]
        : response.product
      onDone(product)
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Could not save product")
    } finally {
      setSaving("")
    }
  }

  if (loading) {
    return <div className="product-form">Loading product…</div>
  }

  const busy = Boolean(saving) || uploading
  const definedOptions = form.options.filter((option) => option.title.trim())

  return (
    <div className="product-form">
      <section className="form-section">
        <h4>Details</h4>
        <p className="muted">The essentials customers see on the product page.</p>
        <div className="field-grid">
          <label className="wide">
            Product title
            <input
              value={form.title}
              onChange={(event) => patch({ title: event.target.value })}
              minLength={2}
              required
            />
          </label>
          <label>
            Subtitle <span>(optional)</span>
            <input
              value={form.subtitle}
              onChange={(event) => patch({ subtitle: event.target.value })}
            />
          </label>
          <label>
            Handle <span>(optional)</span>
            <input
              value={form.handle}
              onChange={(event) => patch({ handle: event.target.value })}
              placeholder="auto-generated if blank"
            />
          </label>
          <label className="wide">
            Description
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </label>
          <label>
            Material <span>(optional)</span>
            <input
              value={form.material}
              onChange={(event) => patch({ material: event.target.value })}
            />
          </label>
          <label>
            Weight in grams <span>(optional)</span>
            <input
              type="number"
              min={0}
              value={form.weight}
              onChange={(event) => patch({ weight: event.target.value })}
            />
          </label>
          <label className="wide">
            Tags <span>(comma separated)</span>
            <input
              value={form.tags}
              onChange={(event) => patch({ tags: event.target.value })}
              placeholder="handmade, wool, gift"
            />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h4>Media</h4>
        <p className="muted">
          Upload photos; click a photo to make it the thumbnail.
        </p>
        <div className="image-grid">
          {form.images.map((url) => (
            <div
              key={url}
              className={`image-tile${form.thumbnail === url ? " is-thumb" : ""}`}
            >
              <img
                src={url}
                alt=""
                onClick={() => patch({ thumbnail: url })}
              />
              <button
                type="button"
                className="tile-action"
                onClick={() => removeImage(url)}
              >
                ✕
              </button>
              {form.thumbnail === url && <span className="thumb-flag">Thumbnail</span>}
            </div>
          ))}
          <label className="upload-drop secondary-button">
            {uploading ? "Uploading…" : "Add images"}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h4>Organize</h4>
        <p className="muted">Help shoppers and the storefront find this product.</p>
        <div className="field-grid">
          <div className="wide">
            <label>Categories</label>
            <div className="checkbox-list" style={{ marginTop: 8 }}>
              {taxonomy.categories.length === 0 && (
                <span className="muted">No categories available.</span>
              )}
              {taxonomy.categories.map((category) => (
                <label
                  key={category.id}
                  className={`checkbox-chip${
                    form.category_ids.includes(category.id) ? " selected" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.category_ids.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </div>
          <label>
            Collection
            <select
              value={form.collection_id}
              onChange={(event) => patch({ collection_id: event.target.value })}
            >
              <option value="">None</option>
              {taxonomy.collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Destination
            <select
              value={form.destination_id}
              onChange={(event) => patch({ destination_id: event.target.value })}
            >
              <option value="">None</option>
              {taxonomy.destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Artisan
            <select
              value={form.artisan_id}
              onChange={(event) => patch({ artisan_id: event.target.value })}
            >
              <option value="">None</option>
              {taxonomy.artisans.map((artisan) => (
                <option key={artisan.id} value={artisan.id}>
                  {artisan.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="form-section">
        <h4>Options</h4>
        <p className="muted">
          Optional — add options like Size or Colour (comma-separated values).
          Leave blank for a single-variant product.
        </p>
        {form.options.map((option) => (
          <div className="repeat-row" key={option.key}>
            <div className="repeat-head">
              <strong>Option</strong>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  patch({
                    options: form.options.filter((o) => o.key !== option.key),
                  })
                }
              >
                Remove
              </button>
            </div>
            <div className="field-grid">
              <label>
                Name
                <input
                  value={option.title}
                  onChange={(event) =>
                    updateOption(option.key, { title: event.target.value })
                  }
                  placeholder="Size"
                />
              </label>
              <label>
                Values <span>(comma separated)</span>
                <input
                  value={option.values}
                  onChange={(event) =>
                    updateOption(option.key, { values: event.target.value })
                  }
                  placeholder="S, M, L"
                />
              </label>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="add-row-button"
          onClick={() =>
            patch({
              options: [
                ...form.options,
                { key: nextKey(), title: "", values: "" },
              ],
            })
          }
        >
          + Add option
        </button>
      </section>

      <section className="form-section">
        <h4>Variants &amp; pricing</h4>
        <p className="muted">Each buyable version with its NPR price and stock.</p>
        {form.variants.map((variant, index) => (
          <div className="repeat-row" key={variant.key}>
            <div className="repeat-head">
              <strong>Variant {index + 1}</strong>
              {form.variants.length > 1 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    patch({
                      variants: form.variants.filter((v) => v.key !== variant.key),
                    })
                  }
                >
                  Remove
                </button>
              )}
            </div>
            <div className="variant-grid">
              <label>
                Title
                <input
                  value={variant.title}
                  onChange={(event) =>
                    updateVariant(variant.key, { title: event.target.value })
                  }
                  placeholder="Default"
                />
              </label>
              <label>
                SKU <span>(optional)</span>
                <input
                  value={variant.sku}
                  onChange={(event) =>
                    updateVariant(variant.key, { sku: event.target.value })
                  }
                />
              </label>
              <label>
                Price (NPR)
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  value={variant.price}
                  onChange={(event) =>
                    updateVariant(variant.key, { price: event.target.value })
                  }
                />
              </label>
              {definedOptions.map((option) => (
                <label key={option.key}>
                  {option.title || "Option"}
                  <select
                    value={variant.options[option.title] ?? ""}
                    onChange={(event) =>
                      updateVariant(variant.key, {
                        options: {
                          ...variant.options,
                          [option.title]: event.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Select</option>
                    {option.values
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean)
                      .map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
            <label className="inline-check" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={variant.manage_inventory}
                onChange={(event) =>
                  updateVariant(variant.key, {
                    manage_inventory: event.target.checked,
                  })
                }
              />
              Track inventory for this variant
            </label>
            {variant.manage_inventory && (
              <label style={{ marginTop: 10, maxWidth: 220 }}>
                Stock on hand
                <input
                  type="number"
                  min={0}
                  value={variant.inventory_quantity}
                  onChange={(event) =>
                    updateVariant(variant.key, {
                      inventory_quantity: event.target.value,
                    })
                  }
                  placeholder="0"
                />
              </label>
            )}
          </div>
        ))}
        <button
          type="button"
          className="add-row-button"
          onClick={() => patch({ variants: [...form.variants, blankVariant()] })}
        >
          + Add variant
        </button>
      </section>

      <div className="form-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => submit("draft")}
        >
          {saving === "draft" ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => submit("proposed")}
        >
          {saving === "proposed" ? "Submitting…" : "Submit for review"}
        </button>
      </div>
    </div>
  )
}

const STATUS_HINT: Record<Product["status"], string> = {
  draft: "Not submitted yet",
  proposed: "Awaiting admin approval",
  published: "Live — edits go live instantly",
  rejected: "Rejected — edit and resubmit",
}

function Products({
  products,
  seller,
  token,
  onChange,
  onError,
}: {
  products: Product[]
  seller: Seller
  token: string
  onChange: (products: Product[]) => void
  onError: (message: string) => void
}) {
  // "new" opens the create form, a product id opens that product for editing.
  const [editing, setEditing] = useState<"new" | string | null>(null)
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({
    categories: [],
    collections: [],
    destinations: [],
    artisans: [],
  })

  useEffect(() => {
    if (seller.status !== "active") {
      return
    }
    Promise.all([
      api<{ product_categories: Category[] }>("/vendor/product-categories", { token }),
      api<{ collections: Collection[] }>("/vendor/collections", { token }),
      api<{ destinations: Taxon[] }>("/vendor/destinations", { token }),
      api<{ artisans: Taxon[] }>("/vendor/artisans", { token }),
    ])
      .then(([categories, collections, destinations, artisans]) =>
        setTaxonomy({
          categories: categories.product_categories,
          collections: collections.collections,
          destinations: destinations.destinations,
          artisans: artisans.artisans,
        })
      )
      .catch(() => {
        /* selectors are best-effort; the form still works without them */
      })
  }, [seller.status, token])

  const handleDone = (product: Product) => {
    const exists = products.some((item) => item.id === product.id)
    onChange(
      exists
        ? products.map((item) => (item.id === product.id ? product : item))
        : [product, ...products]
    )
    setEditing(null)
  }

  if (editing) {
    return (
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Catalog</p>
            <h3>{editing === "new" ? "New product" : "Edit product"}</h3>
          </div>
        </div>
        <ProductForm
          token={token}
          productId={editing === "new" ? undefined : editing}
          taxonomy={taxonomy}
          onDone={handleDone}
          onCancel={() => setEditing(null)}
          onError={onError}
        />
      </section>
    )
  }

  return (
    <section>
      <div className="section-heading">
        <div><p className="eyebrow">Catalog</p><h3>Products</h3></div>
        <button
          className="primary-button compact"
          disabled={seller.status !== "active"}
          onClick={() => setEditing("new")}
        >
          Add product
        </button>
      </div>
      <div className="table-card">
        <div className="table-row table-head"><span>Product</span><span>Variants</span><span>Status</span><span></span></div>
        {products.length === 0 ? <p className="empty">No products yet.</p> : products.map((product) => (
          <div className="table-row" key={product.id}>
            <div>
              <strong>{product.title}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{STATUS_HINT[product.status]}</div>
            </div>
            <span>{product.variants?.length ?? 0}</span>
            <span className={`status status-${product.status}`}>{product.status}</span>
            <button
              className="text-button"
              disabled={seller.status !== "active"}
              onClick={() => setEditing(product.id)}
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function Payouts({ payouts }: { payouts: Payout[] }) {
  const total = useMemo(
    () => payouts.reduce((sum, payout) => sum + payoutNet(payout), 0),
    [payouts]
  )
  return (
    <section>
      <div className="section-heading">
        <div><p className="eyebrow">Settlement ledger</p><h3>Payouts</h3></div>
        <strong>{money(total, payouts[0]?.currency_code ?? "npr")}</strong>
      </div>
      <div className="table-card">
        <div className="table-row payout-row table-head"><span>Order</span><span>Amount</span><span>Status</span><span>Reference</span></div>
        {payouts.length === 0 ? <p className="empty">No payouts yet.</p> : payouts.map((payout) => (
          <div className="table-row payout-row" key={payout.id}>
            <strong>{payout.order_id}</strong>
            <span>{money(payoutNet(payout), payout.currency_code)}</span>
            <span className={`status status-${payout.status}`}>{payout.status}</span>
            <span>{payout.reference || "—"}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
