package io.github.userofit123.calculator;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Keeps the app running while an update downloads (C-74). The download itself is CalcUpdaterPlugin's thread; without
 * this, leaving the app made Android treat it as a cached background app (frozen or cut off from the network), so the
 * download stopped and ended as "Update failed". A foreground service with the download's progress notification
 * tells Android someone is waiting for it. It does nothing else: no network of its own, and it stops as soon as the
 * download ends.
 */
public class UpdateDownloadService extends Service {
    private static final Object LOCK = new Object();
    /** a download is running and wants the service */
    private static boolean wanted;
    /** the service once it is in the foreground (null before, and after the download ended) */
    private static UpdateDownloadService live;

    /** Starts the service for the running download. Android 12+ refuses it while the app is in the background (an
     *  automatic download the page started then): the download then runs without it, as before. */
    static void begin(Context ctx) {
        synchronized (LOCK) { wanted = true; }
        try { ContextCompat.startForegroundService(ctx, new Intent(ctx, UpdateDownloadService.class)); }
        catch (Exception e) { synchronized (LOCK) { wanted = false; } }
    }

    /** The download ended: the service and its notification go (the plugin then shows "Update ready" or "Update failed"). */
    static void end() {
        UpdateDownloadService s;
        synchronized (LOCK) { wanted = false; s = live; live = null; }
        if (s != null) s.quit();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = CalcUpdaterPlugin.runningNotice(this);
        try {
            // Android requires startForeground after startForegroundService even when the download already ended
            ServiceCompat.startForeground(this, CalcUpdaterPlugin.NOTICE_ID, n,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC : 0);
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        synchronized (LOCK) { if (wanted) { live = this; return START_NOT_STICKY; } }
        quit();
        return START_NOT_STICKY;
    }

    private void quit() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    /** Android 15's 6-hour data-sync limit calls this, but only for apps targeting SDK 35+; harmless until then. It stops the service. */
    public void onTimeout(int startId, int fgsType) {
        synchronized (LOCK) { if (live == this) live = null; }
        quit();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
