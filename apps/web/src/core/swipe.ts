// Deciding whether a sideways swipe changes the page (used by the phone shell; pure so it can be tested).

/** What a sideways-scrolling element looked like when the touch started (before the swipe moved it). */
export interface SideScroller { left: number; scrollWidth: number; clientWidth: number; rtl: boolean }

/** Whether the element could still scroll for a finger moving by dx (dx < 0: finger left, content moves left,
 *  so scrollLeft grows). scrollLeft is physical: 0..max in LTR, -max..0 in RTL. */
export function canScrollSideways(s: SideScroller, dx: number): boolean {
  const max = s.scrollWidth - s.clientWidth;
  if (max <= 1) return false;
  const lo = s.rtl ? -max : 0, hi = s.rtl ? 0 : max;
  return dx < 0 ? s.left < hi - 1 : s.left > lo + 1;
}

/** A swipe changes the page only when none of the scrollers under the finger can still scroll that way, so a long
 *  number on the display scrolls, but once it is at its edge (or does not overflow) the swipe moves the page. */
export function swipeBlocked(scrollers: SideScroller[], dx: number): boolean {
  return scrollers.some(s => canScrollSideways(s, dx));
}
