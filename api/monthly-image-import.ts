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
  if (typeof result?.output_text === 'string') {
    return result.output_text.trim();
  }

  let text = '';

  for (const item of result?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') {
        text += content.text;
      }
    }
  }

  return text.trim();
}

function cleanJson(text: string) {
  const v = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const a = v.indexOf('{');
  const b = v.lastIndexOf('}');

  return a >= 0 && b > a
    ? v.slice(a, b + 1)
    : v;
}

function numberValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? Math.abs(value)
      : 0;
  }

  const s = String(value ?? '')
    .replace(
      /[٠-٩]/g,
      d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    )
    .replace(
      /[۰-۹]/g,
      d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    )
    .replace(/[٬,]/g, '')
    .replace(/[^\d.-]/g, '');

  const n = Number(s);

  return Number.isFinite(n)
    ? Math.abs(n)
    : 0;
}

function textValue(value: unknown) {
  return String(value ?? '').trim();
}

function mergeSameDays(rows: DayRow[]): DayRow[] {
  const map = new Map<number, DayRow>();

  const joinDistinct = (
    first: string,
    second: string
  ) => {
    const parts = [
      ...first.split(' / '),
      ...second.split(' / '),
    ]
      .map(value => value.trim())
      .filter(Boolean);

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

      workType: joinDistinct(
        old.workType,
        row.workType
      ),

      tripType: joinDistinct(
        old.tripType,
        row.tripType
      ),

      tripPrice:
        old.tripPrice +
        row.tripPrice,

      expenseType: joinDistinct(
        old.expenseType,
        row.expenseType
      ),

      expenseAmount:
        old.expenseAmount +
        row.expenseAmount,

      notes: joinDistinct(
        old.notes,
        row.notes
      ),
    });
  }

  return [...map.values()]
    .sort((a, b) => a.day - b.day);
}

