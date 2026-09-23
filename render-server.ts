import http from 'node:http';

const PORT = Number(process.env.PORT || 10000);

type DayRow = {
  day: number;
  workType: string;
  tripType: string;
  tripPrice: number;
  expenseType: string;
  expenseAmount: number;
  notes: string;
};

function send(
  res: http.ServerResponse,
  status: number,
  data: unknown
) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });

  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;

      if (body.length > 35 * 1024 * 1024) {
        reject(new Error('الملف كبير جداً'));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('بيانات الطلب غير صحيحة'));
      }
    });

    req.on('error', reject);
  });
}

function dataUrlToBuffer(dataUrl: string) {
  const i = dataUrl.indexOf(',');

  if (i < 0) {
    throw new Error('صيغة الملف غير صحيحة');
  }

  return Buffer.from(dataUrl.slice(i + 1), 'base64');
}

function arabicDigits(s: string) {
  return String(s ?? '')
    .replace(
      /[٠-٩]/g,
      d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    )
    .replace(
      /[۰-۹]/g,
      d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    );
}

function num(s: unknown) {
  const cleaned = arabicDigits(String(s ?? ''))
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '');

  const n = Number(cleaned);

  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function cleanText(s: unknown) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function join(a: string, b: string) {
  return [
    ...new Set(
      [
        ...a.split(' / '),
        ...b.split(' / '),
      ]
        .map(x => x.trim())
        .filter(Boolean)
    ),
  ].join(' / ');
}

function mergeRows(
  rows: DayRow[],
  daysInMonth: number
) {
  const map = new Map<number, DayRow>();

  for (const r of rows) {
    if (
      !Number.isInteger(r.day) ||
      r.day < 1 ||
      r.day > daysInMonth
    ) {
      continue;
    }

    const old = map.get(r.day);

    if (!old) {
      map.set(r.day, { ...r });
    } else {
      map.set(r.day, {
        day: r.day,

        workType: join(
          old.workType,
          r.workType
        ),

        tripType: join(
          old.tripType,
          r.tripType
        ),

        tripPrice:
          old.tripPrice +
          r.tripPrice,

        expenseType: join(
          old.expenseType,
          r.expenseType
        ),

        expenseAmount:
          old.expenseAmount +
          r.expenseAmount,

        notes: join(
          old.notes,
          r.notes
        ),
      });
    }
  }

  return [...map.values()]
    .filter(
      r =>
        r.workType ||
        r.tripType ||
        r.tripPrice ||
        r.expenseType ||
        r.expenseAmount ||
        r.notes
    )
    .sort((a, b) => a.day - b.day);
}

/*
  تحليل مجاني لجدول الحساب.

  لا يستخدم:
  OpenAI
  API Key
  رصيد مدفوع

  PDF النصي:
  pdf-parse

  الصور:
  Tesseract OCR عربي + إنجليزي
*/

function parseMonthlyText(
  text: string,
  daysInMonth: number
): DayRow[] {
  const rows: DayRow[] = [];

  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map(cleanText)
    .filter(Boolean);

  for (const original of lines) {
    const line = arabicDigits(original);

    const dayMatch = line.match(
      /^\s*(\d{1,2})(?:\s|[|،,:;\-–—])/
    );

    if (!dayMatch) {
      continue;
    }

    const day = Number(dayMatch[1]);

    if (
      !Number.isInteger(day) ||
      day < 1 ||
      day > daysInMonth
    ) {
      continue;
    }

    const rest = cleanText(
      line.slice(dayMatch[0].length)
    );

    const moneyMatches = [
      ...rest.matchAll(
        /(?:^|\s)(\d{2,7}(?:\.\d{1,2})?)(?=\s|$|ر\.?س|ريال)/g
      ),
    ];

    const amounts = moneyMatches
      .map(m => num(m[1]))
      .filter(n => n > 0);

    let textOnly = rest;

    for (const m of moneyMatches) {
      textOnly = textOnly.replace(
        m[0],
        ' '
      );
    }

    textOnly = cleanText(
      textOnly.replace(/[|]+/g, ' ')
    );

    rows.push({
      day,

      workType: textOnly,

      tripType: '',

      tripPrice:
        amounts[0] || 0,

      expenseType: '',

      expenseAmount:
        amounts.length > 1
          ? amounts[1]
          : 0,

      notes:
        amounts.length > 2
          ? `مبالغ إضافية: ${amounts
              .slice(2)
              .join(' / ')}`
          : '',
    });
  }

  return mergeRows(
    rows,
    daysInMonth
  );
}

