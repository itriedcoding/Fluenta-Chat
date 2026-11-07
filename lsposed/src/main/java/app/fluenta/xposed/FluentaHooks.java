package app.fluenta.xposed;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import de.robv.android.xposed.XC_MethodHook;
import de.robv.android.xposed.XposedBridge;
import de.robv.android.xposed.XposedHelpers;
import de.robv.android.xposed.callbacks.XC_LoadPackage;

/**
 * The real work. Everything here is defensive: a hook that fails is logged and
 * skipped so a Discord update cannot brick the app.
 */
final class FluentaHooks {

    private static final int FLAG_SECURE = WindowManager.LayoutParams.FLAG_SECURE;

    private static volatile String bundle;
    private static volatile boolean installed;

    private FluentaHooks() {
    }

    static void install(XC_LoadPackage.LoadPackageParam lpparam) {
        if (installed) return;
        installed = true;

        String bundleSource = moduleApkPath();
        bundle = readBundle(bundleSource);
        XposedBridge.log("Fluenta: mod bundle "
                + (bundle == null ? "NOT FOUND in " + bundleSource : bundle.length() + " chars"));

        hookSecureFlag();
        hookWebViews();
        hookActivities();

        XposedBridge.log("Fluenta: hooks active (flags, activities, webviews)");
    }

    /** Discord blocks screenshots on several screens; let the user capture again. */
    private static void hookSecureFlag() {
        FluentaModule.safe(() -> XposedHelpers.findAndHookMethod(
                Window.class, "setFlags", int.class, int.class,
                new XC_MethodHook() {
                    @Override
                    protected void beforeHookedMethod(MethodHookParam param) {
                        int flags = (Integer) param.args[0];
                        if ((flags & FLAG_SECURE) != 0) {
                            param.args[0] = flags & ~FLAG_SECURE;
                        }
                    }
                }));

        FluentaModule.safe(() -> XposedHelpers.findAndHookMethod(
                Window.class, "addFlags", int.class,
                new XC_MethodHook() {
                    @Override
                    protected void beforeHookedMethod(MethodHookParam param) {
                        int flags = (Integer) param.args[0];
                        if ((flags & FLAG_SECURE) != 0) {
                            param.args[0] = flags & ~FLAG_SECURE;
                        }
                    }
                }));
    }

    /** Keep Discord's activities in a sane state for the injected panel. */
    private static void hookActivities() {
        FluentaModule.safe(() -> XposedHelpers.findAndHookMethod(
                Activity.class, "onResume",
                new XC_MethodHook() {
                    @Override
                    protected void afterHookedMethod(MethodHookParam param) {
                        Activity activity = (Activity) param.thisObject;
                        Window window = activity.getWindow();
                        if (window != null) {
                            window.clearFlags(FLAG_SECURE);
                        }
                    }
                }));
    }

    /**
     * Discord renders parts of its UI in WebViews (link handling, OAuth and
     * embedded content). Inject the bundle there, at load time, on the UI thread.
     */
    private static void hookWebViews() {
        FluentaModule.safe(() -> XposedHelpers.findAndHookMethod(
                WebView.class, "loadUrl", String.class,
                new XC_MethodHook() {
                    @Override
                    protected void afterHookedMethod(MethodHookParam param) {
                        final WebView view = (WebView) param.thisObject;
                        final String url = (String) param.args[0];
                        if (view == null || url == null || !url.contains("discord.com")) return;
                        inject(view);
                    }
                }));
    }

    private static void inject(final WebView view) {
        final String source = bundle;
        if (source == null || source.isEmpty()) return;

        Handler handler = new Handler(Looper.getMainLooper());
        handler.postDelayed(() -> FluentaModule.safe(() -> {
            view.evaluateJavascript(source, null);
            XposedBridge.log("Fluenta: bundle injected into " + view.getUrl());
        }), 1200L);
    }

    /**
     * Path of this module's own APK. LSPosed loads module classes straight out
     * of the APK, so the code source location is that file. (The older API 82
     * exposes no modulePath field on LoadPackageParam.)
     */
    private static String moduleApkPath() {
        try {
            java.security.CodeSource source = FluentaHooks.class.getProtectionDomain().getCodeSource();
            if (source != null && source.getLocation() != null) {
                return new File(source.getLocation().toURI()).getAbsolutePath();
            }
        } catch (Throwable error) {
            XposedBridge.log(error);
        }
        return null;
    }

    /** Reads assets/fluenta.js out of this module's own APK. */
    private static String readBundle(String modulePath) {
        if (modulePath == null) return null;
        File apk = new File(modulePath);
        if (!apk.exists()) return null;

        try (ZipFile zip = new ZipFile(apk)) {
            ZipEntry entry = zip.getEntry("assets/fluenta.js");
            if (entry == null) return null;
            try (InputStream stream = zip.getInputStream(entry)) {
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] chunk = new byte[8192];
                int read;
                while ((read = stream.read(chunk)) != -1) {
                    buffer.write(chunk, 0, read);
                }
                return buffer.toString(StandardCharsets.UTF_8.name());
            }
        } catch (Throwable error) {
            XposedBridge.log(error);
            return null;
        }
    }
}
