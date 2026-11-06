// Hebrew: a chunk of its own, loaded only when Hebrew is chosen (core/i18n.ts). Every English key must be here
// (the type below fails the typecheck otherwise). Unit names (HE_UNITS) are keyed by @calc/core's unit ids.
import type { Key } from "./en";
import { common } from "./he/common";
import { msg } from "./he/msg";
import { calc } from "./he/calc";
import { settings } from "./he/settings";
import { convert } from "./he/convert";
import { history } from "./he/history";
import { date } from "./he/date";
import { every } from "./he/every";
import { fin } from "./he/fin";
import { prog } from "./he/prog";
import { kbd } from "./he/kbd";
import { look } from "./he/look";
export { HE_UNITS } from "./he/units";

export const HE: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...fin, ...prog, ...kbd, ...look };
