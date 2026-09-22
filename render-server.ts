import http from 'node:http';

const PORT = Number(process.env.PORT || 10000);

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.end(JSON.stringify(data));
}

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 30 * 1024 * 1024) {
        reject(new Error('الملف كبير جدًا'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('بيانات الطلب غير صالحة')); }
    });
    req.on('error', reject);
  });
}

function extractOutputText(result: any): string {
  if (typeof result?.output_text === 'string') return result.output_text.trim();
  const parts: string[] = [];
  for (const item of result?.output ?? []) {
    for (const c of item?.content ?? []) {
      if (typeof c?.text === 'string') parts.push(c.text);
    }
  }
  return parts.join('\n').trim();
}

function cleanJsonText(text: string) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function numberValue(value: unknown): number {
  const s = String(value ?? '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/,/g, '').replace(/[^\d.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function textValue(value: unknown): string { return String(value ?? '').trim(); }

function joinText(a: string, b: string): string {
  const values = [...a.split(' / '), ...b.split(' / ')].map(v => v.trim()).filter(Boolean);
  return [...new Set(values)].join(' / ');
}

type DayRow = {
  day: number; workType: string; tripType: string; tripPrice: number;
  expenseType: string; expenseAmount: number; notes: string;
};

function normalizeRows(source: any[], daysInMonth: number): DayRow[] {
  const byDay = new Map<number, DayRow>();
  for (const r of source) {
    const day = numberValue(r?.day ?? r?.['اليوم']);
    if (!Number.isInteger(day) || day < 1 || day > daysInMonth) continue;
    const row: DayRow = {
      day,
      workType: textValue(r?.workType ?? r?.work ?? r?.details ?? r?.['نوع العمل'] ?? r?.['تفاصيل']),
      tripType: textValue(r?.tripType ?? r?.location ?? r?.['موقع العمل'] ?? r?.['الموقع']),
      tripPrice: numberValue(r?.tripPrice ?? r?.income ?? r?.amount ?? r?.['الدخل'] ?? r?.['المبلغ']),
      expenseType: textValue(r?.expenseType ?? r?.['نوع المصروف']),
      expenseAmount: numberValue(r?.expenseAmount ?? r?.outgoing ?? r?.['الخرج'] ?? r?.['مبلغ المصروف']),
      notes: textValue(r?.notes ?? r?.['ملاحظات']),
    };
    const old = byDay.get(day);
    if (!old) byDay.set(day, row);
    else byDay.set(day, {
      day,
      workType: joinText(old.workType, row.workType),
      tripType: joinText(old.tripType, row.tripType),
      tripPrice: old.tripPrice + row.tripPrice,
      expenseType: joinText(old.expenseType, row.expenseType),
      expenseAmount: old.expenseAmount + row.expenseAmount,
      notes: joinText(old.notes, row.notes),
    });
  }
  return [...byDay.values()]
    .filter(r => r.workType || r.tripType || r.tripPrice || r.expenseType || r.expenseAmount || r.notes)
    .sort((a,b) => a.day-b.day);
}

async function analyze(body: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY غير موجود في إعدادات Render');

  const imageDataUrl = body?.imageDataUrl;
  const pdfDataUrl = body?.pdfDataUrl;
  const fileName = textValue(body?.fileName || 'monthly-file');
  const year = Number(body?.year || new Date().getFullYear());
  const month = Number(body?.month || new Date().getMonth() + 1);
  const daysInMonth = Number(body?.daysInMonth || new Date(year, month, 0).getDate());
  const equipmentName = textValue(body?.equipmentName);

  if (!imageDataUrl && !pdfDataUrl) throw new Error('لم يتم إرسال صورة أو ملف PDF');

  const prompt = `أنت محلل حسابات عربية لتطبيق BAAKR PRO.
اقرأ المستند المرفق بدقة، سواء كان جدول حساب شهري أو كشف حساب.
المعدة: ${equipmentName || 'غير محددة'}
السنة: ${year}
الشهر: ${month}
عدد أيام الشهر: ${daysInMonth}
أعد JSON فقط بالشكل:
{"rows":[{"day":1,"workType":"","tripType":"","tripPrice":0,"expenseType":"","expenseAmount":0,"notes":""}]}
القواعد:
- day هو رقم اليوم من التاريخ.
- الدخل يوضع في tripPrice.
- الخرج/المصروف يوضع في expenseAmount.
- تفاصيل العمل في workType.
- الموقع إن وجد في tripType.
- نوع المصروف أو وصفه في expenseType.
- لا تخترع بيانات غير موجودة.
- احتفظ بكل العمليات حتى لو تكررت عدة عمليات في نفس اليوم.
- الأرقام بدون رموز عملة.
- أعد JSON فقط دون Markdown.`;

  const content: any[] = [{ type: 'input_text', text: prompt }];
  if (pdfDataUrl) {
    content.push({ type: 'input_file', filename: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`, file_data: pdfDataUrl });
  } else {
    content.push({ type: 'input_image', image_url: imageDataUrl, detail: 'high' });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5',
      input: [{ role: 'user', content }],
    }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || result?.message || `OpenAI API error (${response.status})`);

  const outputText = extractOutputText(result);
  if (!outputText) throw new Error('لم يرجع نموذج التحليل أي بيانات');

  let parsed: any;
  try { parsed = JSON.parse(cleanJsonText(outputText)); }
  catch { throw new Error('تعذر قراءة نتيجة التحليل كبيانات JSON'); }

  const source =
    Array.isArray(parsed?.rows) ? parsed.rows :
    Array.isArray(parsed?.data?.rows) ? parsed.data.rows :
    Array.isArray(parsed?.data) ? parsed.data :
    Array.isArray(parsed) ? parsed : [];

  const rows = normalizeRows(source, daysInMonth);
  if (!rows.length) throw new Error(pdfDataUrl ? 'لم يتم العثور على بيانات واضحة في ملف PDF' : 'لم يتم العثور على بيانات واضحة في الصورة');

  return { success: true, sourceType: pdfDataUrl ? 'pdf' : 'image', count: rows.length, rows };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return res.end();
  }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    return sendJson(res, 200, { ok: true, service: 'BAAKR PRO Monthly Import API' });
  }
  if (req.method === 'POST' && req.url === '/api/monthly-image-import') {
    try {
      const body = await readJson(req);
      return sendJson(res, 200, await analyze(body));
    } catch (error: any) {
      console.error(error);
      return sendJson(res, 400, { success: false, error: error?.message || 'تعذر تحليل الملف' });
    }
  }
  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`BAAKR PRO API running on port ${PORT}`);
});
