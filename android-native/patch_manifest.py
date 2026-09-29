from pathlib import Path

p = Path('android/app/src/main/AndroidManifest.xml')
s = p.read_text(encoding='utf-8')

permission = '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n'
if 'android.permission.POST_NOTIFICATIONS' not in s:
    manifest_start = s.find('<manifest')
    idx = s.find('>', manifest_start) + 1
    s = s[:idx] + '\n' + permission + s[idx:]

service = '''
        <service
            android:name=".WhatsAppNotificationService"
            android:label="BAKR PRO WhatsApp Monitor"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
'''

if 'WhatsAppNotificationService' not in s:
    s = s.replace('</application>', service + '    </application>')

p.write_text(s, encoding='utf-8')
