// Keyboard mode's pure logic (tested in test/keyboard.test.ts): which mode a first-ever open starts in, and stepping
// through earlier lines with the arrow keys, like a terminal.

/** What a first open knows about the device */
export interface DeviceHints { phone: boolean; finePointer: boolean; anyCoarse: boolean }

/** The mode to open in: the saved one when there is one; on a first-ever open, Keyboard on a computer with no touch
 *  screen (a mouse or touchpad and nothing coarse, on the desktop layout), else Basic */
export function startMode<M extends string>(saved: M | null | undefined, d: DeviceHints): M | "keyboard" | "basic" {
  if (saved) return saved;
  return !d.phone && d.finePointer && !d.anyCoarse ? "keyboard" : "basic";
}
/** The device as the browser reports it (false when it can't tell, so a first open stays on Basic) */
export function deviceHints(phone: boolean): DeviceHints {
  const mq = (q: string) => { try { return typeof matchMedia === "function" && matchMedia(q).matches; } catch { return false; } };
  return { phone, finePointer: mq("(pointer: fine)"), anyCoarse: mq("(any-pointer: coarse)") };
}

/** Where the arrow keys are in the earlier lines: at -1 the line being typed (kept in draft), else lines[at] */
export interface Recall { at: number; draft: string }
export const freshRecall = (): Recall => ({ at: -1, draft: "" });
/** Earlier lines, newest first, with a line typed twice in a row listed once */
export function recallLines(lines: string[]): string[] {
  return lines.filter((l, i) => l && l !== lines[i - 1]);
}
/** ArrowUp (older) or ArrowDown (newer) from the line now in the input: the new state and the text to show, or null
 *  when there is nothing further that way. Going up first keeps what was being typed; coming back down brings it back. */
export function recallStep(lines: string[], st: Recall, current: string, dir: "up" | "down"): { st: Recall; text: string } | null {
  if (dir === "up") {
    if (st.at + 1 >= lines.length) return null;
    const draft = st.at === -1 ? current : st.draft;
    return { st: { at: st.at + 1, draft }, text: lines[st.at + 1]! };
  }
  if (st.at < 0) return null;
  const at = st.at - 1;
  return { st: { at, draft: st.draft }, text: at < 0 ? st.draft : lines[at]! };
}
