import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CurrencyDollar } from "@medusajs/icons"
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Drawer,
  Heading,
  Input,
  Label,
  StatusBadge,
  Text,
  toast,
  useDataTable,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { sdk } from "../../lib/sdk"

type PayoutStatus = "pending" | "paid" | "partially_reversed" | "reversed"

type Payout = {
  id: string
  amount: number | string
  reversed_amount: number | string
  currency_code: string
  status: PayoutStatus
  order_id: string
  reference?: string | null
  created_at: string
  seller?: {
    id: string
    name: string
  } | null
}

type PayoutsResponse = {
  payouts: Payout[]
  count: number
  offset: number
  limit: number
}

const PAYOUTS_QUERY_KEY = "marketplace-payouts"

const formatAmount = (payout: Payout) => {
  const amount = Number(payout.amount) - Number(payout.reversed_amount ?? 0)
  const currency = payout.currency_code.toUpperCase()

  if (!Number.isFinite(amount)) {
    return `${currency} ${String(payout.amount)}`
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount)
}

const SettlePayoutDrawer = ({ payout }: { payout: Payout }) => {
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState(payout.reference ?? "")
  const queryClient = useQueryClient()

  const settle = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/payouts/${payout.id}`, {
        method: "POST",
        body: {
          status: "paid",
          reference: reference.trim() || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYOUTS_QUERY_KEY] })
      toast.success("Payout marked as paid")
      setOpen(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update payout")
    },
  })

  return (
    <>
      <Button
        size="small"
        variant="secondary"
        disabled={payout.status !== "pending"}
        onClick={() => setOpen(true)}
      >
        {payout.status === "pending" ? "Mark paid" : "Unavailable"}
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Settle payout</Drawer.Title>
          </Drawer.Header>

          <Drawer.Body className="flex flex-col gap-y-6 p-4">
            <div>
              <Text weight="plus">{payout.seller?.name ?? "Unknown seller"}</Text>
              <Text size="small" className="text-ui-fg-subtle">
                {formatAmount(payout)} for order {payout.order_id}
              </Text>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor={`reference-${payout.id}`}>Transfer reference</Label>
              <Input
                id={`reference-${payout.id}`}
                value={reference}
                placeholder="Bank or eSewa transaction reference"
                onChange={(event) => setReference(event.target.value)}
              />
            </div>
          </Drawer.Body>

          <Drawer.Footer>
            <div className="flex items-center justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={settle.isPending}
                >
                  Cancel
                </Button>
              </Drawer.Close>
              <Button
                size="small"
                isLoading={settle.isPending}
                onClick={() => settle.mutate()}
              >
                Confirm payment
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
}

const columnHelper = createDataTableColumnHelper<Payout>()

const columns = [
  columnHelper.accessor("seller.name", {
    header: "Seller",
    cell: ({ row }) => row.original.seller?.name ?? "Unknown",
  }),
  columnHelper.accessor("order_id", { header: "Order" }),
  columnHelper.accessor("amount", {
    header: "Amount",
    cell: ({ row }) => formatAmount(row.original),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue()
      return (
        <StatusBadge color={
          status === "paid"
            ? "green"
            : status === "pending"
              ? "orange"
              : "red"
        }>
          {status.replaceAll("_", " ")}
        </StatusBadge>
      )
    },
  }),
  columnHelper.accessor("reference", {
    header: "Reference",
    cell: ({ getValue }) => getValue() || "—",
  }),
  columnHelper.display({
    id: "actions",
    cell: ({ row }) => <SettlePayoutDrawer payout={row.original} />,
  }),
]

const PayoutsPage = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: [PAYOUTS_QUERY_KEY, limit, offset],
    queryFn: () =>
      sdk.client.fetch<PayoutsResponse>("/admin/payouts", {
        query: { limit, offset },
      }),
  })

  const table = useDataTable({
    data: data?.payouts ?? [],
    columns,
    getRowId: (payout) => payout.id,
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
        <Heading level="h1">Payouts</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Review and settle seller earnings
        </Text>
      </div>

      {isEmpty ? (
        <div className="px-6 py-8">
          <Text size="small" className="text-ui-fg-subtle">
            No payouts yet. They appear after marketplace orders are placed.
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
  label: "Payouts",
  icon: CurrencyDollar,
})

export default PayoutsPage
