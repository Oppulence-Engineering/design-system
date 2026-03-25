"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ColumnsIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "../atoms/button";
import { Checkbox } from "../atoms/checkbox";
import { Input } from "../atoms/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../molecules/table";

// ─── DataTable ──────────────────────────────────────────────────────────────

type DataTableProps<TData> = Omit<React.ComponentProps<"div">, "className"> & {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  pagination?: boolean;
  sorting?: boolean;
  filtering?: boolean;
  columnVisibility?: boolean;
  rowSelection?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  onRowSelectionChange?: (rows: TData[]) => void;
  loading?: boolean;
  emptyMessage?: React.ReactNode;
  filterPlaceholder?: string;
  filterColumn?: string;
};

function DataTable<TData>({
  columns,
  data,
  pagination = true,
  sorting = true,
  filtering = false,
  rowSelection = false,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  onRowSelectionChange,
  loading = false,
  emptyMessage = "No results.",
  filterPlaceholder = "Filter...",
  filterColumn,
  ...props
}: DataTableProps<TData>) {
  const [sortingState, setSortingState] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibilityState, setColumnVisibilityState] =
    React.useState<VisibilityState>({});
  const [rowSelectionState, setRowSelectionState] = React.useState({});

  const selectionColumn: ColumnDef<TData, unknown> = React.useMemo(
    () => ({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }),
    [],
  );

  const allColumns = React.useMemo(
    () => (rowSelection ? [selectionColumn, ...columns] : columns),
    [rowSelection, selectionColumn, columns],
  );

  const table = useReactTable({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    ...(sorting && {
      onSortingChange: setSortingState,
      getSortedRowModel: getSortedRowModel(),
    }),
    ...(filtering && {
      onColumnFiltersChange: setColumnFilters,
      getFilteredRowModel: getFilteredRowModel(),
    }),
    ...(pagination && {
      getPaginationRowModel: getPaginationRowModel(),
    }),
    onColumnVisibilityChange: setColumnVisibilityState,
    onRowSelectionChange: setRowSelectionState,
    state: {
      sorting: sortingState,
      columnFilters,
      columnVisibility: columnVisibilityState,
      rowSelection: rowSelectionState,
    },
    initialState: {
      pagination: { pageSize },
    },
  });

  React.useEffect(() => {
    if (onRowSelectionChange) {
      const selectedRows = table
        .getSelectedRowModel()
        .rows.map((row) => row.original);
      onRowSelectionChange(selectedRows);
    }
  }, [rowSelectionState, table, onRowSelectionChange]);

  const firstFilterableColumn = filterColumn
    ? table.getColumn(filterColumn)
    : table.getAllColumns().find((col) => col.getCanFilter());

  return (
    <div data-slot="data-table" className="flex flex-col gap-4" {...props}>
      {filtering && firstFilterableColumn && (
        <div className="flex items-center gap-2">
          <Input
            placeholder={filterPlaceholder}
            value={(firstFilterableColumn.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              firstFilterableColumn.setFilterValue(event.target.value)
            }
          />
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={allColumns.length}
                  style={{ textAlign: "center", height: "96px" }}
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={allColumns.length}
                  style={{ textAlign: "center", height: "96px" }}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <DataTablePagination
          table={table}
          pageSizeOptions={pageSizeOptions}
          rowSelection={rowSelection}
        />
      )}
    </div>
  );
}

// ─── DataTableColumnHeader ──────────────────────────────────────────────────

type DataTableColumnHeaderProps = Omit<
  React.ComponentProps<"div">,
  "className"
> & {
  sorted?: false | "asc" | "desc";
  onSort?: () => void;
  title: string;
};

function DataTableColumnHeader({
  sorted,
  onSort,
  title,
  ...props
}: DataTableColumnHeaderProps) {
  return (
    <div
      data-slot="data-table-column-header"
      className="flex items-center gap-1"
      {...props}
    >
      {onSort ? (
        <Button variant="ghost" size="xs" onClick={onSort}>
          {title}
          {sorted === "asc" ? (
            <ArrowUpIcon className="size-3" />
          ) : sorted === "desc" ? (
            <ArrowDownIcon className="size-3" />
          ) : (
            <ArrowUpDownIcon className="size-3" />
          )}
        </Button>
      ) : (
        <span>{title}</span>
      )}
    </div>
  );
}

// ─── DataTablePagination ────────────────────────────────────────────────────

function DataTablePagination<TData>({
  table,
  pageSizeOptions,
  rowSelection,
}: {
  table: ReturnType<typeof useReactTable<TData>>;
  pageSizeOptions: number[];
  rowSelection: boolean;
}) {
  return (
    <div
      data-slot="data-table-pagination"
      className="flex items-center justify-between text-sm text-muted-foreground"
    >
      <div className="flex-1">
        {rowSelection && (
          <span>
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </span>
        <Button
          variant="outline"
          size="xs"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export { DataTable, DataTableColumnHeader, DataTablePagination };
export type { DataTableProps, DataTableColumnHeaderProps };
