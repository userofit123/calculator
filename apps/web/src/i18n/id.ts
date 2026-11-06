// Indonesian: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./id/common";
import { msg } from "./id/msg";
import { calc } from "./id/calc";
import { settings } from "./id/settings";
import { convert } from "./id/convert";
import { history } from "./id/history";
import { date } from "./id/date";
import { every } from "./id/every";
import { tip } from "./id/tip";
import { fin } from "./id/fin";
import { prog } from "./id/prog";
import { kbd } from "./id/kbd";
import { look } from "./id/look";
import { UNITS } from "./id/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { other: "{n} tahun" },
    month: { other: "{n} bulan" },
    week: { other: "{n} minggu" },
    day: { other: "{n} hari" },
    hour: { other: "{n} jam" },
    minute: { other: "{n} menit" },
    second: { other: "{n} detik" },
  },
} satisfies LangPack;
