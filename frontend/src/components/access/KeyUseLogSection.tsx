import { Panel, StatusPill } from "@/components/portal/Panel";
import { DataTable, type DataColumn } from "@/components/portal/DataTable";
import { EmptyState, ErrorState } from "@/components/portal/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { formatCount, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { useKeyUses } from "@/lib/queries";
import type { KeyUseSummaryRow } from "@/lib/types";

/** Shows an IPv4 address the server saw as IPv6-mapped (::ffff:1.2.3.4) as plain IPv4. */
function displayIp(ip: string | null): string {
  return ip ? ip.replace(/^::ffff:/, "") : "unknown";
}

const OUTCOME_TONE = { ok: "success", revoked: "danger", expired: "warning" } as const;

const COLUMNS: DataColumn<KeyUseSummaryRow>[] = [
  {
    id: "key",
    header: "Key",
    sortValue: (row) => row.keyName ?? row.keyPrefix,
    filterValue: (row) => row.keyName ?? row.keyPrefix ?? "unknown key",
    searchValue: (row) => `${row.keyName ?? ""} ${row.keyPrefix ?? ""}`,
    cell: (row) => (
      <div className="max-w-[220px] space-y-0.5">
        <p className="truncate font-medium">{row.keyName ?? "Deleted key"}</p>
        <p className="num truncate text-[11px] text-muted-foreground">{row.keyPrefix ?? row.keyId.slice(0, 8)}</p>
      </div>
    ),
  },
  {
    id: "ip",
    header: "Source IP",
    sortValue: (row) => row.sourceIp,
    filterValue: (row) => displayIp(row.sourceIp),
    cell: (row) => (
      <p className="num max-w-[200px] truncate text-xs" title={row.sourceIp ?? undefined}>
        {displayIp(row.sourceIp)}
      </p>
    ),
  },
  {
    id: "method",
    header: "Method",
    sortValue: (row) => row.method,
    filterValue: (row) => row.method,
    cell: (row) => <span className="num text-xs font-semibold">{row.method}</span>,
  },
  {
    id: "route",
    header: "Route",
    sortValue: (row) => row.route,
    cell: (row) => (
      <p className="num max-w-[280px] truncate text-xs" title={row.route}>
        {row.route}
      </p>
    ),
  },
  {
    id: "outcome",
    header: "Outcome",
    sortValue: (row) => row.outcome,
    filterValue: (row) => row.outcome,
    cell: (row) => (
      <StatusPill tone={OUTCOME_TONE[row.outcome]} dot>
        {row.outcome}
      </StatusPill>
    ),
  },
  {
    id: "uses",
    header: "Uses",
    align: "right",
    sortValue: (row) => row.uses,
    cell: (row) => <span className="num text-xs">{formatCount(row.uses)}</span>,
  },
  {
    id: "last",
    header: "Last seen",
    sortValue: (row) => row.lastUsedAt,
    cell: (row) => (
      <div className="whitespace-nowrap" title={`First ${formatDateTime(row.firstUsedAt)}\nLast ${formatDateTime(row.lastUsedAt)}`}>
        <p className="text-xs">{formatRelative(row.lastUsedAt)}</p>
        <p className="text-[11px] text-muted-foreground">since {formatDate(row.firstUsedAt)}</p>
      </div>
    ),
  },
];

/** Where and how the caller's API keys were used over the last 30 days. */
export function KeyUseLogSection() {
  const uses = useKeyUses();
  const rows = uses.data ?? [];
  const total = rows.reduce((sum, row) => sum + row.uses, 0);
  return (
    <Panel
      eyebrow="Audit"
      title="Key use log"
      action={<StatusPill tone="muted">{formatCount(total)} uses · 30 days</StatusPill>}
      bodyClassName="min-h-[140px]"
    >
      {uses.isError ? (
        <ErrorState title="Could not load the key use log" detail={errorMessage(uses.error)} onRetry={() => uses.refetch()} />
      ) : uses.isPending ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState motif="ops" title="No key uses" description="Each request made with one of your API keys shows up here." />
      ) : (
        <DataTable
          rows={rows}
          columns={COLUMNS}
          rowKey={(row) => `${row.keyId}|${row.sourceIp}|${row.method}|${row.route}|${row.outcome}`}
          initialSort={{ id: "last", desc: true }}
          searchPlaceholder="Search keys, IPs, routes"
        />
      )}
    </Panel>
  );
}
