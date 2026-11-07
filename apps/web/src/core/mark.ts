// The app mark: the launcher icon's four operators (+ - x /) in one colour, drawn on a 24x24 grid. Each stroke is an
// outline wound the same way, so it is filled non-zero and the crossings of + and x stay solid. Logo.vue shows it on the
// accent gradient; markIcon() makes the same tile for the browser tab, so the tab icon is the one the app shows and
// follows the look too (not the full-colour install icon, icon.svg).
export const MARK = "M4.12 8.53L10.38 8.53A1.12 1.12 0 0 0 10.38 6.28L4.12 6.28A1.12 1.12 0 0 0 4.12 8.53ZM6.12 4.28L6.12 10.53A1.12 1.12 0 0 0 8.38 10.53L8.38 4.28A1.12 1.12 0 0 0 6.12 4.28ZM13.62 8.53L19.88 8.53A1.12 1.12 0 0 0 19.88 6.28L13.62 6.28A1.12 1.12 0 0 0 13.62 8.53ZM4.08 15.33L8.83 20.08A1.12 1.12 0 0 0 10.42 18.49L5.67 13.74A1.12 1.12 0 0 0 4.08 15.33ZM5.67 20.08L10.42 15.33A1.12 1.12 0 0 0 8.83 13.74L4.08 18.49A1.12 1.12 0 0 0 5.67 20.08ZM13.62 18.03L19.88 18.03A1.12 1.12 0 0 0 19.88 15.78L13.62 15.78A1.12 1.12 0 0 0 13.62 18.03ZM17.94 14.16A1.19 1.19 0 0 0 15.56 14.16A1.19 1.19 0 0 0 17.94 14.16ZM17.94 19.66A1.19 1.19 0 0 0 15.56 19.66A1.19 1.19 0 0 0 17.94 19.66Z";

/** The logo tile as an SVG data address, in the given colours (the theme's --acc, --acc2 and --on): the tab icon */
export function markIcon(acc: string, acc2: string, on: string, rad?: string): string {
  // corners follow the corner-style setting like .logo does in theme.css (soft 10, sharp 3, otherwise round 15)
  const rx = rad === "soft" ? 10 : rad === "sharp" ? 3 : 15;
  // as .logo draws it: a 44px tile, the gradient at 135deg, the 26px mark in the middle
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
    + '<stop offset="0" stop-color="' + acc + '"/><stop offset="1" stop-color="' + acc2 + '"/></linearGradient></defs>'
    + '<rect width="44" height="44" rx="' + rx + '" fill="url(#g)"/>'
    + '<path transform="translate(9 9) scale(1.0833)" fill="' + on + '" d="' + MARK + '"/></svg>';
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
