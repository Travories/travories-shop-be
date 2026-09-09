import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  StatusBadge,
  Text,
  toast,
  useDataTable,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { sdk } from "../../lib/sdk"

type VendorProduct = {
  id: string
  title: string
  thumbnail?: string | null
  status: string
  created_at: string
  seller?: { id: string; name: string } | null
  variants?: { id: string; title: string }[]
}

type VendorProductsResponse = {
  products: VendorProduct[]
  count: number
  offset: number
  limit: number
}

const APPROVALS_QUERY_KEY = "marketplace-product-approvals"

const ReviewActions = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()

  const review = useMutation({
    mutationFn: (action: "approve" | "reject") =>
      sdk.client.fetch(`/admin/vendor-products/${product.id}`, {
        method: "POST",
        body: { action },
      }),
    onSuccess: (_data, action) => {
      queryClient.invalidateQueries({ queryKey: [APPROVALS_QUERY_KEY] })
      toast.success(
        action === "approve"
          ? `Published ${product.title}`
          : `Rejected ${product.title}`
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update product")
    },
  })

  return (
    <div className="flex items-center justify-end gap-x-2">
      <Button
        size="small"
        variant="secondary"
        disabled={review.isPending}
        onClick={() => review.mutate("reject")}
      >
        Reject
      </Button>
      <Button
        size="small"
        disabled={review.isPending}
        onClick={() => review.mutate("approve")}
      >
        Approve
      </Button>
    </div>
  )
}

const columnHelper = createDataTableColumnHelper<VendorProduct>()

const columns = [
  columnHelper.accessor("title", {
    header: "Product",
    cell: ({ row, getValue }) => (
      <div className="flex items-center gap-x-3">
        {row.original.thumbnail ? (
          <img
            src={row.original.thumbnail}
            alt=""
            className="h-8 w-8 rounded object-cover"
          />
        ) : (
          <div className="bg-ui-bg-component h-8 w-8 rounded" />
        )}
        <Text size="small">{getValue()}</Text>
      </div>
    ),
  }),
  columnHelper.accessor("seller.name", {
    header: "Seller",
    cell: ({ row }) => (
      <Text size="small">{row.original.seller?.name ?? "—"}</Text>
    ),
  }),
  columnHelper.accessor("variants", {
    header: "Variants",
    cell: ({ getValue }) => (
      <Text size="small">{getValue()?.length ?? 0}</Text>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: () => <StatusBadge color="orange">Proposed</StatusBadge>,
  }),
  columnHelper.display({
    id: "actions",
    cell: ({ row }) => <ReviewActions product={row.original} />,
  }),
]

const ProductApprovalsPage = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: [APPROVALS_QUERY_KEY, limit, offset],
    queryFn: () =>
      sdk.client.fetch<VendorProductsResponse>("/admin/vendor-products", {
        query: { limit, offset },
      }),
  })

  const table = useDataTable({
    data: data?.products ?? [],
    columns,
    getRowId: (product) => product.id,
    rowCount: data?.count ?? 0,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  const isEmpty = useMemo(
    () => !isLoading && (data?.count ?? 0) === 0,
    [isLoading, data?.count]
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Product approvals</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Review and publish products submitted by vendors
        </Text>
      </div>

      {isEmpty ? (
        <div className="px-6 py-8">
          <Text size="small" className="text-ui-fg-subtle">
            No products are awaiting review.
          </Text>
        </div>
      ) : (
        <DataTable instance={table}>
          <DataTable.Table />
          <DataTable.Pagination />
        </DataTable>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Product approvals",
  icon: Tag,
})

export default ProductApprovalsPage
