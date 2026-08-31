import React, { useState } from 'react';
import { ArrowRight, Delete } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';

export function CalculatorPage() {
  const navigate = useNavigate();

  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForNumber, setWaitingForNumber] = useState(false);

  function inputNumber(num: string) {
    if (waitingForNumber) {
      setDisplay(num);
      setWaitingForNumber(false);
      return;
    }

    if (display === '0') {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  }

  function inputDecimal() {
    if (waitingForNumber) {
      setDisplay('0.');
      setWaitingForNumber(false);
      return;
    }

    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  }

  function clearAll() {
    setDisplay('0');
    setStoredValue(null);
    setOperator(null);
    setWaitingForNumber(false);
  }

  function deleteLast() {
    if (waitingForNumber) return;

    if (display.length <= 1) {
      setDisplay('0');
      return;
    }

    setDisplay(display.slice(0, -1));
  }

  function calculate(a: number, b: number, op: string) {
    switch (op) {
      case '+':
        return a + b;

      case '-':
        return a - b;

      case '×':
        return a * b;

      case '÷':
        return b === 0 ? 0 : a / b;

      default:
        return b;
    }
  }

  function chooseOperator(nextOperator: string) {
    const inputValue = Number(display);

    if (storedValue === null) {
      setStoredValue(inputValue);
    } else if (operator && !waitingForNumber) {
      const result = calculate(
        storedValue,
        inputValue,
        operator
      );

      setStoredValue(result);
      setDisplay(String(result));
    }

    setOperator(nextOperator);
    setWaitingForNumber(true);
  }

  function equals() {
    if (
      storedValue === null ||
      operator === null
    ) {
      return;
    }

    const inputValue = Number(display);

    const result = calculate(
      storedValue,
      inputValue,
      operator
    );

    setDisplay(String(result));
    setStoredValue(null);
    setOperator(null);
    setWaitingForNumber(true);
  }

  function percentage() {
    const value = Number(display);

    setDisplay(
      String(value / 100)
    );
  }

  function toggleSign() {
    const value = Number(display);

    setDisplay(
      String(value * -1)
    );
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        className="min-h-screen bg-[#06101f] px-3 py-4 text-white"
      >
        <div className="mx-auto max-w-md">

          {/* HEADER */}

          <div className="mb-5 flex items-center justify-between">

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-[#0c1728]"
            >
              <ArrowRight size={22} />
            </button>

            <div className="text-center">
              <h1 className="text-xl font-black">
                الحاسبة
              </h1>

              <p className="mt-1 text-xs text-slate-400">
                BAAKR PRO
              </p>
            </div>

            <div className="h-11 w-11" />

          </div>

          {/* CALCULATOR */}

          <div className="rounded-[28px] border border-slate-700 bg-[#0a1525] p-4 shadow-2xl">

            {/* DISPLAY */}

            <div className="mb-4 rounded-[22px] border border-slate-700 bg-[#020817] p-4">

              <div className="min-h-[24px] text-left text-xs font-bold text-slate-500">
                {storedValue !== null
                  ? `${storedValue} ${operator ?? ''}`
                  : ''}
              </div>

              <div
                dir="ltr"
                className="mt-2 overflow-x-auto whitespace-nowrap text-right text-[42px] font-black tracking-tight"
              >
                {display}
              </div>

            </div>

            {/* BUTTONS */}

            <div className="grid grid-cols-4 gap-3">

              <CalcButton
                label="AC"
                special
                onClick={clearAll}
              />

              <CalcButton
                label="+/-"
                special
                onClick={toggleSign}
              />

              <CalcButton
                label="%"
                special
                onClick={percentage}
              />

              <CalcButton
                label="÷"
                operator
                onClick={() =>
                  chooseOperator('÷')
                }
              />

              <CalcButton
                label="7"
                onClick={() => inputNumber('7')}
              />

              <CalcButton
                label="8"
                onClick={() => inputNumber('8')}
              />

              <CalcButton
                label="9"
                onClick={() => inputNumber('9')}
              />

              <CalcButton
                label="×"
                operator
                onClick={() =>
                  chooseOperator('×')
                }
              />

              <CalcButton
                label="4"
                onClick={() => inputNumber('4')}
              />

              <CalcButton
                label="5"
                onClick={() => inputNumber('5')}
              />

              <CalcButton
                label="6"
                onClick={() => inputNumber('6')}
              />

              <CalcButton
                label="-"
                operator
                onClick={() =>
                  chooseOperator('-')
                }
              />

              <CalcButton
                label="1"
                onClick={() => inputNumber('1')}
              />

              <CalcButton
                label="2"
                onClick={() => inputNumber('2')}
              />

              <CalcButton
                label="3"
                onClick={() => inputNumber('3')}
              />

              <CalcButton
                label="+"
                operator
                onClick={() =>
                  chooseOperator('+')
                }
              />

              <button
                type="button"
                onClick={deleteLast}
                className="flex h-[68px] items-center justify-center rounded-[20px] bg-slate-700 text-white active:scale-95"
              >
                <Delete size={24} />
              </button>

              <CalcButton
                label="0"
                onClick={() => inputNumber('0')}
              />

              <CalcButton
                label="."
                onClick={inputDecimal}
              />

              <CalcButton
                label="="
                operator
                onClick={equals}
              />

            </div>

          </div>

        </div>
      </div>
    </AppLayout>
  );
}

function CalcButton({
  label,
  onClick,
  operator = false,
  special = false,
}: {
  label: string;
  onClick: () => void;
  operator?: boolean;
  special?: boolean;
}) {
  let className =
    'h-[68px] rounded-[20px] text-xl font-black transition active:scale-95';

  if (operator) {
    className +=
      ' bg-violet-600 text-white';
  } else if (special) {
    className +=
      ' bg-slate-600 text-white';
  } else {
    className +=
      ' bg-[#111d30] text-white';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
    >
      {label}
    </button>
  );
          }
