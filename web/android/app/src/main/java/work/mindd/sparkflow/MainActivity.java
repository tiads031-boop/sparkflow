package work.mindd.sparkflow;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(CourseAutomationPlugin.class);
        registerPlugin(SchoolImportPlugin.class);
        registerPlugin(AppUsagePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
