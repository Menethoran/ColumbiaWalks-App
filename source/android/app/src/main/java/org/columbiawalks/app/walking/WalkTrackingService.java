package org.columbiawalks.app.walking;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.columbiawalks.app.MainActivity;
import org.columbiawalks.app.R;

import java.io.IOException;
import java.time.Instant;

public final class WalkTrackingService extends Service implements LocationListener {
    public static final String ACTION_START =
            "org.columbiawalks.app.walking.START";
    public static final String ACTION_STOP =
            "org.columbiawalks.app.walking.STOP";
    public static final String ACTION_STATUS =
            "org.columbiawalks.app.walking.STATUS";

    private static final String PREFERENCES = "walk_tracking";
    private static final String KEY_RUNNING = "running";
    private static final String KEY_STARTED = "started";
    private static final String KEY_DISTANCE = "distance";
    private static final String KEY_LAST_LATITUDE = "last_latitude";
    private static final String KEY_LAST_LONGITUDE = "last_longitude";
    private static final String KEY_LAST_TIME = "last_time";
    private static final String KEY_HAS_LAST = "has_last";
    private static final String KEY_LAST_COMPLETED_DISTANCE = "last_completed_distance";
    private static final String CHANNEL_ID = "active_walk";
    private static final int NOTIFICATION_ID = 4101;

    private LocationManager locationManager;
    private SharedPreferences preferences;
    private Location lastLocation;
    private double distanceMeters;

    @Override
    public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        preferences = getSharedPreferences(PREFERENCES, MODE_PRIVATE);
        distanceMeters = Double.longBitsToDouble(
                preferences.getLong(KEY_DISTANCE, Double.doubleToLongBits(0))
        );
        if (preferences.getBoolean(KEY_HAS_LAST, false)) {
            lastLocation = new Location("saved");
            lastLocation.setLatitude(Double.longBitsToDouble(
                    preferences.getLong(KEY_LAST_LATITUDE, 0)
            ));
            lastLocation.setLongitude(Double.longBitsToDouble(
                    preferences.getLong(KEY_LAST_LONGITUDE, 0)
            ));
            lastLocation.setTime(preferences.getLong(KEY_LAST_TIME, 0));
        }
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            finishWalk();
            return START_NOT_STICKY;
        }
        startOrResumeWalk();
        return START_STICKY;
    }

    private void startOrResumeWalk() {
        if (!preferences.getBoolean(KEY_RUNNING, false)) {
            distanceMeters = 0;
            lastLocation = null;
            preferences.edit()
                    .putBoolean(KEY_RUNNING, true)
                    .putLong(KEY_STARTED, System.currentTimeMillis())
                    .putLong(KEY_DISTANCE, Double.doubleToLongBits(0))
                    .putBoolean(KEY_HAS_LAST, false)
                    .apply();
        }
        startForeground(NOTIFICATION_ID, buildNotification());
        if (!hasLocationPermission()) {
            clearRunningState();
            stopSelf();
            return;
        }
        String provider = chooseProvider();
        if (provider == null) {
            sendStatus();
            return;
        }
        try {
            locationManager.requestLocationUpdates(provider, 3_000L, 2f, this);
        } catch (SecurityException ignored) {
            clearRunningState();
            stopSelf();
        }
        sendStatus();
    }

    private void finishWalk() {
        if (!preferences.getBoolean(KEY_RUNNING, false)) {
            stopSelf();
            return;
        }
        try {
            locationManager.removeUpdates(this);
        } catch (SecurityException ignored) {
            // No updates are retained after the foreground service stops.
        }
        long started = preferences.getLong(KEY_STARTED, System.currentTimeMillis());
        long ended = System.currentTimeMillis();
        long durationSeconds = Math.max(1, (ended - started) / 1000L);
        try {
            WalkingMetricPayload.queue(
                    this,
                    Instant.ofEpochMilli(started),
                    Instant.ofEpochMilli(ended),
                    distanceMeters,
                    durationSeconds,
                    1,
                    "tracked_walk"
            );
        } catch (IOException ignored) {
            // The UI reports the local queue error on the next user action.
        }
        preferences.edit()
                .putLong(
                        KEY_LAST_COMPLETED_DISTANCE,
                        Double.doubleToLongBits(distanceMeters)
                )
                .apply();
        clearRunningState();
        sendStatus();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) return;
        if (location.hasAccuracy() && location.getAccuracy() > 60f) return;
        if (lastLocation != null) {
            float segment = lastLocation.distanceTo(location);
            long elapsedMillis = Math.max(1, location.getTime() - lastLocation.getTime());
            double metersPerSecond = segment / (elapsedMillis / 1000d);
            if (segment >= 1f && segment <= 500f && metersPerSecond <= 12d) {
                distanceMeters += segment;
            }
        }
        lastLocation = new Location(location);
        preferences.edit()
                .putLong(KEY_DISTANCE, Double.doubleToLongBits(distanceMeters))
                .putBoolean(KEY_HAS_LAST, true)
                .putLong(
                        KEY_LAST_LATITUDE,
                        Double.doubleToLongBits(location.getLatitude())
                )
                .putLong(
                        KEY_LAST_LONGITUDE,
                        Double.doubleToLongBits(location.getLongitude())
                )
                .putLong(KEY_LAST_TIME, location.getTime())
                .apply();
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.notify(NOTIFICATION_ID, buildNotification());
        sendStatus();
    }

    @Override
    public void onProviderDisabled(String provider) {
        sendStatus();
    }

    @Override
    public void onProviderEnabled(String provider) {
        // The next location update refreshes status.
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
        // Required by LocationListener on Android 8 and 9.
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent openPending = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Intent stopIntent = new Intent(this, WalkTrackingService.class)
                .setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
                this,
                1,
                stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_walk)
                .setContentTitle(getString(R.string.walk_notification_title))
                .setContentText(String.format("%.2f miles · %s",
                        distanceMeters / 1609.344,
                        getString(R.string.walk_notification_text)))
                .setContentIntent(openPending)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .addAction(
                        R.drawable.ic_walk,
                        getString(R.string.walk_notification_stop),
                        stopPending
                )
                .build();
    }

    private void createNotificationChannel() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.walk_notification_channel),
                NotificationManager.IMPORTANCE_LOW
        );
        manager.createNotificationChannel(channel);
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private String chooseProvider() {
        if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            return LocationManager.GPS_PROVIDER;
        }
        return locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
                ? LocationManager.NETWORK_PROVIDER
                : null;
    }

    private void clearRunningState() {
        preferences.edit()
                .putBoolean(KEY_RUNNING, false)
                .putBoolean(KEY_HAS_LAST, false)
                .remove(KEY_STARTED)
                .remove(KEY_DISTANCE)
                .remove(KEY_LAST_LATITUDE)
                .remove(KEY_LAST_LONGITUDE)
                .remove(KEY_LAST_TIME)
                .apply();
    }

    private void sendStatus() {
        Intent status = new Intent(ACTION_STATUS).setPackage(getPackageName());
        status.putExtra("running", preferences.getBoolean(KEY_RUNNING, false));
        status.putExtra("distance_meters", distanceMeters);
        sendBroadcast(status);
    }

    public static boolean isRunning(Context context) {
        return context.getSharedPreferences(PREFERENCES, MODE_PRIVATE)
                .getBoolean(KEY_RUNNING, false);
    }

    public static double distanceMeters(Context context) {
        return Double.longBitsToDouble(
                context.getSharedPreferences(PREFERENCES, MODE_PRIVATE)
                        .getLong(KEY_DISTANCE, Double.doubleToLongBits(0))
        );
    }
}