export default async function handler(
  request: Request
) {
  if (request.method !== 'POST') {
    return Response.json(
      {
        error: 'Method not allowed',
      },
      {
        status: 405,
      }
    );
  }

  try {
    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            'OPENAI_API_KEY غير موجود في إعدادات السيرفر',
        },
        {
          status: 500,
        }
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
      typeof imageDataUrl === 'string' &&
      imageDataUrl.startsWith(
        'data:image/'
      );

    const hasPdf =
      typeof pdfDataUrl === 'string' &&
      /^data:application\/pdf(?:;|,)/i.test(
        pdfDataUrl
      );

    if (!hasImage && !hasPdf) {
      return Response.json(
        {
          error:
            'اختر صورة أو ملف PDF صالح',
        },
        {
          status: 400,
        }
      );
    }

    const maxDay = Math.max(
      28,
      Math.min(
        31,
        Number(daysInMonth) || 31
      )
    );

    const prompt = `
أنت تستخرج بيانات حسابات كرينات ومعدات من ملفات عربية قديمة.

اقرأ الملف المرفق بصرياً وبعناية كاملة.

إذا كان صورة:
افحص الجدول داخل الصورة حتى لو كانت لقطة شاشة طويلة أو فيها واجهة هاتف حول الجدول.

إذا كان PDF:
افحص جميع الصفحات ولا تتوقف عند الصفحة الأولى.

حدد شكل الجدول تلقائياً.

المعدة الحالية:
${equipmentName || 'غير محددة'}

الشهر الذي سيُستورد إليه داخل التطبيق:
${month}/${year}

أيام هذا الشهر:
1 إلى ${maxDay}


=========================
النمط A - جدول شهري قديم
=========================

قد تكون الأعمدة:

اليوم | نوع العمل | المبلغ | موقع العمل

مثال:

1 | مهرجان | 1000 | أبها

في هذا النمط:

day = اليوم

workType = نوع العمل

tripType = موقع العمل

tripPrice = المبلغ

expenseType = ""

expenseAmount = 0

ولا تجعل المبلغ مصروفاً إلا إذا كان واضحاً
من الجدول أنه مصروف.


=========================
النمط B - كشف حساب
=========================

قد تكون الأعمدة:

الرقم | التاريخ | تفاصيل | الخرج | الدخل | الرصيد

في هذا النمط:

- لا تستخدم عمود "الرقم" كرقم اليوم.

- استخرج رقم اليوم من عمود "التاريخ".

مثال:

28/10/2025

يصبح:

day = 28

- "تفاصيل" توضع في:

workType

- "الدخل" يوضع في:

tripPrice

- "الخرج" يوضع في:

expenseAmount

- إذا كان هناك مبلغ في الخرج،
ضع وصف التفاصيل أيضاً في:

expenseType

- "الرصيد" تراكمي.

تجاهل الرصيد تماماً.

لا تضع الرصيد في tripPrice.

ولا تضع الرصيد في expenseAmount.


=========================
النمط C - كشف متعدد الصفحات
=========================

طبق قواعد النمط B
على جميع الصفحات.

لا تتوقف عند الصفحة الأولى.


=========================
قواعد مهمة جداً
=========================

1)
افحص كل صفحة وكل صف.

2)
إذا كانت صورة:
اقرأ الجدول حتى لو كان صغيراً
أو محاطاً بواجهة الهاتف.

3)
تجاهل:

العناوين
الشعارات
أرقام الهاتف
أرقام الصفحات
الإجماليات
الرصيد النهائي
الباقي
الملاحظات العامة خارج الجدول.

4)
تجاهل الصفوف الفارغة.

5)
لا تخترع أي بيانات.

6)
الأرقام قد تكون عربية:

٠١٢٣٤٥٦٧٨٩

أو إنجليزية:

0123456789

7)
المبالغ قد تحتوي فواصل:

5,000

8)
لا تعتبر الرصيد مبلغ عمل.

9)
لا تعتبر الرصيد مصروفاً.

10)
لا تعتبر رقم الحركة أو الرقم
رقم اليوم.

11)
في كشف الحساب استخدم يوم التاريخ.

حتى لو تكرر نفس التاريخ عدة مرات،
أرجع كل عملية كصف مستقل.

السيرفر سيجمع العمليات لاحقاً.

12)
إذا كان التاريخ مكتوباً على سطرين مثل:

28/10/202
5

فاقرأه:

28/10/2025

13)
إذا كان الملف لشهر مختلف
عن الشهر المحدد في التطبيق:

لا ترفض الملف.

استخرج رقم اليوم كما يظهر في الملف.

14)
أي صف يحتوي:

استلم
تحويل
صرافة
نقداً
دفعة

لا تعتمد على النص وحده
لتحديد هل هو دخل أو خرج.

اعتمد أولاً على مكان الرقم
في عمود الدخل أو الخرج.

15)
في جدول:

اليوم
نوع العمل
المبلغ
موقع العمل

اعتبر "المبلغ" دخلاً:

tripPrice

إلا إذا كان واضحاً أنه مصروف.

16)
لا تضف أي يوم أقل من 1
أو أكبر من ${maxDay}.

17)
إذا كان بعض النص غير واضح:

استخرج الصف إذا كان اليوم والمبلغ
أو المعلومات الأساسية واضحة.

اترك الحقل غير الواضح فارغاً.

لا تسقط الصف كله بسبب كلمة غير واضحة.

18)
لا تجمع العمليات المتكررة في نفس اليوم.

أرجع كل عملية كصف مستقل.

السيرفر سيقوم بعملية الجمع.

19)
إذا وجدت مبلغاً في عمود الدخل:

tripPrice = المبلغ

expenseAmount = 0

20)
إذا وجدت مبلغاً في عمود الخرج:

expenseAmount = المبلغ

tripPrice = 0

إلا إذا كان الصف نفسه يحتوي
دخلاً وخرجاً فعلياً.

21)
أعد JSON فقط.

ممنوع markdown.

ممنوع الشرح.

ممنوع كتابة نص قبل JSON.

ممنوع كتابة نص بعد JSON.


الشكل المطلوب بالضبط:

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

    const content: any[] = [
      {
        type: 'input_text',
        text: prompt,
      },
    ];

    if (hasPdf) {
      content.push({
        type: 'input_file',

        filename:
          typeof fileName === 'string' &&
          fileName.trim()
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

    /*
     * لا نغير النموذج هنا من الملف الحالي.
     * إذا كان OPENAI_VISION_MODEL موجوداً
     * في Vercel سيستخدمه.
     *
     * وإذا لم يكن موجوداً سيستخدم gpt-5.
     */

    const selectedModel =
      process.env.OPENAI_VISION_MODEL ||
      'gpt-5';

    const openAIResponse =
      await fetch(
        'https://api.openai.com/v1/responses',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            model: selectedModel,

            reasoning: {
              effort: 'medium',
            },

            input: [
              {
                role: 'user',
                content,
              },
            ],

            max_output_tokens: 10000,
          }),
        }
      );

    const result =
      await openAIResponse
        .json()
        .catch(() => null);

    /*
     * ==========================
     * تشخيص خطأ OpenAI نفسه
     * ==========================
     */

    if (!openAIResponse.ok) {
      console.error(
        'OPENAI API ERROR:',
        JSON.stringify(result)
      );

      return Response.json(
        {
          error:
            result?.error?.message ||
            `فشل تحليل ${
              hasPdf
                ? 'PDF'
                : 'الصورة'
            } - HTTP ${
              openAIResponse.status
            }`,

          debug: {
            stage: 'openai_request',

            httpStatus:
              openAIResponse.status,

            model: selectedModel,

            sourceType:
              hasPdf
                ? 'pdf'
                : 'image',

            openAIError:
              result?.error || null,
          },
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ==========================
     * استخراج النص الخام
     * ==========================
     */

    const outputText =
      extractOutputText(result);

    /*
     * إذا OpenAI رجع نجاح
     * ولكن بدون نص.
     */

    if (!outputText) {
      console.error(
        'EMPTY OPENAI OUTPUT:',
        JSON.stringify(result)
      );

      return Response.json(
        {
          error:
            'DEBUG: OpenAI استقبل الملف لكنه لم يرجع نصاً للتحليل',

          debug: {
            stage:
              'empty_output_text',

            model:
              result?.model ||
              selectedModel,

            status:
              result?.status ||
              'unknown',

            sourceType:
              hasPdf
                ? 'pdf'
                : 'image',

            output:
              result?.output ||
              null,

            usage:
              result?.usage ||
              null,
          },
        },
        {
          status: 422,
        }
      );
    }

    /*
     * ==========================
     * تحويل النص إلى JSON
     * ==========================
     */

    let parsed: any;

    try {
      parsed = JSON.parse(
        cleanJson(outputText)
      );
    } catch (parseError) {
      console.error(
        'JSON PARSE ERROR:',
        outputText
      );

      return Response.json(
        {
          error:
            'DEBUG: تمت قراءة الملف ولكن JSON غير صالح',

          debug: {
            stage:
              'json_parse',

            model:
              result?.model ||
              selectedModel,

            status:
              result?.status ||
              'unknown',

            sourceType:
              hasPdf
                ? 'pdf'
                : 'image',

            outputText:
              outputText.slice(
                0,
                5000
              ),

            parseError:
              parseError instanceof Error
                ? parseError.message
                : String(
                    parseError
                  ),
          },
        },
        {
          status: 422,
        }
      );
    }

    /*
     * ==========================
     * البحث عن rows
     * ==========================
     */

    const sourceRows =
      Array.isArray(parsed)
        ? parsed
        : Array.isArray(
            parsed?.rows
          )
          ? parsed.rows
          : Array.isArray(
              parsed?.data?.rows
            )
            ? parsed.data.rows
            : Array.isArray(
                parsed?.data
              )
              ? parsed.data
              : [];

    /*
     * أهم تشخيص:
     * OpenAI أعطانا JSON
     * ولكن rows فارغة.
     */

    if (!sourceRows.length) {
      console.error(
        'NO SOURCE ROWS:',
        {
          parsed,
          outputText,
        }
      );

      return Response.json(
        {
          error:
            'DEBUG: التحليل رجع JSON ولكن بدون صفوف حساب',

          debug: {
            stage:
              'no_source_rows',

            model:
              result?.model ||
              selectedModel,

            status:
              result?.status ||
              'unknown',

            sourceType:
              hasPdf
                ? 'pdf'
                : 'image',

            fileName:
              fileName || '',

            parsed,

            outputText:
              outputText.slice(
                0,
                5000
              ),

            usage:
              result?.usage ||
              null,
          },
        },
        {
          status: 422,
        }
      );
    }

    /*
     * ==========================
     * تطبيع الصفوف
     * ==========================
     */

    const normalized: DayRow[] =
      sourceRows
        .map((row: any) => {
          return {
            day: numberValue(
              row.day ??
              row['اليوم']
            ),

            workType: textValue(
              row.workType ??
              row.work ??
              row.details ??
              row['نوع العمل'] ??
              row['تفاصيل']
            ),

            tripType: textValue(
              row.tripType ??
              row.location ??
              row['موقع العمل'] ??
              row['الموقع'] ??
              row['جهة العمل']
            ),

            tripPrice: numberValue(
              row.tripPrice ??
              row.income ??
              row.amount ??
              row.price ??
              row['الدخل'] ??
              row['المبلغ'] ??
              row['السعر'] ??
              row['قيمة العمل']
            ),

            expenseType: textValue(
              row.expenseType ??
              row['نوع المصروف']
            ),

            expenseAmount:
              numberValue(
                row.expenseAmount ??
                row.outgoing ??
                row['الخرج'] ??
                row['مبلغ المصروف']
              ),

            notes: textValue(
              row.notes ??
              row['ملاحظات']
            ),
          };
        });

    /*
     * نخلي نسخة قبل الفلترة
     * حتى نعرف ماذا استخرج.
     */

    const normalizedBeforeFilter =
      [...normalized];

    const validRows =
      normalized.filter(
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

    /*
     * إذا OpenAI استخرج صفوف
     * ولكن كلها سقطت في الفلترة،
     * نرجع التفاصيل كاملة.
     */

    if (!validRows.length) {
      console.error(
        'ROWS FAILED FILTER:',
        {
          sourceRows,
          normalizedBeforeFilter,
          maxDay,
        }
      );

      return Response.json(
        {
          error:
            'DEBUG: تم استخراج صفوف ولكن لم ينجح أي يوم في الفلترة',

          debug: {
            stage:
              'rows_filter',

            model:
              result?.model ||
              selectedModel,

            sourceType:
              hasPdf
                ? 'pdf'
                : 'image',

            maxDay,

            sourceRows,

            normalized:
              normalizedBeforeFilter,

            outputText:
              outputText.slice(
                0,
                5000
              ),
          },
        },
        {
          status: 422,
        }
      );
    }

    /*
     * ==========================
     * دمج عمليات نفس اليوم
     * ==========================
     */

    const rows =
      mergeSameDays(validRows);

    if (!rows.length) {
      return Response.json(
        {
          error:
            'DEBUG: فشل دمج الصفوف بعد استخراجها',

          debug: {
            stage:
              'merge_rows',

            model:
              result?.model ||
              selectedModel,

            sourceType:
              hasPdf
                ? 'pdf'
                : 'image',

            sourceRows,

            validRows,

            maxDay,

            outputText:
              outputText.slice(
                0,
                5000
              ),
          },
        },
        {
          status: 422,
        }
      );
    }

    /*
     * ==========================
     * نجاح
     * ==========================
     */

    return Response.json({
      success: true,

      sourceType:
        hasPdf
          ? 'pdf'
          : 'image',

      count:
        rows.length,

      rows,

      /*
       * تشخيص مؤقت.
       * بعد حل المشكلة يمكن حذفه.
       */

      debug: {
        stage:
          'success',

        model:
          result?.model ||
          selectedModel,

        sourceRowsCount:
          sourceRows.length,

        validRowsCount:
          validRows.length,

        mergedRowsCount:
          rows.length,
      },
    });
  } catch (error: any) {
    console.error(
      'MONTHLY IMPORT ERROR:',
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          'حدث خطأ أثناء قراءة ملف الحساب',

        debug: {
          stage:
            'server_exception',

          name:
            error?.name ||
            'Error',

          message:
            error?.message ||
            String(error),
        },
      },
      {
        status: 500,
      }
    );
  }
          }
