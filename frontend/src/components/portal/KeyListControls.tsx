import { useState, type ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface StatusOption<S extends string> {
  value: S | "all";
  label: string;
  count: number;
}

/** Status pills with counts, plus a search box, above a list of keys. */
export function KeyListControls<S extends string>({
  options,
  status,
  onStatus,
  query,
  onQuery,
  placeholder,
}: {
  options: StatusOption<S>[];
  status: S | "all";
  onStatus: (next: S | "all") => void;
  query: string;
  onQuery: (next: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pb-3">
      <div className="inline-flex flex-wrap gap-1" role="group" aria-label="Filter by status">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={status === option.value}
            onClick={() => onStatus(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
              status === option.value
                ? "border-primary/40 bg-primary/12 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            <span className="num opacity-70">{option.count}</span>
          </button>
        ))}
      </div>
      <div className="relative ml-auto w-full sm:w-56">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          className="h-8 pl-8 text-xs"
        />
      </div>
    </div>
  );
}

/** A collapsible group of rows with a header saying how many are live. */
export function KeyGroup({
  title,
  live,
  total,
  children,
}: {
  title: string;
  live: number;
  total: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-md border border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="font-medium">{title}</span>
        <span className="num ml-auto text-xs text-muted-foreground">
          {live} live · {total} shown
        </span>
      </button>
      {open ? <ul className="space-y-1.5 border-t border-border p-2">{children}</ul> : null}
    </section>
  );
}
