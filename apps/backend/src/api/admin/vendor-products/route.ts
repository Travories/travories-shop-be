import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/vendor-products
 *
 * Review queue of vendor products awaiting approval. Products are filtered by
 * the core `status` field (proposed); only those owned by a seller are kept,
 * since admin-created products can also be proposed.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const limit = Number(req.query.limit ?? 20)
  const offset = Number(req.query.offset ?? 0)

  const { data, metadata } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "thumbnail",
      "status",
      "created_at",
      "seller.id",
      "seller.name",
      "variants.id",
      "variants.title",
    ],
    filters: { status: "proposed" },
    pagination: { take: limit, skip: offset },
  })

  const products = (
    data as Array<{ seller?: { id?: string } | null }>
  ).filter((product) => product.seller?.id)

  res.json({
    products,
    count: metadata?.count ?? products.length,
    offset: metadata?.skip ?? offset,
    limit: metadata?.take ?? limit,
  })
}
