import { Link } from "react-router-dom";
import { Hexagon } from "lucide-react";
import type { Health } from "@/lib/types";
import { INTEGRATION_GUIDE_URL, REPOSITORY_URL } from "./links";
import { FEATURES } from "./features";
import "./landing.css";

/** The homepage's wrapper: the shared palette plus the top bar. */
export function LandingShell({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="lp min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-[var(--lp-line)] bg-[var(--lp-bg)]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <Hexagon className="h-5 w-5" strokeWidth={1.5} />
            <span className="lp-serif text-xl">Octo</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm sm:gap-7">
            <a href="/#features" className="hidden transition-colors hover:text-[var(--lp-accent)] sm:inline">
              Features
            </a>
            <Link to={INTEGRATION_GUIDE_URL} className="transition-colors hover:text-[var(--lp-accent)]">
              Docs
            </Link>
            <a href="/#sign-in" className="lp-btn lp-btn-dark !px-4 !py-2">
              Sign in
            </a>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

export function LandingFooter({ health }: { health?: Health | undefined }) {
  return (
    <footer className="border-t border-[var(--lp-line)]">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <p className="lp-serif text-2xl">Octo</p>
          <p className="lp-muted mt-3 max-w-xs text-sm leading-relaxed">
            A self-hosted data layer for the projects you build, and the agents that build them.
          </p>
          <p className="lp-muted mt-5 text-xs">
            {health ? (
              <>
                API {health.status} · version <span className="font-mono">{health.version}</span>
              </>
            ) : (
              "Checking status…"
            )}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] lp-muted">Features</p>
          <ul className="mt-4 space-y-2 text-sm">
            {FEATURES.map((feature) => (
              <li key={feature.slug}>
                <Link to={`/features/${feature.slug}`} className="transition-colors hover:text-[var(--lp-accent)]">
                  {feature.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] lp-muted">Learn</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link to={INTEGRATION_GUIDE_URL} className="transition-colors hover:text-[var(--lp-accent)]">
                Documentation
              </Link>
            </li>
            <li>
              <Link to="/docs/quickstart" className="transition-colors hover:text-[var(--lp-accent)]">
                Quickstart
              </Link>
            </li>
            <li>
              <Link to="/docs/api" className="transition-colors hover:text-[var(--lp-accent)]">
                API reference
              </Link>
            </li>
            <li>
              <a
                href={REPOSITORY_URL}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-[var(--lp-accent)]"
              >
                Repository
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
