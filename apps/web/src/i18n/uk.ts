// Ukrainian: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./uk/common";
import { msg } from "./uk/msg";
import { calc } from "./uk/calc";
import { settings } from "./uk/settings";
import { convert } from "./uk/convert";
import { history } from "./uk/history";
import { date } from "./uk/date";
import { every } from "./uk/every";
import { tip } from "./uk/tip";
import { fin } from "./uk/fin";
import { prog } from "./uk/prog";
import { kbd } from "./uk/kbd";
import { look } from "./uk/look";
import { UNITS } from "./uk/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { one: "{n} рік", few: "{n} роки", many: "{n} років", other: "{n} року" },
    month: { one: "{n} місяць", few: "{n} місяці", many: "{n} місяців", other: "{n} місяця" },
    week: { one: "{n} тиждень", few: "{n} тижні", many: "{n} тижнів", other: "{n} тижня" },
    day: { one: "{n} день", few: "{n} дні", many: "{n} днів", other: "{n} дня" },
    hour: { one: "{n} година", few: "{n} години", many: "{n} годин", other: "{n} години" },
    minute: { one: "{n} хвилина", few: "{n} хвилини", many: "{n} хвилин", other: "{n} хвилини" },
    second: { one: "{n} секунда", few: "{n} секунди", many: "{n} секунд", other: "{n} секунди" },
  },
} satisfies LangPack;
