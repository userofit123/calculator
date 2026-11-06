package io.github.userofit123.calculator;

import android.content.SharedPreferences;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Opens like a built-in calculator: the launch screen (only the background colour, see styles.xml) goes as soon as
        // the first frame is ready, with no exit animation and no waiting for anything
        SplashScreen.installSplashScreen(this).setOnExitAnimationListener(v -> { v.remove(); CalcBarsPlugin.restore(this); });
        registerPlugin(CalcBarsPlugin.class);
        registerPlugin(CalcUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        // From the second start on, the window and the page behind it take the last look's background (CalcBarsPlugin
        // remembers it), so a light look doesn't open on the default dark colour for a moment
        SharedPreferences p = getSharedPreferences(CalcBarsPlugin.PREFS, MODE_PRIVATE);
        if (p.contains("bg")) {
            int bg = p.getInt("bg", 0);
            getWindow().setBackgroundDrawable(new ColorDrawable(bg));
            if (getBridge() != null) getBridge().getWebView().setBackgroundColor(bg);
            CalcBarsPlugin.paint(this, bg, p.getBoolean("dark", true));
        }
    }
}
