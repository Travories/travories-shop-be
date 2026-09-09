import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import createMediaUploadUrlWorkflow from "../../../../workflows/create-media-upload-url"
import { getSellerIdForMember } from "../../helpers"

const uploadBodySchema = z.object({
  filename: z.string().min(1),
  content_type: z.string().min(1),
})

/**
 * POST /vendor/media/upload-url — presigned upload URL for vendor product
 * images. Reuses the shared media workflow; uploads are foldered per seller
 * and always public (product images are served on the storefront).
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const sellerId = await getSellerIdForMember(
    req.scope,
    req.auth_context.actor_id
  )
  const body = uploadBodySchema.parse(req.body ?? {})

  const { result } = await createMediaUploadUrlWorkflow(req.scope).run({
    input: {
      filename: body.filename,
      contentType: body.content_type,
      folder: `vendor/${sellerId}`,
      access: "public",
    },
  })

  res.json({
    upload: {
      key: result.key,
      access: result.access,
      method: result.method,
      url: result.url,
      headers: result.headers,
      expires_at: result.expiresAt,
      expires_in: result.expiresIn,
      public_url: result.publicUrl,
      store_url: result.storeUrl,
    },
  })
}
