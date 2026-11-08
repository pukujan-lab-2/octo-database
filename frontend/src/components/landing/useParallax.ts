import { useEffect, useRef } from "react";

/** One scroll listener drives every parallax block on the page.
 *
 *  Each registered element gets `--p`: how far its centre sits from the viewport
 *  centre, from -1 (a screen above) to 1 (a screen below). CSS turns that into a
 *  drift, so a layer's speed is just a multiplier in its own style. Nothing runs
 *  when the user prefers reduced motion; `--p` stays 0 and layers sit still.
 */
const nodes = new Set<HTMLElement>();
let frame = 0;
let listening = false;

function update() {
  frame = 0;
  const half = window.innerHeight / 2;
  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.bottom < -half || rect.top > window.innerHeight + half) return;
    const p = (rect.top + rect.height / 2 - half) / (half * 2);
    node.style.setProperty("--p", Math.max(-1.5, Math.min(1.5, p)).toFixed(4));
  });
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(update);
}

function attach() {
  if (listening) return;
  listening = true;
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
}

function detach() {
  if (nodes.size || !listening) return;
  listening = false;
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
}

export function useParallax<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    nodes.add(node);
    attach();
    schedule();
    return () => {
      nodes.delete(node);
      detach();
    };
  }, []);
  return ref;
}
