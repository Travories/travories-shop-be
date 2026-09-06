import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCollectionByHandle, listCollections } from "@lib/data/collections"
import { listRegions } from "@lib/data/regions"
import {
  JsonLd,
  breadcrumbSchema,
  buildSeoMetadata,
  collectionPageSchema,
} from "@lib/seo"
import { StoreCollection, StoreRegion } from "@medusajs/types"
import CollectionTemplate from "@modules/collections/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { parseOptionValueIds } from "@lib/util/product-option-filters"

type Props = {
  params: Promise<{ handle: string; countryCode: string }>
  searchParams: Promise<
    Record<string, string | string[] | undefined> & {
      page?: string
      sortBy?: SortOptions
      optionValueIds?: string | string[]
    }
  >
}

export const PRODUCT_LIMIT = 12

export async function generateStaticParams() {
  try {
    const { collections } = await listCollections({
      fields: "*products",
    })

    if (!collections) {
      return []
    }

    const countryCodes = await listRegions().then(
      (regions: StoreRegion[]) =>
        regions
          ?.map((r) => r.countries?.map((c) => c.iso_2))
          .flat()
          .filter(Boolean) as string[]
    )

    const collectionHandles = collections.map(
      (collection: StoreCollection) => collection.handle
    )

    const staticParams = countryCodes
      ?.map((countryCode: string) =>
        collectionHandles.map((handle: string | undefined) => ({
          countryCode,
          handle,
        }))
      )
      .flat()

    return staticParams
  } catch (error) {
    console.error(
      `Failed to generate static paths for collection pages. This usually means the Medusa backend was unreachable at build time. Verify NEXT_PUBLIC_MEDUSA_BACKEND_URL and NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY.`,
      error
    )
    return []
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const collection = await getCollectionByHandle(params.handle)

  if (!collection) {
    notFound()
  }

  return await buildSeoMetadata({
    title: collection.title,
    description:
      collection.metadata?.description?.toString() ??
      `Browse the ${collection.title} collection from Nepal Souvenirs.`,
    countryCode: params.countryCode,
    path: `/collections/${params.handle}`,
    eyebrow: "Collection",
    keywords: [
      `${collection.title} Nepal`,
      `${collection.title} collection`,
      "Nepal handmade collection",
    ],
  })
}

export default async function CollectionPage(props: Props) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { sortBy, page } = searchParams
  const optionValueIds = parseOptionValueIds(searchParams)

  const collection = await getCollectionByHandle(params.handle).then(
    (collection) => collection
  )

  if (!collection) {
    notFound()
  }

  const path = `/collections/${params.handle}`

  return (
    <>
      <JsonLd
        id="collection"
        data={[
          collectionPageSchema({
            name: collection.title,
            description: collection.metadata?.description?.toString(),
            path,
            countryCode: params.countryCode,
          }),
          breadcrumbSchema(
            [
              { name: "Home", path: "/" },
              { name: "Shop", path: "/store" },
              { name: collection.title, path },
            ],
            params.countryCode
          ),
        ]}
      />
      <CollectionTemplate
        collection={collection}
        page={page}
        sortBy={sortBy}
        countryCode={params.countryCode}
        optionValueIds={optionValueIds}
      />
    </>
  )
}
