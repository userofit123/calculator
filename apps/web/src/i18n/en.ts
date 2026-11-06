// English: the source of every text in the app (core/i18n.ts). Each area keeps its texts in en/<area>.ts, with its
// Hebrew in he/<area>.ts under the same keys (the type in he.ts and test/i18n.test.ts make sure none is missing).
// Only the texts of what is in the main bundle are here (EN); a page or form that loads lazily brings its own English
// with it (useTexts in core/i18n.ts), so the first screen doesn't carry the Settings or Appearance texts.
import { common } from "./en/common";
import { msg } from "./en/msg";
import { calc } from "./en/calc";
import { prog } from "./en/prog";
import { kbd } from "./en/kbd";
import type { settings } from "./en/settings";
import type { convert } from "./en/convert";
import type { history } from "./en/history";
import type { date } from "./en/date";
import type { every } from "./en/every";
import type { tip } from "./en/tip";
import type { fin } from "./en/fin";
import type { look } from "./en/look";

export const EN = { ...common, ...msg, ...calc, ...prog, ...kbd } as const;
type Lazy = typeof settings & typeof convert & typeof history & typeof date & typeof every & typeof tip & typeof fin & typeof look;
export type Key = keyof typeof EN | keyof Lazy;
