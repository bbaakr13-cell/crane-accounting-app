from pathlib import Path
import re

p = Path('android/app/src/main/java/com/crane/accounting/MainActivity.java')
s = p.read_text(encoding='utf-8')

if 'import android.os.Bundle;' not in s:
    s = s.replace('import android.content.Intent;\n', 'import android.content.Intent;\nimport android.os.Bundle;\n', 1)

if 'registerPlugin(WhatsAppMonitorPlugin.class);' not in s:
    pattern = r'(public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s+implements\s+ModifiedMainActivityForSocialLoginPlugin\s*\{\s*)'
    block = '''\n    @Override\n    protected void onCreate(Bundle savedInstanceState) {\n        registerPlugin(WhatsAppMonitorPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n\n'''
    s, count = re.subn(pattern, lambda m: m.group(1) + block, s, count=1)
    if count != 1:
        raise SystemExit('MainActivity class marker not found')

p.write_text(s, encoding='utf-8')
