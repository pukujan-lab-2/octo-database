import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortValue = string | number | null | undefined;

export type DataColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** The value the column sorts by; omit for a column that does not sort. */
  sortValue?: (row: T) => SortValue;
  /** Adds a select filter over this value's distinct values. */
  filterValue?: (row: T) => string | null | undefined;
  /** Text the search box matches; defaults to the sort value. */
  searchValue?: (row: T) => string | null | undefined;
  align?: "left" | "right";
  className?: string;
};

type Sort = { id: string; desc: boolean };

/** One table for the Operations and Access logs: sort by any header, search the
 *  text, filter by a column's values, and page through the rest. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  initialSort,
  pageSize = 25,
  searchPlaceholder = "Search",
  rowClassName,
  empty = "No rows match these filters.",
}: {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  initialSort?: Sort;
  pageSize?: number;
  searchPlaceholder?: string;
  rowClassName?: (row: T) => string | undefined;
  empty?: string;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<Sort | null>(initialSort ?? null);
  const [page, setPage] = useState(0);

  const filterOptions = useMemo(() => {
    const options: Record<string, string[]> = {};
    for (const column of columns) {
      if (!column.filterValue) continue;
      const values = new Set<string>();
      for (const row of rows) values.add(column.filterValue(row) ?? "—");
      options[column.id] = [...values].sort((a, b) => a.localeCompare(b));
    }
    return options;
  }, [rows, columns]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      for (const column of columns) {
        const wanted = filters[column.id];
        if (wanted && column.filterValue && (column.filterValue(row) ?? "—") !== wanted) return false;
      }
      if (!needle) return true;
      return columns.some((column) => {
        const value = column.searchValue?.(row) ?? column.sortValue?.(row) ?? column.filterValue?.(row);
        return value != null && String(value).toLowerCase().includes(needle);
      });
    });
    const column = sort ? columns.find((c) => c.id === sort.id) : undefined;
    if (!sort || !column?.sortValue) return filtered;
    const value = column.sortValue;
    return [...filtered].sort((a, b) => {
      const order = compare(value(a), value(b));
      return sort.desc ? -order : order;
    });
  }, [rows, columns, search, filters, sort]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, pages - 1);
  const shown = visible.slice(current * pageSize, (current + 1) * pageSize);
  const filtering = search.trim() !== "" || Object.values(filters).some(Boolean);

  function toggleSort(id: string) {
    setSort((previous) => (previous?.id === id ? { id, desc: !previous.desc } : { id, desc: false }));
    setPage(0);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <div className="relative min-w-[180px] flex-1 sm:max-w-[280px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-8 bg-background pl-8 text-sm"
          />
        </div>
        {columns
          .filter((column) => column.filterValue)
          .map((column) => (
            <select
              key={column.id}
              value={filters[column.id] ?? ""}
              onChange={(event) => {
                setFilters((previous) => ({ ...previous, [column.id]: event.target.value }));
                setPage(0);
              }}
              aria-label={`Filter by ${column.header}`}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">All {column.header.toLowerCase()}</option>
              {(filterOptions[column.id] ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ))}
        {filtering ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs"
            onClick={() => {
              setSearch("");
              setFilters({});
              setPage(0);
            }}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
        <span className="num ml-auto text-[11px] text-muted-foreground">
          {visible.length === rows.length
            ? `${formatCount(rows.length)} rows`
            : `${formatCount(visible.length)} of ${formatCount(rows.length)} rows`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort?.id === column.id;
                const Icon = active ? (sort?.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
                return (
                  <th
                    key={column.id}
                    className={cn(column.align === "right" && "text-right", column.className)}
                    aria-sort={active ? (sort?.desc ? "descending" : "ascending") : undefined}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className={cn(
                          "inline-flex items-center gap-1 uppercase tracking-[0.12em] hover:text-foreground",
                          active && "text-foreground",
                        )}
                      >
                        {column.header}
                        <Icon className={cn("h-3 w-3", !active && "opacity-40")} />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : (
              shown.map((row) => (
                <tr key={rowKey(row)} className={rowClassName?.(row)}>
                  {columns.map((column) => (
                    <td key={column.id} className={cn(column.align === "right" && "text-right", column.className)}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="flex items-center justify-between border-t border-border px-5 py-2.5">
          <span className="num text-[11px] text-muted-foreground">
            {formatCount(current * pageSize + 1)}–{formatCount(current * pageSize + shown.length)} of{" "}
            {formatCount(visible.length)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="num px-2 text-[11px] text-muted-foreground">
              {current + 1} / {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => setPage(current + 1)}
              disabled={current >= pages - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Empty values sort last; numbers numerically; everything else as text. */
function compare(a: SortValue, b: SortValue): number {
  const aEmpty = a == null || a === "";
  const bEmpty = b == null || b === "";
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}
