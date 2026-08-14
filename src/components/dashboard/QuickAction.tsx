import { type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickActionProps {
  label: string;
  icon: LucideIcon;
  to: string;
  tone?: "gold" | "income" | "expense" | "profit" | "receivable";
  delay?: number;
}

const toneMap = {
  gold: "text-yellow-400 bg-yellow-500/10",
  income: "text-green-400 bg-green-500/10",
  expense: "text-red-400 bg-red-500/10",
  profit: "text-blue-400 bg-blue-500/10",
  receivable: "text-orange-400 bg-orange-500/10",
};

export function QuickAction({
  label,
  icon: Icon,
  to,
  tone = "gold",
  delay = 0,
}: QuickActionProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="group flex flex-col items-center justify-center gap-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${toneMap[tone]}`}
      >
        <Icon className="w-6 h-6" strokeWidth={2} />
      </span>

      <span className="text-xs font-medium text-white">
        {label}
      </span>
    </button>
  );
}
