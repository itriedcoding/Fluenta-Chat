package app.fluenta.xposed;

import de.robv.android.xposed.IXposedHookLoadPackage;
import de.robv.android.xposed.XC_MethodHook;
import de.robv.android.xposed.XposedBridge;
import de.robv.android.xposed.callbacks.XC_LoadPackage;

/**
 * Entry point declared in assets/xposed_init. LSPosed loads this class inside
 * Discord's process and calls handleLoadPackage.
 */
public class FluentaModule implements IXposedHookLoadPackage {

    public static final String TARGET = "com.discord";

    @Override
    public void handleLoadPackage(XC_LoadPackage.LoadPackageParam lpparam) {
        if (lpparam == null || !TARGET.equals(lpparam.packageName)) return;

        XposedBridge.log("Fluenta: entering " + lpparam.packageName
                + " (process " + (lpparam.processName == null ? "?" : lpparam.processName) + ")");

        try {
            FluentaHooks.install(lpparam);
        } catch (Throwable error) {
            // Never take Discord down with us.
            XposedBridge.log("Fluenta: hook installation failed");
            XposedBridge.log(error);
        }
    }

    /** Utility used by the hooks to report without crashing Discord. */
    static void safe(Callable action) {
        try {
            action.run();
        } catch (Throwable error) {
            XposedBridge.log(error);
        }
    }

    interface Callable {
        void run() throws Throwable;
    }

    interface HookBody {
        void after(XC_MethodHook.MethodHookParam param) throws Throwable;
    }
}
