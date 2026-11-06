package io.github.userofit123.calculator;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The status and navigation bars, the same as Motus's Android app: the page runs behind clear bars, so its background
 * (with the look's glow at the top) continues under the clock and the navigation bar. The page pads itself by the bars'
 * heights, which we hand it as --nst / --nsb / --nsl / --nsr (see tokens.css), because older WebViews report no
 * safe-area insets. The clock and icons switch between dark and light with the look (theme.ts calls calcApp.setBars,
 * native/android.ts passes it here). Phones before Android 6 can't show dark status-bar icons, so they keep the bars
 * coloured with the look's background and the page below them.
 */
@CapacitorPlugin(name = "CalcBars")
public class CalcBarsPlugin extends Plugin {
    static final String PREFS = "calcBars";
    private static final boolean EDGE = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M;
    private int top, bottom, left, right;

    @Override
    public void load() {
        if (!EDGE) return;
        clear(getActivity());
        View web = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            boolean typing = insets.isVisible(WindowInsetsCompat.Type.ime());
            // only the keyboard shrinks the page; every bar (the side ones in landscape too) is the page's to pad, so its
            // background fills the strip beside a side navigation bar
            ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            int b = typing ? ime.bottom : 0;
            if (lp.leftMargin != 0 || lp.rightMargin != 0 || lp.bottomMargin != b) {
                lp.setMargins(0, 0, 0, b);
                v.setLayoutParams(lp);
            }
            float d = v.getResources().getDisplayMetrics().density;
            int t = Math.round(bars.top / d), bo = typing ? 0 : Math.round(bars.bottom / d);
            int l = Math.round(bars.left / d), r = Math.round(bars.right / d);
            if (t != top || bo != bottom || l != left || r != right) { top = t; bottom = bo; left = l; right = r; notifyListeners("insets", sizes()); }
            // newer WebViews turn the insets into env(safe-area-inset-*): take off the part the keyboard margin already
            // covers, so the bottom padding doesn't stay at the navigation bar's height while typing
            return ViewCompat.onApplyWindowInsets(v, b > 0 ? insets.inset(0, 0, 0, b) : insets);
        });
        ViewCompat.requestApplyInsets(web);
    }

    /** Clear bars over the page. Also called when the launch screen goes (MainActivity): on Android 12+ it puts the
     *  theme's bar colours and icon colours back, which would cover the page's top and bottom with a flat colour. */
    static void clear(Activity a) {
        if (!EDGE) return;
        Window w = a.getWindow();
        WindowCompat.setDecorFitsSystemWindows(w, false);
        w.setStatusBarColor(Color.TRANSPARENT);
        // dark navigation buttons need Android 8; before that the bar keeps a colour (paint() below)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) w.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { w.setStatusBarContrastEnforced(false); w.setNavigationBarContrastEnforced(false); }
    }

    /** The last look's colours (this start or the previous one), re-applied after the launch screen. */
    static void restore(Activity a) {
        clear(a);
        android.content.SharedPreferences p = a.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (p.contains("bg")) paint(a, p.getInt("bg", 0), p.getBoolean("dark", true));
    }

    private JSObject sizes() {
        JSObject o = new JSObject();
        o.put("top", top);
        o.put("bottom", bottom);
        o.put("left", left);
        o.put("right", right);
        return o;
    }

    /** The bars' sizes (top, bottom and the sides) in CSS pixels, for a page that has just loaded. */
    @PluginMethod
    public void insets(PluginCall call) { call.resolve(sizes()); }

    /** The look changed: its background colour (#rrggbb) and whether it is dark. Remembered for the next start (MainActivity). */
    @PluginMethod
    public void set(PluginCall call) {
        String bg = call.getString("bg");
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", true));
        int parsed;
        try { parsed = Color.parseColor(bg); } catch (Exception e) { call.reject("Not a colour"); return; }
        final int c = parsed;
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("bg", c).putBoolean("dark", dark).apply();
        getActivity().runOnUiThread(() -> { paint(getActivity(), c, dark); call.resolve(); });
    }

    /** Bar colours where they can't be clear, and dark or light clock and buttons to suit the background. */
    static void paint(Activity a, int bg, boolean dark) {
        Window w = a.getWindow();
        if (!EDGE) w.setStatusBarColor(bg);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) w.setNavigationBarColor(bg);
        WindowInsetsControllerCompat ctl = new WindowInsetsControllerCompat(w, w.getDecorView());
        ctl.setAppearanceLightStatusBars(!dark);
        ctl.setAppearanceLightNavigationBars(!dark);
    }
}
