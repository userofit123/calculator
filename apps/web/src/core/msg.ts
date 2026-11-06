// Shows a message that @calc/core or a store keeps in English ("Division by zero", "Unknown variable x", "Version 1.2
// is available") in the language shown. The English text stays the id everywhere else (code compares it, tests check
// it); only the display goes through here. A message not listed is shown as it is.
import { msg } from "../i18n/en/msg";
import { lang, t, tMaybe, type Key } from "./i18n";

type MsgKey = keyof typeof msg & Key;
const exact = new Map<string, MsgKey>();
for (const [k, v] of Object.entries(msg)) if (!v.includes("{") && !k.startsWith("msg.part.")) exact.set(v, k as MsgKey);

const part = (s: string) => tMaybe("msg.part." + s, s);
const BASE: Record<string, string> = { hexadecimal: "hex", decimal: "dec", octal: "oct", binary: "bin" };
const PATTERNS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Unknown unit after in$/, () => t("msg.unknownUnitIn")],
  [/^Unknown variable (.+)$/, (m) => t("msg.unknownVar", { x: m[1]! })],
  [/^Unknown function (.+)$/, (m) => t("msg.unknownFn", { x: m[1]! })],
  [/^Unknown unit (.+)$/, (m) => t("msg.unknownUnit", { x: m[1]! })],
  [/^No rate for (.+)$/, (m) => t("msg.noRate", { x: m[1]! })],
  [/^Can't convert (.+) to (.+)$/, (m) => t("msg.cantConvert", { a: m[1]!, b: m[2]! })],
  [/^Can't change (.+), it's a built-in name$/, (m) => t("msg.cantChange", { x: m[1]! })],
  [/^(.+) is a built-in name$/, (m) => t("msg.builtIn", { x: m[1]! })],
  [/^(.+) is kept for unit conversions \(5 km in mi\)$/, (m) => t("msg.keptUnits", { x: m[1]! })],
  [/^(.+) is only defined for non-negative integers$/, (m) => t("msg.nonNegInt", { x: part(m[1]!) })],
  [/^(.+) can't be negative$/, (m) => t("msg.cantNeg", { x: part(m[1]!) })],
  [/^(.+) must be above 0$/, (m) => t("msg.above0", { x: part(m[1]!) })],
  [/^(.+) must be a whole number of periods$/, (m) => t("msg.wholePeriods", { x: part(m[1]!) })],
  [/^(.+) is not an? (hexadecimal|decimal|octal|binary) number$/, (m) => t("msg.notBase", { x: m[1]!, base: t(("msg.part." + BASE[m[2]!]) as Key) })],
  [/^Base (\S+) isn't one of 2, 8, 10 and 16$/, (m) => t("msg.baseList", { x: m[1]! })],
  [/^(.+) takes one number$/, (m) => t("msg.takesOne", { x: m[1]! })],
  [/^(.+) takes (\d+) numbers: (.+)$/, (m) => t("msg.takesList", { x: m[1]!, n: m[2]!, list: m[3]! })],
  [/^(.+) takes (\d+) numbers$/, (m) => t("msg.takesN", { x: m[1]!, n: m[2]! })],
  [/^Out of range for (.+)$/, (m) => t("msg.outOfRange", { x: m[1]! })],
  // "the ECB or the National Bank of Ukraine": each bank named in the language shown (a name is words, not isolated)
  [/^Couldn't reach (.+)$/, (m) => t("msg.couldntReach").replace("{x}", m[1]!.split(" or ").map(part).join(` ${part("or")} `))],
  [/^Version (\S+) is ready to install$/, (m) => t("msg.verReady", { v: m[1]! })],
  [/^Version (\S+) is the latest$/, (m) => t("msg.verLatest", { v: m[1]! })],
  [/^Version (\S+) is available: install the update from the release page$/, (m) => t("msg.verLink", { v: m[1]! })],
  [/^Version (\S+) is available$/, (m) => t("msg.verAvail", { v: m[1]! })],
  [/^Downloading (\d+)%$/, (m) => t("msg.downloadingPct", { p: m[1]! })],
  [/^Downloading (\d+\.\d) MB$/, (m) => t("msg.downloadingMb", { mb: m[1]! })],
];

/** A message from the core or a store, in the language shown */
export function tMsg(s: string | null | undefined): string {
  if (!s || lang.value === "en") return s ?? "";
  const k = exact.get(s);
  if (k) return t(k);
  for (const [re, f] of PATTERNS) { const m = re.exec(s); if (m) return f(m); }
  return s;
}
/** Whether a message is one tMsg knows (for the tests) */
export const knownMsg = (s: string) => exact.has(s) || PATTERNS.some(([re]) => re.test(s));
