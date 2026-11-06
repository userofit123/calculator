// Page-swipe decision (apps/web/src/core/swipe.ts).
import { describe, it, expect } from "vitest";
import { canScrollSideways, swipeBlocked, type SideScroller } from "../src/core/swipe";

const s = (left: number, rtl = false, sw = 500, cw = 300): SideScroller => ({ left, scrollWidth: sw, clientWidth: cw, rtl });

describe("page swipe vs sideways scrollers", () => {
  it("no scroller under the finger: the page changes", () => expect(swipeBlocked([], -100)).toBe(false));
  it("content that does not overflow never blocks", () => expect(canScrollSideways(s(0, false, 300, 300), -100)).toBe(false));
  it("LTR: at the start only a finger moving left scrolls", () => {
    expect(canScrollSideways(s(0), -100)).toBe(true);
    expect(canScrollSideways(s(0), 100)).toBe(false);
  });
  it("LTR: at the end only a finger moving right scrolls", () => {
    expect(canScrollSideways(s(200), -100)).toBe(false);
    expect(canScrollSideways(s(200), 100)).toBe(true);
  });
  it("in the middle both ways scroll", () => {
    expect(canScrollSideways(s(100), -100)).toBe(true);
    expect(canScrollSideways(s(100), 100)).toBe(true);
  });
  it("RTL scrollLeft runs from -max to 0", () => {
    expect(canScrollSideways(s(0, true), -100)).toBe(false);
    expect(canScrollSideways(s(0, true), 100)).toBe(true);
    expect(canScrollSideways(s(-200, true), -100)).toBe(true);
    expect(canScrollSideways(s(-200, true), 100)).toBe(false);
  });
  it("blocked when any scroller on the way up can scroll", () => expect(swipeBlocked([s(200), s(0)], -100)).toBe(true));
});
