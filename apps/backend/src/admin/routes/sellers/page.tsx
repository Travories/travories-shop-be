import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Buildings } from "@medusajs/icons"
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
  Select,
  StatusBadge,
  Text,
  toast,
  useDataTable,
} from "@medusajs/ui"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { sdk } from "../../lib/sdk"

type SellerStatus = "pending" | "active" | "suspended" | "rejected"

type Seller = {
  id: string
  name: string
  handle: string
  email: string
  phone?: string | null
  status: SellerStatus
  commission_rate?: number | null
  created_at: string
}

type SellersResponse = {
  sellers: Seller[]
  count: number
  offset: number
  limit: number
}

const STATUS_COLOR: Record<
  SellerStatus,
  "green" | "orange" | "red" | "grey"
> = {
  active: "green",
  pending: "orange",
  suspended: "red",
  rejected: "grey",
}

const SELLERS_QUERY_KEY = "marketplace-sellers"

const ManageSellerDrawer = ({ seller }: { seller: Seller }) => {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<SellerStatus>(seller.status)
  const [commission, setCommission] = useState<string>(
    seller.commission_rate != null ? String(seller.commission_rate) : ""
  )
  const queryClient = useQueryClient()

  const update = useMutation({
    mutationFn: (body: {
      status: SellerStatus
      commission_rate: number | null
    }) =>
      sdk.client.fetch(`/admin/sellers/${seller.id}`, {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SELLERS_QUERY_KEY] })
      toast.success(`Updated ${seller.name}`)
      setOpen(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update seller")
    },
  })

  const handleSave = () => {
    const trimmed = commission.trim()
    const parsed = trimmed === "" ? null : Number(trimmed)

    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0 || parsed > 100)) {
      toast.error("Commission must be a number between 0 and 100")
      return
    }

    update.mutate({ status, commission_rate: parsed })
  }

  return (
    <>
      <Button size="small" variant="secondary" onClick={() => setOpen(true)}>
        Manage
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{seller.name}</Drawer.Title>
          </Drawer.Header>

          <Drawer.Body className="flex flex-col gap-y-6 p-4">
            <div className="flex flex-col gap-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as SellerStatus)}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Select status" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="pending">Pending</Select.Item>
                  <Select.Item value="active">Active (approved)</Select.Item>
                  <Select.Item value="suspended">Suspended</Select.Item>
                  <Select.Item value="rejected">Rejected</Select.Item>
                </Select.Content>
              </Select>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label>Commission rate (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                placeholder="Platform default"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
              />
              <Text size="small" className="text-ui-fg-subtle">
                Leave blank to use the platform default commission.
              </Text>
            </div>
          </Drawer.Body>

          <Drawer.Footer>
            <div className="flex items-center justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={update.isPending}
                >
                  Cancel
                </Button>
              </Drawer.Close>
              <Button
                size="small"
                onClick={handleSave}
                isLoading={update.isPending}
              >
                Save
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
}

const columnHelper = createDataTableColumnHelper<Seller>()

const columns = [
  columnHelper.accessor("name", { header: "Name" }),
  columnHelper.accessor("handle", { header: "Handle" }),
  columnHelper.accessor("email", { header: "Email" }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue()
      return (
        <StatusBadge color={STATUS_COLOR[status]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </StatusBadge>
      )
    },
  }),
  columnHelper.accessor("commission_rate", {
    header: "Commission",
    cell: ({ getValue }) => {
      const rate = getValue()
      return (
        <Text size="small">
          {rate != null ? `${rate}%` : "Default"}
        </Text>
      )
    },
  }),
  columnHelper.display({
    id: "actions",
    cell: ({ row }) => <ManageSellerDrawer seller={row.original} />,
  }),
]

const SellersPage = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: [SELLERS_QUERY_KEY, limit, offset],
    queryFn: () =>
      sdk.client.fetch<SellersResponse>("/admin/sellers", {
        query: { limit, offset },
      }),
  })

  const table = useDataTable({
    data: data?.sellers ?? [],
    columns,
    getRowId: (seller) => seller.id,
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
        <Heading level="h1">Sellers</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Approve vendors and set their commission
        </Text>
      </div>

      {isEmpty ? (
        <div className="px-6 py-8">
          <Text size="small" className="text-ui-fg-subtle">
            No sellers yet. Vendors appear here after they sign up.
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
  label: "Sellers",
  icon: Buildings,
})

export default SellersPage
