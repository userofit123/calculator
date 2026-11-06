// Arabic: a chunk of its own, loaded only when Arabic is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./ar/common";
import { msg } from "./ar/msg";
import { calc } from "./ar/calc";
import { settings } from "./ar/settings";
import { convert } from "./ar/convert";
import { history } from "./ar/history";
import { date } from "./ar/date";
import { every } from "./ar/every";
import { tip } from "./ar/tip";
import { fin } from "./ar/fin";
import { prog } from "./ar/prog";
import { kbd } from "./ar/kbd";
import { look } from "./ar/look";
import { UNITS } from "./ar/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { zero: "{n} سنة", one: "سنة واحدة", two: "سنتان", few: "{n} سنوات", many: "{n} سنة", other: "{n} سنة" },
    month: { zero: "{n} شهر", one: "شهر واحد", two: "شهران", few: "{n} أشهر", many: "{n} شهرًا", other: "{n} شهر" },
    week: { zero: "{n} أسبوع", one: "أسبوع واحد", two: "أسبوعان", few: "{n} أسابيع", many: "{n} أسبوعًا", other: "{n} أسبوع" },
    day: { zero: "{n} يوم", one: "يوم واحد", two: "يومان", few: "{n} أيام", many: "{n} يومًا", other: "{n} يوم" },
    hour: { zero: "{n} ساعة", one: "ساعة واحدة", two: "ساعتان", few: "{n} ساعات", many: "{n} ساعة", other: "{n} ساعة" },
    minute: { zero: "{n} دقيقة", one: "دقيقة واحدة", two: "دقيقتان", few: "{n} دقائق", many: "{n} دقيقة", other: "{n} دقيقة" },
    second: { zero: "{n} ثانية", one: "ثانية واحدة", two: "ثانيتان", few: "{n} ثوانٍ", many: "{n} ثانية", other: "{n} ثانية" },
  },
  sep: "، ",
} satisfies LangPack;
