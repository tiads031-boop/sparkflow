package work.mindd.sparkflow;

import android.app.AlarmManager;
import android.app.AutomaticZenRule;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.service.notification.Condition;
import org.json.JSONArray;
import org.json.JSONObject;

public class CourseAutomationReceiver extends BroadcastReceiver {
    static final Uri CONDITION = Uri.parse("condition://work.mindd.sparkflow/course");
    static SharedPreferences preferences(Context context) { return context.getSharedPreferences("course-automation", Context.MODE_PRIVATE); }
    @Override public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) preferences(context).edit().remove("dndApplied").apply();
        reconcile(context);
    }
    static Condition condition(boolean active) { return new Condition(CONDITION, "SparkFlow 上课期间", active ? Condition.STATE_TRUE : Condition.STATE_FALSE); }
    static synchronized void reconcile(Context context) {
        SharedPreferences prefs = preferences(context);
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        PendingIntent alarm = PendingIntent.getBroadcast(context, 1600000000, new Intent(context, CourseAutomationReceiver.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        alarms.cancel(alarm);
        long now = System.currentTimeMillis(), next = Long.MAX_VALUE;
        boolean active = false;
        String mode = prefs.getString("mode", "off");
        try {
            if (!mode.equals("off")) {
                JSONArray windows = new JSONArray(prefs.getString("windows", "[]"));
                for (int i = 0; i < windows.length(); i++) {
                    JSONObject window = windows.getJSONObject(i);
                    long start = window.getLong("start"), end = window.getLong("end");
                    active |= start <= now && end > now;
                    if (start > now) next = Math.min(next, start);
                    if (end > now) next = Math.min(next, end);
                }
            }
            // Schedule restoration before changing any system setting.
            if (next != Long.MAX_VALUE) {
                if (Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarm);
                else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarm);
            }
            NotificationManager notifications = context.getSystemService(NotificationManager.class);
            AudioManager audio = context.getSystemService(AudioManager.class);
            boolean silent = active && mode.equals("silent");
            boolean wasSilent = prefs.getBoolean("silentApplied", false);
            if (wasSilent && !silent) {
                if (audio.getRingerMode() == AudioManager.RINGER_MODE_SILENT) audio.setRingerMode(prefs.getInt("previousRinger", AudioManager.RINGER_MODE_NORMAL));
                prefs.edit().putBoolean("silentApplied", false).apply();
            }
            if (silent && !wasSilent) {
                prefs.edit().putInt("previousRinger", audio.getRingerMode()).putBoolean("silentApplied", true).apply();
                audio.setRingerMode(AudioManager.RINGER_MODE_SILENT);
            }
            boolean dnd = active && mode.equals("dnd");
            String ruleId = prefs.getString("ruleId", null);
            boolean newRule = false;
            if (dnd && !notifications.isNotificationPolicyAccessGranted()) throw new SecurityException("勿扰权限未开启");
            if (notifications.isNotificationPolicyAccessGranted()) {
                if (dnd && (ruleId == null || notifications.getAutomaticZenRule(ruleId) == null)) {
                    ruleId = notifications.addAutomaticZenRule(new AutomaticZenRule("SparkFlow 上课勿扰", new ComponentName(context, CourseConditionService.class), CONDITION, NotificationManager.INTERRUPTION_FILTER_PRIORITY, true));
                    prefs.edit().putString("ruleId", ruleId).apply();
                    newRule = true;
                }
                if (ruleId != null && (newRule || dnd != prefs.getBoolean("dndApplied", false) || !prefs.contains("dndApplied"))) {
                    if (Build.VERSION.SDK_INT >= 29) notifications.setAutomaticZenRuleState(ruleId, condition(dnd));
                    else CourseConditionService.publish(dnd);
                }
            }
            prefs.edit().putBoolean("dndApplied", dnd).putString("error", "").apply();
        } catch (Exception e) { prefs.edit().putString("error", "自动模式无法更新，请检查系统权限：" + e.getMessage()).apply(); }
    }
}
