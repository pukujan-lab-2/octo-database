import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LandingFooter, LandingShell } from "@/components/landing/LandingChrome";
import { FeatureStage } from "@/components/landing/FeatureStage";
import { FEATURES, findFeature } from "@/components/landing/features";
import { useHealth } from "@/lib/queries";
import NotFound from "./NotFound";

/** /features/:slug: one feature, told in a hero, three beats and a way on. */
export function FeaturePage() {
  const { slug } = useParams();
  const health = useHealth();
  const feature = findFeature(slug);
  if (!feature) return <NotFound />;

  const index = FEATURES.indexOf(feature);
  const next = FEATURES[(index + 1) % FEATURES.length];

  return (
    <LandingShell testId="feature-page">
      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:pb-28 lg:pt-24">
          <div>
            <Link to="/#features" className="lp-muted inline-flex items-center gap-2 text-sm hover:text-[var(--lp-ink)]">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> All features
            </Link>
            <p className="num mt-8 text-xs lp-muted">
              {feature.number} / {feature.name}
            </p>
            <h1 className="lp-serif mt-4 text-5xl leading-[1.04] sm:text-6xl">{feature.headline}</h1>
            <p className="lp-muted mt-6 max-w-lg text-lg leading-relaxed">{feature.lead}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to={feature.docs} className="lp-btn lp-btn-dark">
                Read the guide <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
              <a href="/#sign-in" className="lp-btn lp-btn-line">
                Try it
              </a>
            </div>
          </div>
          <FeatureStage feature={feature} tall />
        </section>

        <section className="border-y border-[var(--lp-line)] bg-[var(--lp-card)]">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
            <h2 className="lp-serif text-3xl sm:text-4xl">How it works</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {feature.steps.map((step, i) => (
                <li key={step.title}>
                  <span className="num text-xs lp-muted">0{i + 1}</span>
                  <h3 className="lp-serif mt-3 text-2xl">{step.title}</h3>
                  <p className="lp-muted mt-3 text-sm leading-relaxed">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <Link
            to={`/features/${next.slug}`}
            className="group block rounded-[2rem] border border-[var(--lp-line)] bg-[var(--lp-card)] p-8 transition-colors hover:border-[var(--lp-ink)] sm:p-12"
          >
            <p className="lp-muted text-xs uppercase tracking-[0.16em]">Next: {next.name}</p>
            <p className="lp-serif mt-4 flex items-center justify-between gap-6 text-3xl sm:text-5xl">
              {next.headline}
              <ArrowRight className="h-8 w-8 shrink-0 transition-transform group-hover:translate-x-1" strokeWidth={1.25} />
            </p>
          </Link>
        </section>
      </main>
      <LandingFooter health={health.data} />
    </LandingShell>
  );
}
