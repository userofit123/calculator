// Hindi: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./hi/common";
import { msg } from "./hi/msg";
import { calc } from "./hi/calc";
import { settings } from "./hi/settings";
import { convert } from "./hi/convert";
import { history } from "./hi/history";
import { date } from "./hi/date";
import { every } from "./hi/every";
import { tip } from "./hi/tip";
import { fin } from "./hi/fin";
import { prog } from "./hi/prog";
import { kbd } from "./hi/kbd";
import { look } from "./hi/look";
import { UNITS } from "./hi/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { one: "{n} साल", other: "{n} साल" },
    month: { one: "{n} महीना", other: "{n} महीने" },
    week: { one: "{n} हफ़्ता", other: "{n} हफ़्ते" },
    day: { one: "{n} दिन", other: "{n} दिन" },
    hour: { one: "{n} घंटा", other: "{n} घंटे" },
    minute: { one: "{n} मिनट", other: "{n} मिनट" },
    second: { one: "{n} सेकंड", other: "{n} सेकंड" },
  },
} satisfies LangPack;
