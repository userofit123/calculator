// Japanese: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./ja/common";
import { msg } from "./ja/msg";
import { calc } from "./ja/calc";
import { settings } from "./ja/settings";
import { convert } from "./ja/convert";
import { history } from "./ja/history";
import { date } from "./ja/date";
import { every } from "./ja/every";
import { tip } from "./ja/tip";
import { fin } from "./ja/fin";
import { prog } from "./ja/prog";
import { kbd } from "./ja/kbd";
import { look } from "./ja/look";
import { UNITS } from "./ja/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { other: "{n}年" },
    month: { other: "{n}か月" },
    week: { other: "{n}週間" },
    day: { other: "{n}日" },
    hour: { other: "{n}時間" },
    minute: { other: "{n}分" },
    second: { other: "{n}秒" },
  },
  sep: "",
} satisfies LangPack;
