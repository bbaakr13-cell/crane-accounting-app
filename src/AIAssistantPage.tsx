import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  ArrowRight,
  Bot,
  Send,
  Mic,
  Sparkles,
  TrendingUp,
  Wallet,
  Trophy,
  FileBarChart,
  Fuel,
  Users,
  Truck,
  Receipt,
  Plus,
  RotateCcw,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';

import {
  fetchDashboardTotals,
  fetchAllTransactions,
  type DashboardTotals,
} from '@/lib/transactions';

import { formatSAR } from '@/lib/format';

type ChatMessage = {
  id: number;
  sender: 'user' | 'ai';
  text: string;
};

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    sender: 'ai',
    text:
      'مرحباً بك 👋 أنا BAAKR AI، مساعدك الذكي لإدارة حسابات وأعمال الكرينات. اسألني عن الدخل، المصروفات، الأرباح أو المستحقات.',
  },
];

export function AIAssistantPage() {
  const navigate = useNavigate();

  const bottomRef =
    useRef<HTMLDivElement>(null);

  const [totals, setTotals] =
    useState<DashboardTotals>({
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      receivables: 0,
    });

  const [transactionsCount, setTransactionsCount] =
    useState(0);

  const [messages, setMessages] =
    useState<ChatMessage[]>(
      initialMessages
    );

  const [input, setInput] =
    useState('');

  const [thinking, setThinking] =
    useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages, thinking]);

  async function loadData() {
    try {
      const [dashboard, transactions] =
        await Promise.all([
          fetchDashboardTotals(),
          fetchAllTransactions(),
        ]);

      setTotals(dashboard);

      setTransactionsCount(
        transactions.length
      );
    } catch (error) {
      console.error(
        'BAAKR AI data load error:',
        error
      );
    }
  }

  function getLocalAnswer(
    question: string
  ) {
    const q =
      question.trim().toLowerCase();

    if (
      q.includes('دخل') ||
      q.includes('الايراد') ||
      q.includes('الإيراد')
    ) {
      return `إجمالي الدخل المسجل حالياً هو ${formatSAR(
        totals.totalIncome
      )}.`;
    }

    if (
      q.includes('مصروف') ||
      q.includes('المصروفات')
    ) {
      return `إجمالي المصروفات المسجلة هو ${formatSAR(
        totals.totalExpenses
      )}.`;
    }

    if (
      q.includes('ربح') ||
      q.includes('صافي')
    ) {
      return `صافي الربح الحالي هو ${formatSAR(
        totals.netProfit
      )}.`;
    }

    if (
      q.includes('مستحق') ||
      q.includes('متبقي') ||
      q.includes('ديون')
    ) {
      return `إجمالي المستحقات الحالية هو ${formatSAR(
        totals.receivables
      )}.`;
    }

    if (
      q.includes('حركة') ||
      q.includes('الحركات')
    ) {
      return `عدد الحركات المالية المسجلة حالياً هو ${transactionsCount} حركة.`;
    }

    if (
      q.includes('ملخص') ||
      q.includes('الحساب')
    ) {
      return [
        'هذا ملخص الحساب الحالي:',
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
      'حالياً أستطيع قراءة ملخص الحسابات من التطبيق. ' +
      'قريباً سنربطني بالعملاء والكرينات والإيجار الشهري والتقارير حتى أجيبك على أسئلة أكثر.'
    );
  }

  async function sendMessage(
    customText?: string
  ) {
    const text =
      (customText ?? input).trim();

    if (!text || thinking) {
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now(),
      sender: 'user',
      text,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setInput('');
    setThinking(true);

    window.setTimeout(() => {
      const answer =
        getLocalAnswer(text);

      const aiMessage: ChatMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: answer,
      };

      setMessages((current) => [
        ...current,
        aiMessage,
      ]);

      setThinking(false);
    }, 450);
  }

  function clearChat() {
    setMessages(
      initialMessages
    );
  }

  const suggestions = [
    {
      label: 'دخل اليوم',
      icon: TrendingUp,
      question:
        'كم إجمالي الدخل؟',
    },
    {
      label: 'المستحقات',
      icon: Wallet,
      question:
        'كم المستحقات؟',
    },
    {
      label: 'صافي الربح',
      icon: Trophy,
      question:
        'كم صافي الربح؟',
    },
    {
      label: 'ملخص الحساب',
      icon: FileBarChart,
      question:
        'اعطني ملخص الحساب',
    },
  ];

  return (
    <AppLayout
      showHeader={false}
      showBottomNav={false}
    >
      <div
        dir="rtl"
        className="min-h-screen pb-5"
      >

        {/* HEADER */}

        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() =>
              navigate('/')
            }
            className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />

              <h1 className="text-[22px] font-black text-white">
                BAAKR{' '}
                <span className="text-purple-400">
                  AI
                </span>
              </h1>
            </div>

            <p className="text-[10px] text-slate-500 mt-1">
              مساعدك الذكي لإدارة أعمال الكرينات
            </p>
          </div>

          <button
            type="button"
            onClick={
              clearChat
            }
            className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95"
          >
            <RotateCcw className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        {/* WELCOME CARD */}

        <div
          className="rounded-[24px] p-4 mb-4"
          style={{
            background:
              'linear-gradient(135deg,rgba(75,37,145,0.34),rgba(12,24,44,0.96))',
            border:
              '1px solid rgba(168,85,247,0.18)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-[18px] bg-purple-500/15 border border-purple-400/20 flex items-center justify-center">
              <Bot className="w-8 h-8 text-purple-400" />
            </div>

            <div className="flex-1">
              <p className="text-[16px] font-black text-white">
                مرحباً بك 👋
              </p>

              <p className="text-[11px] text-slate-400 mt-1 leading-5">
                اسأل عن حساباتك وسأقرأ البيانات المسجلة داخل BAAKR PRO.
              </p>
            </div>
          </div>
        </div>

        {/* SUMMARY */}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <SummaryCard
            title="إجمالي الدخل"
            value={formatSAR(
              totals.totalIncome
            )}
            icon={TrendingUp}
            tone="green"
          />

          <SummaryCard
            title="المستحقات"
            value={formatSAR(
              totals.receivables
            )}
            icon={Wallet}
            tone="red"
          />

          <SummaryCard
            title="صافي الربح"
            value={formatSAR(
              totals.netProfit
            )}
            icon={Trophy}
            tone="gold"
          />

          <SummaryCard
            title="الحركات"
            value={`${transactionsCount}`}
            icon={Receipt}
            tone="blue"
          />
        </div>

        {/* QUICK TOOLS */}

        <div
          className="rounded-[22px] p-3 mb-4"
          style={{
            background:
              'rgba(10,22,39,0.92)',
            border:
              '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p className="text-[12px] font-bold text-white mb-3">
            ⚡ اختصارات سريعة
          </p>

          <div className="grid grid-cols-4 gap-2">
            <QuickTool
              label="العملاء"
              icon={Users}
              onClick={() =>
                navigate(
                  '/customers'
                )
              }
            />

            <QuickTool
              label="المعدات"
              icon={Truck}
              onClick={() =>
                navigate(
                  '/equipment'
                )
              }
            />

            <QuickTool
              label="التقارير"
              icon={FileBarChart}
              onClick={() =>
                navigate(
                  '/reports'
                )
              }
            />

            <QuickTool
              label="إضافة"
              icon={Plus}
              onClick={() =>
                navigate('/add')
              }
            />
          </div>
        </div>

        {/* CHAT */}

        <div
          className="rounded-[26px] overflow-hidden"
          style={{
            background:
              'linear-gradient(180deg,rgba(12,25,45,0.98),rgba(6,14,26,0.99))',
            border:
              '1px solid rgba(255,255,255,0.07)',
          }}
        >

          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <Bot className="w-5 h-5 text-purple-400" />
            </div>

            <div>
              <p className="text-sm font-black text-white">
                BAAKR AI
              </p>

              <p className="text-[9px] text-green-400">
                ● جاهز للمساعدة
              </p>
            </div>
          </div>

          {/* MESSAGES */}

          <div className="min-h-[300px] max-h-[430px] overflow-y-auto p-4 space-y-3">

            {messages.map(
              (message) => (
                <div
                  key={
                    message.id
                  }
                  className={`flex ${
                    message.sender ===
                    'user'
                      ? 'justify-start'
                      : 'justify-end'
                  }`}
                >
                  <div
                    className={`max-w-[86%] rounded-[18px] px-4 py-3 whitespace-pre-line text-[12px] leading-6 ${
                      message.sender ===
                      'user'
                        ? 'bg-purple-600/80 text-white rounded-tr-[18px] rounded-tl-[5px]'
                        : 'bg-white/[0.045] border border-white/[0.06] text-slate-200 rounded-tl-[18px] rounded-tr-[5px]'
                    }`}
                  >
                    {message.sender ===
                      'ai' && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-purple-400">
                        <Bot className="w-4 h-4" />

                        <span className="text-[10px] font-bold">
                          BAAKR AI
                        </span>
                      </div>
                    )}

                    {message.text}
                  </div>
                </div>
              )
            )}

            {thinking && (
              <div className="flex justify-end">
                <div className="bg-white/[0.045] border border-white/[0.06] rounded-[18px] px-4 py-3">
                  <div className="flex items-center gap-2 text-purple-400">
                    <Bot className="w-4 h-4" />

                    <span className="text-[11px]">
                      جاري التحليل
                    </span>

                    <span className="flex gap-1">
                      <i className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      <i className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      <i className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* SUGGESTIONS */}

          <div className="px-3 pb-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {suggestions.map(
                (item) => {
                  const Icon =
                    item.icon;

                  return (
                    <button
                      key={
                        item.label
                      }
                      type="button"
                      onClick={() =>
                        sendMessage(
                          item.question
                        )
                      }
                      className="shrink-0 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center gap-2 text-[10px] text-slate-300 active:scale-95"
                    >
                      <Icon className="w-3.5 h-3.5 text-purple-400" />

                      {
                        item.label
                      }
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* INPUT */}

          <div className="p-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">

              <button
                type="button"
                className="w-11 h-11 shrink-0 rounded-[15px] bg-purple-600/20 border border-purple-500/20 flex items-center justify-center"
              >
                <Mic className="w-5 h-5 text-purple-400" />
              </button>

              <div className="flex-1 relative">
                <input
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
                  className="w-full h-11 bg-white/[0.04] border border-white/[0.07] rounded-[15px] px-4 text-[12px] text-white placeholder:text-slate-600 outline-none focus:border-purple-500/40"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  sendMessage()
                }
                disabled={
                  !input.trim() ||
                  thinking
                }
                className="w-11 h-11 shrink-0 rounded-[15px] bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center disabled:opacity-40 active:scale-95"
              >
                <Send className="w-5 h-5 text-white" />
              </button>

            </div>

            <p className="text-[8px] text-slate-600 text-center mt-2">
              BAAKR AI قد يخطئ أحياناً، يرجى التأكد من المعلومات المهمة.
            </p>
          </div>
        </div>

        <div className="h-5" />
      </div>
    </AppLayout>
  );
}

type SummaryTone =
  | 'green'
  | 'red'
  | 'gold'
  | 'blue';

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: any;
  tone: SummaryTone;
}) {
  const colors = {
    green: {
      color: '#4ade80',
      bg:
        'rgba(34,197,94,0.10)',
    },
    red: {
      color: '#fb7185',
      bg:
        'rgba(239,68,68,0.10)',
    },
    gold: {
      color: '#fbbf24',
      bg:
        'rgba(245,158,11,0.10)',
    },
    blue: {
      color: '#60a5fa',
      bg:
        'rgba(59,130,246,0.10)',
    },
  };

  const theme =
    colors[tone];

  return (
    <div
      className="rounded-[20px] p-3.5"
      style={{
        background:
          'linear-gradient(145deg,rgba(13,27,47,0.96),rgba(7,17,31,0.98))',
        border:
          '1px solid rgba(255,255,255,0.055)',
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] text-slate-500">
            {title}
          </p>

          <p
            className="text-[14px] font-black mt-2"
            style={{
              color:
                theme.color,
            }}
          >
            {value}
          </p>
        </div>

        <div
          className="w-10 h-10 rounded-[14px] flex items-center justify-center"
          style={{
            background:
              theme.bg,
          }}
        >
          <Icon
            className="w-5 h-5"
            style={{
              color:
                theme.color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function QuickTool({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: any;
  onClick: () => void
