const readFirst = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key]
    if (value) {
      return value
    }
  }

  return undefined
}

/**
 * Read lazily, on every access, rather than snapshotting at import time.
 *
 * medusa-config.ts is what populates process.env (via loadEnv from the repo
 * root), but `import { mediaEnv }` is hoisted above that call — so a snapshot
 * taken here would always be empty, the whole set would look unconfigured, and
 * the S3 file module would silently fall back to the local-disk provider.
 */
export const mediaEnv = {
  get fileUrl() {
    return readFirst("S3_FILE_URL")
  },
  get endpoint() {
    return readFirst("S3_ENDPOINT")
  },
  get bucket() {
    return readFirst("S3_BUCKET", "S3_BUCKET_NAME_PUBLIC")
  },
  get region() {
    return readFirst("S3_REGION", "AWS_REGION", "AWS_DEFAULT_REGION")
  },
  get accessKeyId() {
    return readFirst("S3_ACCESS_KEY_ID", "S3_ACCESS_KEY", "AWS_ACCESS_KEY_ID")
  },
  get secretAccessKey() {
    return readFirst(
      "S3_SECRET_ACCESS_KEY",
      "S3_SECRET_KEY",
      "AWS_SECRET_ACCESS_KEY"
    )
  },
}

export const requiredMediaEnvKeys = [
  "S3_ENDPOINT",
  "S3_BUCKET or S3_BUCKET_NAME_PUBLIC",
  "S3_REGION or AWS_REGION",
  "S3_ACCESS_KEY_ID or S3_ACCESS_KEY",
  "S3_SECRET_ACCESS_KEY or S3_SECRET_KEY",
]
