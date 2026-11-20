import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { useApp } from '@/contexts/AppContext';
import { AddTruckDialog } from '@/components/dialogs/AddTruckDialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Truck, Users, PauseCircle, History, Download, Printer, Play, UserX, Search, Filter, Calendar, CheckCircle2, AlertCircle, Trash2, Sparkles, Command, Activity, LayoutGrid, Table2, Zap, ArrowUpRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { loadPdfTools } from '@/lib/pdf';
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

const TruckTypeBadge = ({
  truckType,
  label
}: {
  truckType: string;
  label: string;
}) => {
  const [broken, setBroken] = useState(false);
  const imageCandidatesByType: Record<'camion' | 'remorque' | 'allogaz' | 'clark', string[]> = {
    allogaz: ['/truck-types/allogaz.png', '/truck-types/allgaz.png', '/truck-types/allogaz', '/truck-types/allgaz'],
    remorque: ['/truck-types/remorque.png', '/truck-types/remorque'],
    camion: ['/truck-types/camion.png', '/truck-types/camion'],
    clark: ['/truck-types/clark.jpeg', '/truck-types/clark.jpg', '/truck-types/clark.png', '/truck-types/clark']
  };
  const [imageIndex, setImageIndex] = useState(0);
  const fallbackByType: Record<'camion' | 'remorque' | 'allogaz' | 'clark', string> = {
    allogaz: '🚚',
    remorque: '🛞',
    camion: '🚛',
    clark: '🦺'
  };
  const normalizedType = String(truckType || '').toLowerCase();
  const safeType: 'camion' | 'remorque' | 'allogaz' | 'clark' =
    normalizedType === 'camion'
      ? 'camion'
      : normalizedType === 'remorque'
        ? 'remorque'
        : normalizedType === 'clark'
          ? 'clark'
          : 'allogaz';
  const imageCandidates = imageCandidatesByType[safeType];
  useEffect(() => {
    setBroken(false);
    setImageIndex(0);
  }, [safeType]);
  return (
    <Badge variant="outline" className="bg-white border-slate-200 text-slate-600 font-medium px-2 py-0.5 rounded-md">
      {broken ? (
        <span className="mr-1">{fallbackByType[safeType]}</span>
      ) : (
        <img
          src={imageCandidates[Math.min(imageIndex, imageCandidates.length - 1)]}
          alt={label}
          onError={() => {
            if (imageIndex + 1 < imageCandidates.length) {
              setImageIndex((prev) => prev + 1);
              return;
            }
            setBroken(true);
          }}
          className="mr-1 inline-block h-3.5 w-5 object-contain align-middle"
        />
      )}
      {label}
    </Badge>
  );
};

