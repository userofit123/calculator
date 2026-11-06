// Back (the phone's button or gesture, the browser's) closes an open sheet instead of leaving the page. Sheets don't add
// steps to the browser history: a Back while one is open is caught (shell/nav.ts) and undone, and the sheet closes.
const stack: { id: number; close: () => void }[] = [];
let n = 0;
export const sheetIsOpen = () => stack.length > 0;

export function sheetOpened(close: () => void) {
  const id = ++n;
  stack.push({ id, close });
  return id;
}
export function sheetClosed(id: number) {
  const i = stack.findIndex((e) => e.id === id);
  if (i >= 0) stack.splice(i, 1);
}
/** Close the sheet on top (the Android app's back button will call this directly) */
export function closeTopSheet() { stack.at(-1)?.close(); }
