// Chinese (Simplified): a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./zh/common";
import { msg } from "./zh/msg";
import { calc } from "./zh/calc";
import { settings } from "./zh/settings";
import { convert } from "./zh/convert";
import { history } from "./zh/history";
import { date } from "./zh/date";
import { every } from "./zh/every";
import { tip } from "./zh/tip";
import { fin } from "./zh/fin";
import { prog } from "./zh/prog";
import { kbd } from "./zh/kbd";
import { look } from "./zh/look";
import { UNITS } from "./zh/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { other: "{n}年" },
    month: { other: "{n}个月" },
    week: { other: "{n}周" },
    day: { other: "{n}天" },
    hour: { other: "{n}小时" },
    minute: { other: "{n}分钟" },
    second: { other: "{n}秒" },
  },
  sep: "",
} satisfies LangPack;
