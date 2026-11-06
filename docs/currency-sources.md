# Currency sources

The converter uses official data only (see CLAUDE.md): the European Central Bank's euro reference rates, and for
currencies the ECB doesn't quote, the country's own central bank. A currency with no usable official source is left out,
never filled in from a third-party rates service.

"Usable" for a live rate means: the bank publishes its own official rate in a machine-readable form, with no key or
account, and its answer allows any site to read it (CORS `access-control-allow-origin: *`), because the web app asks from
the browser. The desktop app allows exactly these hosts in its page rules (apps/desktop/src/main.ts). Every included
currency also ships with the app (scripts/update-rates.mjs) so it works offline.

Checked on 6 Nov 2026 with `curl -sI -H "Origin: https://calculator.local" <url>`.

## Live sources

| Source | Address | Format | CORS | Currencies | Notes |
|---|---|---|---|---|---|
| European Central Bank | https://data-api.ecb.europa.eu/service/data/EXR/D..EUR.SP00.A?lastNObservations=1&format=csvdata&detail=dataonly | CSV | `*` | ~30 (USD, JPY, GBP, ...) | Euro reference rates, each working day around 16:00 CET. |
| National Bank of Ukraine | https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json | JSON | `*` | UAH | The official hryvnia rate of the euro (`cc` EUR, `r030` 978, `rate` = UAH per euro, `exchangedate` DD.MM.YYYY). Open data of the NBU; no key. |
| Central Bank of Argentina (BCRA) | https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones | JSON | `*` | ARS | The BCRA's quote of the euro (`codigoMoneda` EUR, `tipoCotizacion` = ARS per euro) on `fecha`. BCRA public API; no key. |

Only the bank's own currency is taken from each (the NBU and the BCRA also list other currencies; those are not their
official rates to set, so they are ignored).

## Fixed parities (official, set in the app)

| Currency | Parity | Set by |
|---|---|---|
| BGN Bulgarian lev | 1.95583 per euro | Irrevocably fixed when Bulgaria joined the euro (2026-01-01) |
| XOF West African CFA franc | 655.957 per euro | BCEAO (fixed parity with the euro) |
| XAF Central African CFA franc | 655.957 per euro | BEAC (fixed parity with the euro) |
| AED UAE dirham | 3.6725 per US dollar | Central Bank of the UAE |
| SAR Saudi riyal | 3.75 per US dollar | Saudi Central Bank (SAMA) |
| QAR Qatari riyal | 3.64 per US dollar | Qatar Central Bank |
| BHD Bahraini dinar | 0.376 per US dollar | Central Bank of Bahrain |
| OMR Omani rial | 0.3845 per US dollar | Central Bank of Oman |
| JOD Jordanian dinar | 0.709 per US dollar | Central Bank of Jordan |

A dollar peg's euro rate is the peg times the ECB's dollar rate (exact), shown with the day of that ECB rate. The Hong
Kong dollar's peg is a band (7.75 - 7.85), and the ECB quotes it anyway.

## Left out (no usable official source)

| Currency | Central bank | What it publishes | Why left out |
|---|---|---|---|
| EGP Egyptian pound | Central Bank of Egypt | HTML page | Not machine-readable, no CORS |
| NGN Nigerian naira | Central Bank of Nigeria | JSON (www.cbn.gov.ng/api/GetAllExchangeRates) | No CORS header: a web page can't read it |
| PKR Pakistani rupee | State Bank of Pakistan | HTML / PDF | 403 to automated requests, no CORS |
| TWD Taiwan dollar | Central Bank of the Republic of China (Taiwan) | JSON (cpx.cbc.gov.tw/API/DataAPI) | CORS allows only petstore.swagger.io |
| CLP Chilean peso | Banco Central de Chile | API (si3.bcentral.cl SieteRestWS) | Needs a registered user and password |
| VND Vietnamese dong | State Bank of Vietnam | HTML page | Not machine-readable, no CORS |
| KWD Kuwaiti dinar | Central Bank of Kuwait | HTML pages | Not machine-readable, no CORS; pegged to an undisclosed basket, so no fixed parity either |

Rates for these from other countries' central banks (the NBU lists EGP, SAR, AED, VND, ...) are not used: only the
issuing country's own bank counts.
