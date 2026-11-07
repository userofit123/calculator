// The app's motion in one place: small animations played with the Web Animations API on things that change in place
// (the answer after =, an error, a chip's new value, a bit flipping, the keypad of another mode), with the same
// durations and curves as the CSS ones (the --dur-* / --ease tokens in tokens.css, read from there).
// Rules: transform and opacity only (no layout work per frame); nothing ever waits for an animation (they are played
// after the change is already on screen, so typing and = are never held up); nothing moves on the first paint
// (html.mo is set only after the app has drawn itself); with reduced motion nothing moves at all.
import { nextTick, type Directive } from "vue";

const RM = typeof matchMedia !== "undefined" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
const root = () => document.documentElement;

/** motion is on: the first paint is done and the system doesn't ask for reduced motion */
export const canMove = () => typeof document !== "undefined" && root().classList.contains("mo") && !RM?.matches;

// the tokens, read once (they never change at run time)
let T: { d1: number; d2: number; d3: number; ease: string; easeIn: string } | null = null;
function tokens() {
  if (T) return T;
  const cs = getComputedStyle(root()), ms = (p: string, f: number) => { const v = parseFloat(cs.getPropertyValue(p)); return Number.isFinite(v) ? v * 1000 : f; };
  T = { d1: ms("--dur-1", 120), d2: ms("--dur-2", 180), d3: ms("--dur-3", 240), ease: cs.getPropertyValue("--ease").trim() || "ease-out", easeIn: cs.getPropertyValue("--ease-in").trim() || "ease-in" };
  return T;
}
/** a motion duration token in ms (1 small, 2 popover, 3 page/sheet) */
export const dur = (n: 1 | 2 | 3) => tokens()[("d" + n) as "d1" | "d2" | "d3"];
/** the reading direction as a sign (1 left to right, -1 right to left) */
export const dirSign = () => (root().dir === "rtl" ? -1 : 1);

export type Kind = "rise" | "fade" | "tick" | "shake" | "pulse" | "swap" | "flip" | "spin" | "slide" | "in";
/**
 * Plays one of the app's small animations on an element. `by`: for "slide", which way (1 forwards, -1 back; mirrored
 * right to left). The element ends exactly as it was: the animations only start from somewhere else.
 */
