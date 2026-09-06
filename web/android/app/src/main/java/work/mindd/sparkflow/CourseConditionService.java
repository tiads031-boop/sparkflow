package work.mindd.sparkflow;
import android.net.Uri;
import android.service.notification.ConditionProviderService;
public class CourseConditionService extends ConditionProviderService {
    private static CourseConditionService instance;
    @Override public void onConnected() { instance = this; CourseAutomationReceiver.reconcile(this); publish(CourseAutomationReceiver.preferences(this).getBoolean("dndApplied", false)); }
    @Override public void onSubscribe(Uri id) { publish(CourseAutomationReceiver.preferences(this).getBoolean("dndApplied", false)); }
    @Override public void onUnsubscribe(Uri id) { }
    @Override public void onDestroy() { instance = null; super.onDestroy(); }
    static void publish(boolean active) { if (instance != null) instance.notifyCondition(CourseAutomationReceiver.condition(active)); }
}
