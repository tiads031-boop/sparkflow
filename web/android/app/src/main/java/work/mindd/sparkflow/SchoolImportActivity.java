package work.mindd.sparkflow;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.*;
import android.widget.*;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.nio.charset.StandardCharsets;

// Separate WebView: school pages never receive the Capacitor bridge or application storage.
public class SchoolImportActivity extends Activity {
    private WebView web;
    private TextView address;
    private String script;
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL);
        layout.setOnApplyWindowInsetsListener((v, insets) -> { v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets; });
        address = new TextView(this); address.setPadding(12, 12, 12, 12); layout.addView(address);
        LinearLayout bar = new LinearLayout(this); layout.addView(bar);
        Button back = new Button(this); back.setText("返回"); bar.addView(back);
        Button parse = new Button(this); parse.setText("解析课表"); bar.addView(parse);
        Button done = new Button(this); done.setText("返回预览"); bar.addView(done);
        web = new WebView(this); layout.addView(web, new LinearLayout.LayoutParams(-1, 0, 1)); setContentView(layout);
        web.getSettings().setJavaScriptEnabled(true); web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false); web.getSettings().setAllowContentAccess(false);
        web.getSettings().setSupportMultipleWindows(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme(); return !"http".equals(scheme) && !"https".equals(scheme);
            }
            @Override public void onPageFinished(WebView view, String url) { address.setText("登录后打开个人课表并查询学期\n" + url); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(SchoolImportActivity.this).setMessage(message).setPositiveButton("确定", (d,w) -> result.confirm()).setOnCancelListener(d -> result.cancel()).show(); return true;
            }
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(SchoolImportActivity.this).setMessage(message).setPositiveButton("确定", (d,w) -> result.confirm()).setNegativeButton("取消", (d,w) -> result.cancel()).setOnCancelListener(d -> result.cancel()).show(); return true;
            }
            @Override public boolean onJsPrompt(WebView view, String url, String message, String initial, JsPromptResult result) {
                EditText input = new EditText(SchoolImportActivity.this); input.setText(initial);
                new AlertDialog.Builder(SchoolImportActivity.this).setMessage(message).setView(input).setPositiveButton("确定", (d,w) -> result.confirm(input.getText().toString())).setNegativeButton("取消", (d,w) -> result.cancel()).setOnCancelListener(d -> result.cancel()).show(); return true;
            }
        });
        try {
            String id = getIntent().getStringExtra("adapter");
            if (id == null || !id.matches("[a-zA-Z0-9_-]+")) throw new Exception();
            script = readAsset("bridge.js") + "\n" + readAsset(id + ".js");
        } catch (Exception e) { Toast.makeText(this, "适配资源缺失，请更新应用", Toast.LENGTH_LONG).show(); finish(); return; }
        back.setOnClickListener(v -> { if (web.canGoBack()) web.goBack(); else finish(); });
        parse.setOnClickListener(v -> web.evaluateJavascript(script, ignored -> Toast.makeText(this, "按页面提示解析，完成后点击返回预览", Toast.LENGTH_LONG).show()));
        done.setOnClickListener(v -> web.evaluateJavascript("JSON.stringify(window.__sparkflowImport || {})", value -> {
            try {
                Object decoded = new JSONTokener(value).nextValue();
                if (!(decoded instanceof String) || ((String) decoded).length() > 400000) throw new Exception();
                JSONObject data = new JSONObject((String) decoded);
                if (!data.optBoolean("complete")) { Toast.makeText(this, "解析尚未完成，请完成页面提示后重试", Toast.LENGTH_LONG).show(); return; }
                if (data.optJSONArray("courses") == null || data.getJSONArray("courses").length() == 0) { Toast.makeText(this, data.optString("message", "请先解析课表"), Toast.LENGTH_LONG).show(); return; }
                new AlertDialog.Builder(this).setMessage("将 " + data.getJSONArray("courses").length() + " 条排课带回 SparkFlow 预览？")
                    .setPositiveButton("返回预览", (d,w) -> { setResult(RESULT_OK, new Intent().putExtra("schedule", data.toString())); finish(); }).setNegativeButton("继续", null).show();
            } catch (Exception e) { Toast.makeText(this, "未获取有效课表或数据过大", Toast.LENGTH_LONG).show(); }
        }));
        web.loadUrl(getIntent().getStringExtra("url"));
    }
    private String readAsset(String name) throws Exception {
        try (java.io.InputStream stream = getAssets().open("public/school-adapters/" + name); java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            byte[] bytes = new byte[8192]; int count;
            while ((count = stream.read(bytes)) != -1) out.write(bytes, 0, count);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }
    @Override protected void onDestroy() { if (web != null) { web.stopLoading(); web.destroy(); } super.onDestroy(); }
}