export function play(el: Element | null | undefined, kind: Kind, by = 1): Animation | null {
  if (!el || !canMove() || typeof (el as HTMLElement).animate !== "function") return null;
  const t = tokens();
  const k: Record<Kind, [Keyframe[], number, string]> = {
    // the answer after =: comes up from where the preview was
    rise: [[{ opacity: 0.35, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], t.d3, t.ease],
    fade: [[{ opacity: 0 }, { opacity: 1 }], t.d2, t.ease],
    // a number that follows typing (the converter's result): a light brightening, never a blink
    tick: [[{ opacity: 0.55 }, { opacity: 1 }], t.d1, t.ease],
    // an error: a short, gentle shake (sideways movement is the same either way round)
    shake: [[{ transform: "none" }, { transform: "translateX(-5px)", offset: 0.2 }, { transform: "translateX(4px)", offset: 0.45 }, { transform: "translateX(-2px)", offset: 0.7 }, { transform: "none" }], t.d3 + 60, "ease-out"],
    // copied: the answer gives a small nod
    pulse: [[{ transform: "none" }, { transform: "scale(.97)", opacity: 0.6, offset: 0.4 }, { transform: "none", opacity: 1 }], t.d3, t.ease],
    // a chip or label showing a new value: the new one drops in
    swap: [[{ opacity: 0, transform: "translateY(-5px)" }, { opacity: 1, transform: "none" }], t.d2, t.ease],
    // a bit or a 2nd-layer key turning over to its other side
    flip: [[{ opacity: 0.2, transform: "perspective(200px) rotateX(90deg)" }, { opacity: 1, transform: "none" }], t.d2, t.ease],
    // a half turn on top of the element's own transform (the converter's swap arrows rest at rotate(90deg)): "add"
    // keeps that resting angle, where "none" as the end frame replaced it and the icon snapped the last quarter
    spin: [[{ transform: "rotate(-180deg)" }, { transform: "rotate(0deg)" }], t.d3, t.ease],
    // another mode's keys: from the side the mode is on (in the mode list's order), mirrored right to left
    slide: [[{ opacity: 0, transform: `translateX(${16 * by * dirSign()}px)` }, { opacity: 1, transform: "none" }], t.d3, t.ease],
    in: [[{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], t.d3, t.ease],
  };
  const [base, duration, easing] = k[kind];
  // the same animation again (a fast run of keys) restarts it rather than stacking; a spin still turning goes on from
  // the angle it has reached and adds another half turn, so quick taps never make the icon jump back
  let left = 0;
  (el as HTMLElement).getAnimations?.().forEach((a) => {
    if ((a as Animation & { id: string }).id !== "mo-" + kind) return;
    if (kind === "spin") left = -180 * (1 - (a.effect?.getComputedTiming().progress ?? 1));
    a.cancel();
  });
  const kf: Keyframe[] = left ? [{ transform: `rotate(${left - 180}deg)` }, { transform: "rotate(0deg)" }] : base;
  const a = (el as HTMLElement).animate(kf, { duration, easing, composite: kind === "spin" ? "add" : "replace" });
  a.id = "mo-" + kind;
  return a;
}

/**
 * v-swap="value": plays "swap" (or v-swap:flip, v-swap:fade…) when the value shown changes, never when the element first
 * appears. v-swap.on: only when the value becomes true (a choice turning on).
 */
export const vSwap: Directive<HTMLElement, unknown> = {
  updated(el, b) {
    if (b.value === b.oldValue || (b.modifiers.on && !b.value)) return;
    play(el, (b.arg as Kind) || "swap");
  },
};

/**
 * Keys whose labels change together (Advanced's 2nd and hyp layers, Programming's 2nd): call before the change shows
 * (a watcher's "pre" flush); once the page has redrawn, every key in `sel` that now says something else turns over.
 */
export function flipChanged(sel: string, after: (fn: () => void) => void) {
  if (!canMove()) return;
  const before = new Map([...document.querySelectorAll<HTMLElement>(sel)].map((e, i) => [i, e.textContent]));
  after(() => document.querySelectorAll<HTMLElement>(sel).forEach((e, i) => { if (before.has(i) && before.get(i) !== e.textContent) play(e, "flip"); }));
}

/**
 * A change that moves items between lists (History's pin: a row goes from Recent to Pinned): each item marked with
 * data-k glides from where it was to where it lands, matched by that key.
 */
export async function flipMove(sel: string, change: () => void) {
  if (!canMove()) { change(); return; }
  const first = new Map([...document.querySelectorAll<HTMLElement>(sel)].map((e) => [e.dataset.k, e.getBoundingClientRect()]));
  change();
  await nextTick();
  const t = tokens();
  document.querySelectorAll<HTMLElement>(sel).forEach((e) => {
    const f = first.get(e.dataset.k); if (!f || e.classList.contains("row-leave-active")) return;
    const l = e.getBoundingClientRect(), dx = f.left - l.left, dy = f.top - l.top;
    if (dx || dy) e.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: t.d3 + 60, easing: t.ease });
  });
}

/**
 * A box whose size changed (the calculator's page going from Basic to Advanced, C-66): call with its box from before the
 * change, once the change is on screen; it grows or shrinks from that size to its new one instead of jumping. Its
 * content is clipped to the size on the way, so new keys are uncovered rather than spilling out. (Width and height,
 * not a scale: the keys inside must not stretch.)
 */
export function resizeFrom(el: HTMLElement | null | undefined, from: DOMRect | null) {
  if (!el || !from || !canMove()) return;
  el.getAnimations().forEach((a) => { if ((a as Animation & { id: string }).id === "mo-size") a.cancel(); });
  const to = el.getBoundingClientRect();
  if (Math.abs(to.width - from.width) < 1 && Math.abs(to.height - from.height) < 1) return;
  const t = tokens(), box = (r: DOMRect): Keyframe => ({ width: r.width + "px", height: r.height + "px", maxWidth: "none", minHeight: "0", overflow: "clip" });
  el.animate([box(from), box(to)], { duration: t.d3, easing: t.ease }).id = "mo-size";
}

/** a popover on its way out (a Transition's before-leave): no longer there for a screen reader, the keyboard or a click */
export const leaving = (el: Element) => { el.setAttribute("aria-hidden", "true"); (el as HTMLElement).inert = true; };

let started = false;
/** after the first paint: from now on things may move (the app opens without anything animating in) */
export function startMotion() {
  if (started || typeof document === "undefined") return; started = true;
  const set = () => root().classList.toggle("mo", !RM?.matches);
  requestAnimationFrame(() => requestAnimationFrame(set));
  RM?.addEventListener?.("change", set);
}
