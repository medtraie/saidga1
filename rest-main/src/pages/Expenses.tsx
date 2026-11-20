import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import {
  DollarSign,
  Plus,
  Calendar,
  Search,
  Filter,
  Download,
  Trash2,
  Receipt,
  Wallet,
  CreditCard,
  Banknote,
  Pencil,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Save,
  Landmark,
  Building2,
  ArrowDownRight,
  Layers,
  X,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { Expense } from '@/types';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { loadPdfTools } from '@/lib/pdf';
import { DateRange } from 'react-day-picker';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { motion, useMotionValue, useReducedMotion, useTransform, animate } from 'framer-motion';

const formatMetric = (value: number, locale: string, decimals: number) =>
  value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

const AnimatedMetricValue = ({
  value,
  suffix = '',
  decimals = 0,
  locale = 'fr-MA',
  className = ''
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  locale?: string;
  className?: string;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const transformed = useTransform(motionValue, (latest) => formatMetric(latest, locale, decimals));
  const [displayValue, setDisplayValue] = useState(() => formatMetric(0, locale, decimals));

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(formatMetric(value, locale, decimals));
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1]
    });
    const unsubscribe = transformed.on('change', (latest) => setDisplayValue(latest));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, locale, decimals, shouldReduceMotion, motionValue, transformed]);

  return <span className={className}>{displayValue}{suffix}</span>;
};

const paymentMethods = [
  'espece',
  'compte_fournisseur',
  'cheque',
  'banque'
];

