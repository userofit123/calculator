// Every English text, main bundle and lazy parts together: for the tests only (the app never imports this).
import { EN } from "./en";
import { settings } from "./en/settings";
import { convert } from "./en/convert";
import { history } from "./en/history";
import { date } from "./en/date";
import { every } from "./en/every";
import { fin } from "./en/fin";
import { look } from "./en/look";
import type { Key } from "./en";

export const EN_ALL: Record<Key, string> = { ...EN, ...settings, ...convert, ...history, ...date, ...every, ...fin, ...look };
