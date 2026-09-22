export const config = { runtime: 'edge' };

type DayRow = {
  day: number;
  workType: string;
  tripType: string;
  tripPrice: number;
  expenseType: string;
  expenseAmount: number;
  notes: string;
};

function extractOutputText(result: any): string {
  if (typeof result?.output_text === 'string') return result.output_text.trim();
  let text = '';
  for (const item of result?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') text += content.text;
    }
  }
  return text.trim();
}

function cleanJson(text: string) {
  let v = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const a = v.indexOf('{');
  const b = v.lastIndexOf('}');
  return a >= 0 && b > a ? v.slice(a, b + 1) : v;
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value ?? '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٬,]/g, '')
    .replace(/[^\d.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function textValue(v: unknown) {
  return String(v ?? '').trim();
}

function mergeSameDays(rows: DayRow[]): DayRow[] {
  const map = new Map<number, DayRow>();

  const joinDistinct = (a: string, b: string) => {
    const parts = [...a.split(' / '), ...b.split(' / ')]
      .map(x => x.trim()).filter(Boolean);
    return [...new Set(parts)].join(' / ');
  };

  for (const row of rows) {
    const old = map.get(row.day);
    if (!old) {
      map.set(row.day, { ...row });
      continue;
    }

    map.set(row.day, {
      day: row.day,
      workType: joinDistinct(old.workType, row.workType),
      tripType: joinDistinct(old.tripType, row.tripType),
      tripPrice: old.tripPrice + row.tripPrice,
      expenseType: joinDistinct(old.expenseType, row.expenseType),
      expenseAmount: old.expenseAmount + row.expenseAmount,
      notes: joinDistinct(old.notes, row.notes),
    });
  }

  return [...map.values()].sort((a, b) => a.day - b.day);
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'OPENAI_API_KEY غير موجود في إعدادات السيرفر' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      imageDataUrl,
      pdfDataUrl,
      fileName,
      year,
      month,
      daysInMonth,
      equipmentName,
    } = body || {};

    const hasImage =
      typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/');
    const hasPdf =
      typeof pdfDataUrl === 'string' &&
      /^data:application\/pdf(?:;|,)/i.test(pdfDataUrl);

    if (!hasImage && !hasPdf) {
      return Response.json(
        { error: 'اختر صورة أو ملف PDF صالح' },
        { status: 400 }
      );
    }

    const maxDay = Math.max(28, Math.min(31, Number(daysInMonth) || 31));

    const prompt = `
أنت تستخرج بيانات حسابات كرينات ومعدات من ملفات عربية قديمة.
اقرأ الملف المرفق بصرياً وبعناية كاملة. إذا كان صورة فافحص الجدول داخل الصورة حتى لو كانت لقطة شاشة طويلة أو فيها واجهة هاتف حول الجدول. إذا كان PDF فافحص كل الصفحات. حدد شكل الجدول تلقائياً.

المعدة الحالية: ${equipmentName || 'غير محددة'}
الشهر الذي سيُستورد إليه داخل التطبيق: ${month}/${year}
أيام هذا الشهر: 1 إلى ${maxDay}

الملفات قد تأتي بأحد هذه الأشكال:

النمط A - جدول شهري قديم:
اليوم | نوع العمل | المبلغ | موقع العمل
مثال: 1 | مهرجان | 1000 | ...
في هذا النمط:
day = اليوم
workType = نوع العمل
tripType = موقع العمل
tripPrice = المبلغ
ولا تجعل المبلغ مصروفاً إلا إذا كان واضحاً أنه مصروف.

النمط B - كشف حساب:
الرقم | التاريخ | تفاصيل | الخرج | الدخل | الرصيد
في هذا النمط:
- لا تستخدم عمود "الرقم" كرقم اليوم.
- استخرج رقم اليوم من "التاريخ".
- "تفاصيل" توضع في workType.
- "الدخل" يوضع في tripPrice.
- "الخرج" يوضع في expenseAmount.
- إذا كان هناك خرج، ضع وصف التفاصيل أيضاً في expenseType.
- "الرصيد" تراكمي، تجاهله تماماً ولا تستورده كمبلغ.
- تجاهل الإجمالي والباقي والرصيد النهائي والملاحظات العامة.

النمط C - كشف حساب متعدد الصفحات:
طبق قواعد النمط B على جميع الصفحات، ولا تتوقف عند الصفحة الأولى.

قواعد مهمة جداً:
1) افحص كل صفحة وكل صف. في الصور: اقرأ الجدول داخل الصورة حتى لو كان صغيراً أو محاطاً بواجهة الهاتف أو بهوامش.
2) تجاهل العناوين والشعارات وأرقام الهاتف وأرقام الصفحات.
3) تجاهل الصفوف الفارغة.
4) لا تخترع أي بيانات.
5) الأرقام قد تكون عربية ٠١٢٣٤٥٦٧٨٩ أو إنجليزية 0123456789.
6) المبالغ قد تحتوي فواصل مثل 5,000.
7) لا تعتبر الرصيد مبلغ عمل أو مصروف.
8) لا تعتبر رقم الحركة/الرقم رقم يوم.
9) في كشف الحساب استخدم يوم التاريخ حتى لو كان كل الصفوف في اليوم نفسه.
10) إذا تكرر اليوم عدة مرات أرجع كل العمليات كصفوف منفصلة؛ السيرفر سيجمعها لاحقاً لصف اليوم الواحد.
11) إذا كان التاريخ مطبوعاً على سطرين مثل 28/10/202 ثم 5، فاقرأه 28/10/2025.
12) إذا كان الملف لشهر مختلف عن الشهر المحدد في التطبيق، لا ترفضه؛ استخرج الأيام كما تظهر في الملف.
13) أي صف "استلم..." أو تحويل/صرافة: اعتمد مكان الرقم في عمود الدخل أو الخرج، لا تخمن من النص وحده.
14) في جدول اليوم/نوع العمل/المبلغ/الموقع، المبلغ هو دخل tripPrice ما لم يوجد دليل واضح أنه مصروف.
15) لا تضف يوم 32 أو أي يوم خارج 1-${maxDay}.
16) إذا كانت الصورة لجدول شهري بعناوين مثل اليوم/نوع العمل/المبلغ/موقع العمل، استخرج كل الصفوف المقروءة ولا ترجع rows فارغة.
17) إذا كان بعض النص غير واضح، استخرج الصفوف الواضحة واترك الحقل غير الواضح فارغاً بدلاً من إسقاط الصف كله.

أعد JSON فقط، بدون markdown أو شرح:
{
  "rows": [
    {
      "day": 1,
      "workType": "مهرجان",
      "tripType": "",
      "tripPrice": 1000,
      "expenseType": "",
      "expenseAmount": 0,
      "notes": ""
    }
  ]
}
`;

    const content: any[] = [{ type: 'input_text', text: prompt }];

    if (hasPdf) {
      content.push({
        type: 'input_file',
        filename:
          typeof fileName === 'string' && fileName.trim()
            ? fileName.trim()
            : 'monthly-account.pdf',
        file_data: pdfDataUrl,
      });
    } else {
      content.push({
        type: 'input_image',
        image_url: imageDataUrl,
        detail: 'high',
      });
    }

    const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || 'gpt-5',
        reasoning: { effort: 'medium' },
        input: [{ role: 'user', content }],
        max_output_tokens: 10000,
      }),
    });

    const result = await openAIResponse.json().catch(() => null);

    if (!openAIResponse.ok) {
      console.error('OPENAI API ERROR:', JSON.stringify(result));
      return Response.json(
        {
          error:
            result?.error?.message ||
            `فشل تحليل ${hasPdf ? 'PDF' : 'الصورة'} - HTTP ${openAIResponse.status}`,
        },
        { status: 500 }
      );
    }

    const outputText = extractOutputText(result);
    if (!outputText) {
      return Response.json(
        { error: 'لم يرجع التحليل أي بيانات من الملف' },
        { status: 422 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson(outputText));
    } catch {
      console.error('JSON PARSE ERROR:', outputText);
      return Response.json(
        {
          error: 'تمت قراءة الملف لكن النتيجة لم تكن جدولاً صالحاً',
          debug: outputText.slice(0, 1200),
        },
        { status: 422 }
      );
    }

    const sourceRows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.rows)
        ? parsed.rows
        : Array.isArray(parsed?.data)
          ? parsed.data
          : [];

    if (!sourceRows.length) {
      return Response.json(
        { error: 'تم تحليل الملف لكن لم يتم العثور على صفوف حساب' },
        { status: 422 }
      );
    }

    const normalized: DayRow[] = sourceRows
      .map((row: any) => ({
        day: numberValue(row.day ?? row['اليوم']),
        workType: textValue(
          row.workType ?? row.work ?? row.details ??
          row['نوع العمل'] ?? row['تفاصيل']
        ),
        tripType: textValue(
          row.tripType ?? row.location ??
          row['موقع العمل'] ?? row['الموقع'] ?? row['جهة العمل']
        ),
        tripPrice: numberValue(
          row.tripPrice ?? row.income ?? row.amount ?? row.price ??
          row['الدخل'] ?? row['المبلغ'] ?? row['السعر'] ?? row['قيمة العمل']
        ),
        expenseType: textValue(
          row.expenseType ?? row['نوع المصروف']
        ),
        expenseAmount: numberValue(
          row.expenseAmount ?? row.outgoing ??
          row['الخرج'] ?? row['مبلغ المصروف']
        ),
        notes: textValue(row.notes ?? row['ملاحظات']),
      }))
      .filter(
        row =>
          row.day >= 1 &&
          row.day <= maxDay &&
          Boolean(
            row.workType ||
            row.tripType ||
            row.tripPrice ||
            row.expenseType ||
            row.expenseAmount ||
            row.notes
          )
      );

    const rows = mergeSameDays(normalized);

    if (!rows.length) {
      return Response.json(
        { error: 'تمت قراءة الملف ولكن لم أجد أياماً صالحة للاستيراد' },
        { status: 422 }
      );
    }

    return Response.json({
      success: true,
      sourceType: hasPdf ? 'pdf' : 'image',
      count: rows.length,
      rows,
    });
  } catch (error: any) {
    console.error('MONTHLY IMPORT ERROR:', error);
    return Response.json(
      { error: error?.message || 'حدث خطأ أثناء قراءة ملف الحساب' },
      { status: 500 }
    );
  }
}
