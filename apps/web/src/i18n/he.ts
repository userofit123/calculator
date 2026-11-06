// Hebrew: a chunk of its own, loaded only when Hebrew is chosen (i18n/langs.ts, core/i18n.ts). Every English key must be
// here (the type below fails the typecheck otherwise). Unit names (HE_UNITS) are keyed by @calc/core's unit ids.
// The model for every other language's i18n/<code>.ts.
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./he/common";
import { msg } from "./he/msg";
import { calc } from "./he/calc";
import { settings } from "./he/settings";
import { convert } from "./he/convert";
import { history } from "./he/history";
import { date } from "./he/date";
import { every } from "./he/every";
import { tip } from "./he/tip";
import { fin } from "./he/fin";
import { prog } from "./he/prog";
import { kbd } from "./he/kbd";
import { look } from "./he/look";
import { HE_UNITS } from "./he/units";
export { HE_UNITS };

export const HE: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict: HE,
  units: HE_UNITS,
  // Hebrew has its own words for one and two ("יום אחד", "יומיים")
  count: {
    year: { one: "שנה אחת", two: "שנתיים", other: "{n} שנים" },
    month: { one: "חודש אחד", two: "חודשיים", other: "{n} חודשים" },
    week: { one: "שבוע אחד", two: "שבועיים", other: "{n} שבועות" },
    day: { one: "יום אחד", two: "יומיים", other: "{n} ימים" },
    hour: { one: "שעה אחת", two: "שעתיים", other: "{n} שעות" },
    minute: { one: "דקה אחת", two: "שתי דקות", other: "{n} דקות" },
    second: { one: "שנייה אחת", two: "שתי שניות", other: "{n} שניות" },
  },
} satisfies LangPack;