const Expenses = () => {
  const { expenses, addExpense, updateExpense, deleteExpense, expenseTypes, addExpenseType, suppliers } = useApp();
  const t = useT();
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const uiLocale = language === 'ar' ? 'ar-MA' : 'fr-MA';
  const formatDateUi = (value: Date | string, options?: Intl.DateTimeFormatOptions) =>
    new Date(value).toLocaleDateString(uiLocale, options || { year: 'numeric', month: '2-digit', day: '2-digit' });
  const te = (key: string, fallback: string) => t(`expenses.pdf.${key}`, fallback);
  const tu = (key: string, fallback: string) => t(`expenses.ui.${key}`, fallback);

  const paymentLabel = (method: string) => {
    switch (method) {
      case 'espece':
        return tu('payment.cash', 'Espèce');
      case 'compte_fournisseur':
        return tr('Compte Bancaire Fournisseur', 'حساب بنكي للمورد');
      case 'cheque':
        return tu('payment.cheque', 'Chèque');
      case 'banque':
        return tu('payment.bank', 'Banque');
      default:
        return method;
    }
  };

  const isArabicPdf = language === 'ar';
  const arabicPdfFontFile = 'NotoNaskhArabic-Regular.ttf';
  const arabicPdfFontName = 'NotoNaskhArabic';
  const arabicPdfFontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notonaskharabic/NotoNaskhArabic-Regular.ttf';
  const arabicPdfFontDataRef = useRef<string | null>(null);

  const getArabicPdfFontData = useCallback(async () => {
    if (arabicPdfFontDataRef.current) return arabicPdfFontDataRef.current;
    const cacheKey = 'expenses_pdf_font_ar_v1';
    const cached = window.localStorage.getItem(cacheKey);
    if (cached) {
      arabicPdfFontDataRef.current = cached;
      return cached;
    }
    const response = await fetch(arabicPdfFontUrl);
    if (!response.ok) throw new Error(`PDF font download failed (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    arabicPdfFontDataRef.current = base64;
    window.localStorage.setItem(cacheKey, base64);
    return base64;
  }, []);

  const createPdfDoc = useCallback(async (jsPDF: any) => {
    const doc = new jsPDF();
    if (isArabicPdf) {
      const fontData = await getArabicPdfFontData();
      doc.addFileToVFS(arabicPdfFontFile, fontData);
      doc.addFont(arabicPdfFontFile, arabicPdfFontName, 'normal');
      doc.setFont(arabicPdfFontName, 'normal');
    }
    return doc;
  }, [isArabicPdf, getArabicPdfFontData]);

  const today = new Date();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expenseType, setExpenseType] = useState<string>('');
  const [customExpenseType, setCustomExpenseType] = useState<string>('');
  const [showAddTypeInline, setShowAddTypeInline] = useState(false);
  const [newExpenseTypeName, setNewExpenseTypeName] = useState('');
  const [code, setCode] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedSupplierBank, setSelectedSupplierBank] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [note, setNote] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'espece' | 'compte_fournisseur' | 'cheque' | 'banque'>('all');
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [activeCardKey, setActiveCardKey] = useState<string>('total');

  const supplierBankProfiles = useMemo(() => {
    return (suppliers || [])
      .map((s) => ({
        id: String(s?.id || ''),
        name: String(s?.name || '').trim(),
        bankAccountName: String(s?.bankAccountName || s?.name || '').trim(),
        bankName: String(s?.bankName || '').trim(),
        rib: String(s?.rib || '').trim()
      }))
      .filter((s) => s.id && (s.bankAccountName || s.name));
  }, [suppliers]);

  const handleGenerateCode = () => {
    const todayStr = format(new Date(), 'yyyyMMdd');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setCode(`EXP-${todayStr}-${randomSuffix}`);
  };

  const handleAddExpense = async () => {
    if (!expenseType || !amount || !paymentMethod) {
      toast.error(tu('toast.fillRequired', 'Veuillez remplir tous les champs obligatoires'));
      return;
    }

    if (expenseType === 'autre' && !customExpenseType) {
      toast.error(tu('toast.specifyExpenseType', 'Veuillez préciser le type de dépense'));
      return;
    }

    if (paymentMethod === 'compte_fournisseur' && !selectedSupplierBank) {
      toast.error(tr('Veuillez sélectionner un compte bancaire fournisseur', 'يرجى اختيار حساب بنكي للمورد'));
      return;
    }

    let finalType = expenseType;
    if (expenseType === 'autre') {
      finalType = customExpenseType;
      await addExpenseType(customExpenseType);
    }

    const matchedSupplier = supplierBankProfiles.find(s => s.bankAccountName === selectedSupplierBank || s.id === selectedSupplierId);
    const finalSupplierId = selectedSupplierId || matchedSupplier?.id;
    const finalSupplierBank = selectedSupplierBank || matchedSupplier?.bankAccountName;

    const trimmedCode = code ? code.trim() : '';

    if (expenseToEdit) {
      await updateExpense(expenseToEdit.id, {
        type: finalType as any,
        code: trimmedCode,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod as any,
        date: date.toISOString(),
        note: note || undefined,
        supplierId: paymentMethod === 'compte_fournisseur' ? finalSupplierId : undefined,
        supplierBankName: paymentMethod === 'compte_fournisseur' ? finalSupplierBank : undefined,
        accountDetails: paymentMethod === 'compte_fournisseur' ? finalSupplierBank : undefined,
      });
      toast.success(tu('toast.expenseUpdated', 'Dépense mise à jour avec succès'));
    } else {
      const generatedId = (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
      const newExpense: Expense = {
        id: generatedId,
        type: finalType as any,
        code: trimmedCode,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod as any,
        date: date.toISOString(),
        note: note || undefined,
        supplierId: paymentMethod === 'compte_fournisseur' ? finalSupplierId : undefined,
        supplierBankName: paymentMethod === 'compte_fournisseur' ? finalSupplierBank : undefined,
        accountDetails: paymentMethod === 'compte_fournisseur' ? finalSupplierBank : undefined,
      };

      await addExpense(newExpense);
      toast.success(tu('toast.expenseAdded', 'Dépense ajoutée avec succès'));
    }
    
    resetForm();
    setDialogOpen(false);
  };

  const handleEditExpense = (expense: Expense) => {
    setExpenseToEdit(expense);
    setExpenseType(expense.type);
    setCode(expense.code || '');
    setAmount(expense.amount.toString());
    setPaymentMethod(expense.paymentMethod);
    setDate(new Date(expense.date));
    setNote(expense.note || '');
    if (expense.paymentMethod === 'compte_fournisseur') {
      const bankName = expense.supplierBankName || expense.accountDetails || '';
      setSelectedSupplierBank(bankName);
      const sup = supplierBankProfiles.find(s => s.id === expense.supplierId || s.bankAccountName === bankName);
      setSelectedSupplierId(sup?.id || expense.supplierId || '');
    } else {
      setSelectedSupplierId('');
      setSelectedSupplierBank('');
    }
    setDialogOpen(true);
  };

  const handleAddExpenseTypeToList = async () => {
    const nextType = newExpenseTypeName.trim();
    if (!nextType) {
      toast.error(tu('toast.specifyExpenseType', 'Veuillez préciser le type de dépense'));
      return;
    }
    const exists = expenseTypes.some((t) => t.trim().toLowerCase() === nextType.toLowerCase());
    if (exists) {
      toast.error(tr('Ce type existe déjà dans la liste', 'هذا النوع موجود بالفعل في القائمة'));
      return;
    }
    await addExpenseType(nextType);
    setExpenseType(nextType);
    setNewExpenseTypeName('');
    setShowAddTypeInline(false);
    toast.success(tr('Type de dépense ajouté avec succès', 'تمت إضافة نوع المصروف بنجاح'));
  };

  const resetForm = () => {
    setExpenseToEdit(null);
    setExpenseType('');
    setCustomExpenseType('');
    setShowAddTypeInline(false);
    setNewExpenseTypeName('');
    setCode('');
    setAmount('');
    setPaymentMethod('');
    setSelectedSupplierId('');
    setSelectedSupplierBank('');
    setDate(new Date());
    setNote('');
  };

  const handleDownloadPDF = async () => {
    const { jsPDF, autoTable } = await loadPdfTools();
    const doc = await createPdfDoc(jsPDF);
    doc.text(te('title', 'Liste des Dépenses'), 14, 16);

    const tableColumn = [te('type', 'Type'), te('code', 'Code'), te('date', 'Date'), te('paymentMethod', 'Mode de paiement'), te('note', 'Note'), te('amountMad', 'Montant (MAD)')];
    const tableRows: (string | number)[][] = [];

    filteredExpenses.forEach(expense => {
      const expenseData = [
        expense.type,
        expense.code || '-',
        new Date(expense.date).toLocaleDateString(uiLocale),
        paymentLabel(expense.paymentMethod),
        expense.note || '-',
        `-${expense.amount.toFixed(2)} DH`
      ];
      tableRows.push(expenseData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72] },
      styles: { font: isArabicPdf ? arabicPdfFontName : 'helvetica' },
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(10);
    doc.text(`${te('totalExpenses', 'Total des dépenses')}: -${totalExpenses.toFixed(2)} DH`, 14, finalY + 10);

    doc.save(`depenses_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const filteredExpenses = expenses.filter(expense => 
    ((expense.type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (expense.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (expense.note || '').toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!dateRange?.from || new Date(expense.date) >= dateRange.from) &&
    (!dateRange?.to || new Date(expense.date) <= dateRange.to) &&
    (paymentFilter === 'all' || expense.paymentMethod === paymentFilter)
  );

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const averageExpense = filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0;
  const maxExpense = filteredExpenses.length > 0 ? Math.max(...filteredExpenses.map((expense) => expense.amount)) : 0;

  const previousMonthExpenses = useMemo(() => {
    const now = new Date();
    const startPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return expenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startPreviousMonth && expenseDate <= endPreviousMonth;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    const startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return expenses
      .filter((expense) => new Date(expense.date) >= startCurrentMonth)
      .reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const monthDelta = currentMonthExpenses - previousMonthExpenses;
  const monthDeltaPercent =
    previousMonthExpenses > 0
      ? Math.round((monthDelta / previousMonthExpenses) * 100)
      : currentMonthExpenses > 0
        ? 100
        : 0;

  const paymentCounts = useMemo(() => {
    return {
      all: expenses.length,
      espece: expenses.filter(e => e.paymentMethod === 'espece').length,
      compte_fournisseur: expenses.filter(e => e.paymentMethod === 'compte_fournisseur').length,
      cheque: expenses.filter(e => e.paymentMethod === 'cheque').length,
      banque: expenses.filter(e => e.paymentMethod === 'banque').length,
    };
  }, [expenses]);

  // Compact Modern KPI Overview Cards Configuration
  const overviewCards = [
    {
      key: 'total',
      title: tr('Total des Charges', 'إجمالي النفقات'),
      value: totalExpenses,
      suffix: ' DH',
      decimals: 2,
      hint: tr('Cumul charges filtrées', 'مجموع النفقات المفلترة'),
      tag: tr('Sorties', 'المصروف'),
      progress: 100,
      icon: Receipt,
      shell: 'bg-gradient-to-br from-rose-600 via-pink-600 to-rose-700 border-rose-300/30 text-white',
      titleColor: 'text-rose-100',
      valueColor: 'text-white',
      hintColor: 'text-rose-100/90',
      tagColor: 'border-rose-200/40 bg-white/20 text-rose-100',
      iconWrap: 'bg-white/20 text-white',
      progressTrack: 'bg-white/25',
      progressBar: 'from-rose-100 via-pink-100 to-violet-100',
      hintIcon: TrendingDown
    },
    {
      key: 'count',
      title: tr("Nombre d'Opérations", 'عدد العمليات'),
      value: filteredExpenses.length,
      suffix: '',
      decimals: 0,
      hint: tr('Opérations enregistrées', 'عمليات مسجّلة'),
      tag: tr('Volume', 'العدد'),
      progress: Math.min(100, filteredExpenses.length * 5),
      icon: Layers,
      shell: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-indigo-400/30 text-white',
      titleColor: 'text-indigo-100',
      valueColor: 'text-white',
      hintColor: 'text-indigo-200/90',
      tagColor: 'border-indigo-300/40 bg-indigo-400/20 text-indigo-100',
      iconWrap: 'bg-white/15 text-white',
      progressTrack: 'bg-white/20',
      progressBar: 'from-cyan-300 via-indigo-200 to-fuchsia-200',
      hintIcon: CheckCircle2
    },
    {
      key: 'average',
      title: tr('Moyenne par Charge', 'متوسط المصروف'),
      value: averageExpense,
      suffix: ' DH',
      decimals: 2,
      hint: tr('Montant moyen / dépense', 'متوسط المعاملة الواحدة'),
      tag: tr('Moyenne', 'المتوسط'),
      progress: totalExpenses > 0 ? Math.min(100, Math.round((averageExpense / totalExpenses) * 100)) : 0,
      icon: Wallet,
      shell: 'bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 border-emerald-300/30 text-white',
      titleColor: 'text-emerald-100',
      valueColor: 'text-white',
      hintColor: 'text-emerald-100',
      tagColor: 'border-emerald-200/40 bg-white/20 text-emerald-100',
      iconWrap: 'bg-white/20 text-white',
      progressTrack: 'bg-white/25',
      progressBar: 'from-lime-200 via-emerald-100 to-cyan-100',
      hintIcon: DollarSign
    },
    {
      key: 'max',
      title: tr('Transaction Max', 'أعلى معاملة'),
      value: maxExpense,
      suffix: ' DH',
      decimals: 2,
      hint: `${monthDeltaPercent > 0 ? '+' : ''}${monthDeltaPercent}% ${tr('vs mois précédent', 'مقارنة بالسابق')}`,
      tag: tr('Pic', 'الأعلى'),
      progress: totalExpenses > 0 ? Math.min(100, Math.round((maxExpense / totalExpenses) * 100)) : 0,
      icon: Sparkles,
      shell: 'bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 border-amber-300/30 text-white',
      titleColor: 'text-amber-50',
      valueColor: 'text-white',
      hintColor: 'text-amber-100/95',
      tagColor: 'border-amber-200/40 bg-white/20 text-amber-50',
      iconWrap: 'bg-white/20 text-white',
      progressTrack: 'bg-white/25',
      progressBar: 'from-yellow-200 via-orange-100 to-rose-100',
      hintIcon: TrendingUp
    }
  ];

  const hasActiveFilters = searchQuery !== '' || paymentFilter !== 'all' || dateRange !== undefined;

  const resetFilters = () => {
    setSearchQuery('');
    setPaymentFilter('all');
    setDateRange(undefined);
  };

  return (
    <div className="app-page-shell p-4 md:p-8 space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="app-page-title text-2xl md:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl border border-rose-200/50">
              <Receipt className="h-7 w-7" />
            </div>
            <span>{tr('Gestion des Dépenses', 'إدارة المصاريف والنفقات')}</span>
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>{formatDateUi(today, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            className="h-10 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-xl font-semibold shadow-sm"
          >
            <Download className="w-4 h-4 mr-2 text-slate-500" />
            {tu('actions.exportPdf', 'Exporter PDF')}
          </Button>

          <Button 
            onClick={() => { resetForm(); setDialogOpen(true); }}
            className="h-10 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white shadow-lg shadow-rose-500/20 rounded-xl font-bold transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" />
            {tu('actions.newExpense', 'Nouvelle Charge')}
          </Button>
        </div>
      </div>

      {/* Compact Overview Cards (4 KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {overviewCards.map((card, index) => {
          const Icon = card.icon;
          const HintIcon = card.hintIcon || CheckCircle2;
          const isActive = activeCardKey === card.key;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.35, ease: 'easeOut' }}
              whileHover={{ y: -3 }}
              onMouseEnter={() => setActiveCardKey(card.key)}
              tabIndex={0}
            >
              <Card
                className={cn(
                  "relative overflow-hidden rounded-xl border p-3.5 sm:p-4 shadow-sm transition-all duration-300",
                  card.shell,
                  isActive ? "ring-2 ring-white/50 shadow-md" : ""
                )}
              >
                <div className="space-y-2 relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold ${card.titleColor}`}>{card.title}</span>
                      <Badge variant="outline" className={`h-4 rounded px-1.5 text-[9px] font-bold ${card.tagColor}`}>
                        {card.tag}
                      </Badge>
                    </span>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${card.iconWrap}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <AnimatedMetricValue
                      value={card.value}
                      suffix={card.suffix}
                      decimals={card.decimals}
                      className={`text-xl sm:text-2xl font-black tracking-tight ${card.valueColor}`}
                    />
                    <span className={`text-[11px] font-bold ${card.hintColor}`}>
                      {Math.max(0, Math.min(100, card.progress))}%
                    </span>
                  </div>

                  <div className={`h-1.5 w-full overflow-hidden rounded-full ${card.progressTrack}`}>
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${card.progressBar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(6, Math.min(100, card.progress))}%` }}
                      transition={{ delay: 0.1 + index * 0.08, duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <p className={`flex items-center gap-1 text-[11px] truncate ${card.hintColor}`}>
                      <HintIcon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{card.hint}</span>
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Unified Executive Control & Filter Bar */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
        {/* Row 1: Search & Payment Method Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tu('filters.searchPlaceholder', 'Rechercher par type, code ou note...')}
              className="pl-10 pr-9 h-10 rounded-xl border-slate-200 focus:ring-rose-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Payment Method Quick Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl self-start lg:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setPaymentFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap",
                paymentFilter === 'all'
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span>{tu('filters.all', 'Tous')}</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4 bg-slate-200 text-slate-700">
                {paymentCounts.all}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter('espece')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap",
                paymentFilter === 'espece'
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-emerald-700"
              )}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>{tu('payment.cash', 'Espèce')}</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4 bg-emerald-100 text-emerald-700">
                {paymentCounts.espece}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter('compte_fournisseur')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap",
                paymentFilter === 'compte_fournisseur'
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-slate-600 hover:text-purple-700"
              )}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>{tr('Compte Fournisseur', 'حساب المورد')}</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4 bg-purple-100 text-purple-700">
                {paymentCounts.compte_fournisseur}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter('cheque')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap",
                paymentFilter === 'cheque'
                  ? "bg-white text-amber-700 shadow-sm"
                  : "text-slate-600 hover:text-amber-700"
              )}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{tu('payment.cheque', 'Chèque')}</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4 bg-amber-100 text-amber-700">
                {paymentCounts.cheque}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter('banque')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap",
                paymentFilter === 'banque'
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-indigo-700"
              )}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{tu('payment.bank', 'Banque')}</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4 bg-indigo-100 text-indigo-700">
                {paymentCounts.banque}
              </Badge>
            </button>
          </div>
        </div>

        {/* Row 2: Date Filters & Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    "h-9 px-3 text-xs rounded-xl border-slate-200 justify-start text-left bg-white",
                    !dateRange && "text-slate-500"
                  )}
                >
                  <Calendar className="mr-2 h-3.5 w-3.5 text-rose-500" />
                  {dateRange?.from
                    ? dateRange.to
                      ? `${formatDateUi(dateRange.from, { day: '2-digit', month: 'short' })} - ${formatDateUi(dateRange.to, { day: '2-digit', month: 'short' })}`
                      : formatDateUi(dateRange.from, { day: '2-digit', month: 'long', year: 'numeric' })
                    : tu('filters.allDates', 'Toutes les dates')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="start">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  className="bg-white p-4"
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs rounded-xl border-slate-200 hover:border-rose-300 hover:bg-rose-50/50"
              onClick={() => {
                const now = new Date();
                setDateRange({ from: now, to: now });
              }}
            >
              {tr("Aujourd'hui", 'اليوم')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs rounded-xl border-slate-200 hover:border-rose-300 hover:bg-rose-50/50"
              onClick={() => {
                const now = new Date();
                const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
                setDateRange({ from, to: now });
              }}
            >
              {tu('filters.last7Days', '7 jours')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs rounded-xl border-slate-200 hover:border-rose-300 hover:bg-rose-50/50"
              onClick={() => {
                const now = new Date();
                const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
                setDateRange({ from, to: now });
              }}
            >
              {tu('filters.last30Days', '30 jours')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs rounded-xl border-slate-200 hover:border-rose-300 hover:bg-rose-50/50"
              onClick={() => {
                const now = new Date();
                const from = new Date(now.getFullYear(), now.getMonth(), 1);
                setDateRange({ from, to: now });
              }}
            >
              {tr('Ce mois', 'هذا الشهر')}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-9 px-2.5 text-xs text-slate-500 hover:text-slate-800"
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {tu('actions.reset', 'Réinitialiser')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>{tr('Total affiché :', 'المعروض:')}</span>
            <Badge variant="outline" className="font-bold text-slate-800 bg-slate-50 border-slate-200">
              {filteredExpenses.length} {tr('dépenses', 'مصاريف')}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Expenses Table Card */}
      <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
        <div className="smart-scroll-x hidden md:block">
          <Table className="smart-table">
            <TableHeader className="bg-slate-50/80 border-b border-slate-100">
              <TableRow className="border-slate-100">
                <TableHead className="text-slate-700 font-bold">{tu('table.type', 'Type')}</TableHead>
                <TableHead className="text-slate-700 font-bold">{tu('table.code', 'Code')}</TableHead>
                <TableHead className="text-slate-700 font-bold">{tu('table.date', 'Date')}</TableHead>
                <TableHead className="text-slate-700 font-bold">{tu('table.paymentMethod', 'Mode de paiement')}</TableHead>
                <TableHead className="text-slate-700 font-bold">{tu('table.note', 'Note')}</TableHead>
                <TableHead className="text-slate-700 font-bold text-right">{tu('table.amount', 'Montant')}</TableHead>
                <TableHead className="text-slate-700 font-bold text-right pr-6">{tu('table.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Receipt className="w-12 h-12 mb-2 opacity-25" />
                      <p className="text-base font-bold text-slate-700">{tu('empty.noExpenseFound', 'Aucune dépense trouvée')}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{tu('empty.adjustFilters', 'Vérifiez vos filtres ou ajoutez une nouvelle charge')}</p>
                      {hasActiveFilters && (
                        <Button variant="outline" size="sm" onClick={resetFilters} className="mt-3 rounded-xl text-xs">
                          {tr('Effacer les filtres', 'مسح الفلاتر')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.id} className="group hover:bg-slate-50/60 transition-colors border-slate-100">
                    <TableCell>
                      <Badge variant="outline" className="bg-white border-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg capitalize">
                        {expense.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium font-mono text-xs">{expense.code || '-'}</TableCell>
                    <TableCell className="text-slate-600 font-medium">{formatDateUi(expense.date)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {expense.paymentMethod === 'espece' && <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />}
                        {expense.paymentMethod === 'compte_fournisseur' && <Landmark className="w-4 h-4 text-purple-600 shrink-0" />}
                        {expense.paymentMethod === 'cheque' && <Receipt className="w-4 h-4 text-amber-500 shrink-0" />}
                        {expense.paymentMethod === 'banque' && <CreditCard className="w-4 h-4 text-indigo-500 shrink-0" />}
                        <div className="flex flex-col">
                          <span className="capitalize text-slate-700 font-medium text-xs">
                            {paymentLabel(expense.paymentMethod)}
                          </span>
                          {expense.paymentMethod === 'compte_fournisseur' && (expense.supplierBankName || expense.accountDetails) && (
                            <span className="text-[11px] text-purple-600 font-semibold tracking-tight">
                              {expense.supplierBankName || expense.accountDetails}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-slate-500 text-xs italic">{expense.note || '-'}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-extrabold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg text-sm">
                        -{expense.amount.toFixed(2)} DH
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          onClick={() => handleEditExpense(expense)}
                          title={tu('actions.edit', 'Modifier')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          onClick={() => {
                            if (window.confirm(tu('confirm.deleteExpense', 'Êtes-vous sûr de vouloir supprimer cette dépense ?'))) {
                              deleteExpense(expense.id);
                              toast.success(tu('toast.expenseDeleted', 'Dépense supprimée avec succès'));
                            }
                          }}
                          title={tu('actions.delete', 'Supprimer')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {filteredExpenses.length > 0 && (
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-t-2 border-slate-200">
                  <TableCell colSpan={5} className="py-4 text-base font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-5 bg-rose-500 rounded-full" />
                      <span>{tu('table.totalFilteredExpenses', 'Total des charges filtrées')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <div className="inline-flex flex-col items-end">
                      <span className="text-xl font-black text-rose-700">-{totalExpenses.toFixed(2)} DH</span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{tu('table.totalAmountVatIncluded', 'Montant total TTC')}</span>
                    </div>
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View Cards */}
        <div className="md:hidden grid grid-cols-1 gap-2.5 p-3 sm:p-4">
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <p className="font-semibold">{tu('empty.noExpenseFound', 'Aucune dépense trouvée')}</p>
            </div>
          ) : (
            filteredExpenses.map((expense) => (
              <div key={expense.id} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 font-bold text-xs capitalize">
                    {expense.type}
                  </Badge>
                  <span className="text-xs text-slate-500 font-medium">{formatDateUi(expense.date)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                    {expense.paymentMethod === 'espece' && <Banknote className="w-3.5 h-3.5 text-emerald-500" />}
                    {expense.paymentMethod === 'compte_fournisseur' && <Landmark className="w-3.5 h-3.5 text-purple-600" />}
                    {expense.paymentMethod === 'cheque' && <Receipt className="w-3.5 h-3.5 text-amber-500" />}
                    {expense.paymentMethod === 'banque' && <CreditCard className="w-3.5 h-3.5 text-indigo-500" />}
                    <span>{paymentLabel(expense.paymentMethod)}</span>
                  </div>
                  <span className="font-black text-rose-600 text-sm">
                    -{expense.amount.toFixed(2)} DH
                  </span>
                </div>

                {expense.paymentMethod === 'compte_fournisseur' && (expense.supplierBankName || expense.accountDetails) && (
                  <p className="text-[11px] text-purple-700 bg-purple-50 p-1.5 rounded-lg border border-purple-100 font-semibold">
                    {expense.supplierBankName || expense.accountDetails}
                  </p>
                )}

                {expense.note && (
                  <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {expense.note}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400 font-mono">{expense.code || '-'}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditExpense(expense)}
                      className="text-xs h-8 text-indigo-600 hover:bg-indigo-50"
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      {tu('actions.edit', 'Modifier')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm(tu('confirm.deleteExpense', 'Êtes-vous sûr de vouloir supprimer cette dépense ?'))) {
                          deleteExpense(expense.id);
                          toast.success(tu('toast.expenseDeleted', 'Dépense supprimée avec succès'));
                        }
                      }}
                      className="text-xs h-8 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      {tu('actions.delete', 'Supprimer')}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}

          {filteredExpenses.length > 0 && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs mt-1">
              <span className="font-bold text-slate-800">{tu('table.totalFilteredExpenses', 'Total des charges filtrées')}</span>
              <span className="text-base font-black text-rose-700">-{totalExpenses.toFixed(2)} DH</span>
            </div>
          )}
        </div>
      </Card>

      {/* New / Edit Expense Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl p-0 border-none overflow-hidden shadow-2xl rounded-2xl max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-indigo-950 p-6 text-white shrink-0 relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <DialogHeader>
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner border border-white/20">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-xl font-black text-white tracking-wide">
                      {expenseToEdit ? tu('dialog.editTitle', 'Modifier la Charge') : tu('dialog.newTitle', 'Nouvelle Charge')}
                    </DialogTitle>
                    <Badge className="bg-white/20 text-white hover:bg-white/30 border-none text-[11px] font-semibold px-2">
                      <Sparkles className="w-3 h-3 mr-1 text-amber-300 inline" />
                      {expenseToEdit ? tr('Édition', 'تعديل') : tr('Enregistrement', 'تسجيل')}
                    </Badge>
                  </div>
                  <CardDescription className="text-rose-100/90 text-xs mt-1 font-medium">
                    {expenseToEdit 
                      ? tr('Mettre à jour les paramètres et le mode de règlement de la charge', 'تحديث بيانات ومصدر دفع المصروف') 
                      : tr('Enregistrer une charge avec affectation automatique du compte', 'تسجيل مصروف جديد مع الخصم التلقائي من الحساب المالي المختار')}
                  </CardDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          {/* Form Content */}
          <div className="p-6 space-y-4 bg-slate-50/40 overflow-y-auto flex-1">
            {/* Type de Dépense */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <Label htmlFor="type" className="text-slate-800 font-bold text-sm flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-rose-500" />
                  {tu('form.expenseTypeLabel', 'Type de dépense')} <span className="text-rose-500">*</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2"
                  onClick={() => setShowAddTypeInline((prev) => !prev)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {tr('Nouveau type', 'نوع جديد')}
                </Button>
              </div>

              <Select value={expenseType} onValueChange={setExpenseType}>
                <SelectTrigger className="h-11 bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl">
                  <SelectValue placeholder={tu('form.chooseType', 'Choisir un type')} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl max-h-60">
                  {expenseTypes.map(type => (
                    <SelectItem key={type} value={type} className="rounded-lg capitalize font-medium">{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {showAddTypeInline && (
                <div className="flex gap-2 pt-2 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 animate-in fade-in-50 duration-200">
                  <Input
                    value={newExpenseTypeName}
                    onChange={(e) => setNewExpenseTypeName(e.target.value)}
                    placeholder={tr('Nom du nouveau type...', 'اسم النوع الجديد...')}
                    className="h-9 bg-white border-indigo-200 text-sm"
                  />
                  <Button type="button" size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 font-medium" onClick={handleAddExpenseTypeToList}>
                    {tr('Ajouter', 'إضافة')}
                  </Button>
                </div>
              )}

              {expenseType === 'autre' && (
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="customExpenseType" className="text-slate-700 text-xs font-semibold">{tu('form.customExpenseNameLabel', 'Préciser le nom de la dépense *')}</Label>
                  <Input
                    id="customExpenseType"
                    value={customExpenseType}
                    onChange={(e) => setCustomExpenseType(e.target.value)}
                    placeholder={tu('form.customExpenseNamePlaceholder', 'Entrez le nom de la dépense')}
                    className="h-10 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl font-semibold"
                  />
                </div>
              )}
            </div>

            {/* Code & Montant Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Code */}
              <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <Label htmlFor="code" className="text-slate-800 font-bold text-sm">
                    {tu('form.codeLabel', 'Code')} <span className="text-xs font-normal text-slate-400">({tr('facultatif', 'اختياري')})</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateCode}
                    className="h-6 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 px-2"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    {tr('Auto', 'تلقائي')}
                  </Button>
                </div>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={tu('form.codePlaceholder', 'Ex: EXP-20261024-01')}
                  className="h-11 bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl font-bold font-mono text-slate-800"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <Label htmlFor="amount" className="text-slate-800 font-bold text-sm">
                  {tu('form.amountLabel', 'Montant (MAD)')} <span className="text-rose-500">*</span>
                </Label>
                <div className="relative group">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rose-600 transition-colors" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-9 pr-12 h-11 bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl font-black text-rose-600 text-lg"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">DH</span>
                </div>
              </div>
            </div>

            {/* Mode de règlement */}
            <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <Label className="text-slate-800 font-bold text-sm flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-purple-600" />
                  {tu('form.paymentMethodLabel', 'Mode de règlement')} <span className="text-rose-500">*</span>
                </Label>
                {paymentMethod === 'compte_fournisseur' && (
                  <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200 text-[10px] font-bold">
                    {tr('Débit Fournisseur Direct', 'خصم بنكي مباشر')}
                  </Badge>
                )}
              </div>

              {/* Visual payment mode selector grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Espèce */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('espece');
                    setSelectedSupplierId('');
                    setSelectedSupplierBank('');
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center gap-1.5",
                    paymentMethod === 'espece'
                      ? "border-emerald-500 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20 shadow-sm font-bold"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Banknote className={cn("w-5 h-5", paymentMethod === 'espece' ? "text-emerald-600" : "text-slate-400")} />
                  <span className="text-xs font-bold leading-tight">{tu('payment.cash', 'Espèce')}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{tr('Caisse', 'الصندوق')}</span>
                </button>

                {/* Compte Bancaire Fournisseur */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('compte_fournisseur');
                    if (!selectedSupplierBank && supplierBankProfiles.length > 0) {
                      setSelectedSupplierId(supplierBankProfiles[0].id);
                      setSelectedSupplierBank(supplierBankProfiles[0].bankAccountName);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center gap-1.5",
                    paymentMethod === 'compte_fournisseur'
                      ? "border-purple-600 bg-purple-50/80 text-purple-950 ring-2 ring-purple-500/20 shadow-sm font-bold"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Landmark className={cn("w-5 h-5", paymentMethod === 'compte_fournisseur' ? "text-purple-600" : "text-slate-400")} />
                  <span className="text-xs font-bold leading-tight">{tr('Compte Fournisseur', 'حساب المورد')}</span>
                  <span className="text-[10px] text-purple-600/80 font-semibold">{tr('Débit auto', 'خصم بنكي')}</span>
                </button>

                {/* Chèque */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('cheque');
                    setSelectedSupplierId('');
                    setSelectedSupplierBank('');
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center gap-1.5",
                    paymentMethod === 'cheque'
                      ? "border-amber-500 bg-amber-50/70 text-amber-900 ring-2 ring-amber-500/20 shadow-sm font-bold"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Receipt className={cn("w-5 h-5", paymentMethod === 'cheque' ? "text-amber-600" : "text-slate-400")} />
                  <span className="text-xs font-bold leading-tight">{tu('payment.cheque', 'Chèque')}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{tr('Portefeuille', 'شيك')}</span>
                </button>

                {/* Banque Société */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('banque');
                    setSelectedSupplierId('');
                    setSelectedSupplierBank('');
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center gap-1.5",
                    paymentMethod === 'banque'
                      ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20 shadow-sm font-bold"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <CreditCard className={cn("w-5 h-5", paymentMethod === 'banque' ? "text-indigo-600" : "text-slate-400")} />
                  <span className="text-xs font-bold leading-tight">{tu('payment.bank', 'Banque')}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{tr('Société', 'حساب الشركة')}</span>
                </button>
              </div>

              {/* Dedicated Supplier Bank Account Selector when compte_fournisseur is chosen */}
              {paymentMethod === 'compte_fournisseur' && (
                <div className="mt-3 p-4 bg-purple-50/60 rounded-xl border border-purple-200 space-y-3 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      {tr('Sélectionner le compte bancaire fournisseur *', 'اختر حساب بنك المورد *')}
                    </Label>
                    <span className="text-[11px] text-purple-600 font-semibold">
                      {supplierBankProfiles.length} {tr('comptes disponibles', 'حسابات متوفرة')}
                    </span>
                  </div>

                  <Select
                    value={selectedSupplierBank}
                    onValueChange={(val) => {
                      setSelectedSupplierBank(val);
                      const matched = supplierBankProfiles.find(s => s.bankAccountName === val);
                      if (matched) setSelectedSupplierId(matched.id);
                    }}
                  >
                    <SelectTrigger className="h-11 bg-white border-purple-200 focus:ring-2 focus:ring-purple-500 rounded-xl font-medium text-slate-800">
                      <SelectValue placeholder={tr('Choisir un compte bancaire fournisseur', 'اختر حساب بنك المورد')} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-purple-100 shadow-xl max-h-60">
                      {supplierBankProfiles.map((sup) => (
                        <SelectItem key={sup.id} value={sup.bankAccountName} className="rounded-lg py-2">
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-slate-800">{sup.bankAccountName}</span>
                            <span className="text-[11px] text-slate-500">
                              {sup.name !== sup.bankAccountName ? `${sup.name} · ` : ''}
                              {sup.bankName ? `${sup.bankName} ` : ''}
                              {sup.rib ? `(RIB: ${sup.rib.slice(-6)})` : ''}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Impact notice banner */}
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/90 border border-purple-200/80 text-xs text-purple-900">
                    <ArrowDownRight className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        {tr('Déduction automatique du compte bancaire fournisseur :', 'خصم تلقائي من حساب بنك المورد :')}
                      </p>
                      <p className="text-[11px] text-purple-700 mt-0.5">
                        {tr(
                          `Le montant de ${amount ? `${parseFloat(amount).toFixed(2)} DH` : '0.00 DH'} sera débité directement du compte "${selectedSupplierBank || 'Fournisseur'}" dans la section Comptes Bancaires Fournisseurs.`,
                          `سيتم خصم مبلغ ${amount ? `${parseFloat(amount).toFixed(2)} DH` : '0.00 DH'} مباشرة من حساب "${selectedSupplierBank || 'المورد'}" في قسم حسابات بنوك الموردين.`
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Date de l'opération */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <Label htmlFor="date" className="text-slate-800 font-bold text-sm flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-rose-500" />
                {tu('form.operationDateLabel', "Date de l'opération")} <span className="text-rose-500">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-11 bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl justify-start text-left font-semibold text-slate-700",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4 text-rose-500" />
                    {date ? formatDateUi(date, { day: '2-digit', month: 'long', year: 'numeric' }) : <span>{tu('form.chooseDate', 'Choisir une date')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="center">
                  <CalendarComponent
                    mode="single"
                    selected={date}
                    onSelect={(date) => date && setDate(date)}
                    initialFocus
                    className="bg-white p-4"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Note / Détails */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <Label htmlFor="note" className="text-slate-800 font-bold text-sm">
                {tu('form.noteLabel', 'Note / Observations')} <span className="text-xs font-normal text-slate-400">({tr('facultatif', 'اختياري')})</span>
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tu('form.notePlaceholder', 'Précisions ou référence sur la dépense...')}
                className="bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl resize-none min-h-[85px] text-sm"
              />
            </div>

            {/* Live Financial Summary */}
            {amount && parseFloat(amount) > 0 && (
              <div className="p-3.5 bg-gradient-to-r from-rose-50 to-indigo-50/60 rounded-xl border border-rose-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 font-bold">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">
                      {paymentMethod === 'compte_fournisseur' 
                        ? tr(`Débit Compte Fournisseur (${selectedSupplierBank || 'Non spécifié'})`, `خصم من حساب بنك المورد (${selectedSupplierBank || 'غير محدد'})`) 
                        : paymentMethod === 'espece' 
                          ? tr('Débit Caisse (Espèce)', 'خصم من الصندوق (نقدًا)')
                          : paymentMethod === 'cheque' 
                            ? tr('Chèque émis', 'شيك صادر')
                            : tr('Débit Banque Société', 'خصم من الحساب البنكي')}
                    </span>
                    <span className="text-slate-500 text-[11px] font-medium">
                      {expenseType || tr('Charge générale', 'مصروف عام')} {code ? `· ${code}` : ''}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-rose-600 block">
                    -{parseFloat(amount).toFixed(2)} DH
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">TTC</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
                className="flex-1 sm:flex-none h-11 border-slate-200 font-semibold rounded-xl hover:bg-slate-50 px-5"
              >
                {tu('actions.cancel', 'Annuler')}
              </Button>
              <Button
                onClick={handleAddExpense}
                className="flex-1 sm:flex-none h-11 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 shadow-md hover:shadow-lg transition-all font-bold rounded-xl text-white px-6"
              >
                {expenseToEdit ? (
                  <>
                    <Save className="w-4 h-4 mr-1.5" />
                    {tu('actions.update', 'Mettre à jour')}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1.5" />
                    {tu('actions.save', 'Enregistrer la charge')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
