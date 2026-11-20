// Top-level imports
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Repair } from '@/types';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  Truck,
  FileDown,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  History,
  CreditCard,
  Banknote,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShieldAlert,
  X,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { loadPdfTools } from '@/lib/pdf';
import { motion, useMotionValue, useReducedMotion, useTransform, animate } from 'framer-motion';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

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

const Repairs = () => {
  const { trucks, repairs, addRepair, updateRepair, deleteRepair, updateTruck } = useApp();
  const { toast } = useToast();
  const t = useT();
  const { language } = useLanguage();
  const ru = (key: string, fallback: string) => t(`repairs.ui.${key}`, fallback);
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const uiLocale = language === 'ar' ? 'ar-MA' : 'fr-MA';

  const handleDownloadPDF = async (repair: Repair) => {
    const { jsPDF, autoTable } = await loadPdfTools();
    const doc = new jsPDF();
    const truck = trucks.find(t => t.id === repair.truckId);
    const typeLabel = repair.type === 'mecanique' ? tr('Mécanique', 'ميكانيك') : repair.type === 'electrique' ? tr('Électrique', 'كهربائي') : tr('Garage', 'مرآب');
    const paymentMethodMap: { [key: string]: string } = {
      especes: tr('Espèces', 'نقدًا'),
      cheque: tr('Chèque', 'شيك'),
      virement: tr('Virement', 'تحويل'),
    };

    doc.setFillColor(249, 115, 22); // orange-500
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    const isAr = language === 'ar';
    doc.text(isAr ? "سند إصلاح" : "BON DE RÉPARATION", 105, 25, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    const dateLabel = isAr ? "التاريخ" : "Date";
    const refLabel = isAr ? "المرجع" : "Référence";
    doc.text(`${dateLabel}: ${new Date(repair.date).toLocaleDateString(uiLocale, { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 50);
    doc.text(`${refLabel}: REP-${repair.id.slice(0, 8).toUpperCase()}`, 14, 58);

    autoTable(doc, {
      startY: 70,
      head: [[isAr ? 'البند' : 'Désignation', isAr ? 'التفاصيل' : 'Détails']],
      body: [
        [isAr ? 'المركبة' : 'Véhicule', truck?.matricule || 'N/A'],
        [isAr ? 'نوع الإصلاح' : 'Type de Réparation', isAr ? (repair.type === 'mecanique' ? 'ميكانيك' : repair.type === 'electrique' ? 'كهربائي' : 'مرآب') : typeLabel],
        [isAr ? 'الوصف' : 'Description', repair.remarks],
        [isAr ? 'طريقة الدفع' : 'Mode de Paiement', paymentMethodMap[repair.paymentMethod] || repair.paymentMethod],
        [isAr ? 'الحالة' : 'Statut', repair.debtAmount > 0 ? (isAr ? 'مدفوع جزئياً' : 'Partiellement Payé') : (isAr ? 'مدفوع' : 'Payé')],
      ],
      headStyles: { fillColor: [249, 115, 22] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(14);
    doc.text(isAr ? "الملخص المالي" : "Récapitulatif Financier", 14, finalY);
    
    autoTable(doc, {
      startY: finalY + 5,
      body: [
        [isAr ? 'التكلفة الإجمالية' : 'Coût Total', `${repair.totalCost.toFixed(2)} MAD`],
        [isAr ? 'المبلغ المدفوع' : 'Montant Payé', `${repair.paidAmount.toFixed(2)} MAD`],
        [isAr ? 'المتبقي (دين)' : 'Reste à Payer (Dette)', `${repair.debtAmount.toFixed(2)} MAD`],
      ],
      styles: { fontSize: 11 },
      columnStyles: { 0: { fontStyle: 'bold' } },
    });

    doc.save(`reparation-${truck?.matricule || 'vehicule'}-${format(new Date(repair.date), 'dd-MM-yyyy')}.pdf`);
  };

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRepair, setEditingRepair] = useState<Repair | null>(null);
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [repairToSettle, setRepairToSettle] = useState<Repair | null>(null);
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<'especes' | 'cheque' | 'virement'>('especes');
  const [debtPaymentAmount, setDebtPaymentAmount] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    truckId: '',
    type: 'mecanique' as 'mecanique' | 'electrique' | 'garage',
    totalCost: '',
    paidAmount: '',
    paymentMethod: 'especes' as 'especes' | 'cheque' | 'virement',
    date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('tous');
  const [periodFilter, setPeriodFilter] = useState('toutes');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'tous' | 'avec-dette' | 'reglees'>('tous');
  const [activeOverviewCard, setActiveOverviewCard] = useState('total');

  // Stats calculation
  const stats = useMemo(() => {
    const total = repairs.reduce((acc, r) => acc + r.totalCost, 0);
    const paid = repairs.reduce((acc, r) => acc + r.paidAmount, 0);
    const debt = repairs.reduce((acc, r) => acc + r.debtAmount, 0);
    const settlementRate = total > 0 ? Math.round((paid / total) * 100) : 0;
    const avgCost = repairs.length > 0 ? total / repairs.length : 0;
    return { total, paid, debt, count: repairs.length, settlementRate, avgCost };
  }, [repairs]);

  const debtRepairsCount = useMemo(() => repairs.filter(r => r.debtAmount > 0).length, [repairs]);
  const paidRepairsCount = useMemo(() => repairs.filter(r => r.debtAmount <= 0).length, [repairs]);

  // Compact Modern Overview Cards configuration
  const overviewCards = [
    {
      key: 'count',
      title: tr('Nombre de Réparations', 'عدد الإصلاحات'),
      value: stats.count,
      suffix: '',
      decimals: 0,
      hint: tr('Opérations enregistrées', 'عمليات مسجّلة'),
      tag: tr('Volume', 'الحجم'),
      progress: Math.min(100, stats.count * 10),
      icon: History,
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
      key: 'total',
      title: tr('Coût Total', 'التكلفة الإجمالية'),
      value: stats.total,
      suffix: ' MAD',
      decimals: 0,
      hint: tr('Cumul total des coûts', 'إجمالي التكاليف'),
      tag: tr('Budget', 'الميزانية'),
      progress: stats.settlementRate,
      icon: Wrench,
      shell: 'bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 border-amber-300/30 text-white',
      titleColor: 'text-amber-50',
      valueColor: 'text-white',
      hintColor: 'text-amber-100/95',
      tagColor: 'border-amber-200/40 bg-white/20 text-amber-50',
      iconWrap: 'bg-white/20 text-white',
      progressTrack: 'bg-white/25',
      progressBar: 'from-yellow-200 via-orange-100 to-rose-100',
      hintIcon: DollarSign
    },
    {
      key: 'paid',
      title: tr('Montant Réglé', 'المبلغ المسدَّد'),
      value: stats.paid,
      suffix: ' MAD',
      decimals: 0,
      hint: tr('Montant total payé', 'إجمالي المبلغ المدفوع'),
      tag: tr('Cashflow', 'التدفق النقدي'),
      progress: stats.settlementRate,
      icon: CheckCircle2,
      shell: 'bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 border-emerald-300/30 text-white',
      titleColor: 'text-emerald-100',
      valueColor: 'text-white',
      hintColor: 'text-emerald-100',
      tagColor: 'border-emerald-200/40 bg-white/20 text-emerald-100',
      iconWrap: 'bg-white/20 text-white',
      progressTrack: 'bg-white/25',
      progressBar: 'from-lime-200 via-emerald-100 to-cyan-100',
      hintIcon: CheckCircle2
    },
    {
      key: 'debt',
      title: tr('Dettes Restantes', 'الديون المتبقية'),
      value: stats.debt,
      suffix: ' MAD',
      decimals: 0,
      hint: tr('Montant à régulariser', 'المبلغ الواجب تسويته'),
      tag: tr('Risque', 'المخاطر'),
      progress: stats.total > 0 ? Math.round((stats.debt / stats.total) * 100) : 0,
      icon: AlertCircle,
      shell: 'bg-gradient-to-br from-rose-600 via-pink-600 to-rose-700 border-rose-300/30 text-white',
      titleColor: 'text-rose-100',
      valueColor: 'text-white',
      hintColor: 'text-rose-100',
      tagColor: 'border-rose-200/40 bg-white/20 text-rose-100',
      iconWrap: 'bg-white/20 text-white',
      progressTrack: 'bg-white/25',
      progressBar: 'from-rose-100 via-pink-100 to-violet-100',
      hintIcon: AlertCircle
    }
  ];

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.truckId || !formData.totalCost || !formData.paidAmount || !formData.remarks) {
      toast({
        title: ru('toast.error', 'Erreur'),
        description: ru('toast.fillRequired', 'Veuillez remplir tous les champs obligatoires'),
        variant: "destructive"
      });
      return;
    }

    const totalCost = parseFloat(formData.totalCost);
    const paidAmount = parseFloat(formData.paidAmount);

    if (paidAmount > totalCost) {
      toast({
        title: ru('toast.error', 'Erreur'),
        description: ru('toast.paidExceedsTotal', 'Le montant payé ne peut pas être supérieur au coût total'),
        variant: "destructive"
      });
      return;
    }

    if (isEditing && editingRepair) {
      updateRepair(editingRepair.id, {
        date: formData.date,
        truckId: formData.truckId,
        type: formData.type,
        totalCost,
        paidAmount,
        debtAmount: totalCost - paidAmount,
        paymentMethod: formData.paymentMethod,
        remarks: formData.remarks
      });
    } else {
      const newRepair: Repair = {
        id: (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
        date: formData.date,
        truckId: formData.truckId,
        type: formData.type,
        totalCost,
        paidAmount,
        debtAmount: totalCost - paidAmount,
        paymentMethod: formData.paymentMethod,
        remarks: formData.remarks
      };
      addRepair(newRepair);

      if (newRepair.type === 'garage' && newRepair.truckId) {
        updateTruck(newRepair.truckId, { isActive: false, reposReason: 'Garage' });
      }
    }

    setDialogOpen(false);
    setIsEditing(false);
    setEditingRepair(null);

    toast({
      title: ru('toast.success', 'Succès'),
      description: isEditing ? ru('toast.repairUpdated', 'Réparation mise à jour avec succès') : ru('toast.repairAdded', 'Réparation ajoutée avec succès')
    });
  };

  const openDebtSettlementDialog = (repair: Repair) => {
    setRepairToSettle(repair);
    setDebtPaymentMethod(repair.paymentMethod || 'especes');
    setDebtPaymentAmount('');
    setDebtDialogOpen(true);
  };

  const closeDebtSettlementDialog = () => {
    setDebtDialogOpen(false);
    setRepairToSettle(null);
    setDebtPaymentAmount('');
  };

  const handleDebtSettlement = () => {
    if (!repairToSettle) return;

    const amount = parseFloat(debtPaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: ru('toast.error', 'Erreur'),
        description: tr('Veuillez saisir un montant valide.', 'يرجى إدخال مبلغ صحيح.'),
        variant: 'destructive'
      });
      return;
    }

    if (amount > repairToSettle.debtAmount) {
      toast({
        title: ru('toast.error', 'Erreur'),
        description: tr('Le montant à payer ne peut pas dépasser la dette restante.', 'مبلغ الدفع لا يمكن أن يتجاوز الدين المتبقي.'),
        variant: 'destructive'
      });
      return;
    }

    updateRepair(repairToSettle.id, {
      paidAmount: Number((repairToSettle.paidAmount + amount).toFixed(2)),
      debtAmount: Number((repairToSettle.debtAmount - amount).toFixed(2)),
      paymentMethod: debtPaymentMethod
    });
    closeDebtSettlementDialog();

    toast({
      title: tr('Dette réglée', 'تمت تسوية الدين'),
      description: tr('Le paiement a été appliqué avec succès.', 'تم تطبيق الدفعة بنجاح.')
    });
  };

  // Filter repairs based on search and filters
  const filteredRepairs = repairs.filter(repair => {
    const truck = trucks.find(t => t.id === repair.truckId);
    const truckMatricule = truck?.matricule || '';
    
    const matchesSearch = truckMatricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         repair.remarks.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'tous' || repair.type === typeFilter;
    
    let matchesPeriod = true;
    if (periodFilter !== 'toutes') {
      const repairDate = new Date(repair.date);
      const now = new Date();
      
      switch (periodFilter) {
        case '7jours':
          matchesPeriod = (now.getTime() - repairDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
          break;
        case '30jours':
          matchesPeriod = (now.getTime() - repairDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
          break;
        case '90jours':
          matchesPeriod = (now.getTime() - repairDate.getTime()) <= 90 * 24 * 60 * 60 * 1000;
          break;
      }
    }
    
    const matchesStatus =
      paymentStatusFilter === 'tous' ||
      (paymentStatusFilter === 'avec-dette' && repair.debtAmount > 0) ||
      (paymentStatusFilter === 'reglees' && repair.debtAmount <= 0);

    return matchesSearch && matchesType && matchesPeriod && matchesStatus;
  });

  const topDebtRepairs = useMemo(() => {
    return filteredRepairs
      .filter((repair) => repair.debtAmount > 0)
      .sort((a, b) => b.debtAmount - a.debtAmount)
      .slice(0, 3);
  }, [filteredRepairs]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const recentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).getTime();
    const previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59).getTime();
    const recent = repairs
      .filter((repair) => {
        const repairTime = new Date(repair.date).getTime();
        return repairTime >= recentStart;
      })
      .reduce((sum, repair) => sum + repair.totalCost, 0);
    const previous = repairs
      .filter((repair) => {
        const repairTime = new Date(repair.date).getTime();
        return repairTime >= previousStart && repairTime < recentStart;
      })
      .reduce((sum, repair) => sum + repair.totalCost, 0);
    const delta = recent - previous;
    const percent = previous === 0 ? (recent > 0 ? 100 : 0) : Math.round((delta / previous) * 100);
    return { recent, previous, delta, percent };
  }, [repairs]);

  const getRepairAgeDays = (repairDate: string) => {
    const now = new Date().getTime();
    const date = new Date(repairDate).getTime();
    return Math.max(0, Math.floor((now - date) / (24 * 60 * 60 * 1000)));
  };

  const getSlaMeta = (repair: Repair) => {
    const age = getRepairAgeDays(repair.date);
    if (repair.debtAmount <= 0) {
      return { label: tr('Conforme', 'مطابق'), style: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    }
    if (age >= 30) {
      return { label: tr('Critique', 'حرج'), style: 'bg-rose-100 text-rose-700 border-rose-200' };
    }
    if (age >= 15) {
      return { label: tr('À surveiller', 'تحت المراقبة'), style: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    return { label: tr('En délai', 'ضمن الأجل'), style: 'bg-blue-100 text-blue-700 border-blue-200' };
  };

  const hasActiveFilters = searchTerm !== '' || typeFilter !== 'tous' || periodFilter !== 'toutes' || paymentStatusFilter !== 'tous';

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('tous');
    setPeriodFilter('toutes');
    setPaymentStatusFilter('tous');
  };

  return (
    <div className="app-page-shell p-4 md:p-8 space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="app-page-title text-2xl md:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/10 text-orange-600 rounded-xl border border-orange-200/50">
              <Wrench className="h-7 w-7" />
            </div>
            <span>{tr('Gestion des Réparations', 'إدارة الإصلاحات')}</span>
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>{new Date().toLocaleDateString(uiLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </p>
        </div>
        <Button 
          onClick={() => {
            setIsEditing(false);
            setEditingRepair(null);
            setFormData({
              truckId: '',
              type: 'mecanique',
              totalCost: '',
              paidAmount: '',
              paymentMethod: 'especes',
              date: new Date().toISOString().split('T')[0],
              remarks: ''
            });
            setDialogOpen(true);
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20 transition-all active:scale-95 font-semibold"
        >
          <Plus className="mr-2 h-5 w-5" /> {ru('actions.addRepair', 'Ajouter la réparation')}
        </Button>
      </div>

      {/* Compact Overview Cards (4 KPI Cards - Reduced Size) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {overviewCards.map((card, index) => {
          const Icon = card.icon;
          const HintIcon = card.hintIcon || CheckCircle2;
          const isActive = activeOverviewCard === card.key;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.35, ease: 'easeOut' }}
              whileHover={{ y: -3 }}
              onMouseEnter={() => setActiveOverviewCard(card.key)}
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

      {/* Workshop Intelligence & Trends Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border border-slate-200/80 shadow-sm bg-white lg:col-span-2 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center justify-between text-slate-800">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                {tr('Tendance Coût 30J', 'منحنى تكلفة آخر 30 يومًا')}
              </span>
              {monthlyTrend.delta >= 0 ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +{monthlyTrend.percent}%
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  {monthlyTrend.percent}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200/70 p-3 bg-slate-50/70">
                <p className="text-xs font-medium text-slate-500">
                  {tr('30 jours récents', 'آخر 30 يومًا')}
                </p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{monthlyTrend.recent.toLocaleString(uiLocale)} MAD</p>
              </div>
              <div className="rounded-xl border border-slate-200/70 p-3 bg-slate-50/70">
                <p className="text-xs font-medium text-slate-500">
                  {tr('30 jours précédents', '30 يومًا السابقة')}
                </p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{monthlyTrend.previous.toLocaleString(uiLocale)} MAD</p>
              </div>
              <div className={cn(
                "rounded-xl border p-3",
                monthlyTrend.delta >= 0 ? "border-rose-200 bg-rose-50/60" : "border-emerald-200 bg-emerald-50/60"
              )}>
                <p className="text-xs font-medium text-slate-500">
                  {tr('Variation', 'التغيّر')}
                </p>
                <p className={cn("text-lg font-bold mt-0.5", monthlyTrend.delta >= 0 ? "text-rose-700" : "text-emerald-700")}>
                  {monthlyTrend.delta >= 0 ? '+' : ''}
                  {monthlyTrend.percent}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center justify-between text-slate-800">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                {tr('Top Dettes Atelier', 'أعلى ديون الورشة')}
              </span>
              <Badge variant="outline" className="text-[10px] font-semibold text-rose-600 bg-rose-50 border-rose-200">
                {topDebtRepairs.length} {tr('véhicules', 'مركبات')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-2">
            {topDebtRepairs.length > 0 ? (
              topDebtRepairs.map((repair) => {
                const truck = trucks.find((t) => t.id === repair.truckId);
                return (
                  <button
                    key={repair.id}
                    type="button"
                    onClick={() => {
                      setSearchTerm(truck?.matricule || '');
                      setPaymentStatusFilter('avec-dette');
                    }}
                    className="w-full text-left rounded-xl border border-slate-200/80 p-2.5 hover:border-orange-300 hover:bg-orange-50/40 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-white text-slate-600 shrink-0">
                        <Truck className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-semibold text-slate-900 truncate">{truck?.matricule || tr('Inconnu', 'غير معروف')}</span>
                    </div>
                    <span className="text-xs text-rose-600 font-bold shrink-0">{repair.debtAmount.toLocaleString(uiLocale)} MAD</span>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-slate-500 py-3 text-center">{tr('Aucune dette sur la vue active.', 'لا توجد ديون ضمن العرض النشط.')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unified Executive Control & Filter Bar */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
        {/* Row 1: Search & Quick Status Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={ru('placeholder.searchByVehicleOrRemark', 'Rechercher par véhicule ou remarque...')}
              className="pl-10 pr-9 h-10 rounded-xl border-slate-200 focus:ring-orange-500 bg-slate-50/50"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl self-start lg:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setPaymentStatusFilter('tous')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap",
                paymentStatusFilter === 'tous'
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span>{tr('Tous', 'الكل')}</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4 bg-slate-200 text-slate-700">
                {repairs.length}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setPaymentStatusFilter('avec-dette')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap",
                paymentStatusFilter === 'avec-dette'
                  ? "bg-white text-rose-700 shadow-sm"
                  : "text-slate-600 hover:text-rose-600"
              )}
            >
              <span>{tr('Avec Dette', 'مع دين')}</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4 bg-rose-100 text-rose-700">
                {debtRepairsCount}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setPaymentStatusFilter('reglees')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap",
                paymentStatusFilter === 'reglees'
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-emerald-600"
              )}
            >
              <span>{tr('Réglées', 'مسددة')}</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4 bg-emerald-100 text-emerald-700">
                {paidRepairsCount}
              </Badge>
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Dropdowns and Quick Focus Shortcuts */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[155px] h-9 text-xs rounded-xl border-slate-200 bg-white">
                <Filter className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                <SelectValue placeholder={ru('placeholder.repairType', 'Type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">{tr('Tous les types', 'كل الأنواع')}</SelectItem>
                <SelectItem value="mecanique">🔧 {tr('Mécanique', 'ميكانيك')}</SelectItem>
                <SelectItem value="electrique">⚡ {tr('Électrique', 'كهربائي')}</SelectItem>
                <SelectItem value="garage">🏪 {tr('Garage', 'مرآب')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Period Filter */}
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[155px] h-9 text-xs rounded-xl border-slate-200 bg-white">
                <Calendar className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                <SelectValue placeholder={ru('placeholder.period', 'Période')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">{tr('Toutes périodes', 'كل الفترات')}</SelectItem>
                <SelectItem value="7jours">{tr('7 derniers jours', 'آخر 7 أيام')}</SelectItem>
                <SelectItem value="30jours">{tr('30 derniers jours', 'آخر 30 يومًا')}</SelectItem>
                <SelectItem value="90jours">{tr('90 derniers jours', 'آخر 90 يومًا')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Quick Focus Shortcuts */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPaymentStatusFilter('avec-dette');
                setPeriodFilter('30jours');
              }}
              className="h-9 px-3 text-xs rounded-xl border-slate-200 hover:border-orange-300 hover:bg-orange-50/50"
            >
              <ShieldAlert className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
              {tr('Focus dettes', 'تركيز الديون')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPaymentStatusFilter('tous');
                setPeriodFilter('7jours');
              }}
              className="h-9 px-3 text-xs rounded-xl border-slate-200 hover:border-orange-300 hover:bg-orange-50/50"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-orange-500" />
              {tr('Focus 7 jours', 'تركيز 7 أيام')}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-9 px-2.5 text-xs text-slate-500 hover:text-slate-800"
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {tr('Réinitialiser', 'إعادة تعيين')}
              </Button>
            )}
          </div>

          {/* Results Counter */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>{tr('Total affiché :', 'المعروض:')}</span>
            <Badge variant="outline" className="font-bold text-slate-800 bg-slate-50 border-slate-200">
              {filteredRepairs.length} {tr('opérations', 'عمليات')}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Repairs Table Card */}
      <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
        <div className="smart-scroll-x hidden md:block">
          <Table className="smart-table">
            <TableHeader className="bg-slate-50/80 border-b border-slate-100">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">{ru('table.date', 'Date')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{ru('table.vehicle', 'Véhicule')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{ru('table.type', 'Type')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{ru('table.cost', 'Coût total')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{ru('table.paid', 'Payé')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{ru('table.debt', 'Dette')}</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right pr-6">{ru('table.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRepairs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-3 rounded-full bg-slate-100 text-slate-400">
                        <Wrench className="h-6 w-6" />
                      </div>
                      <p className="font-medium">{ru('empty.noRepairs', 'Aucune réparation trouvée')}</p>
                      {hasActiveFilters && (
                        <Button variant="outline" size="sm" onClick={resetFilters} className="mt-1">
                          {tr('Effacer les filtres', 'مسح الفلاتر')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRepairs.map((repair) => {
                  const truck = trucks.find(t => t.id === repair.truckId);
                  return (
                    <TableRow key={repair.id} className="hover:bg-slate-50/70 transition-colors group">
                      <TableCell className="font-medium text-slate-600">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-800">{new Date(repair.date).toLocaleDateString(uiLocale)}</span>
                          <Badge variant="outline" className={`w-fit text-[10px] ${getSlaMeta(repair).style}`}>
                            SLA {getSlaMeta(repair).label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600">
                            <Truck className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900">{truck?.matricule || tr('Inconnu', 'غير معروف')}</span>
                            {repair.remarks && (
                              <p className="text-xs text-slate-500 max-w-[220px] truncate" title={repair.remarks}>
                                {repair.remarks}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`
                          ${repair.type === 'mecanique' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                            repair.type === 'electrique' ? 'bg-purple-50 text-purple-700 border-purple-100' : 
                            'bg-orange-50 text-orange-700 border-orange-100'}
                          border font-medium
                        `}>
                          {repair.type === 'mecanique' ? tr('Mécanique', 'ميكانيك') : 
                           repair.type === 'electrique' ? tr('Électrique', 'كهربائي') : tr('Garage', 'مرآب')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">
                        {repair.totalCost.toLocaleString(uiLocale)} MAD
                      </TableCell>
                      <TableCell className="text-emerald-600 font-bold">
                        {repair.paidAmount.toLocaleString(uiLocale)} MAD
                      </TableCell>
                      <TableCell>
                        {repair.debtAmount > 0 ? (
                          <span className="text-rose-600 font-bold px-2 py-1 bg-rose-50 border border-rose-100 rounded-md text-xs">
                            {repair.debtAmount.toLocaleString(uiLocale)} MAD
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                            {tr('Réglé', 'مسدد')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          {repair.debtAmount > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDebtSettlementDialog(repair)}
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              title={tr('Régler la dette', 'تسوية الدين')}
                            >
                              <Banknote className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadPDF(repair)}
                            className="h-8 w-8 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                            title={ru('actions.export', 'Exporter PDF')}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingRepair(repair);
                              setIsEditing(true);
                              setFormData({
                                truckId: repair.truckId,
                                type: repair.type,
                                totalCost: repair.totalCost.toString(),
                                paidAmount: repair.paidAmount.toString(),
                                paymentMethod: repair.paymentMethod,
                                date: repair.date.split('T')[0],
                                remarks: repair.remarks
                              });
                              setDialogOpen(true);
                            }}
                            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            title={ru('actions.edit', 'Modifier')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(ru('confirm.deleteRepair', 'Voulez-vous vraiment supprimer cette réparation ?'))) {
                                deleteRepair(repair.id);
                                toast({
                                  title: ru('toast.repairDeleted', 'Réparation supprimée'),
                                  description: ru('toast.repairDeletedSuccess', 'La réparation a été supprimée avec succès.'),
                                });
                              }
                            }}
                            className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                            title={ru('actions.delete', 'Supprimer')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View Cards */}
        <div className="md:hidden grid grid-cols-1 gap-2.5 p-3 sm:p-4">
          {filteredRepairs.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <p>{ru('empty.noRepairs', 'Aucune réparation trouvée')}</p>
            </div>
          ) : (
            filteredRepairs.map((repair) => {
              const truck = trucks.find(t => t.id === repair.truckId);
              return (
                <div key={repair.id} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[11px] font-medium">
                      {new Date(repair.date).toLocaleDateString(uiLocale)}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${getSlaMeta(repair).style}`}>
                      SLA {getSlaMeta(repair).label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-bold text-slate-900">{truck?.matricule || tr('Inconnu', 'غير معروف')}</span>
                    </div>
                    <Badge variant="secondary" className={`
                      ${repair.type === 'mecanique' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                        repair.type === 'electrique' ? 'bg-purple-50 text-purple-700 border-purple-100' : 
                        'bg-orange-50 text-orange-700 border-orange-100'}
                      border font-medium text-[11px]
                    `}>
                      {repair.type === 'mecanique' ? tr('Mécanique', 'ميكانيك') : 
                        repair.type === 'electrique' ? tr('Électrique', 'كهربائي') : tr('Garage', 'مرآب')}
                    </Badge>
                  </div>

                  {repair.remarks && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {repair.remarks}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-500">{tr('Coût', 'التكلفة')}</p>
                      <p className="font-bold text-slate-900">{repair.totalCost.toLocaleString(uiLocale)} MAD</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">{tr('Payé', 'المدفوع')}</p>
                      <p className="text-emerald-700 font-bold">{repair.paidAmount.toLocaleString(uiLocale)} MAD</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">{tr('Dette', 'الدين')}</p>
                      <p className={cn("font-bold", repair.debtAmount > 0 ? "text-rose-600" : "text-slate-500")}>
                        {repair.debtAmount.toLocaleString(uiLocale)} MAD
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                    {repair.debtAmount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDebtSettlementDialog(repair)}
                        className="text-xs h-8 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                      >
                        <Banknote className="mr-1 h-3.5 w-3.5" />
                        {tr('Régler', 'تسوية')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadPDF(repair)}
                      className="text-xs h-8 text-slate-600 hover:text-orange-600"
                    >
                      <FileDown className="mr-1 h-3.5 w-3.5" />
                      PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingRepair(repair);
                        setIsEditing(true);
                        setFormData({
                          truckId: repair.truckId,
                          type: repair.type,
                          totalCost: repair.totalCost.toString(),
                          paidAmount: repair.paidAmount.toString(),
                          paymentMethod: repair.paymentMethod,
                          date: repair.date.split('T')[0],
                          remarks: repair.remarks
                        });
                        setDialogOpen(true);
                      }}
                      className="text-xs h-8 text-blue-600 hover:bg-blue-50"
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      {ru('actions.edit', 'Modifier')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(ru('confirm.deleteRepair', 'Voulez-vous vraiment supprimer cette réparation ?'))) {
                          deleteRepair(repair.id);
                          toast({
                            title: ru('toast.repairDeleted', 'Réparation supprimée'),
                            description: ru('toast.repairDeletedSuccess', 'La réparation a été supprimée avec succès.'),
                          });
                        }
                      }}
                      className="text-xs h-8 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Settle Debt Modal Dialog */}
      <Dialog
        open={debtDialogOpen && !!repairToSettle}
        onOpenChange={(open) => {
          if (!open) closeDebtSettlementDialog();
          else setDebtDialogOpen(true);
        }}
      >
        {repairToSettle && (
          <DialogContent className="max-w-md border-none shadow-2xl overflow-hidden p-0 rounded-2xl">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <span>{tr('Régler la dette', 'تسوية الدين')}</span>
                </DialogTitle>
                <CardDescription className="text-emerald-100 text-xs mt-1">
                  {tr('Enregistrement du paiement pour régularisation de la dette atelier', 'تسجيل الدفعة لتسوية ديون ورشة الصيانة')}
                </CardDescription>
              </DialogHeader>
            </div>

            <div className="p-5 space-y-4 bg-white">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold text-xs">{tr('Mode de Paiement', 'طريقة الدفع')}</Label>
                <Select value={debtPaymentMethod} onValueChange={(value) => setDebtPaymentMethod(value as 'especes' | 'cheque' | 'virement')}>
                  <SelectTrigger className="border-slate-200 focus:ring-emerald-500 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="especes">💵 {tr('Espèces', 'نقدًا')}</SelectItem>
                    <SelectItem value="cheque">📝 {tr('Chèque', 'شيك')}</SelectItem>
                    <SelectItem value="virement">🏦 {tr('Virement', 'تحويل')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">{tr('Reste à payer (Dette) :', 'المتبقي للدفع (الدين):')}</p>
                <p className="text-2xl font-black text-rose-600 mt-0.5">
                  {repairToSettle.debtAmount.toLocaleString(uiLocale)} MAD
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-700 font-semibold text-xs">{tr('Montant à payer (Dette)', 'مبلغ الأداء (الدين)')}</Label>
                  <button
                    type="button"
                    onClick={() => setDebtPaymentAmount(repairToSettle.debtAmount.toString())}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    {tr('Payer la totalité', 'دفع الكل')}
                  </button>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={debtPaymentAmount}
                  onChange={(e) => setDebtPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="border-slate-200 focus:ring-emerald-500 rounded-xl font-bold"
                />
                {debtPaymentAmount && Number.isFinite(parseFloat(debtPaymentAmount)) && (
                  <p className="text-xs text-slate-500 pt-0.5">
                    {tr('Nouveau reste après paiement :', 'المتبقي الجديد بعد الدفع:')}{' '}
                    <span className="font-bold text-emerald-700">
                      {Math.max(0, repairToSettle.debtAmount - parseFloat(debtPaymentAmount || '0')).toLocaleString(uiLocale)} MAD
                    </span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button variant="outline" onClick={closeDebtSettlementDialog} className="rounded-xl">
                  {tr('Annuler', 'إلغاء')}
                </Button>
                <Button onClick={handleDebtSettlement} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                  {tr('Confirmer le règlement', 'تأكيد التسوية')}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* New / Edit Repair Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl border-none shadow-2xl p-0 overflow-hidden rounded-2xl">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Wrench className="h-6 w-6" />
                </div>
                <span>{isEditing ? ru('dialog.editTitle', 'Modifier la Réparation') : ru('dialog.newTitle', 'Nouvelle Réparation')}</span>
              </DialogTitle>
              <CardDescription className="text-orange-100 mt-1">
                {isEditing ? ru('dialog.editSubtitle', "Mettre à jour les détails de l'opération") : ru('dialog.newSubtitle', 'Enregistrer une nouvelle opération de maintenance')}
              </CardDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold text-xs">{ru('label.vehicle', 'Véhicule')}</Label>
                <Select value={formData.truckId} onValueChange={(value) => setFormData(prev => ({ ...prev, truckId: value }))}>
                  <SelectTrigger className="border-slate-200 focus:ring-orange-500 rounded-xl">
                    <SelectValue placeholder={ru('placeholder.selectVehicle', 'Sélectionner un véhicule')} />
                  </SelectTrigger>
                  <SelectContent>
                    {trucks.map(truck => (
                      <SelectItem key={truck.id} value={truck.id}>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-slate-400" />
                          <span>{truck.matricule}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold text-xs">{ru('label.repairType', 'Type de Réparation')}</Label>
                <Select value={formData.type} onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger className="border-slate-200 focus:ring-orange-500 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mecanique">🔧 {tr('Mécanique', 'ميكانيك')}</SelectItem>
                    <SelectItem value="electrique">⚡ {tr('Électrique', 'كهربائي')}</SelectItem>
                    <SelectItem value="garage">🏪 {tr('Garage', 'مرآب')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold text-xs">{ru('label.date', 'Date')}</Label>
                <Input 
                  type="date" 
                  value={formData.date} 
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="border-slate-200 focus:ring-orange-500 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold text-xs">{ru('label.paymentMethod', 'Mode de Paiement')}</Label>
                <Select value={formData.paymentMethod} onValueChange={(value: any) => setFormData(prev => ({ ...prev, paymentMethod: value }))}>
                  <SelectTrigger className="border-slate-200 focus:ring-orange-500 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="especes">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-emerald-500" />
                        <span>{tr('Espèces', 'نقدًا')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="cheque">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-500" />
                        <span>{tr('Chèque', 'شيك')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="virement">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-purple-500" />
                        <span>{tr('Virement', 'تحويل')}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50/70 rounded-xl border border-slate-100">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-bold text-xs flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-orange-500" />
                  {ru('label.totalCostMad', 'Coût Total (MAD)')}
                </Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.totalCost} 
                  onChange={e => setFormData({ ...formData, totalCost: e.target.value })}
                  className="bg-white border-slate-200 focus:ring-orange-500 font-bold text-base rounded-xl"
                  placeholder={ru('placeholder.amountZero', '0.00')}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-bold text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {ru('label.paidAmountMad', 'Montant Payé (MAD)')}
                </Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.paidAmount} 
                  onChange={e => setFormData({ ...formData, paidAmount: e.target.value })}
                  className="bg-white border-slate-200 focus:ring-emerald-500 font-bold text-base text-emerald-600 rounded-xl"
                  placeholder={ru('placeholder.amountZero', '0.00')}
                />
              </div>
              {formData.totalCost && formData.paidAmount && (
                <div className="md:col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500">{ru('label.remainingDebt', 'Reste à payer (Dette) :')}</span>
                  <span className={`text-base font-bold ${(parseFloat(formData.totalCost) - parseFloat(formData.paidAmount)) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {(parseFloat(formData.totalCost) - parseFloat(formData.paidAmount)).toLocaleString(uiLocale)} MAD
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold text-xs">{ru('label.descriptionRemarks', 'Description / Remarques')}</Label>
              <Textarea 
                placeholder={ru('placeholder.repairDetails', 'Détails de la réparation, pièces changées...')}
                value={formData.remarks}
                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                className="min-h-[90px] border-slate-200 focus:ring-orange-500 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="text-slate-500 hover:bg-slate-100 rounded-xl">
                {ru('actions.cancel', 'Annuler')}
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-6 shadow-lg shadow-orange-500/20 rounded-xl font-semibold">
                {isEditing ? ru('actions.saveChanges', 'Enregistrer les modifications') : ru('actions.addRepair', 'Ajouter la réparation')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Repairs;
