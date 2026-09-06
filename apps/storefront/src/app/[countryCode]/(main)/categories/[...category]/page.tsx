import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCategoryByHandle, listCategories } from "@lib/data/categories"
import { listRegions } from "@lib/data/regions"
import {
  JsonLd,
  breadcrumbSchema,
  buildSeoMetadata,
  collectionPageSchema,
} from "@lib/seo"
import { HttpTypes, StoreRegion } from "@medusajs/types"
import CategoryTemplate from "@modules/categories/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { parseOptionValueIds } from "@lib/util/product-option-filters"

type Props = {
  params: Promise<{ category: string[]; countryCode: string }>
  searchParams: Promise<
    Record<string, string | string[] | undefined> & {
      sortBy?: SortOptions
      page?: string
      optionValueIds?: string | string[]
    }
  >
}

export async function generateStaticParams() {
  try {
    const product_categories = await listCategories()

    if (!product_categories) {
      return []
    }

    const countryCodes = await listRegions().then((regions: StoreRegion[]) =>
      regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
    )

    const categoryHandles = product_categories.map(
      (category: HttpTypes.StoreProductCategory) => category.handle
    )

    const staticParams = countryCodes
      ?.map((countryCode: string | undefined) =>
        categoryHandles.map((handle: string) => ({
          countryCode,
          category: [handle],
        }))
      )
      .flat()

    return staticParams
  } catch (error) {
    console.error(
      `Failed to generate static paths for category pages. This usually means the Medusa backend was unreachable at build time. Verify NEXT_PUBLIC_MEDUSA_BACKEND_URL and NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY.`,
      error
    )
    return []
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  try {
    const productCategory = await getCategoryByHandle(params.category)

    return await buildSeoMetadata({
      title: productCategory.name,
      description:
        productCategory.description ??
        `Browse ${productCategory.name.toLowerCase()} from Nepal Souvenirs.`,
      countryCode: params.countryCode,
      path: `/categories/${params.category.join("/")}`,
      eyebrow: "Shop the range",
      keywords: [
        `${productCategory.name} Nepal`,
        `${productCategory.name} souvenirs`,
        `${productCategory.name} gifts`,
      ],
    })
  } catch {
    notFound()
  }
}

export default async function CategoryPage(props: Props) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { sortBy, page } = searchParams
  const optionValueIds = parseOptionValueIds(searchParams)

  const productCategory = await getCategoryByHandle(params.category)

  if (!productCategory) {
    notFound()
  }

  const path = `/categories/${params.category.join("/")}`

  // Ancestors come from the handle segments, so a nested category reports the
  // same trail the visitor actually clicked through.
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/store" },
    ...params.category.map((segment, index) => ({
      name:
        index === params.category.length - 1
          ? productCategory.name
          : segment.replace(/-/g, " "),
      path: `/categories/${params.category.slice(0, index + 1).join("/")}`,
    })),
  ]

  return (
    <>
      <JsonLd
        id="category"
        data={[
          collectionPageSchema({
            name: productCategory.name,
            description: productCategory.description,
            path,
            countryCode: params.countryCode,
          }),
          breadcrumbSchema(crumbs, params.countryCode),
        ]}
      />
      <CategoryTemplate
        category={productCategory}
        sortBy={sortBy}
        page={page}
        countryCode={params.countryCode}
        optionValueIds={optionValueIds}
      />
    </>
  )
}
