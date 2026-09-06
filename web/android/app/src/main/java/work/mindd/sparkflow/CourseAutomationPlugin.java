package work.mindd.sparkflow;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CourseAutomation")
public class CourseAutomationPlugin extends Plugin {
    @PluginMethod public void status(PluginCall call) {
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        AlarmManager alarms = getContext().getSystemService(AlarmManager.class);
        JSObject result = new JSObject();
        result.put("policyAccess", manager.isNotificationPolicyAccessGranted());
        result.put("exactAlarms", Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms());
        result.put("error", CourseAutomationReceiver.preferences(getContext()).getString("error", ""));
        call.resolve(result);
    }
    @PluginMethod public void openSettings(PluginCall call) {
        Intent intent = new Intent("exact".equals(call.getString("kind")) && Build.VERSION.SDK_INT >= 31
            ? Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM : Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
        if (Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM.equals(intent.getAction())) intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(intent); call.resolve();
    }
    @PluginMethod public void sync(PluginCall call) {
        String mode = call.getString("mode", "off");
        if (!mode.equals("off") && !mode.equals("dnd") && !mode.equals("silent")) { call.reject("自动模式无效"); return; }
        if (!mode.equals("off") && !getContext().getSystemService(NotificationManager.class).isNotificationPolicyAccessGranted()) { call.reject("请先授予勿扰访问权限"); return; }
        org.json.JSONArray windows = call.getArray("windows");
        if (windows == null || windows.length() > 10000) { call.reject("课时数据无效"); return; }
        try {
            for (int i = 0; i < windows.length(); i++) {
                org.json.JSONObject window = windows.getJSONObject(i);
                if (window.getLong("end") <= window.getLong("start")) throw new Exception("课时范围无效");
            }
            CourseAutomationReceiver.preferences(getContext()).edit().putString("mode", mode).putString("windows", windows.toString()).apply();
            CourseAutomationReceiver.reconcile(getContext());
            String error = CourseAutomationReceiver.preferences(getContext()).getString("error", "");
            if (!error.isEmpty()) call.reject(error); else call.resolve();
        } catch (Exception e) { call.reject("自动模式更新失败：" + e.getMessage()); }
    }
}
