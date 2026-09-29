package com.crane.accounting;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.Normalizer;
import java.util.Locale;

public class WhatsAppNotificationService extends NotificationListenerService {
    private static final String PREFS = "bakr_whatsapp_monitor";
    private static final String CHANNEL_ID = "bakr_whatsapp_opportunities";
    private static final int MAX_ITEMS = 100;

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        String pkg = sbn.getPackageName();
        if (!"com.whatsapp".equals(pkg) && !"com.whatsapp.w4b".equals(pkg)) return;

        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean("enabled", true)) return;

        Notification notification = sbn.getNotification();
        if (notification == null || notification.extras == null) return;

        Bundle extras = notification.extras;
        String title = charSequenceToString(extras.getCharSequence(Notification.EXTRA_TITLE));
        String text = charSequenceToString(extras.getCharSequence(Notification.EXTRA_TEXT));
        String bigText = charSequenceToString(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        String subText = charSequenceToString(extras.getCharSequence(Notification.EXTRA_SUB_TEXT));
        String conversationTitle = charSequenceToString(extras.getCharSequence("android.conversationTitle"));

        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        StringBuilder lineText = new StringBuilder();
        if (lines != null) {
            for (CharSequence line : lines) {
                if (line != null) lineText.append(line).append("\n");
            }
        }

        String message = firstNonEmpty(bigText, text, lineText.toString());
        String combined = (title + " " + subText + " " + conversationTitle + " " + message).trim();
        if (TextUtils.isEmpty(combined)) return;

        JSONArray keywords = parseArray(prefs.getString("keywords", null), defaultKeywords());
        JSONArray areas = parseArray(prefs.getString("areas", null), defaultAreas());

        String matchedKeyword = findMatch(combined, keywords);
        if (TextUtils.isEmpty(matchedKeyword)) return;

        String matchedArea = findMatch(combined, areas);
        boolean requireArea = prefs.getBoolean("requireArea", false);
        if (requireArea && TextUtils.isEmpty(matchedArea)) return;

        long now = System.currentTimeMillis();
        String dedupe = pkg + "|" + title + "|" + message;
        String last = prefs.getString("lastDedupe", "");
        long lastAt = prefs.getLong("lastDedupeAt", 0L);
        if (dedupe.equals(last) && now - lastAt < 15000L) return;

        JSONObject item = new JSONObject();
        try {
            item.put("id", String.valueOf(now) + "-" + Math.abs(combined.hashCode()));
            item.put("timestamp", now);
            item.put("packageName", pkg);
            item.put("appName", "com.whatsapp.w4b".equals(pkg) ? "WhatsApp Business" : "WhatsApp");
            item.put("groupName", firstNonEmpty(conversationTitle, subText, title));
            item.put("sender", !TextUtils.isEmpty(conversationTitle) ? title : subText);
            item.put("message", message);
            item.put("matchedKeyword", matchedKeyword);
            item.put("matchedArea", matchedArea);
        } catch (Exception ignored) {
        }

        saveOpportunity(prefs, item);
        prefs.edit().putString("lastDedupe", dedupe).putLong("lastDedupeAt", now).apply();
        showOpportunityAlert(item, notification.contentIntent);
    }

    private void saveOpportunity(SharedPreferences prefs, JSONObject item) {
        JSONArray oldItems;
        try {
            oldItems = new JSONArray(prefs.getString("opportunities", "[]"));
        } catch (Exception e) {
            oldItems = new JSONArray();
        }

        JSONArray next = new JSONArray();
        next.put(item);
        int limit = Math.min(oldItems.length(), MAX_ITEMS - 1);
        for (int i = 0; i < limit; i++) {
            try {
                next.put(oldItems.get(i));
            } catch (Exception ignored) {
            }
        }
        prefs.edit().putString("opportunities", next.toString()).apply();
    }

    private void showOpportunityAlert(JSONObject item, PendingIntent sourcePendingIntent) {
        ensureChannel();
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Intent appIntent = new Intent(this, MainActivity.class);
        appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            (int) (System.currentTimeMillis() % Integer.MAX_VALUE),
            appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String group = item.optString("groupName", "WhatsApp");
        String message = item.optString("message", "فرصة كرين جديدة");
        String keyword = item.optString("matchedKeyword", "");
        String area = item.optString("matchedArea", "");

        String content = (!TextUtils.isEmpty(area) ? "📍 " + area + " • " : "") +
            (!TextUtils.isEmpty(group) ? group + " • " : "") + message;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("🚨 فرصة كرين جديدة")
            .setContentText(content)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(
                content + (!TextUtils.isEmpty(keyword) ? "\nالكلمة المطابقة: " + keyword : "")
            ))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(sourcePendingIntent != null ? sourcePendingIntent : pendingIntent)
            .setVibrate(new long[]{0, 300, 180, 500, 180, 700});

        if (sourcePendingIntent != null) {
            builder.addAction(getApplicationInfo().icon, "فتح الرسالة في واتساب", sourcePendingIntent);
        }

        manager.notify((int) (System.currentTimeMillis() % Integer.MAX_VALUE), builder.build());
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        NotificationChannel existing = manager.getNotificationChannel(CHANNEL_ID);
        if (existing != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "فرص الكرين من واتساب",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("تنبيهات BAKR PRO عند العثور على طلب كرين أو رافعة في إشعارات واتساب");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 300, 180, 500, 180, 700});
        channel.enableLights(true);
        channel.setLightColor(Color.GREEN);
        manager.createNotificationChannel(channel);
    }

    private String findMatch(String text, JSONArray values) {
        String normalizedText = normalize(text);
        for (int i = 0; i < values.length(); i++) {
            String value = values.optString(i, "").trim();
            if (value.isEmpty()) continue;
            if (normalizedText.contains(normalize(value))) return value;
        }
        return "";
    }

    private String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("[\\u064B-\\u065F\\u0670]", "")
            .replace('أ', 'ا')
            .replace('إ', 'ا')
            .replace('آ', 'ا')
            .replace('ى', 'ي')
            .replace('ة', 'ه')
            .toLowerCase(Locale.ROOT)
            .replaceAll("\\s+", " ")
            .trim();
    }

    private String charSequenceToString(CharSequence value) {
        return value == null ? "" : value.toString().trim();
    }

    private String firstNonEmpty(String... values) {
        for (String value : values) {
            if (!TextUtils.isEmpty(value) && !value.trim().isEmpty()) return value.trim();
        }
        return "";
    }

    private JSONArray parseArray(String raw, JSONArray fallback) {
        if (raw == null || raw.trim().isEmpty()) return fallback;
        try {
            return new JSONArray(raw);
        } catch (Exception ignored) {
            return fallback;
        }
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
