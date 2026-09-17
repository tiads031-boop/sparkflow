package work.mindd.sparkflow;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;
import org.json.JSONTokener;

import java.nio.charset.StandardCharsets;

// Separate WebView: school pages never receive the Capacitor bridge or application storage.
public class SchoolImportActivity extends Activity {
    private static final int BG = Color.rgb(244, 244, 246);
    private static final int SURFACE = Color.WHITE;
    private static final int TEXT = Color.rgb(36, 36, 36);
    private static final int MUTED = Color.rgb(98, 98, 103);
    private static final int BORDER = Color.rgb(229, 229, 233);
    private static final int ACCENT = Color.rgb(202, 227, 147);
    private static final int ERROR = Color.rgb(180, 35, 24);
    private static final int SUCCESS = Color.rgb(47, 110, 70);

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView web;
    private TextView pageLabel;
    private TextView status;
    private Button action;
    private String script;
    private boolean parsing;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        int systemUi = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) systemUi |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        getWindow().getDecorView().setSystemUiVisibility(systemUi);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(
                insets.getSystemWindowInsetLeft(),
                insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(),
                insets.getSystemWindowInsetBottom()
            );
            return insets;
        });

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(16), dp(10), dp(16), dp(10));
        header.setBackgroundColor(SURFACE);
        root.addView(header, new LinearLayout.LayoutParams(-1, -2));

        TextView back = iconButton("‹", "返回");
        back.setOnClickListener(v -> goBackOrClose());
        header.addView(back, new LinearLayout.LayoutParams(dp(44), dp(44)));

        LinearLayout titleBlock = new LinearLayout(this);
        titleBlock.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, -2, 1f);
        titleParams.setMargins(dp(12), 0, dp(12), 0);
        header.addView(titleBlock, titleParams);

        TextView eyebrow = label("教务课表导入", 12, MUTED, false);
        titleBlock.addView(eyebrow);
        TextView title = label("获取课表", 22, TEXT, true);
        titleBlock.addView(title);

        TextView close = iconButton("×", "关闭");
        close.setOnClickListener(v -> finish());
        header.addView(close, new LinearLayout.LayoutParams(dp(44), dp(44)));

        LinearLayout pageCard = new LinearLayout(this);
        pageCard.setGravity(Gravity.CENTER_VERTICAL);
        pageCard.setPadding(dp(14), dp(9), dp(14), dp(9));
        pageCard.setBackground(rounded(SURFACE, dp(16), BORDER, 1));
        LinearLayout.LayoutParams pageCardParams = new LinearLayout.LayoutParams(-1, -2);
        pageCardParams.setMargins(dp(14), dp(10), dp(14), dp(8));
        root.addView(pageCard, pageCardParams);

        TextView dot = label("●", 10, ACCENT, true);
        pageCard.addView(dot);
        pageLabel = label("正在打开教务系统…", 12, MUTED, false);
        LinearLayout.LayoutParams pageLabelParams = new LinearLayout.LayoutParams(0, -2, 1f);
        pageLabelParams.setMargins(dp(8), 0, 0, 0);
        pageCard.addView(pageLabel, pageLabelParams);

        web = new WebView(this);
        web.setBackgroundColor(SURFACE);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setSupportMultipleWindows(false);
        web.getSettings().setUseWideViewPort(true);
        web.getSettings().setLoadWithOverviewMode(true);
        web.getSettings().setBuiltInZoomControls(true);
        web.getSettings().setDisplayZoomControls(false);
        web.setInitialScale(72);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                return !"http".equals(scheme) && !"https".equals(scheme);
            }

            @Override public void onPageFinished(WebView view, String url) {
                Uri uri = Uri.parse(url);
                String host = uri.getHost();
                pageLabel.setText(host == null ? "教务系统" : host);
                boolean timetable = url.contains("xskbcx") || url.contains("kbcx") || url.contains("xskb");
                if (timetable) {
                    injectTimetableViewport();
                    setStatus("已进入课表页面。确认学期和课程已显示后，点击“解析当前课表”。", MUTED);
                } else {
                    setStatus("请完成登录，进入“个人课表查询”，选择学期并点击查询。", MUTED);
                }
            }

            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    setStatus("页面加载失败，请检查校园网、VPN 或教务系统是否可访问。", ERROR);
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(SchoolImportActivity.this)
                    .setMessage(message)
                    .setPositiveButton("确定", (dialog, which) -> result.confirm())
                    .setOnCancelListener(dialog -> result.cancel())
                    .show();
                return true;
            }

            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(SchoolImportActivity.this)
                    .setMessage(message)
                    .setPositiveButton("确定", (dialog, which) -> result.confirm())
                    .setNegativeButton("取消", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel())
                    .show();
                return true;
            }

            @Override public boolean onJsPrompt(WebView view, String url, String message, String initial, JsPromptResult result) {
                EditText input = new EditText(SchoolImportActivity.this);
                input.setText(initial);
                new AlertDialog.Builder(SchoolImportActivity.this)
                    .setMessage(message)
                    .setView(input)
                    .setPositiveButton("确定", (dialog, which) -> result.confirm(input.getText().toString()))
                    .setNegativeButton("取消", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel())
                    .show();
                return true;
            }
        });
        LinearLayout.LayoutParams webParams = new LinearLayout.LayoutParams(-1, 0, 1f);
        webParams.setMargins(dp(14), 0, dp(14), 0);
        web.setBackground(rounded(SURFACE, dp(20), BORDER, 1));
        root.addView(web, webParams);

        LinearLayout bottom = new LinearLayout(this);
        bottom.setOrientation(LinearLayout.VERTICAL);
        bottom.setPadding(dp(16), dp(12), dp(16), dp(12));
        bottom.setBackgroundColor(SURFACE);
        root.addView(bottom, new LinearLayout.LayoutParams(-1, -2));

        status = label("请先登录并打开个人课表。", 12, MUTED, false);
        status.setLineSpacing(0f, 1.12f);
        bottom.addView(status, new LinearLayout.LayoutParams(-1, -2));

        action = new Button(this);
        action.setAllCaps(false);
        action.setText("解析当前课表");
        action.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        action.setTextColor(ACCENT);
        action.setGravity(Gravity.CENTER);
        action.setMinHeight(dp(52));
        action.setStateListAnimator(null);
        action.setBackground(rounded(TEXT, dp(18), TEXT, 0));
        action.setOnClickListener(v -> startParse());
        LinearLayout.LayoutParams actionParams = new LinearLayout.LayoutParams(-1, dp(54));
        actionParams.setMargins(0, dp(10), 0, 0);
        bottom.addView(action, actionParams);

        TextView cancel = label("返回 SparkFlow", 13, MUTED, true);
        cancel.setGravity(Gravity.CENTER);
        cancel.setPadding(0, dp(12), 0, dp(2));
        cancel.setOnClickListener(v -> finish());
        bottom.addView(cancel, new LinearLayout.LayoutParams(-1, -2));

        setContentView(root);

        try {
            String id = getIntent().getStringExtra("adapter");
            if (id == null || !id.matches("[a-zA-Z0-9_-]+")) throw new Exception();
            script = readAsset("bridge.js") + "\n" + readAsset(id + ".js");
        } catch (Exception error) {
            Toast.makeText(this, "适配资源缺失，请更新应用", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        String url = getIntent().getStringExtra("url");
        if (url == null || url.isEmpty()) {
            Toast.makeText(this, "教务地址无效", Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        web.loadUrl(url);
    }

    private void startParse() {
        if (parsing) return;
        parsing = true;
        action.setEnabled(false);
        action.setText("正在解析…");
        setStatus("正在识别课程、周次、节次与教室信息…", MUTED);

        String quoted = JSONObject.quote(script);
        String wrapped = "(function(){try{var r=eval(" + quoted + ");Promise.resolve(r).catch(function(e){if(window.__sparkflowReportError){window.__sparkflowReportError(e);}});}catch(e){if(window.__sparkflowReportError){window.__sparkflowReportError(e);}}})();";
        web.evaluateJavascript(wrapped, ignored -> pollParseResult(0));
    }

    private void pollParseResult(int attempt) {
        if (!parsing || web == null) return;
        web.evaluateJavascript("JSON.stringify(window.__sparkflowImport || {})", value -> {
            try {
                Object decoded = new JSONTokener(value).nextValue();
                if (!(decoded instanceof String)) throw new Exception();
                JSONObject data = new JSONObject((String) decoded);
                String error = data.optString("error", "");
                String message = data.optString("message", "");
                if (!error.isEmpty()) {
                    failParse(error);
                    return;
                }
                if (data.optBoolean("complete") && data.optJSONArray("courses") != null && data.optJSONArray("courses").length() > 0) {
                    completeParse(data);
                    return;
                }
                if (!message.isEmpty()) setStatus(message, MUTED);
            } catch (Exception ignored) {
                // Keep polling; the adapter may still be initializing its state.
            }

            if (attempt >= 40) {
                failParse("未在当前页面读取到完整课表。请确认已选择学期并点击查询，然后重试。");
            } else {
                handler.postDelayed(() -> pollParseResult(attempt + 1), 300);
            }
        });
    }

    private void completeParse(JSONObject data) {
        parsing = false;
        int count = data.optJSONArray("courses") == null ? 0 : data.optJSONArray("courses").length();
        setStatus("已识别 " + count + " 条排课，正在返回 SparkFlow 预览…", SUCCESS);
        action.setText("解析完成");
        Toast.makeText(this, "已识别 " + count + " 条排课", Toast.LENGTH_SHORT).show();
        handler.postDelayed(() -> {
            Intent result = new Intent().putExtra("schedule", data.toString());
            setResult(RESULT_OK, result);
            finish();
        }, 450);
    }

    private void failParse(String message) {
        parsing = false;
        action.setEnabled(true);
        action.setText("重新解析");
        setStatus(message == null || message.trim().isEmpty() ? "解析未完成，请确认课表已加载后重试。" : message, ERROR);
    }

    private void injectTimetableViewport() {
        String js = "(function(){try{document.documentElement.style.minWidth='980px';document.body.style.minWidth='980px';var m=document.querySelector('meta[name=viewport]');if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}m.content='width=980,initial-scale=0.42,minimum-scale=0.25,maximum-scale=3,user-scalable=yes';}catch(e){}})();";
        web.evaluateJavascript(js, null);
    }

    private void goBackOrClose() {
        if (web != null && web.canGoBack()) web.goBack();
        else finish();
    }

    private TextView iconButton(String text, String description) {
        TextView view = label(text, 28, TEXT, false);
        view.setGravity(Gravity.CENTER);
        view.setContentDescription(description);
        view.setBackground(rounded(SURFACE, dp(16), BORDER, 1));
        return view;
    }

    private TextView label(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        view.setTextColor(color);
        if (bold) view.setTypeface(view.getTypeface(), android.graphics.Typeface.BOLD);
        return view;
    }

    private GradientDrawable rounded(int fill, int radius, int stroke, int strokeWidth) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(radius);
        if (strokeWidth > 0) drawable.setStroke(dp(strokeWidth), stroke);
        return drawable;
    }

    private void setStatus(String message, int color) {
        if (status == null) return;
        status.setText(message);
        status.setTextColor(color);
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }

    private String readAsset(String name) throws Exception {
        try (
            java.io.InputStream stream = getAssets().open("public/school-adapters/" + name);
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()
        ) {
            byte[] bytes = new byte[8192];
            int count;
            while ((count = stream.read(bytes)) != -1) out.write(bytes, 0, count);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    @Override public void onBackPressed() {
        goBackOrClose();
    }

    @Override protected void onDestroy() {
        parsing = false;
        handler.removeCallbacksAndMessages(null);
        if (web != null) {
            web.stopLoading();
            web.destroy();
        }
        super.onDestroy();
    }
}
