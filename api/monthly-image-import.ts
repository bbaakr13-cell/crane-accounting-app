export const config = {
  runtime: 'edge',
};

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
  if (typeof result?.output_text === 'string') {
    return result.output_text.trim();
  }

  let text = '';

  if (Array.isArray(result?.output)) {
    for (const item of result.output) {
      if (!Array.isArray(item?.content)) continue;

      for (const content of item.content) {
        if (typeof content?.text === 'string') {
          text += content.text;
        }
      }
    }
  }

  return text.trim();
}

function cleanJson(text: string) {
  let value = String(text || '').trim();

  value = value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const firstBrace = value.indexOf('{');
  const lastBrace = value.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    value = value.slice(firstBrace, lastBrace + 1);
  }

  return value;
}

function numberValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value ?? '')
    .replace(/[٠-٩]/g, d =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    )
    .replace(/[۰-۹]/g, d =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    )
    .replace(/[٬,]/g, '')
    .replace(/[^\d.-]/g, '');

  const n = Number(normalized);

  return Number.isFinite(n) ? n : 0;
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            'OPENAI_API_KEY غير موجود في إعدادات السيرفر',
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const {
      imageDataUrl,
      year,
      month,
      daysInMonth,
      equipmentName,
    } = body || {};

    if (
      typeof imageDataUrl !== 'string' ||
      !imageDataUrl.startsWith('data:image/')
    ) {
      return Response.json(
        {
          error: 'الصورة المرسلة غير صالحة',
        },
        { status: 400 }
      );
    }

    const maxDay =
      Math.max(
        28,
        Math.min(
          31,
          Number(daysInMonth) || 31
        )
      );

    const prompt = `
اقرأ صورة جدول حساب شهري عربي بدقة عالية.

هذا جدول حساب قديم لكرين أو معدة.

قد تكون الصورة:
- لقطة شاشة من الجوال.
- صورة PDF.
- جدول صغير داخل مساحة كبيرة.
- الكتابة صغيرة.
- بعض الخانات فارغة.
- الأرقام عربية أو إنجليزية.

المعدة الحالية:
${equipmentName || 'غير محددة'}

الشهر المحدد داخل التطبيق:
${month}/${year}

أريد استخراج صفوف العمل فقط من الجدول.

الجداول القديمة غالباً تحتوي الأعمدة التالية:

اليوم | نوع العمل | المبلغ | موقع العمل

وقد تختلف أسماء الأعمدة قليلاً.

خريطة التحويل:

"اليوم"
=> day

"نوع العمل"
=> workType

"موقع العمل" أو "الموقع" أو "جهة العمل"
=> tripType

"المبلغ" أو "السعر" أو "قيمة العمل"
=> tripPrice

إذا كان الجدول يحتوي عمود مصروفات واضح:
نوع المصروف
=> expenseType

مبلغ المصروف
=> expenseAmount

أي معلومة إضافية
=> notes


قواعد القراءة:

1. افحص كامل الصورة وليس الجزء الأوسط فقط.

2. تجاهل شريط الهاتف وأزرار التطبيق
وأي عناصر ليست من الجدول.

3. اقرأ كل صف يحتوي بيانات فعلية.

4. لا تضف الصفوف الفارغة.

5. لا تخترع أي كلمة أو رقم غير ظاهر.

6. إذا لم تستطع قراءة نص معين:
ضع النص "".

7. إذا لم تستطع قراءة مبلغ:
ضع 0.

8. رقم اليوم يجب أن يكون بين 1 و ${maxDay}.

9. لا تعتبر أرقام الأيام مبالغ.

10. لا تعتبر الإجمالي في أسفل الصفحة صف عمل.

11. إذا كان الجدول يحتوي فقط على:
اليوم + نوع العمل + المبلغ + موقع العمل
فإن "المبلغ" يوضع في tripPrice.

12. لا تضع مبلغ العمل في expenseAmount.

13. expenseAmount يستخدم فقط عندما يكون
هناك مصروف واضح مثل:
ديزل، صيانة، زيت، قطع غيار، أجرة، إلخ.

14. اقرأ الأرقام العربية:
٠١٢٣٤٥٦٧٨٩

وكذلك:
0123456789

15. إذا ظهر نفس اليوم أكثر من مرة،
احتفظ بكل المعلومات المفيدة لذلك اليوم
واجمع وصف النص عند الحاجة.

أعد JSON فقط بالشكل التالي:

{
  "rows": [
    {
      "day": 1,
      "workType": "تحميل",
      "tripType": "خميس مشيط",
      "tripPrice": 500,
      "expenseType": "",
      "expenseAmount": 0,
      "notes": ""
    }
  ]
}

ممنوع كتابة شرح خارج JSON.
`;

    const openAIResponse = await fetch(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          model:
            process.env.OPENAI_VISION_MODEL ||
            'gpt-5.6-luna',

          reasoning: {
            effort: 'medium',
          },

          input: [
            {
              role: 'user',

              content: [
                {
                  type: 'input_text',
                  text: prompt,
                },

                {
                  type: 'input_image',
                  image_url: imageDataUrl,
                  detail: 'high',
                },
              ],
            },
          ],

          max_output_tokens: 6000,
        }),
      }
    );

    const result =
      await openAIResponse
        .json()
        .catch(() => null);

    if (!openAIResponse.ok) {
      console.error(
        'OPENAI API ERROR:',
        JSON.stringify(result)
      );

      return Response.json(
        {
          error:
            result?.error?.message ||
            `فشل تحليل الصورة - HTTP ${openAIResponse.status}`,
        },
        { status: 500 }
      );
    }

    const outputText =
      extractOutputText(result);

    console.log(
      'VISION RAW OUTPUT:',
      outputText
    );

    if (!outputText) {
      return Response.json(
        {
          error:
            'الذكاء لم يرجع نصاً من الصورة',
          debug:
            'empty_output',
        },
        { status: 422 }
      );
    }

    let parsed: any;

    try {
      parsed = JSON.parse(
        cleanJson(outputText)
      );
    } catch (error) {
      console.error(
        'JSON PARSE ERROR:',
        outputText
      );

      return Response.json(
        {
          error:
            'تمت قراءة الصورة لكن النتيجة لم تكن جدولاً صالحاً',
          debug:
            outputText.slice(0, 1000),
        },
        { status: 422 }
      );
    }

    let sourceRows: any[] = [];

    if (Array.isArray(parsed)) {
      sourceRows = parsed;
    } else if (
      Array.isArray(parsed?.rows)
    ) {
      sourceRows = parsed.rows;
    } else if (
      Array.isArray(parsed?.data)
    ) {
      sourceRows = parsed.data;
    }

    if (!sourceRows.length) {
      console.error(
        'NO ROWS RETURNED:',
        parsed
      );

      return Response.json(
        {
          error:
            'تم تحليل الصورة لكن لم يتم العثور على صفوف عمل',
          debug: parsed,
        },
        { status: 422 }
      );
    }

    const rows: DayRow[] =
      sourceRows
        .map((row: any) => {
          const day =
            numberValue(
              row.day ??
              row['اليوم']
            );

          const tripPrice =
            numberValue(
              row.tripPrice ??
              row.amount ??
              row.price ??
              row['المبلغ'] ??
              row['السعر']
            );

          const expenseAmount =
            numberValue(
              row.expenseAmount ??
              row['مبلغ المصروف']
            );

          return {
            day,

            workType:
              String(
                row.workType ??
                row.work ??
                row['نوع العمل'] ??
                ''
              ).trim(),

            tripType:
              String(
                row.tripType ??
                row.location ??
                row['موقع العمل'] ??
                row['الموقع'] ??
                ''
              ).trim(),

            tripPrice,

            expenseType:
              String(
                row.expenseType ??
                row['نوع المصروف'] ??
                ''
              ).trim(),

            expenseAmount,

            notes:
              String(
                row.notes ??
                row['ملاحظات'] ??
                ''
              ).trim(),
          };
        })

        .filter(
          row =>
            row.day >= 1 &&
            row.day <= maxDay
        )

        .sort(
          (a, b) =>
            a.day - b.day
        );

    if (!rows.length) {
      return Response.json(
        {
          error:
            'تمت قراءة الجدول ولكن لم أجد أياماً صالحة للاستيراد',
          debug: sourceRows,
        },
        { status: 422 }
      );
    }

    return Response.json({
      success: true,
      count: rows.length,
      rows,
    });

  } catch (error: any) {
    console.error(
      'MONTHLY IMAGE IMPORT ERROR:',
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          'حدث خطأ أثناء قراءة صورة الحساب',
      },
      { status: 500 }
    );
  }
                  }
