import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  Truck,
  Plus,
  Image as ImageIcon,
  ChevronLeft,
  Bot,
  Sparkles,
  Search,
  X,
  Activity,
  LockKeyhole,
  Home,
  CalendarDays,
  UsersRound,
  LayoutGrid,
  UserPlus,
  FileText,
  ChevronUp,
  SlidersHorizontal,
  Check,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import { AppLayout } from '@/components/layout/AppLayout';

import {
  type Transaction,
} from '@/components/dashboard/TransactionItem';

import { formatSAR } from '@/lib/format';