const Trucks = () => {
  const { trucks, drivers, updateTruck, deleteTruck, clearAllTrucks, bulkSetRepos, bulkReactivate, bulkDissociateDriver, driverHasActiveTruck, truckAssignments } = useApp();
  const availableDrivers = useMemo(() => drivers.filter((driver: any) => !driver.isUnavailable), [drivers]);
  const driversById = useMemo(
    () => new Map(drivers.map((driver: any) => [String(driver.id), driver])),
    [drivers]
  );
  const { toast } = useToast();
  const t = useT();
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const tu = (key: string, fallback: string) => t(`trucks.ui.${key}`, fallback);
  const tv = (key: string, frText: string, arText: string) => tu(key, tr(frText, arText));
  const uiLocale = language === 'ar' ? 'ar-MA' : 'fr-MA';
  const isArabicPdf = language === 'ar';
  const arabicPdfFontFile = 'NotoNaskhArabic-Regular.ttf';
  const arabicPdfFontName = 'NotoNaskhArabic';
  const arabicPdfFontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notonaskharabic/NotoNaskhArabic-Regular.ttf';
  const arabicPdfFontDataRef = React.useRef<string | null>(null);
  const getArabicPdfFontData = React.useCallback(async () => {
    if (arabicPdfFontDataRef.current) return arabicPdfFontDataRef.current;
    const cacheKey = 'trucks_pdf_font_ar_v1';
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
  const createPdfDoc = React.useCallback(async () => {
    const { jsPDF, autoTable } = await loadPdfTools();
    const doc = new jsPDF();
    if (isArabicPdf) {
      const fontData = await getArabicPdfFontData();
      doc.addFileToVFS(arabicPdfFontFile, fontData);
      doc.addFont(arabicPdfFontFile, arabicPdfFontName, 'normal');
      doc.setFont(arabicPdfFontName, 'normal');
    }
    return { doc, autoTable };
  }, [isArabicPdf, getArabicPdfFontData]);
  const setPdfFont = (doc: any, weight: 'normal' | 'bold' = 'normal') => {
    if (isArabicPdf) {
      doc.setFont(arabicPdfFontName, 'normal');
      return;
    }
    doc.setFont('helvetica', weight);
  };
  const today = new Date();

  // تأكيد تغيير سائق لصف واحد
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{ truckId: string; newDriverId: string } | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deleteAllCode, setDeleteAllCode] = useState('');

  // بحث وفلاتر وفرز
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<{ active: boolean; inactive: boolean; noDriver: boolean }>(() => {
    const saved = localStorage.getItem('truckFilters');
    return saved ? JSON.parse(saved) : { active: true, inactive: true, noDriver: false };
  });
  const [sortBy, setSortBy] = useState<'status' | 'name' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyTruckId, setHistoryTruckId] = useState<string>('');
  const [fleetPulse, setFleetPulse] = useState<'all' | 'active' | 'inactive' | 'nodriver' | 'critical'>('all');
  const [trucksView, setTrucksView] = useState<'table' | 'cards'>('table');
  const [commandSearch, setCommandSearch] = useState('');
  const [opsPreset, setOpsPreset] = useState<'balanced' | 'safety' | 'dispatch'>('balanced');

  // تحديد جماعي
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const clearSelection = () => setSelected(new Set());
  const requiredDeleteAllCode = 'SFTGAZ25';
  const handleDeleteAllTrucks = () => {
    if (deleteAllCode.trim() !== requiredDeleteAllCode) {
      toast({
        title: tu('toast.invalidDeleteCodeTitle', 'Code invalide'),
        description: tu('toast.invalidDeleteCodeDescription', 'Le code de confirmation est incorrect.'),
        variant: 'destructive'
      });
      return;
    }
    clearAllTrucks();
    clearSelection();
    setDeleteAllCode('');
    setDeleteAllDialogOpen(false);
    toast({ title: tu('toast.trucksDeleted', 'Camions supprimés'), description: tu('toast.allTrucksDeleted', 'Tous les camions ont été supprimés.') });
  };

  // تصفية وفرز الشاحنات
  const filteredTrucks = useMemo(() => {
    return trucks
      .filter(t => {
        const driver = driversById.get(String(t.driverId));
        const matchesSearch =
          t.matricule.toLowerCase().includes(search.toLowerCase()) ||
          (driver?.name || '').toLowerCase().includes(search.toLowerCase());
        const includeByStatus =
          (filters.active && t.isActive) ||
          (filters.inactive && !t.isActive);
        const includeNoDriver = filters.noDriver ? !t.driverId : true;
        return matchesSearch && includeByStatus && includeNoDriver;
      })
      .sort((a, b) => {
        if (sortBy === 'status') {
          const cmp = a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1;
          return cmp * (sortOrder === 'asc' ? 1 : -1);
        }
        if (sortBy === 'name') {
          const an = (driversById.get(String(a.driverId))?.name || '').toLowerCase();
          const bn = (driversById.get(String(b.driverId))?.name || '').toLowerCase();
          const cmp = an.localeCompare(bn);
          return cmp * (sortOrder === 'asc' ? 1 : -1);
        }
        const ad = a.updatedAt ? Date.parse(a.updatedAt) : 0;
        const bd = b.updatedAt ? Date.parse(b.updatedAt) : 0;
        const cmp = ad - bd;
        return cmp * (sortOrder === 'asc' ? 1 : -1);
      });
  }, [trucks, driversById, search, filters, sortBy, sortOrder]);
  const commandFilteredTrucks = useMemo(() => {
    const term = commandSearch.trim().toLowerCase();
    return filteredTrucks.filter((truck) => {
      const driverName = (driversById.get(String(truck.driverId))?.name || '').toLowerCase();
      const matchesTerm =
        !term ||
        truck.matricule.toLowerCase().includes(term) ||
        driverName.includes(term);
      if (!matchesTerm) return false;
      if (fleetPulse === 'all') return true;
      if (fleetPulse === 'active') return truck.isActive;
      if (fleetPulse === 'inactive') return !truck.isActive;
      if (fleetPulse === 'critical') {
        const updatedAt = truck.updatedAt ? Date.parse(truck.updatedAt) : 0;
        const stale = updatedAt ? Date.now() - updatedAt > 1000 * 60 * 60 * 24 * 5 : true;
        return !truck.driverId || !truck.isActive || stale;
      }
      return !truck.driverId;
    });
  }, [filteredTrucks, commandSearch, fleetPulse, driversById]);
  const truckPriority = useMemo(() => {
    return new Map(commandFilteredTrucks.map((truck) => {
      const updatedAt = truck.updatedAt ? Date.parse(truck.updatedAt) : 0;
      const stale = updatedAt ? Date.now() - updatedAt > 1000 * 60 * 60 * 24 * 5 : true;
      const score = (truck.isActive ? 0 : 45) + (!truck.driverId ? 35 : 0) + (stale ? 20 : 0);
      const level = score >= 70 ? 'critical' : score >= 35 ? 'watch' : 'stable';
      return [truck.id, { score, level }] as const;
    }));
  }, [commandFilteredTrucks]);
  const criticalCount = useMemo(() => {
    return commandFilteredTrucks.filter((truck) => truckPriority.get(truck.id)?.level === 'critical').length;
  }, [commandFilteredTrucks, truckPriority]);
  const commandMetrics = useMemo(() => {
    const active = commandFilteredTrucks.filter((truck) => truck.isActive).length;
    const withoutDriver = commandFilteredTrucks.filter((truck) => !truck.driverId).length;
    const watch = commandFilteredTrucks.filter((truck) => truckPriority.get(truck.id)?.level === 'watch').length;
    const stable = Math.max(commandFilteredTrucks.length - criticalCount - watch, 0);
    return {
      visible: commandFilteredTrucks.length,
      active,
      withoutDriver,
      watch,
      stable,
    };
  }, [commandFilteredTrucks, criticalCount, truckPriority]);
  const criticalQueue = useMemo(() => {
    return commandFilteredTrucks
      .filter((truck) => truckPriority.get(truck.id)?.level === 'critical')
      .sort((a, b) => (truckPriority.get(b.id)?.score || 0) - (truckPriority.get(a.id)?.score || 0))
      .slice(0, 5);
  }, [commandFilteredTrucks, truckPriority]);
  const activityHeatmap = useMemo(() => {
    const buckets = [
      { label: tr('<24h', '<24س'), min: 0, max: 1, className: 'bg-emerald-500' },
      { label: tr('1-3j', '1-3ي'), min: 1, max: 3, className: 'bg-lime-500' },
      { label: tr('4-7j', '4-7ي'), min: 4, max: 7, className: 'bg-amber-500' },
      { label: tr('8-14j', '8-14ي'), min: 8, max: 14, className: 'bg-orange-500' },
      { label: tr('15j+', '+15ي'), min: 15, max: Number.POSITIVE_INFINITY, className: 'bg-rose-500' }
    ];
    const now = Date.now();
    const total = commandFilteredTrucks.length || 1;
    return buckets.map((bucket) => {
      const count = commandFilteredTrucks.filter((truck) => {
        if (!truck.updatedAt) return bucket.max === Number.POSITIVE_INFINITY;
        const days = Math.floor((now - Date.parse(truck.updatedAt)) / (1000 * 60 * 60 * 24));
        return days >= bucket.min && days <= bucket.max;
      }).length;
      return { ...bucket, count, ratio: Math.round((count / total) * 100) };
    });
  }, [commandFilteredTrucks, language]);
  const suggestedReposIds = useMemo(() => {
    return commandFilteredTrucks
      .filter((truck) => truck.isActive && (!truck.driverId || truckPriority.get(truck.id)?.level === 'critical'))
      .map((truck) => truck.id)
      .slice(0, 12);
  }, [commandFilteredTrucks, truckPriority]);
  const suggestedReactivateIds = useMemo(() => {
    return commandFilteredTrucks
      .filter((truck) => !truck.isActive && truck.driverId && truckPriority.get(truck.id)?.level !== 'critical')
      .map((truck) => truck.id)
      .slice(0, 12);
  }, [commandFilteredTrucks, truckPriority]);
  const suggestedDissociateIds = useMemo(() => {
    return commandFilteredTrucks
      .filter((truck) => truck.driverId && truckPriority.get(truck.id)?.level === 'critical')
      .map((truck) => truck.id)
      .slice(0, 12);
  }, [commandFilteredTrucks, truckPriority]);
  const selectedVisibleIds = useMemo(() => {
    const visibleIds = new Set(commandFilteredTrucks.map((truck) => truck.id));
    return Array.from(selected).filter((id) => visibleIds.has(id));
  }, [selected, commandFilteredTrucks]);
  const tacticalRadar = useMemo(() => {
    const total = commandFilteredTrucks.length || 1;
    const active = commandFilteredTrucks.filter((t) => t.isActive).length;
    const inactive = commandFilteredTrucks.filter((t) => !t.isActive).length;
    const noDriver = commandFilteredTrucks.filter((t) => !t.driverId).length;
    const critical = commandFilteredTrucks.filter((t) => truckPriority.get(t.id)?.level === 'critical').length;
    return [
      { label: tr('Actifs', 'نشطة'), count: active, ratio: Math.round((active / total) * 100), className: 'bg-emerald-500' },
      { label: tr('Inactifs', 'غير نشطة'), count: inactive, ratio: Math.round((inactive / total) * 100), className: 'bg-amber-500' },
      { label: tr('Sans chauffeur', 'بدون سائق'), count: noDriver, ratio: Math.round((noDriver / total) * 100), className: 'bg-indigo-500' },
      { label: tr('Critiques', 'حرجة'), count: critical, ratio: Math.round((critical / total) * 100), className: 'bg-rose-500' }
    ];
  }, [commandFilteredTrucks, truckPriority, language]);
  const assignmentPulse = useMemo(() => {
    const daySize = 24 * 60 * 60 * 1000;
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end.getTime() - daySize * 6);
    start.setHours(0, 0, 0, 0);
    const buckets = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start.getTime() + daySize * index);
      return {
        label: new Intl.DateTimeFormat(language === 'ar' ? 'ar-MA' : 'fr-MA', { weekday: 'short' }).format(day),
        startTime: day.getTime(),
        endTime: day.getTime() + daySize - 1,
        count: 0
      };
    });
    (truckAssignments || []).forEach((row: any) => {
      if (!row?.date) return;
      const dateValue = Date.parse(row.date);
      if (Number.isNaN(dateValue)) return;
      const bucket = buckets.find((item) => dateValue >= item.startTime && dateValue <= item.endTime);
      if (bucket) bucket.count += 1;
    });
    const peak = Math.max(...buckets.map((bucket) => bucket.count), 1);
    return buckets.map((bucket) => ({
      label: bucket.label,
      count: bucket.count,
      ratio: Math.round((bucket.count / peak) * 100)
    }));
  }, [truckAssignments, language]);
  const forecastQueue = useMemo(() => {
    const now = Date.now();
    return commandFilteredTrucks
      .map((truck) => {
        const priorityScore = truckPriority.get(truck.id)?.score || 0;
        const updatedAt = truck.updatedAt ? Date.parse(truck.updatedAt) : 0;
        const staleDays = updatedAt ? Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24)) : 21;
        const riskScore = priorityScore + Math.min(35, staleDays * 4);
        const etaHours = Math.max(4, 72 - Math.min(60, staleDays * 6) - (truck.isActive ? 0 : 18) - (truck.driverId ? 0 : 20));
        const action = !truck.driverId
          ? tu('forecast.actionAssignDriver', 'Assigner chauffeur')
          : !truck.isActive
            ? tu('forecast.actionReactivate', 'Réactiver')
            : staleDays > 5
              ? tu('forecast.actionInspection', 'Inspection')
              : tu('forecast.actionMonitor', 'Surveiller');
        return { truck, riskScore, etaHours, staleDays, action };
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 6);
  }, [commandFilteredTrucks, truckPriority]);
  const forecastHealth = useMemo(() => {
    const high = forecastQueue.filter((item) => item.riskScore >= 80).length;
    const medium = forecastQueue.filter((item) => item.riskScore >= 55 && item.riskScore < 80).length;
    const activeRisk = forecastQueue.filter((item) => item.truck.isActive).length;
    return { high, medium, activeRisk };
  }, [forecastQueue]);
  const runMacroStabilize = () => {
    const selectedSet = new Set(selectedVisibleIds);
    const source = selectedSet.size
      ? commandFilteredTrucks.filter((truck) => selectedSet.has(truck.id))
      : commandFilteredTrucks;
    const reposIds = source
      .filter((truck) => truck.isActive && (!truck.driverId || truckPriority.get(truck.id)?.level === 'critical'))
      .map((truck) => truck.id)
      .slice(0, 12);
    const dissociateIds = source
      .filter((truck) => truck.driverId && truckPriority.get(truck.id)?.level === 'critical')
      .map((truck) => truck.id)
      .slice(0, 12);
    if (reposIds.length === 0 && dissociateIds.length === 0) {
      toast({ title: tu('toast.macroStabilize', 'Macro stabilisation'), description: tu('toast.noActionNeededScope', 'Aucune action nécessaire pour ce scope.') });
      return;
    }
    if (reposIds.length > 0) bulkSetRepos(reposIds);
    if (dissociateIds.length > 0) bulkDissociateDriver(dissociateIds);
    clearSelection();
    toast({
      title: tu('toast.macroStabilizeStarted', 'Macro stabilisation lancée'),
      description: language === 'ar'
        ? `${reposIds.length} في التوقف · ${dissociateIds.length} فصل ارتباط`
        : `${reposIds.length} repos · ${dissociateIds.length} dissociation(s)`
    });
  };
  const runMacroRecovery = () => {
    const selectedSet = new Set(selectedVisibleIds);
    const source = selectedSet.size
      ? commandFilteredTrucks.filter((truck) => selectedSet.has(truck.id))
      : commandFilteredTrucks;
    const reactivateIds = source
      .filter((truck) => !truck.isActive && truck.driverId && truckPriority.get(truck.id)?.level !== 'critical')
      .map((truck) => truck.id)
      .slice(0, 12);
    if (reactivateIds.length === 0) {
      toast({ title: tu('toast.macroRecovery', 'Macro récupération'), description: tu('toast.noTruckToReactivate', 'Aucun camion à réactiver.') });
      return;
    }
    bulkReactivate(reactivateIds);
    clearSelection();
    toast({ title: tu('toast.macroRecoveryStarted', 'Macro récupération lancée'), description: `${reactivateIds.length} ${tu('toast.trucksReactivated', 'camion(s) réactivé(s)')}` });
  };
  const runMacroAudit = () => {
    const visibleIds = new Set(commandFilteredTrucks.map((truck) => truck.id));
    const latest = (truckAssignments || [])
      .filter((row: any) => row?.truckId && row?.date && visibleIds.has(row.truckId))
      .sort((a: any, b: any) => Date.parse(b.date) - Date.parse(a.date))[0];
    if (!latest?.truckId) {
      toast({ title: tu('toast.macroAudit', 'Macro audit'), description: tu('toast.noHistoryCurrentScope', "Aucun historique disponible sur le scope actuel.") });
      return;
    }
    setHistoryTruckId(latest.truckId);
    setHistoryDialogOpen(true);
  };
  const runForecastContainment = () => {
    const target = forecastQueue.filter((item) => item.riskScore >= 80).map((item) => item.truck);
    const reposIds = target.filter((truck) => truck.isActive).map((truck) => truck.id).slice(0, 12);
    const dissociateIds = target.filter((truck) => truck.driverId).map((truck) => truck.id).slice(0, 12);
    if (reposIds.length === 0 && dissociateIds.length === 0) {
      toast({ title: tu('toast.containment', 'Confinement'), description: tu('toast.noHighRiskContainment', 'Aucun camion à haut risque à contenir.') });
      return;
    }
    if (reposIds.length > 0) bulkSetRepos(reposIds);
    if (dissociateIds.length > 0) bulkDissociateDriver(dissociateIds);
    clearSelection();
    toast({
      title: tu('toast.containmentExecuted', 'Confinement exécuté'),
      description: language === 'ar'
        ? `${reposIds.length} في التوقف · ${dissociateIds.length} فصل ارتباط`
        : `${reposIds.length} repos · ${dissociateIds.length} dissociation(s)`
    });
  };
  const runForecastRebalance = () => {
    const target = forecastQueue.filter((item) => item.riskScore < 80).map((item) => item.truck);
    const reactivateIds = target.filter((truck) => !truck.isActive && truck.driverId).map((truck) => truck.id).slice(0, 12);
    if (reactivateIds.length === 0) {
      toast({ title: tu('toast.rebalance', 'Rééquilibrage'), description: tu('toast.noTruckReadyRecovery', 'Aucun camion prêt pour la récupération.') });
      return;
    }
    bulkReactivate(reactivateIds);
    clearSelection();
    toast({ title: tu('toast.rebalanceExecuted', 'Rééquilibrage exécuté'), description: `${reactivateIds.length} ${tu('toast.trucksReactivated', 'camion(s) réactivé(s)')}` });
  };
  const runForecastFocus = () => {
    const top = forecastQueue[0];
    if (!top) {
      toast({ title: tu('toast.forecastFocus', 'Focus prévisionnel'), description: tu('toast.noTruckCurrentPerimeter', 'Aucun camion disponible dans le périmètre actuel.') });
      return;
    }
    setFleetPulse('critical');
    setCommandSearch(top.truck.matricule);
    setTrucksView('table');
  };
  const applyOpsPreset = (preset: 'balanced' | 'safety' | 'dispatch') => {
    setOpsPreset(preset);
    if (preset === 'balanced') {
      setFleetPulse('all');
      setTrucksView('table');
      setSortBy('updatedAt');
      setSortOrder('desc');
      return;
    }
    if (preset === 'safety') {
      setFleetPulse('critical');
      setTrucksView('table');
      setSortBy('status');
      setSortOrder('asc');
      return;
    }
    setFleetPulse('nodriver');
    setTrucksView('cards');
    setSortBy('name');
    setSortOrder('asc');
  };
  const opsPresetLabel = useMemo(() => {
    if (opsPreset === 'balanced') return tu('presets.balanced', 'Équilibré');
    if (opsPreset === 'safety') return tu('presets.safety', 'Sécurité');
    return tu('presets.dispatch', 'Expédition');
  }, [opsPreset]);
  useEffect(() => {
    const handleShortcuts = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === '1') {
        event.preventDefault();
        setTrucksView('table');
      } else if (key === '2') {
        event.preventDefault();
        setTrucksView('cards');
      } else if (key === '3') {
        event.preventDefault();
        applyOpsPreset('safety');
      } else if (key === '4') {
        event.preventDefault();
        runForecastFocus();
      } else if (key === 'k') {
        event.preventDefault();
        document.getElementById('trucks-command-search')?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, []);

  // يجب أن يُحسب بعد filteredTrucks
  const allSelected = selected.size > 0 && selected.size === commandFilteredTrucks.length;

  // إحصائيات
  const totalTrucks = trucks.length;
  const totalDrivers = drivers.length;
  const inactiveTrucks = trucks.filter(t => !t.isActive).length;
  const activeTrucks = trucks.filter(t => t.isActive).length;
  const trucksWithoutDriver = trucks.filter(t => !t.driverId).length;
  const [activeFleetCard, setActiveFleetCard] = useState('fleet');
  const [fleetCardMode, setFleetCardMode] = useState<'classic' | 'cinematic'>(() => {
    if (typeof window === 'undefined') return 'cinematic';
    return window.localStorage.getItem('app-card-mode') === 'classic' ? 'classic' : 'cinematic';
  });

  useEffect(() => {
    const onModeChange = (event: Event) => {
      const mode = (event as CustomEvent<'classic' | 'cinematic'>).detail;
      if (mode === 'classic' || mode === 'cinematic') {
        setFleetCardMode(mode);
      }
    };
    window.addEventListener('app-card-mode-change', onModeChange as EventListener);
    return () => window.removeEventListener('app-card-mode-change', onModeChange as EventListener);
  }, []);

  const applyFleetCardMode = (mode: 'classic' | 'cinematic') => {
    setFleetCardMode(mode);
    window.localStorage.setItem('app-card-mode', mode);
    document.documentElement.setAttribute('data-card-mode', mode);
    window.dispatchEvent(new CustomEvent('app-card-mode-change', { detail: mode }));
  };

  const fleetOverviewCards = [
    {
      key: 'fleet',
      title: tr('Total Flotte', 'إجمالي الأسطول'),
      value: totalTrucks,
      hint: tr('Véhicules enregistrés', 'مركبات مسجّلة'),
      tag: tr('Volume', 'الحجم'),
      progress: 100,
      icon: Truck,
      shell: 'bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-950 border border-indigo-300/30 text-white',
      titleColor: 'text-indigo-100',
      valueColor: 'text-white',
      hintColor: 'text-indigo-100/90',
      tagColor: 'border-indigo-200/30 bg-indigo-300/15 text-indigo-100',
      iconWrap: 'bg-white/15 text-white',
      glow: 'from-indigo-200/30 via-fuchsia-200/20 to-transparent',
      progressTrack: 'bg-white/20',
      progressBar: 'from-cyan-300 via-indigo-200 to-fuchsia-200',
      hintIcon: CheckCircle2
    },
    {
      key: 'drivers',
      title: tr('Chauffeurs', 'السائقون'),
      value: totalDrivers,
      hint: tr("Membres d'équipage", 'أفراد الطاقم'),
      tag: tr('Staff', 'الطاقم'),
      progress: totalTrucks > 0 ? Math.round((totalDrivers / totalTrucks) * 100) : 0,
      icon: Users,
      shell: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 border border-emerald-200/40 text-white',
      titleColor: 'text-emerald-100',
      valueColor: 'text-white',
      hintColor: 'text-emerald-100',
      tagColor: 'border-emerald-100/40 bg-white/15 text-emerald-100',
      iconWrap: 'bg-white/20 text-white',
      glow: 'from-emerald-100/35 via-cyan-100/20 to-transparent',
      progressTrack: 'bg-white/25',
      progressBar: 'from-lime-200 via-emerald-100 to-cyan-100',
      hintIcon: CheckCircle2
    },
    {
      key: 'inactive',
      title: tr('En Repos', 'في وضع التوقف'),
      value: inactiveTrucks,
      hint: tr('Véhicules inactifs', 'مركبات غير نشطة'),
      tag: tr('Risque', 'المخاطر'),
      progress: totalTrucks > 0 ? Math.round((inactiveTrucks / totalTrucks) * 100) : 0,
      icon: PauseCircle,
      shell: 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 border border-amber-200/40 text-white',
      titleColor: 'text-amber-50',
      valueColor: 'text-white',
      hintColor: 'text-amber-100',
      tagColor: 'border-amber-100/40 bg-white/15 text-amber-50',
      iconWrap: 'bg-white/20 text-white',
      glow: 'from-amber-100/35 via-orange-100/20 to-transparent',
      progressTrack: 'bg-white/25',
      progressBar: 'from-yellow-200 via-orange-100 to-rose-100',
      hintIcon: AlertCircle
    }
  ];

  const classicFleetStyles: Record<string, { shell: string; title: string; value: string; hint: string; tag: string; icon: string; track: string; bar: string }> = {
    fleet: {
      shell: 'bg-white border border-slate-200',
      title: 'text-slate-600',
      value: 'text-slate-900',
      hint: 'text-slate-500',
      tag: 'border-indigo-200 bg-indigo-50 text-indigo-700',
      icon: 'bg-indigo-100 text-indigo-600',
      track: 'bg-slate-200',
      bar: 'from-indigo-500 to-violet-500'
    },
    drivers: {
      shell: 'bg-white border border-slate-200',
      title: 'text-slate-600',
      value: 'text-slate-900',
      hint: 'text-slate-500',
      tag: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: 'bg-emerald-100 text-emerald-600',
      track: 'bg-slate-200',
      bar: 'from-emerald-500 to-teal-500'
    },
    inactive: {
      shell: 'bg-white border border-slate-200',
      title: 'text-slate-600',
      value: 'text-slate-900',
      hint: 'text-slate-500',
      tag: 'border-amber-200 bg-amber-50 text-amber-700',
      icon: 'bg-amber-100 text-amber-600',
      track: 'bg-slate-200',
      bar: 'from-amber-500 to-orange-500'
    }
  };

  // حفظ الفلاتر
  const saveFilters = (next: typeof filters) => {
    setFilters(next);
    localStorage.setItem('truckFilters', JSON.stringify(next));
  };

  // تصدير CSV
  const exportCSV = () => {
    const rows = [
      [
        tu('table.registration', 'Matricule'),
        tu('table.driver', 'Chauffeur'),
        tu('table.status', 'Statut'),
        tu('table.lastActivity', 'Dernière activité'),
        tu('table.restReason', 'Repos (raison)'),
        tu('table.plannedReturn', 'Retour prévu')
      ],
      ...commandFilteredTrucks.map(t => {
        const driver = drivers.find(d => d.id === t.driverId)?.name || '';
        return [
          t.matricule,
          driver,
          t.isActive ? tu('label.active', 'Actif') : tu('label.inactive', 'Inactif'),
          t.updatedAt ? new Date(t.updatedAt).toLocaleString(uiLocale) : '',
          t.reposReason || '',
          t.nextReturnDate || ''
        ];
      })
    ];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tu('export.csvFileName', 'camions.csv');
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedHistoryTruck = useMemo(() => {
    return trucks.find(t => t.id === historyTruckId);
  }, [trucks, historyTruckId]);

  const selectedHistoryAssignments = useMemo(() => {
    const rows = (truckAssignments || []).filter(a => a?.truckId === historyTruckId);
    return rows.sort((a: any, b: any) => {
      const ad = a?.date ? Date.parse(a.date) : 0;
      const bd = b?.date ? Date.parse(b.date) : 0;
      return bd - ad;
    });
  }, [truckAssignments, historyTruckId]);

  const downloadAssignmentHistoryPDF = async () => {
    if (!selectedHistoryTruck) return;

    const { doc, autoTable } = await createPdfDoc();
    const now = new Date();
    const dateStr = now.toLocaleString(uiLocale);

    setPdfFont(doc, 'bold');
    doc.setFontSize(14);
    doc.text(`${tv('pdf.assignmentHistory', "Historique d'assignation", 'سجل التعيينات')} - ${selectedHistoryTruck.matricule}`, 14, 16);
    setPdfFont(doc, 'normal');
    doc.setFontSize(10);
    doc.text(`${tv('pdf.generatedAt', 'Généré le', 'تم الإنشاء في')}: ${dateStr}`, 14, 24);

    const tableRows = selectedHistoryAssignments.map((a: any) => {
      const prevName = drivers.find(d => d.id === a?.prevDriverId)?.name || tv('common.unassigned', 'Non assigné', 'غير معين');
      const nextName = drivers.find(d => d.id === a?.driverId)?.name || tv('common.unassigned', 'Non assigné', 'غير معين');
      const d = a?.date ? new Date(a.date).toLocaleString(uiLocale) : '';
      return [d, prevName, nextName, a?.note || ''];
    });

    autoTable(doc, {
      head: [[
        tv('table.date', 'Date', 'التاريخ'),
        tv('pdf.previousDriver', 'Ancien chauffeur', 'السائق السابق'),
        tv('pdf.newDriver', 'Nouveau chauffeur', 'السائق الجديد'),
        tv('table.note', 'Note', 'ملاحظة')
      ]],
      body: tableRows,
      startY: 32,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 50 }, 2: { cellWidth: 50 }, 3: { cellWidth: 'auto' } },
    });

    doc.save(`${tu('pdf.filePrefix', 'historique_assignation')}_${selectedHistoryTruck.matricule}_${format(now, 'yyyyMMdd_HHmm')}.pdf`);
  };

  return (
    <div className="app-page-shell p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-slate-900 via-indigo-900 to-violet-900 text-white p-6 md:p-8">
        <div className="absolute -top-20 -right-24 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-20 left-16 w-60 h-60 bg-violet-400/20 rounded-full blur-2xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              {tr('Fleet Creative Console', 'واجهة قيادة الأسطول')}
            </div>
            <div className="flex items-center gap-2 text-indigo-100">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium capitalize">{today.toLocaleDateString(uiLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <h1 className="app-page-title text-3xl md:text-4xl font-black tracking-tight">{tr('Gestion des Camions', 'إدارة الشاحنات')}</h1>
            <p className="app-page-subtitle text-indigo-100 font-medium">{tr('Pilotage intelligent de la flotte, des statuts et des affectations chauffeurs.', 'قيادة ذكية للأسطول والحالات وتوزيع السائقين.')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => window.print()} className="hidden md:flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border-white/30">
              <Printer className="w-4 h-4" />
              {tu('actions.print', 'Imprimer')}
            </Button>
            <Button
              variant="outline"
              disabled={trucks.length === 0}
              onClick={() => setDeleteAllDialogOpen(true)}
              className="hidden md:flex items-center gap-2 bg-white/10 hover:bg-red-500/20 text-red-100 border-red-200/40"
            >
              <Trash2 className="w-4 h-4" />
              {tu('actions.deleteAll', 'Supprimer tout')}
            </Button>
            <AddTruckDialog />
          </div>
        </div>
      </div>

      <AlertDialog open={deleteAllDialogOpen} onOpenChange={(open) => {
        setDeleteAllDialogOpen(open);
        if (!open) setDeleteAllCode('');
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tu('confirm.deleteAllCodeTitle', 'Confirmation par code')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tu('confirm.deleteAllCodeDescription', 'Pour supprimer tous les camions, saisissez le code de confirmation demandé.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Input
              value={deleteAllCode}
              onChange={(event) => setDeleteAllCode(event.target.value)}
              placeholder={tu('placeholder.deleteAllCode', 'Entrez le code de confirmation')}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{tu('actions.cancel', 'Annuler')}</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDeleteAllTrucks}>
              {tu('actions.deleteAll', 'Supprimer tout')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stats Cards Section (Compact & Sleek) */}
      <div className="grid gap-3 sm:grid-cols-3">
        {fleetOverviewCards.map((card, index) => {
          const Icon = card.icon;
          const HintIcon = card.hintIcon;
          const isActive = activeFleetCard === card.key;
          const isCinematic = fleetCardMode === 'cinematic';
          const classicStyle = classicFleetStyles[card.key] ?? classicFleetStyles.fleet;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.3 }}
              whileHover={{ y: -2 }}
              onMouseEnter={() => setActiveFleetCard(card.key)}
              onFocus={() => setActiveFleetCard(card.key)}
              tabIndex={0}
            >
              <Card className={`group relative overflow-hidden rounded-2xl p-3.5 sm:p-4 shadow-sm transition-all duration-300 hover:shadow-md ${isCinematic ? `${card.shell} ${isActive ? 'ring-2 ring-white/40' : 'ring-1 ring-white/10'}` : `${classicStyle.shell} ${isActive ? 'ring-2 ring-slate-300' : 'ring-1 ring-slate-100'}`}`}>
                <div className="relative z-10 space-y-2">
                  <div className={`text-xs font-semibold flex items-center justify-between ${isCinematic ? card.titleColor : classicStyle.title}`}>
                    <span className="flex items-center gap-1.5">
                      <span className="font-bold text-sm">{card.title}</span>
                      <Badge variant="outline" className={`h-4.5 rounded-full px-1.5 text-[9px] font-bold ${isCinematic ? card.tagColor : classicStyle.tag}`}>
                        {card.tag}
                      </Badge>
                    </span>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${isCinematic ? card.iconWrap : classicStyle.icon}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <AnimatedMetricValue value={card.value} className={`text-2xl sm:text-3xl font-black tracking-tight ${isCinematic ? card.valueColor : classicStyle.value}`} />
                    <span className={`text-[11px] font-bold ${isCinematic ? card.hintColor : classicStyle.hint}`}>
                      {Math.max(0, Math.min(100, card.progress))}%
                    </span>
                  </div>

                  <div className={`h-1.5 w-full overflow-hidden rounded-full ${isCinematic ? card.progressTrack : classicStyle.track}`}>
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${isCinematic ? card.progressBar : classicStyle.bar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(6, Math.min(100, card.progress))}%` }}
                      transition={{ delay: 0.1 + index * 0.08, duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <p className={`flex items-center gap-1 ${isCinematic ? card.hintColor : classicStyle.hint}`}>
                      <HintIcon className="w-3 h-3" />
                      <span>{card.hint}</span>
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
      {/* Unified Executive Fleet Control & Filters */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                setCommandSearch(val);
              }}
              placeholder={tu('placeholder.searchTruckOrDriver', 'Rechercher par matricule ou chauffeur...')}
              className="pl-10 pr-9 h-11 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-600 rounded-xl text-sm transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCommandSearch('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Status Filter Pills (Tous, Actifs, En Repos, Sans Chauffeur) */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setFleetPulse('all');
                saveFilters({ active: true, inactive: true, noDriver: false });
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                fleetPulse === 'all' && (!filters.noDriver && filters.active && filters.inactive)
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span>{tu('filters.all', 'Tout')}</span>
              <Badge variant="outline" className="h-4.5 px-1.5 text-[10px] bg-slate-200/60 border-slate-300/60 font-semibold text-slate-700">
                {trucks.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => {
                setFleetPulse('active');
                saveFilters({ active: true, inactive: false, noDriver: false });
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                fleetPulse === 'active' || (filters.active && !filters.inactive && !filters.noDriver)
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{tu('stats.active', 'Actifs')}</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                fleetPulse === 'active' || (filters.active && !filters.inactive && !filters.noDriver)
                  ? "bg-emerald-700 text-white"
                  : "bg-emerald-100 text-emerald-800"
              )}>
                {activeTrucks}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFleetPulse('inactive');
                saveFilters({ active: false, inactive: true, noDriver: false });
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                fleetPulse === 'inactive' || (!filters.active && filters.inactive && !filters.noDriver)
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span>{tu('stats.inactive', 'En repos')}</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                fleetPulse === 'inactive' || (!filters.active && filters.inactive && !filters.noDriver)
                  ? "bg-amber-600 text-white"
                  : "bg-amber-100 text-amber-800"
              )}>
                {inactiveTrucks}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFleetPulse('nodriver');
                saveFilters({ active: true, inactive: true, noDriver: true });
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                fleetPulse === 'nodriver' || filters.noDriver
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <UserX className="w-3.5 h-3.5" />
              <span>{tu('stats.withoutDriver', 'Sans chauffeur')}</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                fleetPulse === 'nodriver' || filters.noDriver
                  ? "bg-indigo-700 text-white"
                  : "bg-indigo-100 text-indigo-800"
              )}>
                {trucksWithoutDriver}
              </span>
            </button>
          </div>

          {/* Controls: History filter, Sort, View toggle, Export CSV */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Switcher (Tableau / Cartes) */}
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
              <Button
                size="sm"
                variant={trucksView === 'table' ? 'secondary' : 'ghost'}
                className={cn(
                  "h-8 px-3 rounded-lg text-xs font-bold transition-all",
                  trucksView === 'table'
                    ? "bg-white text-indigo-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
                onClick={() => setTrucksView('table')}
              >
                <Table2 className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                {tu('views.table', 'Tableau')}
              </Button>
              <Button
                size="sm"
                variant={trucksView === 'cards' ? 'secondary' : 'ghost'}
                className={cn(
                  "h-8 px-3 rounded-lg text-xs font-bold transition-all",
                  trucksView === 'cards'
                    ? "bg-white text-indigo-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
                onClick={() => setTrucksView('cards')}
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                {tu('views.cards', 'Cartes')}
              </Button>
            </div>

            {/* History Dropdown */}
            <Select
              value={historyTruckId}
              onValueChange={(v) => {
                setHistoryTruckId(v);
                setHistoryDialogOpen(true);
              }}
            >
              <SelectTrigger className="w-[180px] h-10 bg-white border-slate-200 rounded-xl text-xs">
                <History className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                <SelectValue placeholder={tu('placeholder.historyFilter', 'Historique camion')} />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl max-h-60">
                {trucks.map(truck => (
                  <SelectItem key={truck.id} value={truck.id} className="text-xs font-medium">
                    {truck.matricule}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[140px] h-10 bg-white border-slate-200 rounded-xl text-xs">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                <SelectValue placeholder={tu('placeholder.sortBy', 'Trier par')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status" className="text-xs">{tu('table.status', 'Statut')}</SelectItem>
                <SelectItem value="name" className="text-xs">{tu('table.driver', 'Chauffeur')}</SelectItem>
                <SelectItem value="updatedAt" className="text-xs">{tu('table.lastActivity', 'Dernière activité')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order Button */}
            <Button 
              variant="outline" 
              size="icon"
              className="h-10 w-10 rounded-xl border-slate-200 bg-white hover:bg-slate-50"
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
              title={sortOrder === 'asc' ? tr('Croissant', 'تصاعدي') : tr('Décroissant', 'تنازلي')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>

            {/* Export CSV Button */}
            <Button
              variant="outline"
              onClick={exportCSV}
              className="h-10 px-3.5 rounded-xl border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> 
              <span>{tu('actions.exportCsv', 'Export CSV')}</span>
            </Button>
          </div>
        </div>

        {/* Mass Selection Actions Ribbon */}
        {selected.size > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50 border border-indigo-200/80 rounded-xl animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white font-bold px-2 py-0.5">
                {selected.size}
              </Badge>
              <span className="text-xs font-bold text-indigo-950">
                {tu('selection.selectedTrucks', 'camions sélectionnés')}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-amber-200 text-amber-700 hover:bg-amber-50 h-8 text-xs font-semibold rounded-lg"
                onClick={() => {
                  const ids = Array.from(selected);
                  bulkSetRepos(ids);
                  clearSelection();
                  toast({ title: tu('toast.setToRest', 'Mis en repos'), description: `${ids.length} ${tu('toast.trucksSetToRest', 'camion(s) mis en repos')}` });
                }}
              >
                <PauseCircle className="w-3.5 h-3.5 mr-1" />
                {tu('actions.setToRest', 'Mettre en repos')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-8 text-xs font-semibold rounded-lg"
                onClick={() => {
                  const ids = Array.from(selected);
                  bulkReactivate(ids);
                  clearSelection();
                  toast({ title: tu('toast.reactivated', 'Réactivés'), description: `${ids.length} ${tu('toast.trucksReactivated', 'camion(s) réactivé(s)')}` });
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {tu('actions.reactivate', 'Réactiver')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-rose-200 text-rose-700 hover:bg-rose-50 h-8 text-xs font-semibold rounded-lg"
                onClick={() => {
                  const ids = Array.from(selected);
                  bulkDissociateDriver(ids);
                  clearSelection();
                  toast({ title: tu('toast.driversDissociatedTitle', 'Chauffeurs dissociés'), description: `${ids.length} ${tu('toast.trucksCount', 'camion(s)')}` });
                }}
              >
                <UserX className="w-3.5 h-3.5 mr-1" />
                {tu('actions.dissociateDriver', 'Dissocier chauffeur')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-slate-900 h-8 text-xs rounded-lg"
                onClick={clearSelection}
              >
                {tu('actions.cancel', 'Annuler')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {trucksView === 'table' ? (
      <Card className="border-none shadow-md overflow-hidden rounded-2xl bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selected.size > 0 && allSelected}
                    onCheckedChange={(v) => {
                      if (v) setSelected(new Set(commandFilteredTrucks.map(t => t.id)));
                      else clearSelection();
                    }}
                    className="data-[state=checked]:bg-indigo-600"
                  />
                </TableHead>
                <TableHead className="text-slate-600 font-bold">{tu('table.registration', 'Matricule')}</TableHead>
                <TableHead className="text-slate-600 font-bold">{tu('table.type', 'Type')}</TableHead>
                <TableHead className="text-slate-600 font-bold">{tu('table.driver', 'Chauffeur')}</TableHead>
                <TableHead className="text-slate-600 font-bold">{tu('table.status', 'Statut')}</TableHead>
                <TableHead className="text-slate-600 font-bold">{tu('table.priority', 'Priorité')}</TableHead>
                <TableHead className="text-slate-600 font-bold">{tu('table.lastActivity', 'Dernière activité')}</TableHead>
                <TableHead className="text-slate-600 font-bold text-center">{tu('table.actions', 'Actions')}</TableHead>
                <TableHead className="text-slate-600 font-bold">{tu('table.assignment', 'Assignation')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commandFilteredTrucks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Truck className="w-12 h-12 mb-2 opacity-20" />
                      <p className="text-lg font-medium">{tu('empty.noTruckFound', 'Aucun camion trouvé')}</p>
                      <p className="text-sm">{tu('empty.adjustSearch', 'Essayez de modifier vos critères de recherche')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <AnimatePresence initial={false}>
                {commandFilteredTrucks.map((truck) => {
                  const currentDriver = drivers.find(d => d.id === truck.driverId);
                  const statusLabel = truck.isActive ? tu('label.active', 'Actif') : tu('label.inactive', 'Inactif');
                  const priority = truckPriority.get(truck.id);
                  
                  return (
                    <motion.tr
                      key={truck.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className={`group hover:bg-slate-50/50 transition-colors border-b border-slate-100 ${priority?.level === 'critical' ? 'bg-rose-50/30' : ''}`}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={selected.has(truck.id)} 
                          onCheckedChange={() => toggleSelected(truck.id)} 
                          aria-label={`${tu('actions.select', 'Sélectionner')} ${truck.matricule}`}
                          className="data-[state=checked]:bg-indigo-600"
                        />
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">{truck.matricule}</TableCell>
                      <TableCell>
                        <TruckTypeBadge
                          truckType={truck.truckType}
                          label={
                            truck.truckType === 'camion'
                              ? tu('truckTypes.camion', 'Camion')
                              : truck.truckType === 'remorque'
                                ? tu('truckTypes.remorque', 'Remorque')
                                : truck.truckType === 'clark'
                                  ? tu('truckTypes.clark', 'Clark')
                                  : tu('truckTypes.allogaz', 'Allogaz')
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {currentDriver ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                              {currentDriver.name.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-700">{currentDriver.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-sm">{tu('common.unassigned', 'Non assigné')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={`font-semibold rounded-full px-3 ${
                            truck.isActive 
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' 
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                          }`}>
                            {statusLabel}
                          </Badge>
                          {!truck.isActive && (truck.nextReturnDate || truck.reposReason) && (
                            <div className="text-[10px] text-slate-500 flex flex-col gap-0.5 leading-tight">
                              {truck.nextReturnDate && <span>📅 {tu('label.resume', 'Reprise')}: {truck.nextReturnDate}</span>}
                              {truck.reposReason && <span className="max-w-[150px] truncate">📝 {truck.reposReason}</span>}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`font-semibold rounded-full px-3 ${
                          priority?.level === 'critical'
                            ? 'bg-rose-100 text-rose-700 hover:bg-rose-100'
                            : priority?.level === 'watch'
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-100'
                        }`}>
                          {(priority?.score || 0) >= 70
                            ? `${tu('priority.critical', 'Critique')} ${priority?.score}`
                            : (priority?.score || 0) >= 35
                              ? `${tu('priority.watch', 'Surveillance')} ${priority?.score}`
                              : `${tu('priority.stable', 'Stable')} ${priority?.score}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm font-medium">
                        {truck.updatedAt ? new Date(truck.updatedAt).toLocaleString(uiLocale, { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {truck.isActive ? (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg"
                              onClick={() => updateTruck(truck.id, { isActive: false })}
                              title={tu('actions.setToRest', 'Mettre en repos')}
                            >
                              <PauseCircle className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                              onClick={() => updateTruck(truck.id, { isActive: true, reposReason: undefined, nextReturnDate: undefined })}
                              title={tu('actions.reactivate', 'Réactiver')}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            onClick={() => updateTruck(truck.id, { driverId: '' })}
                            title={tu('actions.dissociateDriver', 'Dissocier chauffeur')}
                          >
                            <UserX className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            onClick={() => {
                              if (window.confirm(`${tu('confirm.deleteTruckPrefix', 'Supprimer le camion')} ${truck.matricule} ?`)) {
                                deleteTruck(truck.id);
                                setSelected(prev => {
                                  const next = new Set(prev);
                                  next.delete(truck.id);
                                  return next;
                                });
                                toast({ title: tu('toast.truckDeleted', 'Camion supprimé'), description: `${truck.matricule} ${tu('toast.wasDeleted', 'a été supprimé.')}` });
                              }
                            }}
                            title={tu('actions.delete', 'Supprimer')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                title={tu('actions.history', 'Historique')}
                              >
                                <History className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-md p-0 border-none overflow-hidden shadow-2xl">
                              <div className="bg-indigo-600 p-6 text-white">
                                <AlertDialogHeader>
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                      <History className="w-6 h-6" />
                                    </div>
                                    <div>
                                      <AlertDialogTitle className="text-xl font-bold text-white">{tv('dialog.assignmentHistory', "Historique d'assignation", 'سجل التعيينات')}</AlertDialogTitle>
                                      <p className="text-indigo-100 text-xs mt-0.5">{truck.matricule}</p>
                                    </div>
                                  </div>
                                </AlertDialogHeader>
                              </div>
                              <div className="p-6 space-y-4 max-h-[50vh] overflow-auto bg-white">
                                {truckAssignments.filter(a => a.truckId === truck.id).length === 0 ? (
                                  <div className="text-center py-8 text-slate-400">
                                    <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                  <p>{tu('empty.noHistory', 'Aucun historique disponible')}</p>
                                  </div>
                                ) : (
                                  truckAssignments.filter(a => a.truckId === truck.id).map(a => (
                                    <div key={a.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400">
                                          {new Date(a.date).toLocaleString(uiLocale, { year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <span className="text-slate-400">{(drivers.find(d => d.id === a.prevDriverId)?.name || tu('common.unassigned', 'Non assigné'))}</span>
                                        <span className="text-indigo-400">→</span>
                                        <span className="text-indigo-600">{drivers.find(d => d.id === a.driverId)?.name || tu('common.unassigned', 'Non assigné')}</span>
                                      </div>
                                      {a.note && <div className="text-xs text-slate-500 italic bg-white p-2 rounded-md border border-slate-100 mt-2">{a.note}</div>}
                                    </div>
                                  ))
                                )}
                              </div>
                              <AlertDialogFooter className="p-4 bg-slate-50 border-t border-slate-100">
                            <AlertDialogCancel className="rounded-xl border-slate-200">{tu('actions.close', 'Fermer')}</AlertDialogCancel>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={truck.driverId || ''}
                          onValueChange={(value) => {
                            const conflict = driverHasActiveTruck(value);
                            if (conflict && conflict.id !== truck.id) {
                              setPendingChange({ truckId: truck.id, newDriverId: value });
                              setConfirmOpen(true);
                              return;
                            }
                            setPendingChange({ truckId: truck.id, newDriverId: value });
                            setConfirmOpen(true);
                          }}
                        >
                          <SelectTrigger className="w-[180px] h-9 bg-white border-slate-200 rounded-lg text-xs font-medium focus:ring-indigo-600">
                            <SelectValue placeholder={tu('placeholder.changeDriver', 'Changer chauffeur')} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                            {availableDrivers.map(driver => (
                              <SelectItem key={driver.id} value={driver.id} className="text-xs font-medium rounded-lg">
                                {driver.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </motion.tr>
                  );
                })}
                </AnimatePresence>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      ) : (
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {commandFilteredTrucks.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3 border border-slate-200 bg-white">
            <div className="h-40 flex flex-col items-center justify-center text-slate-400">
              <Truck className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-lg font-medium">{tu('empty.noTruckFound', 'Aucun camion trouvé')}</p>
              <p className="text-sm">{tu('empty.adjustSearch', 'Essayez de modifier vos critères de recherche')}</p>
            </div>
          </Card>
        ) : (
          commandFilteredTrucks.map((truck) => {
            const currentDriver = drivers.find(d => d.id === truck.driverId);
            const statusLabel = truck.isActive ? tu('label.active', 'Actif') : tu('label.inactive', 'Inactif');
            const priority = truckPriority.get(truck.id);
            return (
              <motion.div
                key={truck.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
              <Card className={`border bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow ${priority?.level === 'critical' ? 'border-rose-300' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox
                      checked={selected.has(truck.id)}
                      onCheckedChange={() => toggleSelected(truck.id)}
                      className="data-[state=checked]:bg-indigo-600"
                    />
                    <div>
                      <div className="font-black text-slate-900">{truck.matricule}</div>
                      <div className="text-xs text-slate-500">{truck.updatedAt ? new Date(truck.updatedAt).toLocaleString(uiLocale, { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                    </div>
                  </div>
                  <Badge className={`font-semibold rounded-full px-3 ${truck.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'}`}>
                    {statusLabel}
                  </Badge>
                </div>
                <div className="mt-2">
                  <Badge className={`font-semibold rounded-full px-3 ${
                    priority?.level === 'critical'
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-100'
                      : priority?.level === 'watch'
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-100'
                  }`}>
                    {(priority?.score || 0) >= 70
                      ? `${tu('priority.critical', 'Critique')} ${priority?.score}`
                      : (priority?.score || 0) >= 35
                        ? `${tu('priority.watch', 'Surveillance')} ${priority?.score}`
                        : `${tu('priority.stable', 'Stable')} ${priority?.score}`}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <TruckTypeBadge
                    truckType={truck.truckType}
                    label={
                      truck.truckType === 'camion'
                        ? tu('truckTypes.camion', 'Camion')
                        : truck.truckType === 'remorque'
                          ? tu('truckTypes.remorque', 'Remorque')
                          : truck.truckType === 'clark'
                            ? tu('truckTypes.clark', 'Clark')
                            : tu('truckTypes.allogaz', 'Allogaz')
                    }
                  />
                  <Button variant="ghost" size="sm" className="text-indigo-600 hover:bg-indigo-50" onClick={() => { setHistoryTruckId(truck.id); setHistoryDialogOpen(true); }}>
                    <ArrowUpRight className="w-4 h-4 mr-1.5" />
                    {tu('actions.history', 'Historique')}
                  </Button>
                </div>
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  {currentDriver ? (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                        {currentDriver.name.charAt(0)}
                      </div>
                      <span className="font-medium text-slate-700">{currentDriver.name}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-sm">{tu('common.unassigned', 'Non assigné')}</span>
                  )}
                  {!truck.isActive && (truck.nextReturnDate || truck.reposReason) && (
                    <div className="text-[11px] text-slate-500 mt-2 leading-tight">
                      {truck.nextReturnDate && <div>📅 {tu('label.resume', 'Reprise')}: {truck.nextReturnDate}</div>}
                      {truck.reposReason && <div className="truncate">📝 {truck.reposReason}</div>}
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <Select
                    value={truck.driverId || ''}
                    onValueChange={(value) => {
                      const conflict = driverHasActiveTruck(value);
                      if (conflict && conflict.id !== truck.id) {
                        setPendingChange({ truckId: truck.id, newDriverId: value });
                        setConfirmOpen(true);
                        return;
                      }
                      setPendingChange({ truckId: truck.id, newDriverId: value });
                      setConfirmOpen(true);
                    }}
                  >
                    <SelectTrigger className="w-full h-9 bg-white border-slate-200 rounded-lg text-xs font-medium focus:ring-indigo-600">
                      <SelectValue placeholder={tu('placeholder.changeDriver', 'Changer chauffeur')} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                      {availableDrivers.map(driver => (
                        <SelectItem key={driver.id} value={driver.id} className="text-xs font-medium rounded-lg">
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-3 flex items-center gap-1">
                  {truck.isActive ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg" onClick={() => updateTruck(truck.id, { isActive: false })} title={tu('actions.setToRest', 'Mettre en repos')}>
                      <PauseCircle className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg" onClick={() => updateTruck(truck.id, { isActive: true, reposReason: undefined, nextReturnDate: undefined })} title={tu('actions.reactivate', 'Réactiver')}>
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => updateTruck(truck.id, { driverId: '' })} title={tu('actions.dissociateDriver', 'Dissocier chauffeur')}>
                    <UserX className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    onClick={() => {
                      if (window.confirm(`${tu('confirm.deleteTruckPrefix', 'Supprimer le camion')} ${truck.matricule} ?`)) {
                        deleteTruck(truck.id);
                        setSelected(prev => {
                          const next = new Set(prev);
                          next.delete(truck.id);
                          return next;
                        });
                        toast({ title: tu('toast.truckDeleted', 'Camion supprimé'), description: `${truck.matricule} ${tu('toast.wasDeleted', 'a été supprimé.')}` });
                      }
                    }}
                    title={tu('actions.delete', 'Supprimer')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
              </motion.div>
            );
          })
        )}
      </div>
      )}

      {/* Confirmation dialog (single row driver change) */}
      <AlertDialog
        open={historyDialogOpen}
        onOpenChange={(open) => {
          setHistoryDialogOpen(open);
          if (!open) setHistoryTruckId('');
        }}
      >
        <AlertDialogContent className="max-w-lg p-0 border-none overflow-hidden shadow-2xl">
          <div className="bg-indigo-600 p-6 text-white">
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <AlertDialogTitle className="text-xl font-bold text-white">{tv('dialog.assignmentHistory', "Historique d'assignation", 'سجل التعيينات')}</AlertDialogTitle>
                  <p className="text-indigo-100 text-xs mt-0.5">{selectedHistoryTruck?.matricule || ''}</p>
                </div>
              </div>
            </AlertDialogHeader>
          </div>
          <div className="p-6 space-y-4 max-h-[55vh] overflow-auto bg-white">
            {selectedHistoryAssignments.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>{tu('empty.noHistory', 'Aucun historique disponible')}</p>
              </div>
            ) : (
              selectedHistoryAssignments.map((a: any) => (
                <div key={a.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">
                      {a?.date ? new Date(a.date).toLocaleString(uiLocale, { year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span className="text-slate-400">{drivers.find(d => d.id === a?.prevDriverId)?.name || tu('common.unassigned', 'Non assigné')}</span>
                    <span className="text-indigo-400">→</span>
                    <span className="text-indigo-600">{drivers.find(d => d.id === a?.driverId)?.name || tu('common.unassigned', 'Non assigné')}</span>
                  </div>
                  {a?.note && <div className="text-xs text-slate-500 italic bg-white p-2 rounded-md border border-slate-100 mt-2">{a.note}</div>}
                </div>
              ))
            )}
          </div>
          <AlertDialogFooter className="p-4 bg-slate-50 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={downloadAssignmentHistoryPDF}
              disabled={!selectedHistoryTruck || selectedHistoryAssignments.length === 0}
              className="rounded-xl border-slate-200 bg-white"
            >
              <Download className="w-4 h-4 mr-2" />
              {tu('actions.downloadPdf', 'Télécharger PDF')}
            </Button>
            <AlertDialogCancel className="rounded-xl border-slate-200">{tu('actions.close', 'Fermer')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md p-0 border-none overflow-hidden shadow-2xl">
          <div className="bg-amber-500 p-6 text-white">
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <AlertDialogTitle className="text-xl font-bold text-white">{tu('dialog.confirmChangeTitle', 'Confirmer le changement')}</AlertDialogTitle>
              </div>
            </AlertDialogHeader>
          </div>
          <div className="p-6 bg-white">
            <AlertDialogDescription className="text-slate-600 font-medium">
              {tu('dialog.confirmChangeDescription', "Ce chauffeur est déjà assigné à un autre camion actif. Si vous confirmez, l'autre camion sera automatiquement mis en repos.")}
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className="p-4 bg-slate-50 border-t border-slate-100">
            <AlertDialogCancel onClick={() => setPendingChange(null)} className="rounded-xl border-slate-200">{tu('actions.cancel', 'Annuler')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-6 font-bold"
              onClick={() => {
                if (pendingChange) {
                  const { truckId, newDriverId } = pendingChange;
                  const otherTrucksWithSameDriver = trucks.filter(
                    (t) => t.driverId === newDriverId && t.id !== truckId
                  );
                  otherTrucksWithSameDriver.forEach((t) => {
                    updateTruck(t.id, { isActive: false });
                  });
                  updateTruck(truckId, { driverId: newDriverId, isActive: true });
                  setPendingChange(null);
                  setConfirmOpen(false);
                  toast({
                    title: tu('toast.driverUpdated', 'Chauffeur mis à jour'),
                    description: tu('toast.assignmentSuccessOtherRest', "Assignation réussie. L'autre véhicule a été mis en repos."),
                  });
                }
              }}
            >
              {tu('actions.confirm', 'Confirmer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Trucks;
