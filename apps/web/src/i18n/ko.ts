// Korean: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./ko/common";
import { msg } from "./ko/msg";
import { calc } from "./ko/calc";
import { settings } from "./ko/settings";
import { convert } from "./ko/convert";
import { history } from "./ko/history";
import { date } from "./ko/date";
import { every } from "./ko/every";
import { tip } from "./ko/tip";
import { fin } from "./ko/fin";
import { prog } from "./ko/prog";
import { kbd } from "./ko/kbd";
import { look } from "./ko/look";
import { UNITS } from "./ko/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { other: "{n}년" },
    month: { other: "{n}개월" },
    week: { other: "{n}주" },
    day: { other: "{n}일" },
    hour: { other: "{n}시간" },
    minute: { other: "{n}분" },
    second: { other: "{n}초" },
  },
  sep: " ",
} satisfies LangPack;
