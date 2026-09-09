import path from "path"
import { loadEnv, defineConfig } from "@medusajs/framework/utils"
import { mediaEnv } from "./src/lib/media-env"

// This monorepo keeps a SINGLE .env at the repo root — there is no
// apps/backend/.env. Load from there rather than from the cwd (which is
// apps/backend when turbo runs the dev/build task).
//
// In the built bundle (.medusa/server) that path resolves to a directory with
// no .env, which is a harmless no-op: Docker injects the same variables via
// compose `env_file` instead. dotenv never overrides an already-set variable,
// so real process env always wins.
loadEnv(process.env.NODE_ENV || 'development', path.resolve(__dirname, "../.."))

// Registering the file module REPLACES Medusa's default local-file provider, so
// admin uploads would start failing the moment S3 credentials are wrong or
// absent. Only register it once the whole set is present; without them the
// local provider stays in place and uploads keep working.
const s3 = mediaEnv

const s3Configured = Object.values(s3).every(Boolean)

const fileModule = {
  resolve: "@medusajs/medusa/file",
  options: {
    providers: [
      {
        resolve: "@medusajs/medusa/file-s3",
        id: "s3",
        options: {
          file_url: s3.fileUrl,
          endpoint: s3.endpoint,
          bucket: s3.bucket,
          // Garage ignores the region, but the AWS SDK refuses to initialise
          // without one.
          region: s3.region,
          access_key_id: s3.accessKeyId,
          secret_access_key: s3.secretAccessKey,
          additional_client_config: {
            // Mandatory for Garage: it does not support virtual-host-style
            // bucket addressing, and without this every upload fails with a
            // DNS error that does not mention buckets at all.
            forcePathStyle: true,
          },
        },
      },
    ],
  },
}

const esewaConfigured = Boolean(
  process.env.ESEWA_PRODUCT_CODE &&
    process.env.ESEWA_SECRET_KEY &&
    process.env.ESEWA_STOREFRONT_BASE_URL
)

const redisUrl = process.env.REDIS_URL

const redisModules = redisUrl
  ? [
      {
        resolve: "@medusajs/medusa/event-bus-redis",
        options: {
          redisUrl,
          jobOptions: {
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 86400, count: 5000 },
          },
        },
      },
      {
        resolve: "@medusajs/medusa/workflow-engine-redis",
        options: {
          redis: { redisUrl },
        },
      },
    ]
  : []

const paymentModule = {
  resolve: "@medusajs/payment",
  options: {
    providers: [
      {
        resolve: "./src/modules/payment-nepal/providers/esewa",
        id: "esewa",
        options: {
          productCode: process.env.ESEWA_PRODUCT_CODE,
          secretKey: process.env.ESEWA_SECRET_KEY,
          storefrontBaseUrl: process.env.ESEWA_STOREFRONT_BASE_URL,
          formUrl: process.env.ESEWA_FORM_URL,
          statusUrl: process.env.ESEWA_STATUS_URL,
          successPath: process.env.ESEWA_SUCCESS_PATH,
          failurePath: process.env.ESEWA_FAILURE_PATH,
          taxAmount: process.env.ESEWA_TAX_AMOUNT,
          productServiceCharge: process.env.ESEWA_PRODUCT_SERVICE_CHARGE,
          productDeliveryCharge: process.env.ESEWA_PRODUCT_DELIVERY_CHARGE,
        },
      },
    ],
  },
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  admin: {
    // The dashboard bundle bakes this in as __BACKEND_URL__ at build time.
    // Defaulting it to MEDUSA_BACKEND_URL would pin every admin API call to
    // api.shop.travories.com, making the dashboard cross-origin when it is
    // reached at admin.shop.travories.com — CORS preflights plus cross-site
    // cookies on login. "/" keeps it same-origin with whichever host serves
    // it, so both hostnames work with no CORS involved.
    //
    // MEDUSA_BACKEND_URL is deliberately left alone: src/lib/store-media.ts
    // still uses it to build absolute media URLs for the storefront.
    backendUrl: "/",
  },
  modules: [
    {
      resolve: "./src/modules/souvenir",
    },
    {
      resolve: "./src/modules/marketplace",
    },
    ...(s3Configured ? [fileModule] : []),
    ...(esewaConfigured ? [paymentModule] : []),
    ...redisModules,
  ],
})
