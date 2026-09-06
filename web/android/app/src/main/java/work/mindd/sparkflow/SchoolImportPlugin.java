package work.mindd.sparkflow;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name = "SchoolImport")
public class SchoolImportPlugin extends Plugin {
    @PluginMethod public void open(PluginCall call) {
        String url = call.getString("url", ""), adapter = call.getString("adapter", "");
        Uri uri = Uri.parse(url);
        if ((!"https".equals(uri.getScheme()) && !"http".equals(uri.getScheme())) || uri.getHost() == null || !adapter.matches("[a-zA-Z0-9_-]+")) { call.reject("教务地址或适配器无效"); return; }
        Intent intent = new Intent(getActivity(), SchoolImportActivity.class);
        intent.putExtra("url", url); intent.putExtra("adapter", adapter);
        startActivityForResult(call, intent, "importResult");
    }
    @ActivityCallback private void importResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { call.reject("已取消教务导入"); return; }
        try { call.resolve(new JSObject(result.getData().getStringExtra("schedule"))); }
        catch (Exception e) { call.reject("教务返回数据无效"); }
    }
}
