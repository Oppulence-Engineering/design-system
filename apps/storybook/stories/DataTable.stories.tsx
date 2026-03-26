import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  DataTable,
  DataTableColumnHeader,
  Badge,
} from "@oppulence/design-system";
import type { ColumnDef } from "@tanstack/react-table";

type Payment = {
  id: string;
  amount: number;
  status: "pending" | "processing" | "success" | "failed";
  email: string;
};

const data: Payment[] = [
  { id: "1", amount: 316, status: "success", email: "alice@example.com" },
  { id: "2", amount: 242, status: "success", email: "bob@example.com" },
  { id: "3", amount: 837, status: "processing", email: "charlie@example.com" },
  { id: "4", amount: 874, status: "success", email: "diana@example.com" },
  { id: "5", amount: 721, status: "failed", email: "eve@example.com" },
  { id: "6", amount: 150, status: "pending", email: "frank@example.com" },
  { id: "7", amount: 432, status: "success", email: "grace@example.com" },
  { id: "8", amount: 91, status: "processing", email: "heidi@example.com" },
  { id: "9", amount: 564, status: "success", email: "ivan@example.com" },
  { id: "10", amount: 278, status: "pending", email: "judy@example.com" },
  { id: "11", amount: 999, status: "failed", email: "karl@example.com" },
  { id: "12", amount: 128, status: "success", email: "lisa@example.com" },
];

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  success: "default",
  processing: "secondary",
  pending: "outline",
  failed: "destructive",
};

const columns: ColumnDef<Payment, unknown>[] = [
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader
        title="Email"
        sorted={column.getIsSorted()}
        onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
      />
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={statusVariant[row.getValue("status") as string]}>
        {row.getValue("status") as string}
      </Badge>
    ),
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader
        title="Amount"
        sorted={column.getIsSorted()}
        onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
      />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
    },
  },
];

const meta = {
  title: "Organisms/DataTable",
  component: DataTable,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <DataTable columns={columns} data={data} />,
};

export const WithFiltering: Story = {
  render: () => (
    <DataTable
      columns={columns}
      data={data}
      filtering
      filterPlaceholder="Filter emails..."
      filterColumn="email"
    />
  ),
};

export const WithRowSelection: Story = {
  render: () => <DataTable columns={columns} data={data} rowSelection />,
};

export const Loading: Story = {
  render: () => <DataTable columns={columns} data={[]} loading />,
};

export const Empty: Story = {
  render: () => (
    <DataTable columns={columns} data={[]} emptyMessage="No payments found." />
  ),
};
