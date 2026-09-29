package com.crane.accounting;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Set;

@CapacitorPlugin(
    name = "WhatsAppMonitor",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class WhatsAppMonitorPlugin extends Plugin {
    private static final String PREFS = "bakr_whatsapp_monitor";

    @PluginMethod
    public void isNotificationAccessEnabled(PluginCall call) {
        Set<String> packages = NotificationManagerCompat.getEnabledListenerPackages(getContext());
        JSObject result = new JSObject();
        result.put("enabled", packages.contains(getContext().getPackageName()));
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void requestAlertPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put(
            "granted",
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        );
        call.resolve(result);
    }

    @PluginMethod
    public void getSettings(PluginCall call) {
        SharedPreferences prefs = getPrefs();
        JSObject result = new JSObject();
        result.put("keywords", jsonArrayToJsArray(prefs.getString("keywords", defaultKeywords().toString())));
        result.put("areas", jsonArrayToJsArray(prefs.getString("areas", defaultAreas().toString())));
        result.put("requireArea", prefs.getBoolean("requireArea", false));
        result.put("enabled", prefs.getBoolean("enabled", true));
        call.resolve(result);
    }

    @PluginMethod
    public void setSettings(PluginCall call) {
        JSArray keywords = call.getArray("keywords", new JSArray());
        JSArray areas = call.getArray("areas", new JSArray());
        boolean requireArea = Boolean.TRUE.equals(call.getBoolean("requireArea", false));
        boolean enabled = !Boolean.FALSE.equals(call.getBoolean("enabled", true));

        getPrefs().edit()
            .putString("keywords", keywords.toString())
            .putString("areas", areas.toString())
            .putBoolean("requireArea", requireArea)
            .putBoolean("enabled", enabled)
            .apply();

        JSObject result = new JSObject();
        result.put("keywords", keywords);
        result.put("areas", areas);
        result.put("requireArea", requireArea);
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void getOpportunities(PluginCall call) {
        String raw = getPrefs().getString("opportunities", "[]");
        JSObject result = new JSObject();
        result.put("opportunities", jsonArrayToJsArray(raw));
        call.resolve(result);
    }

    @PluginMethod
    public void clearOpportunities(PluginCall call) {
        getPrefs().edit().putString("opportunities", "[]").apply();
        call.resolve();
    }

    @PluginMethod
    public void openWhatsApp(PluginCall call) {
        boolean business = Boolean.TRUE.equals(call.getBoolean("business", false));
        String primary = business ? "com.whatsapp.w4b" : "com.whatsapp";
        String fallback = business ? "com.whatsapp" : "com.whatsapp.w4b";

        Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(primary);
        if (intent == null) {
            intent = getContext().getPackageManager().getLaunchIntentForPackage(fallback);
        }

        if (intent == null) {
            call.reject("WhatsApp is not installed");
            return;
        }

        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private JSArray jsonArrayToJsArray(String raw) {
        JSArray result = new JSArray();
        try {
            JSONArray array = new JSONArray(raw == null ? "[]" : raw);
            for (int i = 0; i < array.length(); i++) {
                Object value = array.get(i);
                if (value instanceof JSONObject) {
                    result.put(JSObject.fromJSONObject((JSONObject) value));
                } else {
                    result.put(value);
                }
            }
        } catch (Exception ignored) {
        }
        return result;
    }

    private JSONArray defaultKeywords() {
        JSONArray arr = new JSONArray();
        String[] values = {
            "محتاج كرين", "مطلوب كرين", "ابغى كرين", "أبغى كرين",
            "احتاج كرين", "أحتاج كرين", "كرين", "رافعة", "بوم ترك",
            "بومترك", "ونش", "رفع كونتينر", "رفع بركس", "تحميل", "تنزيل"
        };
        for (String value : values) arr.put(value);
        return arr;
    }

    private JSONArray defaultAreas() {
        JSONArray arr = new JSONArray();
        String[] values = {
            "خميس مشيط", "الخميس", "أبها", "ابها", "أحد رفيدة", "احد رفيدة",
            "سراة عبيدة", "ظهران الجنوب", "الحرجة", "تثليث", "النماص", "تنومة",
            "محايل", "عسير"
        };
        for (String value : values) arr.put(value);
        return arr;
    }
}
