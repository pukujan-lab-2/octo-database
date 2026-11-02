import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { FeatureStage } from "./FeatureStage";
import type { Feature } from "./features";

/** One homepage chapter: text on one side, the drifting stage on the other,
 *  alternating down the page. */
export function FeatureChapter({ feature, flip }: { feature: Feature; flip: boolean }) {
  return (
    <section
      id={feature.slug}
      className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-28"
    >
      <div className={flip ? "lg:order-2" : ""}>
        <p className="num text-xs lp-muted">{feature.number} / {feature.name}</p>
        <h2 className="lp-serif mt-4 text-4xl leading-[1.08] sm:text-5xl">{feature.headline}</h2>
        <p className="lp-muted mt-5 max-w-lg text-base leading-relaxed">{feature.lead}</p>
        <ul className="mt-6 space-y-2 text-sm">
          {feature.points.map((point) => (
            <li key={point} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lp-accent)]" />
              {point}
            </li>
          ))}
        </ul>
        <Link
          to={`/features/${feature.slug}`}
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium underline decoration-[var(--lp-line)] underline-offset-4 transition-colors hover:decoration-[var(--lp-ink)]"
        >
          How {feature.name.toLowerCase()} works <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      </div>
      <div className={flip ? "lg:order-1" : ""}>
        <FeatureStage feature={feature} />
      </div>
    </section>
  );
}
