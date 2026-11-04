import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SignInCard } from "@/components/portal/SignInCard";
import { FEATURES } from "./features";
import { FeatureChapter } from "./FeatureChapter";
import { INTEGRATION_GUIDE_URL } from "./links";
import { useParallax } from "./useParallax";
import type { Health } from "@/lib/types";

const speed = (n: number) => ({ "--speed": n }) as CSSProperties;

function Hero() {
  const ref = useParallax<HTMLElement>();
  return (
    <section ref={ref} className="relative overflow-hidden">
      <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-20 sm:px-8 lg:pb-36 lg:pt-32">
        <p className="text-xs font-medium uppercase tracking-[0.18em] lp-muted">
          Self-hosted workspace data platform
        </p>
        <h1 className="lp-serif mt-6 max-w-4xl text-5xl leading-[1.02] sm:text-7xl lg:text-8xl">
          Your project&apos;s data layer.
        </h1>
        <p className="lp-muted mt-8 max-w-xl text-lg leading-relaxed">
          Every project gets its own database, files, analytics, search, traces and credentials. One
          key, one server, and nothing to rebuild.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a href="#sign-in" className="lp-btn lp-btn-dark">
            Start a session <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </a>
          <Link to={INTEGRATION_GUIDE_URL} className="lp-btn lp-btn-line">
            Read the docs
          </Link>
        </div>
      </div>

      {/* Floating cards: each drifts at its own speed. Hidden on phones, where
          there is no spare width for them. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
        <div className="lp-card lp-layer absolute right-[7%] top-[14%] w-64 px-5 py-4" style={speed(-120)}>
          <p className="text-[11px] uppercase tracking-[0.14em] lp-muted">Database</p>
          <pre className="lp-code mt-2">select count(*) from items{"\n"}→ 1284</pre>
        </div>
        <div className="lp-card lp-layer absolute right-[16%] top-[44%] w-56 px-5 py-4" style={speed(60)}>
          <p className="text-[11px] uppercase tracking-[0.14em] lp-muted">Search</p>
          <p className="mt-2 text-sm">5 matches · reranked</p>
        </div>
        <div className="lp-card lp-layer absolute right-[4%] top-[66%] w-52 px-5 py-4" style={speed(-40)}>
          <p className="text-[11px] uppercase tracking-[0.14em] lp-muted">Vault</p>
          <p className="mt-2 text-sm">lease expires in 1h</p>
        </div>
      </div>
    </section>
  );
}

function Statement() {
  return (
    <section className="border-y border-[var(--lp-line)] bg-[var(--lp-card)]">
      <div className="mx-auto w-full max-w-4xl px-5 py-24 text-center sm:px-8 lg:py-32">
        <p className="lp-serif text-3xl leading-snug sm:text-5xl">
          Give an agent a database, not your database.
        </p>
        <p className="lp-muted mx-auto mt-6 max-w-xl text-base leading-relaxed">
          Each workspace is its own PostgreSQL database behind an HTTP surface. The key you hand out
          reaches that workspace and nothing else, and the steps that cannot be undone wait for a
          human.
        </p>
      </div>
    </section>
  );
}

function Index() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 pt-24 sm:px-8 lg:pt-32">
      <p className="text-xs font-medium uppercase tracking-[0.18em] lp-muted">What a workspace gives you</p>
      <h2 className="lp-serif mt-4 max-w-2xl text-4xl leading-[1.08] sm:text-5xl">
        Eight things you would otherwise build.
      </h2>
      <ul className="mt-10 flex flex-wrap gap-2">
        {FEATURES.map((feature) => (
          <li key={feature.slug}>
            <a href={`#${feature.slug}`} className="lp-btn lp-btn-line !px-4 !py-2 !text-sm">
              {feature.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClosingSignIn({
  health,
  healthPending,
  notice,
  signingIn,
  onGuest,
  isDark,
}: {
  health: Health | undefined;
  healthPending: boolean;
  notice: string | null;
  signingIn: boolean;
  onGuest: (input: { displayName?: string; turnstileToken?: string }) => Promise<boolean>;
  isDark: boolean;
}) {
  return (
    <section className="border-t border-[var(--lp-line)]">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-20 lg:py-32">
        <div>
          <h2 className="lp-serif text-4xl leading-[1.08] sm:text-6xl">Take back the wheel.</h2>
          <p className="lp-muted mt-6 max-w-md text-base leading-relaxed">
            Run one server and give every project its own data plane. Start with a guest session to
            look around.
          </p>
          <Link
            to={INTEGRATION_GUIDE_URL}
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium underline decoration-[var(--lp-line)] underline-offset-4 hover:decoration-[var(--lp-ink)]"
          >
            Or read the quickstart first <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </div>
        <div id="sign-in" className="scroll-mt-24">
          <SignInCard
            health={health}
            healthPending={healthPending}
            notice={notice}
            signingIn={signingIn}
            onGuest={onGuest}
            isDark={isDark}
          />
        </div>
      </div>
    </section>
  );
}

export function LandingHome(props: React.ComponentProps<typeof ClosingSignIn>) {
  return (
    <main>
      <Hero />
      <Statement />
      <Index />
      {FEATURES.map((feature, index) => (
        <FeatureChapter key={feature.slug} feature={feature} flip={index % 2 === 1} />
      ))}
      <ClosingSignIn {...props} />
    </main>
  );
}
