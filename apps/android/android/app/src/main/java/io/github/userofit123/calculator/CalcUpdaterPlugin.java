package io.github.userofit123.calculator;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.ConnectivityManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-app updates from this app's GitHub releases (task C-27, after Motus's MotusUpdaterPlugin). The page (core/appUpdate.ts)
 * decides when; this makes the requests, so the WebView itself never talks to GitHub:
 *  - get: a GET to GitHub only (the releases/latest API and the release's android-latest.json), no cookies, no identifiers;
 *  - download: the APK named by android-latest.json, into the app's own cache (cache/updates), then checked: its size and
 *    SHA-256 must be the manifest's, it must be this app (same package name), exactly that version, newer than the one
 *    installed, and signed with the same certificate as the installed app. Anything else is deleted;
 *  - install: checks the file again and hands it to Android's installer through a FileProvider limited to cache/updates.
 *    Android always asks the person to confirm (and the first time to allow installing apps from Calculator).
 * Android 5.1-6 (API 22-23) can't install from a content:// address, and a file:// one would mean making the APK
 * readable by every app, so there version() says {install: false}: the page then links to the release page instead,
 * and download/install refuse with that advice.
 * While a download runs (C-52, as in Motus's MotusUpdaterPlugin) a low-importance notification on its own "App updates"
 * channel shows its progress bar, so leaving the app doesn't hide it; once the file is checked it becomes "Update ready -
 * tap to install", and the tap opens Android's installer through install()'s same checks. The notification needs POST_NOTIFICATIONS on Android 13+, asked only from the person's tap (askNotify());
 * without it the download still runs and shows in the app. The words come from the page, in the language shown.
 */
@CapacitorPlugin(name = "CalcUpdater", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class CalcUpdaterPlugin extends Plugin {
    private static final String REPO_DOWNLOADS = "https://github.com/userofit123/calculator/releases/download/";
    // GitHub's addresses for the API, the release pages and the files they redirect to; nothing else is ever contacted
    private static final Set<String> HOSTS = new HashSet<>(Arrays.asList("api.github.com", "github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"));
    private static final long MAX_APK = 200L * 1024 * 1024;
    private static final int MAX_JSON = 1024 * 1024;
    private static final String PREFS = "calc-updater", K_VERSION = "version", K_SHA = "sha256";
    private static final AtomicBoolean BUSY = new AtomicBoolean(false);
    // each download has its own number: a thread whose number is no longer current (the app was closed) leaves the
    // notification alone
    private static final AtomicLong GEN = new AtomicLong(0);
    private static final String CHANNEL = "updates";
    private static final int NOTICE_ID = 5201;
    /** The action of the "Update ready - tap to install" notification's tap (see installFrom). */
    static final String ACTION_INSTALL = "io.github.userofit123.calculator.INSTALL_UPDATE";
    private static final String SEMVER = "\\d{1,6}\\.\\d{1,6}\\.\\d{1,6}";
    // the only addresses get() reads: exact host and path, no port, user, query or fragment; the version is digits and
    // dots only, so no "..", "%2e" or other segment can slip in
    private static final String LATEST_PATH = "/repos/userofit123/calculator/releases/latest";
    private static final String MANIFEST_PATH = "/userofit123/calculator/releases/download/v" + SEMVER + "/android-latest\\.json";
    private static final String USE_PAGE = "Install the update from the release page";
    /** Android's installer takes a content:// (FileProvider) address from Android 7 (API 24) on. */
    private static boolean canInstall() { return Build.VERSION.SDK_INT >= Build.VERSION_CODES.N; }

    /** Whether `url` is exactly the releases/latest API or a release's android-latest.json in this repository. */
    static boolean allowedGet(String url) {
        try {
            URI u = new URI(url);
            if (!"https".equals(u.getScheme()) || u.getRawUserInfo() != null || u.getPort() != -1 || u.getRawQuery() != null || u.getRawFragment() != null) return false;
            String host = u.getHost(), path = u.getRawPath();
            if (host == null || path == null) return false;
            if (host.equals("api.github.com")) return path.equals(LATEST_PATH);
            if (host.equals("github.com")) return path.matches(MANIFEST_PATH);
            return false;
        } catch (Exception e) { return false; }
    }

    private File dir() { File d = new File(getContext().getCacheDir(), "updates"); d.mkdirs(); return d; }
    private File apk() { return new File(dir(), "update.apk"); }
    private SharedPreferences prefs() { return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /** Opens a GET to GitHub, following redirects by hand so every hop is https to one of HOSTS. */
    private static HttpURLConnection open(String address) throws Exception {
        String at = address;
        for (int hop = 0; hop < 6; hop++) {
            URL u = new URL(at);
            if (!"https".equals(u.getProtocol()) || !HOSTS.contains(u.getHost())) throw new Exception("Not a GitHub address");
            HttpURLConnection c = (HttpURLConnection) u.openConnection();
            c.setInstanceFollowRedirects(false);
            c.setUseCaches(false);
            c.setConnectTimeout(20_000);
            c.setReadTimeout(60_000);
            c.setRequestProperty("User-Agent", "Calculator");
            c.setRequestProperty("Accept", u.getHost().equals("api.github.com") ? "application/vnd.github+json" : "*/*");
            int s = c.getResponseCode();
            if (s >= 300 && s < 400) {
                String loc = c.getHeaderField("Location");
                c.disconnect();
                if (loc == null) throw new Exception("Bad redirect");
                at = new URL(u, loc).toString();
                continue;
            }
            return c;
        }
        throw new Exception("Too many redirects");
    }

    @PluginMethod
    public void version(PluginCall call) {
        JSObject r = new JSObject();
        try { r.put("version", getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).versionName); }
        catch (Exception e) { r.put("version", ""); }
        r.put("install", canInstall());
        try { r.put("build", code(getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0))); }
        catch (Exception e) { /* no build number */ }
        call.resolve(r);
    }

    /** {status, body} of a small JSON file from this repository's releases (the API's releases/latest, android-latest.json). */
    @PluginMethod
    public void get(PluginCall call) {
        String url = call.getString("url", "");
        if (!allowedGet(url)) { call.reject("Not allowed"); return; }
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                c = open(url);
                JSObject r = new JSObject();
                r.put("status", c.getResponseCode());
                if (c.getResponseCode() == 200) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    try (InputStream in = c.getInputStream()) {
                        byte[] buf = new byte[16384];
                        int n;
                        while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); if (out.size() > MAX_JSON) throw new Exception("Too large"); }
                    }
                    r.put("body", new String(out.toByteArray(), StandardCharsets.UTF_8));
                }
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Could not reach GitHub");
            } finally { if (c != null) c.disconnect(); }
        }).start();
    }

    private static String hex(byte[] b) {
        StringBuilder s = new StringBuilder();
        for (byte x : b) s.append(String.format("%02x", x));
        return s.toString();
    }

    private static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) { byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) md.update(buf, 0, n); }
        return hex(md.digest());
    }

    @SuppressWarnings("deprecation")
    private static long code(PackageInfo pi) { return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? pi.getLongVersionCode() : pi.versionCode; }

    /** SHA-256 of each signing certificate; `multiple` true when the package has several signers (then all must match). */
    @SuppressWarnings("deprecation")
    private static Set<String> signers(PackageInfo pi, boolean[] multiple) throws Exception {
        Signature[] sigs = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && pi.signingInfo != null) {
            multiple[0] = pi.signingInfo.hasMultipleSigners();
            // a single signer's history includes the certificates it rotated from: Android accepts an update whose
            // history includes the installed one's certificate, so the same is accepted here
            sigs = multiple[0] ? pi.signingInfo.getApkContentsSigners() : pi.signingInfo.getSigningCertificateHistory();
        } else if (pi.signatures != null) {
            sigs = pi.signatures;
            multiple[0] = sigs.length > 1;
        }
        Set<String> out = new HashSet<>();
        if (sigs != null) for (Signature s : sigs) out.add(hex(MessageDigest.getInstance("SHA-256").digest(s.toByteArray())));
        return out;
    }

    @SuppressWarnings("deprecation")
    private static int sigFlags() { return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES; }

    /** Why the downloaded file must not be installed, or null when it is this app, `version`, newer, and signed like this one. */
    @SuppressWarnings("deprecation")
    private String refuse(File f, String version) {
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo got = pm.getPackageArchiveInfo(f.getAbsolutePath(), sigFlags());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && got != null && got.signingInfo == null) {
                // some Android versions fill only the older field for a file that isn't installed
                got = pm.getPackageArchiveInfo(f.getAbsolutePath(), PackageManager.GET_SIGNATURES);
            }
            if (got == null) return "The download is not an app";
            if (!getContext().getPackageName().equals(got.packageName)) return "The download is not Calculator";
            if (version != null && !version.equals(got.versionName)) return "The download is not version " + version;
            PackageInfo mine = pm.getPackageInfo(getContext().getPackageName(), sigFlags());
            if (code(got) <= code(mine)) return "The download is not newer than this version";
            boolean[] gm = {false}, mm = {false};
            Set<String> a = signers(got, gm), b = signers(mine, mm);
            if (a.isEmpty() || b.isEmpty()) return "The download's signature could not be checked";
            boolean same = (gm[0] || mm[0]) ? a.equals(b) : !java.util.Collections.disjoint(a, b);
            if (!same) return "The download is not signed like this app";
            return null;
        } catch (Exception e) { return "The download could not be checked"; }
    }

    /** Downloads android-latest.json's APK ({url, sha256, size, version}) and checks it (see the class comment). */
    @PluginMethod
    public void download(PluginCall call) {
        String version = call.getString("version", ""), url = call.getString("url", ""), sha = call.getString("sha256", "");
        // getLong reads only a Long, and a size from the page arrives as an Integer below 2 GB
        Object sz = call.getData().opt("size");
        long size = sz instanceof Number && ((Number) sz).doubleValue() == ((Number) sz).longValue() ? ((Number) sz).longValue() : -1;
        if (!canInstall()) { call.reject(USE_PAGE); return; }
        if (!version.matches(SEMVER) || !url.equals(REPO_DOWNLOADS + "v" + version + "/calculator-" + version + ".apk")
            || !sha.matches("[0-9a-fA-F]{64}") || size <= 0 || size > MAX_APK) { call.reject("The update information is not valid"); return; }
        final Texts tx = new Texts(call.getObject("texts"), version);
        if (!BUSY.compareAndSet(false, true)) { call.reject("Already downloading"); return; }
        final long gen = GEN.incrementAndGet();
        final Context ctx = getContext().getApplicationContext();
        channel(ctx, tx.channel);
        final File part = new File(dir(), "update.apk.part"), out = apk();
        part.delete(); out.delete();
        prefs().edit().clear().apply();
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                c = open(url);
                if (c.getResponseCode() != 200) throw new Exception("status");
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                long done = 0, last = 0, lastNotice = 0;
                notice(ctx, tx.downloading, "0%", 0, true, false);
                try (InputStream in = c.getInputStream(); FileOutputStream fo = new FileOutputStream(part)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        done += n;
                        // never more than the manifest says: a bigger file is not the release's
                        if (done > size) throw new SecurityException("The download is larger than expected");
                        fo.write(buf, 0, n); md.update(buf, 0, n);
                        long now = System.currentTimeMillis();
                        if (now - last >= 250) { last = now; JSObject p = new JSObject(); p.put("loaded", done); p.put("total", size); notifyListeners("progress", p); }
                        // the notification once a second: Android drops updates that come faster
                        if (now - lastNotice >= 1000 && GEN.get() == gen) { lastNotice = now; int pct = (int) (done * 100 / size); notice(ctx, tx.downloading, pct + "%", pct, true, false); }
                    }
                }
                if (done != size) throw new SecurityException("The download is incomplete");
                if (!sha.equalsIgnoreCase(hex(md.digest()))) throw new SecurityException("The download is damaged (its checksum doesn't match)");
                String why = refuse(part, version);
                if (why != null) throw new SecurityException(why);
                if (!part.renameTo(out)) throw new Exception("rename");
                prefs().edit().putString(K_VERSION, version).putString(K_SHA, sha.toLowerCase()).apply();
                // checked: the tap goes straight to Android's installer (through install()'s checks once more)
                if (GEN.get() == gen) notice(ctx, tx.ready, tx.readyText, 0, false, true);
                call.resolve();
            } catch (SecurityException e) {
                part.delete(); out.delete();
                if (GEN.get() == gen) notice(ctx, tx.failed, tx.failedText, 0, false, false);
                call.reject(e.getMessage());
            } catch (Exception e) {
                part.delete(); out.delete();
                if (GEN.get() == gen) notice(ctx, tx.failed, tx.failedText, 0, false, false);
                call.reject("The download didn't finish: try again");
            } finally {
                if (c != null) c.disconnect();
                BUSY.set(false);
            }
        }).start();
    }

    /** The checked download from before (also after the app was closed), if it is still there and still newer: {version}. */
    @PluginMethod
    public void staged(PluginCall call) {
        JSObject r = new JSObject();
        String v = prefs().getString(K_VERSION, null);
        File f = apk();
        if (v != null && f.isFile() && !BUSY.get() && refuse(f, v) == null) r.put("version", v);
        else if (!BUSY.get()) { f.delete(); prefs().edit().clear().apply(); }
        call.resolve(r);
    }

    /** Hands the checked download to Android's installer, which asks the person to confirm. */
    @PluginMethod
    public void install(PluginCall call) {
        String why = installChecked(getContext());
        if (why == null) call.resolve(); else call.reject(why);
    }

    /** Hands the checked download to Android's installer after checking it once more; null when the installer (or, the
     *  first time, the "Install unknown apps" setting) was opened, else why not. Install and the notification's tap. */
    private String installChecked(Context ctx) {
        if (!canInstall()) return USE_PAGE;
        File f = apk();
        String v = prefs().getString(K_VERSION, null), sha = prefs().getString(K_SHA, null);
        if (BUSY.get() || v == null || sha == null || !f.isFile()) return "Nothing downloaded";
        try {
            // checked again: the file sits in the app's own cache, but it is cheap to be sure it is still the same one
            String why = !sha.equalsIgnoreCase(sha256(f)) ? "The download is damaged" : refuse(f, v);
            if (why != null) { f.delete(); prefs().edit().clear().apply(); cancelNotice(ctx); return why + ": download it again"; }
        } catch (Exception e) { return "The download could not be checked"; }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !ctx.getPackageManager().canRequestPackageInstalls()) {
            // the first time Android needs "Install unknown apps" allowed for Calculator
            Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(s);
            return "Allow Calculator to install updates, then tap Install again";
        }
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".updates", f);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
        // Android's installer takes over; the file stays until the new version runs (staged() then finds it isn't
        // newer and deletes it), so backing out of Android's installer leaves Install working
        cancelNotice(ctx);
        return null;
    }

    /** "Update ready - tap to install" was tapped: the same as Install (its checks run again, off the main thread: the
     *  SHA-256 of a few MB). The tap reaches the running app here, or starts it (load()). Any other app could only
     *  start this same checked hand-over, and Android's installer still asks the person. */
    @Override
    public void load() { installFrom(getActivity() != null ? getActivity().getIntent() : null); }

    @Override
    protected void handleOnNewIntent(Intent intent) { super.handleOnNewIntent(intent); installFrom(intent); }

    private void installFrom(Intent i) {
        if (i == null || !ACTION_INSTALL.equals(i.getAction())) return;
        i.setAction(null); // once: turning the phone or coming back doesn't open the installer again
        final Context ctx = getContext();
        new Thread(() -> installChecked(ctx)).start();
    }

    // ----- the download's notification -----

    /** The notification's words from the page (in the language shown), each a short plain text; English otherwise. */
    private static final class Texts {
        final String channel, downloading, ready, readyText, failed, failedText;
        Texts(JSObject t, String version) {
            channel = pick(t, "channel", "App updates");
            downloading = pick(t, "downloading", "Downloading Calculator " + version);
            ready = pick(t, "ready", "Update ready - tap to install");
            readyText = pick(t, "readyText", "Calculator " + version + " is downloaded and checked");
            failed = pick(t, "failed", "Update failed");
            failedText = pick(t, "failedText", "The download didn't finish. Open the app to try again.");
        }
        private static String pick(JSObject t, String k, String fallback) {
            String s = t == null ? null : t.optString(k, null);
            if (s == null) return fallback;
            s = s.replaceAll("\\p{Cntrl}", "").trim();
            return s.isEmpty() || s.length() > 200 ? fallback : s;
        }
    }

    /** Its own channel, so update notices can be silenced in the phone's settings; low importance: a bar that moves
     *  every second must not sound or pop up. Made again with each download so its name follows the language. */
    private static void channel(Context ctx, String name) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, name, NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    /** `busy`: a bar at `pct` (ongoing, goes by itself if nothing updates it for two minutes, so a download Android
     *  stopped without warning leaves nothing behind). `install`: the tap opens the installer, else the app. */
    private static void notice(Context ctx, String title, String text, int pct, boolean busy, boolean install) {
        Intent open = new Intent(ctx, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (install) open.setAction(ACTION_INSTALL);
        PendingIntent pi = PendingIntent.getActivity(ctx, install ? 52 : 51, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(busy ? android.R.drawable.stat_sys_download : android.R.drawable.stat_sys_download_done)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(busy)
            .setAutoCancel(!busy)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(busy ? NotificationCompat.CATEGORY_PROGRESS : NotificationCompat.CATEGORY_STATUS)
            .setContentIntent(pi);
        if (busy) b.setProgress(100, Math.max(0, Math.min(100, pct)), false).setTimeoutAfter(120_000);
        try { NotificationManagerCompat.from(ctx).notify(NOTICE_ID, b.build()); } catch (SecurityException e) { /* notifications not allowed: the app shows it */ }
    }

    private static void cancelNotice(Context ctx) { NotificationManagerCompat.from(ctx).cancel(NOTICE_ID); }

    // The app is closed (swiped away) mid-download: the download stops with it, so its ongoing notification would stay
    // with a bar that never moves. It goes.
    @Override
    protected void handleOnDestroy() {
        if (BUSY.get()) { GEN.incrementAndGet(); cancelNotice(getContext().getApplicationContext()); }
        super.handleOnDestroy();
    }

    /** {state: "granted" | "denied" | "prompt"}: may the download's notification show. Android 12 and older have no
     *  question to ask, only the app's notification switch in the phone's settings. */
    @PluginMethod
    public void notifyState(PluginCall call) {
        JSObject r = new JSObject();
        r.put("state", notifyStateNow());
        call.resolve(r);
    }

    private String notifyStateNow() {
        boolean on = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        if (Build.VERSION.SDK_INT < 33) return on ? "granted" : "denied";
        PermissionState s = getPermissionState("notifications");
        return s == PermissionState.GRANTED && on ? "granted" : s == PermissionState.DENIED || s == PermissionState.GRANTED ? "denied" : "prompt";
    }

    /** Android 13+: asks to show notifications. Only ever from the person's tap in the page (Allow, turning on
     *  automatic downloads, Download), which explains why first. */
    @PluginMethod
    public void askNotify(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) { notifyState(call); return; }
        requestPermissionForAlias("notifications", call, "notifyAnswered");
    }

    @PermissionCallback
    private void notifyAnswered(PluginCall call) { notifyState(call); }

    /** {metered}: whether the connection now is metered (mobile data, or a Wi-Fi Android counts as metered, like a
     *  phone's hotspot), for "Only on Wi-Fi": automatic downloads wait until it isn't. */
    @PluginMethod
    public void metered(PluginCall call) {
        ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        JSObject r = new JSObject();
        r.put("metered", cm != null && cm.isActiveNetworkMetered());
        call.resolve(r);
    }
}
