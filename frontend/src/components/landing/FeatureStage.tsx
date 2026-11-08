import type { CSSProperties } from "react";
import { useParallax } from "./useParallax";
import type { Feature } from "./features";

const speed = (n: number) => ({ "--speed": n }) as CSSProperties;

/** The picture beside a feature: a tinted panel whose layers drift at different
 *  speeds as the page scrolls. The sample card is a real request or result. */
export function FeatureStage({ feature, tall = false }: { feature: Feature; tall?: boolean }) {
  const ref = useParallax<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`lp-stage ${tall ? "min-h-[30rem]" : ""}`}
      style={{ "--hue": feature.hue } as CSSProperties}
      aria-hidden="true"
    >
      <div className="lp-blob lp-layer -right-16 -top-16 h-64 w-64" style={speed(-90)} />
      <div className="lp-blob lp-layer -bottom-24 -left-10 h-72 w-72" style={speed(70)} />

      <div className="relative flex h-full min-h-[inherit] flex-col justify-center gap-5 p-6 sm:p-10">
        <div className="lp-card lp-layer w-full max-w-md self-center px-5 py-4" style={speed(-28)}>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] lp-muted">{feature.sample.label}</p>
          <pre className="lp-code mt-3">{feature.sample.lines.join("\n")}</pre>
        </div>

        {feature.points.slice(0, 2).map((point, index) => (
          <div
            key={point}
            className={`lp-card lp-layer w-fit max-w-[16rem] px-4 py-2.5 text-xs ${
              index === 0 ? "self-start" : "self-end"
            }`}
            style={speed(index === 0 ? 36 : -52)}
          >
            {point}
          </div>
        ))}
      </div>
    </div>
  );
}
