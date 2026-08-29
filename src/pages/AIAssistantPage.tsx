import {
  Bot,
  Send,
  Sparkles,
  TrendingUp,
  Wallet,
  Receipt,
  BarChart3,
} from 'lucide-react';

import {
  useEffect,
  useState,
} from 'react';

import { AppLayout } from '@/components/layout/AppLayout';

import { formatSAR } from '@/lib/format';

import {
  fetchDashboardTotals,
  fetchAllTransactions,
  type DashboardTotals,
} from '@/lib/transactions';

type Message = {
  id: number;
  type: 'user' | 'ai';
  text: string;
};

export function AIAssistantPage() {
  const [input, setInput] =
    useState('');

  const [totals, setTotals] =
    useState<DashboardTotals>({
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      receivables: 0,
    });

  const [
    transactionCount,
    setTransactionCount,
  ] = useState(0);

  const [messages, setMessages] =
    useState<Message[]>([
      {
        id: 1,
        type: 'ai',
        text:
          'مرحباً بك 👋 أنا BAAKR AI. اسألني عن الدخل والمصروفات والأرباح والمستحقات.',
      },
    ]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [
        dashboardTotals,
        transactions,
      ] = await Promise.all([
        fetchDashboardTotals(),
        fetchAllTransactions(),
      ]);

      setTotals(
        dashboardTotals
      );

      setTransactionCount(
        transactions.length
      );
    } catch (error) {
      console.error(
        'BAAKR AI load error:',
        error
      );
    }
  }

  function getAnswer(
    question: string
  ) {
    const text =
      question
        .trim()
        .toLowerCase();

    if (
      text.includes('دخل') ||
      text.includes('إيراد') ||
      text.includes('ايراد')
    ) {
      return `إجمالي الدخل المسجل هو ${formatSAR(
        totals.totalIncome
      )}.`;
    }

    if (
      text.includes('مصروف')
    ) {
      return `إجمالي المصروفات المسجلة هو ${formatSAR(
        totals.totalExpenses
      )}.`;
    }

    if (
      text.includes('ربح') ||
      text.includes('صافي')
    ) {
      return `صافي الربح الحالي هو ${formatSAR(
        totals.netProfit
      )}.`;
    }

    if (
      text.includes('مستحق') ||
      text.includes('ديون') ||
      text.includes('متبقي')
    ) {
      return `إجمالي المستحقات الحالية هو ${formatSAR(
        totals.receivables
      )}.`;
    }

    if (
      text.includes('حركة') ||
      text.includes('حركات')
    ) {
      return `عدد الحركات المالية المسجلة هو ${transactionCount} حركة.`;
    }

    if (
      text.includes('ملخص')
    ) {
      return [
        '📊 ملخص الحساب الحالي:',
        '',
        `الدخل: ${formatSAR(
          totals.totalIncome
        )}`,
        `المصروفات: ${formatSAR(
          totals.totalExpenses
        )}`,
        `صافي الربح: ${formatSAR(
          totals.netProfit
        )}`,
        `المستحقات: ${formatSAR(
          totals.receivables
        )}`,
      ].join('\n');
    }

    return (
      'يمكنك أن تسألني الآن عن الدخل، المصروفات، ' +
      'صافي الربح، المستحقات أو ملخص الحساب.'
    );
  }

  function sendMessage(
    customText?: string
  ) {
    const text =
      (
        customText ??
        input
      ).trim();

    if (!text) {
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      type: 'user',
      text,
    };

    const aiMessage: Message = {
      id:
        Date.now() + 1,
      type: 'ai',
      text: getAnswer(text),
    };

    setMessages(
      (current) => [
        ...current,
        userMessage,
        aiMessage,
      ]
    );

    setInput('');
  }

  const quickQuestions = [
    'كم إجمالي الدخل؟',
    'كم المصروفات؟',
    'كم صافي الربح؟',
    'كم المستحقات؟',
    'اعطني ملخص الحساب',
  ];

  return (
    <AppLayout>
      <div
        dir="rtl"
        className="w-full pb-6"
      >

        {/* عنوان BAAKR AI */}

        <section
          className="relative overflow-hidden rounded-[26px] p-5 mb-4"
          style={{
            background:
              'linear-gradient(135deg, rgba(88,28,135,0.92), rgba(49,46,129,0.78), rgba(10,20,38,0.98))',

            border:
              '1px solid rgba(192,132,252,0.22)',

            boxShadow:
              '0 14px 35px rgba(88,28,135,0.20)',
          }}
        >
          <div className="absolute -left-10 -top-10 w-32 h-32 rounded-full bg-purple-400/10" />

          <div className="relative flex items-center gap-4">

            <div className="w-16 h-16 rounded-[20px] bg-purple-400/15 border border-purple-300/20 flex items-center justify-center">
              <Bot className="w-9 h-9 text-purple-300" />
            </div>

            <div className="flex-1">

              <div className="flex items-center gap-2">

                <h1 className="text-[21px] font-black text-white">
                  BAAKR AI
                </h1>

                <Sparkles className="w-5 h-5 text-purple-300" />

              </div>

              <p className="text-[11px] text-purple-100/80 mt-1">
                مساعدك الذكي لإدارة أعمال الكرينات
              </p>

              <div className="mt-2 inline-flex items-center gap-1.5 text-[9px] text-green-300">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                جاهز للمساعدة
              </div>

            </div>
          </div>
        </section>

        {/* ملخص الحساب */}

        <section className="grid grid-cols-2 gap-3 mb-4">

          <MiniCard
            title="الدخل"
            value={formatSAR(
              totals.totalIncome
            )}
            icon={TrendingUp}
          />

          <MiniCard
            title="المستحقات"
            value={formatSAR(
              totals.receivables
            )}
            icon={Wallet}
          />

          <MiniCard
            title="صافي الربح"
            value={formatSAR(
              totals.netProfit
            )}
            icon={BarChart3}
          />

          <MiniCard
            title="الحركات"
            value={`${transactionCount}`}
            icon={Receipt}
          />

        </section>

        {/* المحادثة */}

        <section
          className="rounded-[26px] overflow-hidden"
          style={{
            background:
              'linear-gradient(180deg,rgba(12,25,45,0.98),rgba(6,14,26,0.99))',

            border:
              '1px solid rgba(255,255,255,0.07)',
          }}
        >

          <div className="p-4 border-b border-white/5">

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-[14px] bg-purple-500/15 flex items-center justify-center">
                <Bot className="w-6 h-6 text-purple-400" />
              </div>

              <div>
                <p className="text-[13px] font-black text-white">
                  المحادثة الذكية
                </p>

                <p className="text-[9px] text-slate-500 mt-0.5">
                  اسأل عن حسابات التطبيق
                </p>
              </div>

            </div>

          </div>

          {/* الرسائل */}

          <div className="p-4 min-h-[300px] max-h-[430px] overflow-y-auto space-y-3">

            {messages.map(
              (message) => (
                <div
                  key={
                    message.id
                  }
                  className={`flex ${
                    message.type ===
                    'user'
                      ? 'justify-start'
                      : 'justify-end'
                  }`}
                >

                  <div
                    className={`max-w-[86%] px-4 py-3 rounded-[18px] text-[12px] leading-6 whitespace-pre-line ${
                      message.type ===
                      'user'
                        ? 'bg-purple-600 text-white rounded-tl-[5px]'
                        : 'bg-white/[0.045] border border-white/[0.06] text-slate-200 rounded-tr-[5px]'
                    }`}
                  >

                    {message.type ===
                      'ai' && (
                      <div className="flex items-center gap-1.5 text-purple-400 mb-1">

                        <Bot className="w-4 h-4" />

                        <span className="text-[9px] font-bold">
                          BAAKR AI
                        </span>

                      </div>
                    )}

                    {message.text}

                  </div>
                </div>
              )
            )}

          </div>

          {/* أسئلة سريعة */}

          <div className="px-3 pb-3">

            <div className="flex gap-2 overflow-x-auto">

              {quickQuestions.map(
                (question) => (
                  <button
                    key={
                      question
                    }
                    type="button"
                    onClick={() =>
                      sendMessage(
                        question
                      )
                    }
                    className="shrink-0 px-3 h-9 rounded-xl bg-purple-500/10 border border-purple-400/10 text-[9px] text-purple-200 active:scale-95"
                  >
                    {question}
                  </button>
                )
              )}

            </div>

          </div>

          {/* الكتابة */}

          <div className="p-3 border-t border-white/5">

            <div className="flex items-center gap-2">

              <input
                type="text"
                value={input}
                onChange={(e) =>
                  setInput(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key ===
                    'Enter'
                  ) {
                    sendMessage();
                  }
                }}
                placeholder="اسأل BAAKR AI..."
                className="flex-1 h-12 rounded-[16px] bg-white/[0.04] border border-white/[0.07] px-4 text-[12px] text-white placeholder:text-slate-600 outline-none focus:border-purple-500/40"
              />

              <button
                type="button"
                onClick={() =>
                  sendMessage()
                }
                disabled={
                  !input.trim()
                }
                className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center active:scale-95 disabled:opacity-40"
              >
                <Send className="w-5 h-5 text-white" />
              </button>

            </div>

            <p className="text-[8px] text-slate-600 text-center mt-2">
              BAAKR AI قد يخطئ أحياناً، يرجى التأكد من المعلومات المهمة.
            </p>

          </div>

        </section>

      </div>
    </AppLayout>
  );
}

function MiniCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: any;
}) {
  return (
    <div
      className="rounded-[20px] p-3.5"
      style={{
        background:
          'linear-gradient(145deg,rgba(13,27,47,0.94),rgba(7,17,31,0.98))',

        border:
          '1px solid rgba(168,85,247,0.10)',
      }}
    >

      <div className="flex items-center justify-between">

        <div>
          <p className="text-[9px] text-slate-500">
            {title}
          </p>

          <p className="text-[13px] font-black text-purple-300 mt-2">
            {value}
          </p>
        </div>

        <div className="w-10 h-10 rounded-[14px] bg-purple-500/10 flex items-center justify-center">

          <Icon className="w-5 h-5 text-purple-400" />

        </div>

      </div>

    </div>
  );
            }
