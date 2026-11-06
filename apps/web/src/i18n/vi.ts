// Vietnamese: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./vi/common";
import { msg } from "./vi/msg";
import { calc } from "./vi/calc";
import { settings } from "./vi/settings";
import { convert } from "./vi/convert";
import { history } from "./vi/history";
import { date } from "./vi/date";
import { every } from "./vi/every";
import { tip } from "./vi/tip";
import { fin } from "./vi/fin";
import { prog } from "./vi/prog";
import { kbd } from "./vi/kbd";
import { look } from "./vi/look";
import { UNITS } from "./vi/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { other: "{n} năm" },
    month: { other: "{n} tháng" },
    week: { other: "{n} tuần" },
    day: { other: "{n} ngày" },
    hour: { other: "{n} giờ" },
    minute: { other: "{n} phút" },
    second: { other: "{n} giây" },
  },
} satisfies LangPack;
