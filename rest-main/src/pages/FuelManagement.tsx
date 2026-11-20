import React, { useState, useEffect, useMemo, useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Fuel,
  Gauge,
  TrendingUp,
  Droplet,
  Coins,
  Calendar,
  Search,
  Download,
  Printer,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Truck,
  User,
  Zap,
  ShieldCheck,
  BarChart3,
  Activity,
  Layers,
  Sparkles,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import {
  fetchGpswoxDailyDistances,
  loadAllFuelSettings,
  saveVehicleFuelSetting,
  getDefaultFuelSetting,
  VehicleDailyTelemetry,
  VehicleFuelSetting,
  LiveVehicle,
  getGpsConfig,
} from '@/lib/gpswoxService';
import { toast } from '@/components/ui/use-toast';

export default function FuelManagement() {
  const { trucks = [], drivers = [] } = useApp() as any;
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9-_]/g, '');

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [telemetryData, setTelemetryData] = useState<VehicleDailyTelemetry[]>([]);
  const [liveVehicles, setLiveVehicles] = useState<LiveVehicle[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string>('En attente...');
  const [gpsServerUrl, setGpsServerUrl] = useState<string>('167.86.91.143');

  // Selected vehicle ('ALL' or vehicle plate/id)
  const [selectedVehicle, setSelectedVehicle] = useState<string>('ALL');
  const [periodDays, setPeriodDays] = useState<number>(7);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fuel Measurement Parameters
  const [allFuelSettings, setAllFuelSettings] = useState<Record<string, VehicleFuelSetting>>({});
  const [consumptionLPerKm, setConsumptionLPerKm] = useState<number>(0.265);
  const [kmPerLiter, setKmPerLiter] = useState<number>(3.77);
  const [costPerLiter, setCostPerLiter] = useState<number>(13.5);
  const [tankCapacity, setTankCapacity] = useState<number>(120);
  const [alertThreshold, setAlertThreshold] = useState<number>(15);

  // Modal for advanced vehicle parameters
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);

  // 1. Initial Load & Fetch from GPSwox
  const loadData = async (isManualRefresh: boolean = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const cfg = await getGpsConfig();
      if (cfg.apiUrl) {
        setGpsServerUrl(cfg.apiUrl.replace(/^https?:\/\//i, '').replace(/\/api.*$/i, ''));
      }

      const settings = loadAllFuelSettings();
      setAllFuelSettings(settings);

      const res = await fetchGpswoxDailyDistances(periodDays);
      if (res.success && res.data) {
        setTelemetryData(res.data);
        setLiveVehicles(res.liveDevices);
        setLastSyncTime(
          new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
        if (isManualRefresh) {
          toast({
            title: 'Synchronisation SFTM réussie',
            description: `${res.liveDevices.length} balises GPS synchronisées avec succès.`,
          });
        }
      } else {
        toast({
          title: 'Mode Hors-Ligne SFTM',
          description: res.error || 'Affichage des données locales de télémétrie.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      console.error('[FuelManagement] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [periodDays]);

  // Synchronize fuel measurement inputs when selected vehicle changes
  useEffect(() => {
    const currentKey = selectedVehicle === 'ALL' ? 'DEFAULT' : selectedVehicle;
    const existing = allFuelSettings[currentKey] || getDefaultFuelSetting(currentKey);

    setConsumptionLPerKm(existing.consumptionLPerKm);
    setKmPerLiter(existing.kmPerLiter);
    setCostPerLiter(existing.costPerLiter);
    setTankCapacity(existing.tankCapacityLiters || 120);
    setAlertThreshold(existing.alertThresholdPercent || 15);
  }, [selectedVehicle, allFuelSettings]);

  // Bidirectional Handlers for Fuel Measurement Inputs
  // When L/km changes -> auto compute km/L
  const handleLPerKmChange = (rawVal: number) => {
    const lPerKm = Math.max(0.001, Number(rawVal) || 0);
    setConsumptionLPerKm(Number(lPerKm.toFixed(4)));
    const kmL = Number((1 / lPerKm).toFixed(2));
    setKmPerLiter(kmL);
  };

  // When L/100km slider / input changes -> auto compute L/km and km/L
  const handleLPer100KmChange = (val100: number) => {
    const valid100 = Math.max(0.1, Number(val100) || 0);
    const lKm = Number((valid100 / 100).toFixed(4));
    setConsumptionLPerKm(lKm);
    const kmL = Number((100 / valid100).toFixed(2));
    setKmPerLiter(kmL);
  };

  // When km/L changes -> auto compute L/km
  const handleKmPerLiterChange = (rawVal: number) => {
    const kmL = Math.max(0.01, Number(rawVal) || 0);
    setKmPerLiter(Number(kmL.toFixed(2)));
    const lKm = Number((1 / kmL).toFixed(4));
    setConsumptionLPerKm(lKm);
  };

  // Save parameters for the active vehicle (or fleet)
  const handleSaveParameters = () => {
    const currentKey = selectedVehicle === 'ALL' ? 'DEFAULT' : selectedVehicle;
    const l100 = Number((consumptionLPerKm * 100).toFixed(2));
    const newSetting: VehicleFuelSetting = {
      vehicleId: currentKey,
      plate: currentKey,
      consumptionLPerKm,
      consumptionLPer100Km: l100,
      kmPerLiter,
      costPerLiter,
      tankCapacityLiters: tankCapacity,
      alertThresholdPercent: alertThreshold,
      updatedAt: new Date().toISOString(),
    };

    saveVehicleFuelSetting(newSetting);
    setAllFuelSettings((prev) => ({
      ...prev,
      [currentKey]: newSetting,
    }));

    toast({
      title: 'Paramètres Carburant Sauvegardés',
      description: `Paramètres enregistrés pour ${
        selectedVehicle === 'ALL' ? 'toute la flotte' : selectedVehicle
      } : ${l100} L/100km, ${kmPerLiter} km/L, ${costPerLiter} DH/L.`,
    });
    setSettingsModalOpen(false);
  };

  // Unified list of vehicles combining AppContext trucks & GPSwox live devices
  const vehicleOptions = useMemo(() => {
    const map = new Map<string, { plate: string; name: string; driverName: string; status: string }>();

    liveVehicles.forEach((v) => {
      map.set(v.plate, {
        plate: v.plate,
        name: v.name || v.plate,
        driverName: v.driverName || 'Chauffeur',
        status: v.status,
      });
    });

    trucks.forEach((t: any) => {
      const plate = t.matricule || t.plate || t.name;
      if (plate && !map.has(plate)) {
        const d = drivers.find((drv: any) => String(drv.id) === String(t.driverId));
        map.set(plate, {
          plate,
          name: t.name || plate,
          driverName: d?.name || 'Chauffeur assigné',
          status: 'stopped',
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.plate.localeCompare(b.plate));
  }, [liveVehicles, trucks, drivers]);

  // Filtered telemetry records based on vehicle selection and search
  const filteredRecords = useMemo(() => {
    let list = telemetryData;
    if (selectedVehicle !== 'ALL') {
      list = list.filter(
        (r) =>
          r.plate.toLowerCase() === selectedVehicle.toLowerCase() ||
          r.vehicleId.toLowerCase() === selectedVehicle.toLowerCase()
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.plate.toLowerCase().includes(q) ||
          r.vehicleName.toLowerCase().includes(q) ||
          r.driverName.toLowerCase().includes(q) ||
          r.date.includes(q)
      );
    }
    return list;
  }, [telemetryData, selectedVehicle, searchQuery]);

  // Aggregate KPI Calculations
  const stats = useMemo(() => {
    const totalDistanceKm = filteredRecords.reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0);
    // Litres = Distance * (L/km)
    const totalFuelLiters = totalDistanceKm * consumptionLPerKm;
    // Coût Total = Litres * Coût/L
    const totalCostDh = totalFuelLiters * costPerLiter;
    // Coût au km (DH/km) = (L/km) * Coût/L
    const costPerKmDh = consumptionLPerKm * costPerLiter;

    // Eco-Driving Rating: based on consumption efficiency
    let ecoScore = 'A+';
    let ecoColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    let ecoLabel = 'Excellente efficacité';

    const l100 = consumptionLPerKm * 100;
    if (l100 > 35) {
      ecoScore = 'C';
      ecoColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      ecoLabel = 'Surconsommation détectée';
    } else if (l100 > 29) {
      ecoScore = 'B';
      ecoColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      ecoLabel = 'Consommation modérée';
    } else if (l100 > 22) {
      ecoScore = 'A';
      ecoColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      ecoLabel = 'Bonne efficacité';
    }

    return {
      totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
      totalFuelLiters: Number(totalFuelLiters.toFixed(1)),
      totalCostDh: Number(totalCostDh.toFixed(2)),
      costPerKmDh: Number(costPerKmDh.toFixed(2)),
      ecoScore,
      ecoColor,
      ecoLabel,
      l100: Number(l100.toFixed(2)),
    };
  }, [filteredRecords, consumptionLPerKm, costPerLiter]);

  // Chart 1: Daily Distance vs Consumed Liters (Aggregated by day)
  const dailyChartData = useMemo(() => {
    const map = new Map<string, { date: string; dayLabel: string; distance: number; liters: number; cost: number }>();

    filteredRecords.forEach((r) => {
      const existing = map.get(r.date) || {
        date: r.date,
        dayLabel: r.dayLabel,
        distance: 0,
        liters: 0,
        cost: 0,
      };
      const dist = Number(r.distanceKm) || 0;
      const lit = dist * consumptionLPerKm;
      const c = lit * costPerLiter;

      existing.distance += dist;
      existing.liters += lit;
      existing.cost += c;
      map.set(r.date, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        distance: Number(item.distance.toFixed(1)),
        liters: Number(item.liters.toFixed(1)),
        cost: Number(item.cost.toFixed(1)),
      }));
  }, [filteredRecords, consumptionLPerKm, costPerLiter]);

  // Chart 2: Fleet Consumption Comparison (Distance & Fuel per truck)
  const fleetComparisonChartData = useMemo(() => {
    const map = new Map<string, { name: string; distance: number; liters: number; cost: number }>();

    telemetryData.forEach((r) => {
      const shortPlate = r.plate.replace(/^Canter\s+/i, 'C-').replace(/^Fighter\s+/i, 'F-');
      const existing = map.get(shortPlate) || {
        name: shortPlate,
        distance: 0,
        liters: 0,
        cost: 0,
      };
      const dist = Number(r.distanceKm) || 0;
      const lit = dist * consumptionLPerKm;
      const c = lit * costPerLiter;

      existing.distance += dist;
      existing.liters += lit;
      existing.cost += c;
      map.set(shortPlate, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.distance - a.distance)
      .slice(0, 8)
      .map((item) => ({
        ...item,
        distance: Number(item.distance.toFixed(1)),
        liters: Number(item.liters.toFixed(1)),
        cost: Number(item.cost.toFixed(0)),
      }));
  }, [telemetryData, consumptionLPerKm, costPerLiter]);

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Véhicule',
      'Chauffeur',
      'Distance GPS (Km)',
      'Odomètre (Km)',
      'Consommation (L)',
      'Coût Carburant (DH)',
      'Rendement (km/L)',
      'Coût au Km (DH/km)',
    ];

    const rows = filteredRecords.map((r) => {
      const dist = Number(r.distanceKm) || 0;
      const lit = (dist * consumptionLPerKm).toFixed(2);
      const c = (dist * consumptionLPerKm * costPerLiter).toFixed(2);
      const cKm = (consumptionLPerKm * costPerLiter).toFixed(2);
      return [
        `"${r.date}"`,
        `"${r.plate}"`,
        `"${r.driverName}"`,
        `"${dist.toFixed(1)}"`,
        `"${r.odometer || '-'}"`,
        `"${lit}"`,
        `"${c}"`,
        `"${kmPerLiter}"`,
        `"${cKm}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mesure_carburant_sftm_${selectedVehicle}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exportation terminée', description: 'Le fichier CSV a été téléchargé avec succès.' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-8 font-sans selection:bg-indigo-500 selection:text-white">
      {/* 2026 Top Ambient Glow Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-60 right-10 w-[450px] h-[450px] bg-cyan-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-1/3 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[160px]" />
      </div>

      {/* 2026 Header & Telematics Status Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
              <Fuel className="w-7 h-7 text-white" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  Mesure du Carburant
                </h1>
                <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-sm">
                  <Sparkles className="w-3 h-3" />
                  Édition 2026 Télématique
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-slate-400 mt-1 flex items-center gap-2">
                <span>Synchronisation télématique par satellite SFTM</span>
                <span className="inline-block w-1 h-1 rounded-full bg-slate-600" />
                <span className="text-slate-300 font-mono text-xs">Serveur: {gpsServerUrl}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Live Status Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch lg:self-auto">
          {/* Live Sync Status Indicator */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-slate-400">SFTM Live:</span>
            <span className="font-mono text-emerald-400 font-semibold">{lastSyncTime}</span>
          </div>

          {/* Period Selector */}
          <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
            <SelectTrigger className="w-[145px] h-9 bg-slate-900/90 border-slate-800 text-xs text-slate-200 rounded-xl focus:ring-indigo-500">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="1">Aujourd'hui</SelectItem>
              <SelectItem value="7">7 Derniers Jours</SelectItem>
              <SelectItem value="14">14 Derniers Jours</SelectItem>
              <SelectItem value="30">30 Jours (Mois)</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="h-9 px-3 bg-slate-900/90 border-slate-800 hover:bg-slate-800 text-slate-200 rounded-xl text-xs gap-1.5 transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </Button>

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-9 px-3 bg-slate-900/90 border-slate-800 hover:bg-slate-800 text-slate-200 rounded-xl text-xs gap-1.5 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Vehicle Selector & Quick Live Summary Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/90 border border-slate-800/80 p-4 rounded-2xl shadow-xl backdrop-blur-md">
        {/* Selector Header */}
        <div className="lg:col-span-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Sélectionner les véhicules (Flotte / Camion)
            </Label>
            <div className="mt-1">
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger className="h-10 bg-slate-950/80 border-slate-700/80 text-sm font-bold text-white rounded-xl focus:ring-indigo-500 min-w-[240px]">
                  <SelectValue placeholder="Choisir un camion..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 max-h-[320px]">
                  <SelectItem value="ALL" className="font-bold text-indigo-400">
                    🌟 TOUTE LA FLOTTE ({vehicleOptions.length} Camions)
                  </SelectItem>
                  {vehicleOptions.map((v) => (
                    <SelectItem key={v.plate} value={v.plate} className="text-xs">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-semibold text-slate-200">{v.plate}</span>
                        <span className="text-slate-400 text-[11px]">({v.driverName})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Selected Vehicle Mini-Specs / Fleet Overview */}
        <div className="lg:col-span-8 flex flex-wrap items-center justify-start lg:justify-end gap-3 text-xs">
          <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Chauffeur:</span>
            <span className="font-semibold text-slate-200">
              {selectedVehicle === 'ALL'
                ? 'Flotte entière'
                : vehicleOptions.find((v) => v.plate === selectedVehicle)?.driverName || 'Assigné'}
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">Odomètre GPS:</span>
            <span className="font-mono font-bold text-indigo-300">
              {selectedVehicle === 'ALL'
                ? `${Math.round(filteredRecords.reduce((s, r) => s + (r.odometer || 0), 0) / (filteredRecords.length || 1)).toLocaleString()} km (moy)`
                : `${(filteredRecords[0]?.odometer || 142000).toLocaleString()} km`}
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2">
            <Droplet className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Réservoir:</span>
            <span className="font-mono font-bold text-cyan-300">{tankCapacity} L</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsModalOpen(true)}
            className="h-8 px-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs gap-1.5 transition-all"
          >
            <Sliders className="w-3.5 h-3.5" />
            Paramètre spéciale
          </Button>
        </div>
      </div>

      {/* CORE SECTION: Mesure du Carburant & Paramètres Dynamiques (2026 Interactive Sliders & Inputs) */}
      <Card className="rounded-2xl border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-slate-950/90 shadow-2xl backdrop-blur-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-slate-800/80">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                <Gauge className="w-5 h-5 text-indigo-400" />
                Mesure du Carburant : Paramètres & Formules en Direct
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Liaison bidirectionnelle instantanée : modifier la consommation L/km recalcule immédiatement les km/L et le coût au kilomètre.
              </CardDescription>
            </div>

            {/* Quick Live Cost Simulator Badge */}
            <div className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulateur 100 km:</span>
              <span className="font-bold text-white">{(consumptionLPerKm * 100).toFixed(1)} L</span>
              <span>=</span>
              <span className="font-bold text-emerald-400">
                {(consumptionLPerKm * 100 * costPerLiter).toFixed(2)} DH
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Input 1: L/kilomètre (and L/100km) */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3 relative group hover:border-indigo-500/50 transition-all">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-cyan-400" />
                  l/kilomètre
                </Label>
                <Badge variant="outline" className="text-[11px] font-mono border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
                  {(consumptionLPerKm * 100).toFixed(1)} L / 100 km
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.005"
                  min="0.01"
                  max="1.5"
                  value={consumptionLPerKm}
                  onChange={(e) => handleLPerKmChange(parseFloat(e.target.value))}
                  className="h-11 bg-slate-900 border-slate-700 font-mono text-lg font-black text-cyan-300 rounded-xl focus:ring-cyan-500"
                />
                <span className="text-xs font-semibold text-slate-400 shrink-0">L / km</span>
              </div>

              {/* Slider for L/100km */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>10 L/100</span>
                  <span>Consommation nominale</span>
                  <span>50 L/100</span>
                </div>
                <Slider
                  value={[Number((consumptionLPerKm * 100).toFixed(1))]}
                  min={10}
                  max={50}
                  step={0.5}
                  onValueChange={(vals) => handleLPer100KmChange(vals[0])}
                  className="py-1 cursor-pointer"
                />
              </div>
            </div>

            {/* Input 2: Kilomètres par 1 litre (0.00) */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3 relative group hover:border-indigo-500/50 transition-all">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-emerald-400" />
                  Kilomètres par 1 litre
                </Label>
                <Badge variant="outline" className="text-[11px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                  Rendement km/L
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="25"
                  value={kmPerLiter}
                  onChange={(e) => handleKmPerLiterChange(parseFloat(e.target.value))}
                  className="h-11 bg-slate-900 border-slate-700 font-mono text-lg font-black text-emerald-300 rounded-xl focus:ring-emerald-500"
                  placeholder="0.00"
                />
                <span className="text-xs font-semibold text-slate-400 shrink-0">km / 1 L</span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2">
                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Formule : 1 ÷ (l/kilomètre) = </span>
                <span className="font-mono font-bold text-emerald-400">{kmPerLiter.toFixed(2)} km</span>
              </div>
            </div>

            {/* Input 3: Coût pour litre */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3 relative group hover:border-indigo-500/50 transition-all">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  Coût pour litre
                </Label>
                <Badge variant="outline" className="text-[11px] font-mono border-amber-500/30 text-amber-400 bg-amber-500/10">
                  Gasoil / Diesel
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.10"
                  min="1"
                  max="30"
                  value={costPerLiter}
                  onChange={(e) => setCostPerLiter(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-11 bg-slate-900 border-slate-700 font-mono text-lg font-black text-amber-300 rounded-xl focus:ring-amber-500"
                  placeholder="13.50"
                />
                <span className="text-xs font-semibold text-slate-400 shrink-0">DH / Litre</span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Coût direct au km = </span>
                <span className="font-mono font-bold text-amber-400">
                  {(consumptionLPerKm * costPerLiter).toFixed(2)} DH / km
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
              <span>
                Paramètre active pour :{' '}
                <strong className="text-white">
                  {selectedVehicle === 'ALL' ? 'Toute la Flotte' : selectedVehicle}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const def = getDefaultFuelSetting(selectedVehicle);
                  setConsumptionLPerKm(def.consumptionLPerKm);
                  setKmPerLiter(def.kmPerLiter);
                  setCostPerLiter(def.costPerLiter);
                }}
                className="h-9 text-xs bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl"
              >
                Réinitialiser
              </Button>

              <Button
                size="sm"
                onClick={handleSaveParameters}
                className="h-9 text-xs bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Enregistrer ces paramètres
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 Modern 2026 Hero KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Distance Totale GPS */}
        <Card className="rounded-2xl border-slate-800/80 bg-slate-900/80 p-5 shadow-xl relative overflow-hidden group hover:border-indigo-500/50 transition-all">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Distance Parcourue</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-white tracking-tight">
            {stats.totalDistanceKm.toLocaleString()}{' '}
            <span className="text-sm font-semibold text-slate-400">km</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> SFTM Certifié
            </span>
            <span className="font-mono text-slate-500">{periodDays}j télémétrie</span>
          </div>
        </Card>

        {/* Card 2: Carburant Consommé */}
        <Card className="rounded-2xl border-slate-800/80 bg-slate-900/80 p-5 shadow-xl relative overflow-hidden group hover:border-cyan-500/50 transition-all">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Volume Carburant</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-cyan-300 tracking-tight">
            {stats.totalFuelLiters.toLocaleString()}{' '}
            <span className="text-sm font-semibold text-slate-400">Litres</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
            <span className="font-mono text-slate-300">
              {(stats.totalFuelLiters / (periodDays || 1)).toFixed(1)} L / jour
            </span>
            <span className="font-mono text-cyan-400 font-semibold">{stats.l100} L/100km</span>
          </div>
        </Card>

        {/* Card 3: Coût Total DH */}
        <Card className="rounded-2xl border-slate-800/80 bg-slate-900/80 p-5 shadow-xl relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Coût Carburant Total</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-amber-300 tracking-tight">
            {stats.totalCostDh.toLocaleString()}{' '}
            <span className="text-sm font-semibold text-slate-400">DH</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
            <span className="font-mono text-amber-400 font-semibold">
              {(stats.totalCostDh / (periodDays || 1)).toFixed(0)} DH / jour
            </span>
            <span className="font-mono text-slate-400">{stats.costPerKmDh} DH / km</span>
          </div>
        </Card>

        {/* Card 4: Rendement & Score Éco-conduite */}
        <Card className="rounded-2xl border-slate-800/80 bg-slate-900/80 p-5 shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rendement Éco-Conduite</span>
            <Badge className={`border text-xs font-bold px-2 py-0.5 rounded-lg ${stats.ecoColor}`}>
              Score {stats.ecoScore}
            </Badge>
          </div>
          <div className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
            {kmPerLiter.toFixed(2)}{' '}
            <span className="text-sm font-semibold text-slate-400">km / 1 L</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
            <span className="text-slate-300 truncate">{stats.ecoLabel}</span>
            <span className="font-mono text-emerald-400 font-semibold">{stats.costPerKmDh} DH/km</span>
          </div>
        </Card>
      </div>

      {/* 2026 Interactive Recharts Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Graph 1: Daily Distance vs Fuel Consumed */}
        <Card className="lg:col-span-8 rounded-2xl border-slate-800/80 bg-slate-900/85 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Évolution Journalière : Distance GPS (Km) & Carburant (Litres)
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-0.5">
                Données cumulées jour par jour issues des balises SFTM
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-cyan-400 font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Distance (km)
              </span>
              <span className="flex items-center gap-1.5 text-indigo-400 font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Carburant (L)
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={`${safeId}-gradDistance`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id={`${safeId}-gradFuel`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="dayLabel" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                  }}
                  formatter={(value: any, name: any) => [
                    `${value} ${name === 'distance' ? 'km' : 'Litres'}`,
                    name === 'distance' ? 'Distance GPS' : 'Carburant Consommé',
                  ]}
                  labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="distance"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={`url(#${safeId}-gradDistance)`}
                />
                <Area
                  type="monotone"
                  dataKey="liters"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={`url(#${safeId}-gradFuel)`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Graph 2: Top Fleet Consumption Comparison */}
        <Card className="lg:col-span-4 rounded-2xl border-slate-800/80 bg-slate-900/85 p-5 shadow-2xl backdrop-blur-md">
          <div className="pb-4 border-b border-slate-800">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-cyan-400" />
              Consommation par Camion (DH)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-0.5">
              Comparatif des dépenses de carburant
            </CardDescription>
          </div>

          <div className="h-[280px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={fleetComparisonChartData}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 10 }} width={70} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`${val} DH`, 'Budget Carburant']}
                />
                <Bar dataKey="cost" fill="#6366f1" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Comprehensive Daily Audit & Telematics Table */}
      <Card className="rounded-2xl border-slate-800/80 bg-slate-900/90 shadow-2xl backdrop-blur-md overflow-hidden">
        <CardHeader className="pb-4 border-b border-slate-800/80">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-indigo-400" />
                Journal Télématique Quotidien : Distance GPS & Coûts par Jour
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-0.5">
                Historique auditable de chaque circuit de distribution par camion et chauffeur
              </CardDescription>
            </div>

            {/* Table Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Rechercher date, camion, chauffeur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 bg-slate-950/80 border-slate-700/80 text-xs text-white rounded-xl focus:ring-indigo-500 placeholder:text-slate-500"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-800 bg-slate-950/70 hover:bg-slate-950/70">
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5">Date</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5">Véhicule & Chauffeur</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5 text-right">Distance GPS</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5 text-right">Odomètre</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5 text-right">Carburant (L)</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5 text-right">Coût Total (DH)</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5 text-center">Rendement</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5 text-center">Statut Conduite</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                      Aucune donnée de télémétrie disponible pour cette période
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((r) => {
                    const dist = Number(r.distanceKm) || 0;
                    const fuelLiters = dist * consumptionLPerKm;
                    const costDh = fuelLiters * costPerLiter;
                    const costKm = consumptionLPerKm * costPerLiter;
                    const isStationary = dist === 0;

                    return (
                      <TableRow
                        key={r.id}
                        className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors text-xs"
                      >
                        {/* Date */}
                        <TableCell className="font-medium text-slate-200">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{r.dayLabel}</span>
                          </div>
                        </TableCell>

                        {/* Vehicle & Driver */}
                        <TableCell>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span>{r.plate}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <User className="w-3 h-3 text-slate-500" />
                              <span>{r.driverName}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Distance GPS */}
                        <TableCell className="text-right font-mono font-bold text-cyan-300">
                          {dist > 0 ? `${dist.toFixed(1)} km` : <span className="text-slate-500">Repos (0 km)</span>}
                        </TableCell>

                        {/* Odometer */}
                        <TableCell className="text-right font-mono text-slate-300">
                          {r.odometer ? `${r.odometer.toLocaleString()} km` : '—'}
                        </TableCell>

                        {/* Fuel Liters */}
                        <TableCell className="text-right font-mono font-bold text-indigo-300">
                          {dist > 0 ? `${fuelLiters.toFixed(1)} L` : '0 L'}
                        </TableCell>

                        {/* Total Cost DH */}
                        <TableCell className="text-right font-mono font-black text-amber-300">
                          {dist > 0 ? `${costDh.toFixed(2)} DH` : '0.00 DH'}
                        </TableCell>

                        {/* Efficiency */}
                        <TableCell className="text-center font-mono text-slate-300">
                          <span className="font-semibold text-emerald-400">{kmPerLiter.toFixed(2)} km/L</span>
                          <span className="block text-[10px] text-slate-500">{costKm.toFixed(2)} DH/km</span>
                        </TableCell>

                        {/* Status Badge */}
                        <TableCell className="text-center">
                          {isStationary ? (
                            <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400 bg-slate-800/40">
                              Arrêté
                            </Badge>
                          ) : dist > 120 ? (
                            <Badge className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                              Grand Circuit
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Circuit Normal
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Paramètres Spéciales par Véhicule */}
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-800 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Paramètres Spéciales Véhicule
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Personnalisation fine des caractéristiques moteur et carburant pour{' '}
              <strong className="text-indigo-300">{selectedVehicle === 'ALL' ? 'Toute la flotte' : selectedVehicle}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Capacité Réservoir (Litres)</Label>
              <Input
                type="number"
                value={tankCapacity}
                onChange={(e) => setTankCapacity(Number(e.target.value) || 120)}
                className="bg-slate-950 border-slate-700 text-white font-mono"
              />
              <p className="text-[11px] text-slate-500">Exemple : 120L pour Canter, 200L pour Fighter.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Seuil Alerte Surconsommation (%)</Label>
              <Input
                type="number"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(Number(e.target.value) || 15)}
                className="bg-slate-950 border-slate-700 text-white font-mono"
              />
              <p className="text-[11px] text-slate-500">Alerte si la consommation dépasse de +{alertThreshold}% la normale.</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-slate-200">Rappel des paramètres actifs :</div>
              <div className="text-slate-400">Consommation : <span className="text-cyan-300 font-mono">{consumptionLPerKm} L/km</span> ({(consumptionLPerKm * 100).toFixed(1)} L/100km)</div>
              <div className="text-slate-400">Rendement : <span className="text-emerald-300 font-mono">{kmPerLiter} km/L</span></div>
              <div className="text-slate-400">Prix unitaire : <span className="text-amber-300 font-mono">{costPerLiter} DH/L</span></div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSettingsModalOpen(false)}
              className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 rounded-xl"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveParameters}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
            >
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
