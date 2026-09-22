package work.mindd.sparkflow;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Process;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;

@CapacitorPlugin(name = "AppUsage")
public class AppUsagePlugin extends Plugin {
    private boolean hasAccess() {
        AppOpsManager ops = (AppOpsManager) getContext().getSystemService(android.content.Context.APP_OPS_SERVICE);
        return ops != null && ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(), getContext().getPackageName()) == AppOpsManager.MODE_ALLOWED;
    }

    @PluginMethod public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasAccess());
        call.resolve(result);
    }

    @PluginMethod public void openSettings(PluginCall call) {
        getActivity().startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
        call.resolve();
    }

    @PluginMethod public void discover(PluginCall call) {
        if (!hasAccess()) { call.reject("请先授予使用情况访问权限"); return; }
        UsageStatsManager manager = (UsageStatsManager) getContext().getSystemService(android.content.Context.USAGE_STATS_SERVICE);
        UsageEvents events = manager == null ? null : manager.queryEvents(System.currentTimeMillis() - 86400000L, System.currentTimeMillis());
        if (events == null) { call.reject("系统使用记录暂不可用"); return; }
        Set<String> seen = new HashSet<>();
        JSArray apps = new JSArray();
        UsageEvents.Event event = new UsageEvents.Event();
        while (events.hasNextEvent() && apps.length() < 50) {
            events.getNextEvent(event);
            if (event.getEventType() != UsageEvents.Event.ACTIVITY_RESUMED) continue;
            String name = event.getPackageName();
            if (name == null || name.equals(getContext().getPackageName()) || !seen.add(name)) continue;
            String label = name;
            try {
                PackageManager packages = getContext().getPackageManager();
                label = packages.getApplicationLabel(packages.getApplicationInfo(name, 0)).toString();
            } catch (PackageManager.NameNotFoundException ignored) { }
            JSObject app = new JSObject(); app.put("packageName", name); app.put("appName", label); apps.put(app);
        }
        JSObject result = new JSObject(); result.put("apps", apps); call.resolve(result);
    }

    @PluginMethod public void query(PluginCall call) {
        if (!hasAccess()) { call.reject("请先在 Android 设置中授予使用情况访问权限"); return; }
        Long start = call.getLong("start");
        Long end = call.getLong("end");
        JSONArray requested = call.getArray("packages");
        long now = System.currentTimeMillis();
        if (start == null || end == null || requested == null || requested.length() > 50 ||
            end <= start || end > now + 120000 || start < now - 3 * 86400000L ||
            end - start > 86400000L) {
            call.reject("查询范围无效（最多 24 小时和 50 个应用）"); return;
        }
        Set<String> packages = new HashSet<>();
        try {
            for (int i = 0; i < requested.length(); i++) {
                String name = requested.getString(i);
                if (name == null || !name.matches("[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+") || name.length() > 200) {
                    call.reject("应用包名无效"); return;
                }
                packages.add(name);
            }
        } catch (JSONException exception) { call.reject("应用列表无效"); return; }
        if (packages.isEmpty()) {
            JSObject result = new JSObject(); result.put("intervals", new JSArray()); call.resolve(result); return;
        }

        UsageStatsManager manager = (UsageStatsManager) getContext().getSystemService(android.content.Context.USAGE_STATS_SERVICE);
        UsageEvents events = manager == null ? null : manager.queryEvents(start, end);
        if (events == null) { call.reject("系统使用记录暂不可用，请解锁设备后重试"); return; }
        JSArray intervals = new JSArray();
        UsageEvents.Event event = new UsageEvents.Event();
        String activePackage = null;
        long activeStart = 0;
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            String packageName = event.getPackageName();
            int type = event.getEventType();
            long at = event.getTimeStamp();
            if (type == UsageEvents.Event.ACTIVITY_RESUMED || type == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                if (activePackage != null && !activePackage.equals(packageName)) {
                    addInterval(intervals, packages, activePackage, activeStart, at);
                    activePackage = null;
                }
                if (activePackage == null) { activePackage = packageName; activeStart = at; }
            } else if (activePackage != null && activePackage.equals(packageName) &&
                (type == UsageEvents.Event.ACTIVITY_PAUSED || type == UsageEvents.Event.MOVE_TO_BACKGROUND)) {
                addInterval(intervals, packages, activePackage, activeStart, at);
                activePackage = null;
            } else if (activePackage != null && type == UsageEvents.Event.SCREEN_NON_INTERACTIVE) {
                addInterval(intervals, packages, activePackage, activeStart, at);
                activePackage = null;
            }
            if (intervals.length() >= 200) break;
        }
        // An interval without a closing event is not sent: the device may be idle or the app still in use.
        JSObject result = new JSObject();
        result.put("intervals", intervals);
        call.resolve(result);
    }

    private void addInterval(JSArray output, Set<String> packages, String name, long start, long end) {
        if (!packages.contains(name) || end - start < 10000 || end - start > 4 * 3600000L) return;
        JSObject value = new JSObject();
        value.put("packageName", name);
        value.put("startTime", new java.util.Date(start).toInstant().toString());
        value.put("endTime", new java.util.Date(end).toInstant().toString());
        output.put(value);
    }
}
