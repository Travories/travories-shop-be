"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"

import { api, Payout, Product, Seller, VendorOrder } from "../lib/api"

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
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState("")

  const createProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const stamp = Date.now()
    setBusyId("create")
    onError("")
    try {
      const response = await api<{ product: Product }>("/vendor/products", {
        method: "POST",
        token,
        body: {
          title: String(data.get("title")),
          description: String(data.get("description") ?? ""),
          options: [{ title: "Option", values: ["Default"] }],
          variants: [{
            title: "Default",
            sku: `SELLER-${stamp}`,
            options: { Option: "Default" },
            prices: [{ currency_code: "npr", amount: Number(data.get("price")) }],
          }],
        },
      })
      onChange([response.product, ...products])
      form.reset()
      setCreating(false)
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Product creation failed")
    } finally {
      setBusyId("")
    }
  }

  const toggleProduct = async (product: Product) => {
    setBusyId(product.id)
    onError("")
    const status = product.status === "published" ? "draft" : "published"
    try {
      const response = await api<{ product: Product[] | Product }>(
        `/vendor/products/${product.id}`,
        { method: "POST", token, body: { status } }
      )
      const updated = Array.isArray(response.product)
        ? response.product[0]
        : response.product
      onChange(products.map((item) => item.id === product.id ? updated : item))
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Product update failed")
    } finally {
      setBusyId("")
    }
  }

  return (
    <section>
      <div className="section-heading">
        <div><p className="eyebrow">Catalog</p><h3>Products</h3></div>
        <button className="primary-button compact" disabled={seller.status !== "active"} onClick={() => setCreating(!creating)}>Add product</button>
      </div>
      {creating && (
        <form className="create-card" onSubmit={createProduct}>
          <label>Product title<input name="title" minLength={2} required /></label>
          <label>Price (NPR)<input name="price" type="number" min={1} step="0.01" required /></label>
          <label className="wide">Description<textarea name="description" rows={3} /></label>
          <div className="wide form-actions"><button type="button" className="secondary-button" onClick={() => setCreating(false)}>Cancel</button><button className="primary-button" disabled={busyId === "create"}>Publish product</button></div>
        </form>
      )}
      <div className="table-card">
        <div className="table-row table-head"><span>Product</span><span>Variants</span><span>Status</span><span></span></div>
        {products.length === 0 ? <p className="empty">No products yet.</p> : products.map((product) => (
          <div className="table-row" key={product.id}>
            <strong>{product.title}</strong>
            <span>{product.variants?.length ?? 0}</span>
            <span className={`status status-${product.status}`}>{product.status}</span>
            <button className="text-button" disabled={busyId === product.id || seller.status !== "active"} onClick={() => toggleProduct(product)}>{product.status === "published" ? "Unpublish" : "Publish"}</button>
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