async function extractPdfText(
  pdfBuffer: Buffer
) {
  const mod: any =
    await import('pdf-parse');

  const pdfParse =
    mod.default || mod;

  const result =
    await pdfParse(pdfBuffer);

  return cleanText(
    result?.text || ''
  ).replace(
    /(?=\s*\d{1,2}\s)/g,
    '\n'
  );
}

async function ocrImage(
  imageBuffer: Buffer
) {
  const mod: any =
    await import('tesseract.js');

  const createWorker =
    mod.createWorker;

  const worker =
    await createWorker(
      'ara+eng'
    );

  try {
    const result =
      await worker.recognize(
        imageBuffer
      );

    return String(
      result?.data?.text || ''
    );
  } finally {
    await worker.terminate();
  }
}

const server =
  http.createServer(
    async (req, res) => {

      if (req.method === 'OPTIONS') {
        return send(
          res,
          204,
          {}
        );
      }

      if (
        req.method === 'GET' &&
        (
          req.url === '/' ||
          req.url === '/health'
        )
      ) {
        return send(
          res,
          200,
          {
            ok: true,

            service:
              'BAAKR PRO Free Monthly Import API',

            engine:
              'local-pdf-text-and-ocr',

            paidApi: false,
          }
        );
      }

      if (
        req.method !== 'POST' ||
        req.url !==
          '/api/monthly-image-import'
      ) {
        return send(
          res,
          404,
          {
            error:
              'المسار غير موجود',
          }
        );
      }

      try {
        const body =
          await readBody(req);

        const daysInMonth =
          Math.max(
            28,
            Math.min(
              31,
              Number(
                body.daysInMonth
              ) || 31
            )
          );

        let extractedText = '';

        let sourceType = '';

        /*
          PDF
        */

        if (body.pdfDataUrl) {
          sourceType = 'pdf';

          const pdf =
            dataUrlToBuffer(
              body.pdfDataUrl
            );

          extractedText =
            await extractPdfText(
              pdf
            );

          if (
            extractedText.length <
            20
          ) {
            return send(
              res,
              422,
              {
                error:
                  'هذا الـ PDF يبدو مصوراً وليس نصياً. النسخة المجانية الحالية تقرأ PDF النصي والصور مباشرة. صوّر صفحة الجدول أو حوّل صفحة PDF إلى صورة ثم اخترها من زر الصورة.',
              }
            );
          }
        }

        /*
          IMAGE
        */

        else if (
          body.imageDataUrl
        ) {
          sourceType =
            'image';

          const image =
            dataUrlToBuffer(
              body.imageDataUrl
            );

          extractedText =
            await ocrImage(
              image
            );
        }

        /*
          NO FILE
        */

        else {
          return send(
            res,
            400,
            {
              error:
                'لم يتم إرسال صورة أو PDF',
            }
          );
        }

        /*
          تحويل النص إلى صفوف
        */

        const rows =
          parseMonthlyText(
            extractedText,
            daysInMonth
          );

        if (!rows.length) {
          return send(
            res,
            422,
            {
              error:
                'تمت قراءة الملف لكن لم أستطع تحديد صفوف الحساب. جرّب صورة واضحة ومباشرة للجدول، ثم راجع النتائج قبل اعتمادها.',

              extractedPreview:
                extractedText.slice(
                  0,
                  1000
                ),
            }
          );
        }

        /*
          SUCCESS
        */

        return send(
          res,
          200,
          {
            success: true,

            freeMode: true,

            sourceType,

            count:
              rows.length,

            rows,
          }
        );
      } catch (e: any) {
        console.error(e);

        return send(
          res,
          500,
          {
            error:
              e?.message ||
              'تعذر تحليل الملف',
          }
        );
      }
    }
  );

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `BAAKR PRO Free Import API running on port ${PORT}`
    );
  }
);
