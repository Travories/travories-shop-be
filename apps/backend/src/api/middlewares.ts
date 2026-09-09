import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

import { UpdatePayoutSchema } from "./admin/payouts/validators"
import { UpdateSellerSchema } from "./admin/sellers/validators"
import { ReviewVendorProductSchema } from "./admin/vendor-products/validators"
import { CreateSellerSchema } from "./vendor/sellers/validators"
import { CreateVendorFulfillmentSchema } from "./vendor/orders/validators"
import {
  CreateVendorProductSchema,
  UpdateVendorProductSchema,
} from "./vendor/products/validators"

export const GetSellersSchema = createFindParams()
export const GetPayoutsSchema = createFindParams()

export default defineMiddlewares({
  routes: [
    // Vendor onboarding: the auth identity exists (from
    // /auth/seller/emailpass/register) but is not yet bound to a seller actor,
    // so allowUnregistered is required here and ONLY here.
    {
      matcher: "/vendor/sellers",
      method: "POST",
      middlewares: [
        authenticate("seller", ["session", "bearer"], {
          allowUnregistered: true,
        }),
        validateAndTransformBody(CreateSellerSchema),
      ],
    },
    // Everything else a vendor does requires a fully-registered seller actor.
    {
      matcher: "/vendor/sellers/me",
      method: "GET",
      middlewares: [authenticate("seller", ["session", "bearer"])],
    },
    // Vendor product management — all require a registered seller actor.
    {
      matcher: "/vendor/products",
      method: "POST",
      middlewares: [
        authenticate("seller", ["session", "bearer"]),
        validateAndTransformBody(CreateVendorProductSchema),
      ],
    },
    {
      matcher: "/vendor/products",
      method: "GET",
      middlewares: [authenticate("seller", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/products/:id",
      method: "GET",
      middlewares: [authenticate("seller", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/products/:id",
      method: "POST",
      middlewares: [
        authenticate("seller", ["session", "bearer"]),
        validateAndTransformBody(UpdateVendorProductSchema),
      ],
    },
    // Vendor form helpers: taxonomy/organize selectors and media uploads.
    {
      matcher: "/vendor/product-categories",
      method: "GET",
      middlewares: [authenticate("seller", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/collections",
      method: "GET",
      middlewares: [authenticate("seller", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/destinations",
      method: "GET",
      middlewares: [authenticate("seller", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/artisans",
      method: "GET",
      middlewares: [authenticate("seller", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/media/upload-url",
      method: "POST",
      middlewares: [authenticate("seller", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/payouts",
      method: "GET",
      middlewares: [authenticate("seller", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/orders",
      method: "GET",
      middlewares: [authenticate("seller", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/orders/:id/fulfillments",
      method: "POST",
      middlewares: [
        authenticate("seller", ["session", "bearer"]),
        validateAndTransformBody(CreateVendorFulfillmentSchema),
      ],
    },
    {
      matcher: "/vendor/orders/:id/fulfillments/:fulfillment_id/deliver",
      method: "POST",
      middlewares: [authenticate("seller", ["session", "bearer"])],
    },
    // Super-admin: /admin/* is already authenticated by Medusa; only add
    // validation here.
    {
      matcher: "/admin/sellers",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(GetSellersSchema, {
          defaults: [
            "id",
            "name",
            "handle",
            "email",
            "phone",
            "status",
            "commission_rate",
            "created_at",
          ],
          isList: true,
          defaultLimit: 20,
        }),
      ],
    },
    {
      matcher: "/admin/sellers/:id",
      method: "POST",
      middlewares: [validateAndTransformBody(UpdateSellerSchema)],
    },
    {
      matcher: "/admin/payouts",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(GetPayoutsSchema, {
          defaults: [
            "id",
            "amount",
            "reversed_amount",
            "currency_code",
            "status",
            "order_id",
            "reference",
            "created_at",
            "seller.id",
            "seller.name",
            "adjustments.*",
          ],
          isList: true,
          defaultLimit: 20,
        }),
      ],
    },
    {
      matcher: "/admin/payouts/:id",
      method: "POST",
      middlewares: [validateAndTransformBody(UpdatePayoutSchema)],
    },
    {
      matcher: "/admin/vendor-products/:id",
      method: "POST",
      middlewares: [validateAndTransformBody(ReviewVendorProductSchema)],
    },
  ],
})
