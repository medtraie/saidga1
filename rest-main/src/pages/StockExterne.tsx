import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Store,
  Truck,
  User,
  Search,
  RefreshCw,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Boxes,
  Sparkles,
  SlidersHorizontal,
  History,
  Layers,
  Phone,
  MapPin,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import {
  stockExterneService,
  ClientExternalStock,
  ExternalStockInspection,
} from '@/lib/stockExterneService';
import { AnimatedGasCage } from '@/components/stock-externe/AnimatedGasCage';
import { toast } from '@/components/ui/use-toast';

export default function StockExterne() {
  const { drivers = [], trucks = [] } = useApp() as any;

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [stocks, setStocks] = useState<ClientExternalStock[]>([]);

  // Filter States
  const [selectedDriver, setSelectedDriver] = useState<string>('ALL');
  const [selectedTruck, setSelectedTruck] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Inspection Modal State
  const [inspectionModalOpen, setInspectionModalOpen] = useState<boolean>(false);
  const [activeStockForInspection, setActiveStockForInspection] = useState<ClientExternalStock | null>(null);
  const [inspectionData, setInspectionData] = useState({
    pleines: 0,
    vides: 0,
    etrangeres: 0,
    defectueuses: 0,
    driverId: '',
    driverName: '',
    truckPlate: '',
    notes: '',
  });

  // Allocation Modal State
  const [allocationModalOpen, setAllocationModalOpen] = useState<boolean>(false);
  const [activeStockForAllocation, setActiveStockForAllocation] = useState<ClientExternalStock | null>(null);
  const [allocationData, setAllocationData] = useState({
    cageNumber: '',
    cageCapacity: 20,
    totalBottles: 20,
    brandName: 'Afriquia Gaz',
    bottleType: '12 Kg',
    depositAmountDh: 5800,
  });

  // History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const [selectedStockForHistory, setSelectedStockForHistory] = useState<ClientExternalStock | null>(null);

  // Load Data
  const loadStocks = async (isManual: boolean = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await stockExterneService.getAllStocks();
      setStocks(data);
      if (isManual) {
        toast({
          title: 'Stock Externe Actualisé',
          description: `${data.length} casiers de points de vente synchronisés avec succès.`,
        });
      }
    } catch (err: any) {
      toast({
        title: 'Erreur de chargement',
        description: err?.message || 'Impossible de charger le stock externe',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStocks(false);
  }, []);

  // Filtered List
  const filteredStocks = useMemo(() => {
    return stocks.filter((s) => {
      // Driver filter
      if (selectedDriver !== 'ALL') {
        const dId = String(s.assignedDriverId || '').toLowerCase();
        const dName = String(s.assignedDriverName || '').toLowerCase();
        const target = selectedDriver.toLowerCase();
        if (dId !== target && !dName.includes(target)) return false;
      }

      // Truck filter
      if (selectedTruck !== 'ALL') {
        const tPlate = String(s.truckPlate || '').toLowerCase();
        if (!tPlate.includes(selectedTruck.toLowerCase())) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (s.posName || '').toLowerCase().includes(q);
        const matchClient = (s.clientName || '').toLowerCase().includes(q);
        const matchCage = (s.cageNumber || '').toLowerCase().includes(q);
        const matchAddress = (s.address || '').toLowerCase().includes(q);
        const matchPhone = (s.phone || '').toLowerCase().includes(q);
        if (!matchName && !matchClient && !matchCage && !matchAddress && !matchPhone) {
          return false;
        }
      }

      return true;
    });
  }, [stocks, selectedDriver, selectedTruck, searchQuery]);

  // Aggregate KPI Statistics
  const stats = useMemo(() => {
    const totalCages = filteredStocks.length;
    const totalAllocated = filteredStocks.reduce(
      (sum, s) => sum + (s.initialAllocation?.totalBottles || 20),
      0
    );
    const totalPleines = filteredStocks.reduce((sum, s) => sum + (s.currentStock?.pleines || 0), 0);
    const totalVides = filteredStocks.reduce((sum, s) => sum + (s.currentStock?.vides || 0), 0);
    const totalEtrangeres = filteredStocks.reduce((sum, s) => sum + (s.currentStock?.etrangeres || 0), 0);
    const totalDefectueuses = filteredStocks.reduce((sum, s) => sum + (s.currentStock?.defectueuses || 0), 0);

    const totalActual = totalPleines + totalVides + totalEtrangeres;
    const globalEcart = totalActual - totalAllocated;
    const cagesWithEcart = filteredStocks.filter((s) => {
      const cur = s.currentStock.pleines + s.currentStock.vides + s.currentStock.etrangeres;
      return cur !== s.initialAllocation.totalBottles;
    }).length;

    return {
      totalCages,
      totalAllocated,
      totalPleines,
      totalVides,
      totalEtrangeres,
      totalDefectueuses,
      totalActual,
      globalEcart,
      cagesWithEcart,
    };
  }, [filteredStocks]);

  // Open Inspection Dialog
  const handleOpenInspection = (stock: ClientExternalStock) => {
    setActiveStockForInspection(stock);
    setInspectionData({
      pleines: stock.currentStock.pleines,
      vides: stock.currentStock.vides,
      etrangeres: stock.currentStock.etrangeres,
      defectueuses: stock.currentStock.defectueuses || 0,
      driverId: stock.assignedDriverId || '',
      driverName: stock.assignedDriverName || 'OMAR AMRHAR',
      truckPlate: stock.truckPlate || 'Canter 32607 A 57',
      notes: '',
    });
    setInspectionModalOpen(true);
  };

  // Submit Monthly Inspection
  const handleSaveInspection = async () => {
    if (!activeStockForInspection) return;

    try {
      const updated = await stockExterneService.recordInspection(activeStockForInspection.id, {
        pleines: Number(inspectionData.pleines) || 0,
        vides: Number(inspectionData.vides) || 0,
        etrangeres: Number(inspectionData.etrangeres) || 0,
        defectueuses: Number(inspectionData.defectueuses) || 0,
        driverId: inspectionData.driverId,
        driverName: inspectionData.driverName,
        truckPlate: inspectionData.truckPlate,
        notes: inspectionData.notes,
      });

      setStocks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast({
        title: 'Inventaire Mensuel Enregistré',
        description: `Casier ${activeStockForInspection.cageNumber} mis à jour : ${inspectionData.pleines} pleines, ${inspectionData.vides} vides, ${inspectionData.etrangeres} étrangères.`,
      });
      setInspectionModalOpen(false);
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err?.message || "Impossible d'enregistrer l'inventaire",
        variant: 'destructive',
      });
    }
  };

  // Open Allocation Dialog
  const handleOpenAllocation = (stock: ClientExternalStock) => {
    setActiveStockForAllocation(stock);
    setAllocationData({
      cageNumber: stock.cageNumber,
      cageCapacity: stock.cageCapacity || 20,
      totalBottles: stock.initialAllocation.totalBottles || 20,
      brandName: stock.initialAllocation.brandName || 'Afriquia Gaz',
      bottleType: stock.initialAllocation.bottleType || '12 Kg',
      depositAmountDh: stock.initialAllocation.depositAmountDh || 5800,
    });
    setAllocationModalOpen(true);
  };

  // Save Allocation Dialog
  const handleSaveAllocation = async () => {
    if (!activeStockForAllocation) return;

    try {
      const updated = await stockExterneService.updateAllocation(activeStockForAllocation.id, {
        cageNumber: allocationData.cageNumber,
        cageCapacity: Number(allocationData.cageCapacity) || 20,
        totalBottles: Number(allocationData.totalBottles) || 20,
        brandName: allocationData.brandName,
        bottleType: allocationData.bottleType,
        depositAmountDh: Number(allocationData.depositAmountDh) || 0,
      });

      setStocks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast({
        title: 'Dotation Mise à Jour',
        description: `Casier ${allocationData.cageNumber} paramétré avec ${allocationData.totalBottles} bouteilles (${allocationData.brandName}).`,
      });
      setAllocationModalOpen(false);
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err?.message || 'Impossible de mettre à jour la dotation',
        variant: 'destructive',
      });
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Point de Vente',
      'Client',
      'N° Casier (Siège)',
      'Chauffeur Assigné',
      'Dotation Initiale',
      'Marque & Calibre',
      'Pleines',
      'Vides',
      'Étrangères',
      'Défectueuses',
      'Total Relevé',
      'Écart Dotation',
      'Dernière Inspection',
    ];

    const rows = filteredStocks.map((s) => {
      const cur = s.currentStock;
      const total = cur.pleines + cur.vides + cur.etrangeres;
      const ecart = total - s.initialAllocation.totalBottles;
      return [
        `"${s.posName}"`,
        `"${s.clientName}"`,
        `"${s.cageNumber}"`,
        `"${s.assignedDriverName || '—'}"`,
        `"${s.initialAllocation.totalBottles}"`,
        `"${s.initialAllocation.brandName} ${s.initialAllocation.bottleType}"`,
        `"${cur.pleines}"`,
        `"${cur.vides}"`,
        `"${cur.etrangeres}"`,
        `"${cur.defectueuses || 0}"`,
        `"${total}"`,
        `"${ecart}"`,
        `"${cur.derniereInspectionDate ? cur.derniereInspectionDate.split('T')[0] : '—'}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock_externe_sieges_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exportation terminée', description: 'Fichier CSV exporté avec succès.' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-8 font-sans selection:bg-indigo-500 selection:text-white">
      {/* 2026 Ambient Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/3 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[130px]" />
        <div className="absolute top-60 right-10 w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-10 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-[160px]" />
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/25 ring-1 ring-white/20">
              <Boxes className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  Stock Externe & Casiers Clients
                </h1>
                <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-sm">
                  <Sparkles className="w-3 h-3" />
                  Sièges & Dotations POS
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                Supervision des casiers grillagés roulants, dotations initiales et recensement mensuel des bouteilles par chauffeur.
              </p>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch lg:self-auto">
          {/* View Switcher */}
          <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-0.5 shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Vue Casiers 3D
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Vue Tableau
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadStocks(true)}
            disabled={refreshing}
            className="h-9 px-3 bg-slate-900/90 border-slate-800 hover:bg-slate-800 text-slate-200 rounded-xl text-xs gap-1.5 transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </Button>

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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Casiers & Dotation */}
        <Card className="rounded-2xl border-slate-800/80 bg-slate-900/80 p-5 shadow-xl relative overflow-hidden group hover:border-blue-500/50 transition-all">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Casiers Grillagés</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-white tracking-tight">
            {stats.totalCages}{' '}
            <span className="text-sm font-semibold text-slate-400">Sièges POS</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
            <span>Dotation totale :</span>
            <span className="font-mono text-cyan-300 font-bold">{stats.totalAllocated} Btl</span>
          </div>
        </Card>

        {/* Card 2: Bouteilles Pleines */}
        <Card className="rounded-2xl border-slate-800/80 bg-slate-900/80 p-5 shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stock Pleines</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
            {stats.totalPleines}{' '}
            <span className="text-sm font-semibold text-slate-400">Bouteilles</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
            <span>Taux de disponibilité :</span>
            <span className="font-mono text-emerald-300 font-bold">
              {stats.totalAllocated > 0 ? ((stats.totalPleines / stats.totalAllocated) * 100).toFixed(0) : 0}%
            </span>
          </div>
        </Card>

        {/* Card 3: Bouteilles Vides & Étrangères */}
        <Card className="rounded-2xl border-slate-800/80 bg-slate-900/80 p-5 shadow-xl relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vides & Étrangères</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-amber-300 tracking-tight">
            {stats.totalVides + stats.totalEtrangeres}{' '}
            <span className="text-sm font-semibold text-slate-400">À Récupérer</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60 font-mono">
            <span>{stats.totalVides} Vides</span>
            <span className="text-amber-400 font-bold">★ {stats.totalEtrangeres} Étrangères</span>
          </div>
        </Card>

        {/* Card 4: Conformité & Alertes Écarts */}
        <Card className="rounded-2xl border-slate-800/80 bg-slate-900/80 p-5 shadow-xl relative overflow-hidden group hover:border-rose-500/50 transition-all">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conformité Dotation</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-white">
            {stats.cagesWithEcart === 0 ? (
              <span className="text-emerald-400">100% Conforme</span>
            ) : (
              <span className="text-rose-400">{stats.cagesWithEcart} Casiers Alerte</span>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60 font-mono">
            <span>Écart total :</span>
            <span
              className={`font-bold ${
                stats.globalEcart < 0
                  ? 'text-rose-400'
                  : stats.globalEcart > 0
                  ? 'text-cyan-400'
                  : 'text-emerald-400'
              }`}
            >
              {stats.globalEcart > 0 ? `+${stats.globalEcart}` : stats.globalEcart} Btl
            </span>
          </div>
        </Card>
      </div>

      {/* Filter Bar: Chauffeur & Camion & Search */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/90 border border-slate-800/80 p-4 rounded-2xl shadow-xl backdrop-blur-md">
        {/* Chauffeur Filter */}
        <div className="md:col-span-4">
          <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <User className="w-3.5 h-3.5 text-blue-400" />
            Filtrer par Chauffeur
          </Label>
          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
            <SelectTrigger className="h-10 bg-slate-950/80 border-slate-700/80 text-xs font-bold text-white rounded-xl focus:ring-blue-500">
              <SelectValue placeholder="Tous les chauffeurs..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
              <SelectItem value="ALL" className="font-bold text-blue-400">
                🌟 TOUS LES CHAUFFEURS ({stocks.length} Casiers)
              </SelectItem>
              {drivers.map((d: any) => (
                <SelectItem key={d.id} value={d.name || d.id} className="text-xs font-semibold">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Camion Filter */}
        <div className="md:col-span-3">
          <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <Truck className="w-3.5 h-3.5 text-cyan-400" />
            Camion de Tournée
          </Label>
          <Select value={selectedTruck} onValueChange={setSelectedTruck}>
            <SelectTrigger className="h-10 bg-slate-950/80 border-slate-700/80 text-xs font-bold text-white rounded-xl focus:ring-cyan-500">
              <SelectValue placeholder="Tous les camions..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
              <SelectItem value="ALL" className="font-bold text-cyan-400">
                🚚 Tous les Camions
              </SelectItem>
              {trucks.map((t: any) => {
                const plate = t.matricule || t.plate || t.name;
                return (
                  <SelectItem key={t.id || plate} value={plate} className="text-xs font-semibold">
                    {plate}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Search Bar */}
        <div className="md:col-span-5">
          <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            Rechercher un Point de Vente / Siège
          </Label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <Input
              placeholder="Nom magasin, client, N° casier, adresse..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-9 bg-slate-950/80 border-slate-700/80 text-xs text-white rounded-xl focus:ring-blue-500 placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'grid' ? (
        /* GRID VIEW: ANIMATED 3D STORAGE CAGED CASIERS */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredStocks.map((stock) => {
            const cur = stock.currentStock;
            const init = stock.initialAllocation;
            const totalCur = cur.pleines + cur.vides + cur.etrangeres;
            const ecart = totalCur - init.totalBottles;
            const isConforme = ecart === 0;

            return (
              <Card
                key={stock.id}
                className="rounded-3xl border-slate-800/80 bg-slate-900/90 shadow-2xl backdrop-blur-md overflow-hidden hover:border-blue-500/40 transition-all flex flex-col justify-between"
              >
                {/* POS Header Banner */}
                <CardHeader className="pb-3 border-b border-slate-800/80 bg-slate-950/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                        <Store className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate">{stock.posName}</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <span>{stock.clientName}</span>
                        {stock.phone && (
                          <>
                            <span className="inline-block w-1 h-1 rounded-full bg-slate-600" />
                            <span className="font-mono text-slate-500">{stock.phone}</span>
                          </>
                        )}
                      </CardDescription>
                    </div>

                    {/* Status Badge */}
                    <Badge
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                        isConforme
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : ecart < 0
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {isConforme ? '✓ Conforme' : ecart < 0 ? `Écart ${ecart} Btl` : `Surplus +${ecart}`}
                    </Badge>
                  </div>

                  {/* Driver and Truck Assigned */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{stock.assignedDriverName || 'Chauffeur non assigné'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60 flex items-center gap-1 font-mono">
                      <Truck className="w-3 h-3 text-cyan-400" />
                      <span>{stock.truckPlate || 'Canter 32607 A 57'}</span>
                    </span>
                  </div>
                </CardHeader>

                {/* ANIMATED CAGE DISPLAY */}
                <CardContent className="pt-6 pb-4 flex flex-col items-center">
                  <div className="w-full mb-3 flex items-center justify-between text-xs px-2">
                    <span className="text-slate-400">Dotation Contractuelle :</span>
                    <span className="font-bold text-cyan-300 font-mono">
                      {init.totalBottles} Btl ({init.brandName} {init.bottleType})
                    </span>
                  </div>

                  {/* The 3D Mesh Trolley Component */}
                  <AnimatedGasCage
                    cageNumber={stock.cageNumber}
                    totalCapacity={init.totalBottles}
                    pleines={cur.pleines}
                    vides={cur.vides}
                    etrangeres={cur.etrangeres}
                    defectueuses={cur.defectueuses}
                    brandName={init.brandName}
                    bottleType={init.bottleType}
                    posName={stock.posName}
                    onOpenAudit={() => handleOpenInspection(stock)}
                  />

                  {/* Last Inspection Time */}
                  <div className="w-full mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      Dernier inventaire :
                    </span>
                    <span className="font-mono text-slate-300">
                      {cur.derniereInspectionDate ? cur.derniereInspectionDate.split('T')[0] : 'Jamais'}
                    </span>
                  </div>
                </CardContent>

                {/* Footer Buttons */}
                <div className="p-3 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedStockForHistory(stock);
                      setHistoryModalOpen(true);
                    }}
                    className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl gap-1"
                  >
                    <History className="w-3.5 h-3.5" />
                    Historique
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAllocation(stock)}
                      className="h-8 text-xs bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl"
                    >
                      Dotation
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleOpenInspection(stock)}
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md gap-1"
                    >
                      Recenser
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card className="rounded-2xl border-slate-800/80 bg-slate-900/90 shadow-2xl backdrop-blur-md overflow-hidden">
          <CardHeader className="pb-4 border-b border-slate-800">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              Répertoire Détaillé du Stock Externe
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-800 bg-slate-950/70">
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5">Point de Vente</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5">Chauffeur & Camion</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5">N° Siège</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5 text-center">Dotation</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5 text-center">Pleines</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5 text-center">Vides</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5 text-center">Étrangères</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5 text-center">Écart</TableHead>
                  <TableHead className="font-bold text-slate-300 text-xs py-3.5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredStocks.map((stock) => {
                  const cur = stock.currentStock;
                  const init = stock.initialAllocation;
                  const totalCur = cur.pleines + cur.vides + cur.etrangeres;
                  const ecart = totalCur - init.totalBottles;

                  return (
                    <TableRow key={stock.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 text-xs">
                      <TableCell>
                        <div className="font-bold text-white">{stock.posName}</div>
                        <div className="text-[11px] text-slate-400">{stock.clientName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-200">{stock.assignedDriverName || '—'}</div>
                        <div className="text-[11px] text-cyan-400 font-mono">{stock.truckPlate}</div>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-blue-400">
                        {stock.cageNumber}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-slate-200">
                        {init.totalBottles} Btl
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-blue-400">
                        {cur.pleines}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-slate-400">
                        {cur.vides}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-amber-400">
                        {cur.etrangeres}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold">
                        {ecart === 0 ? (
                          <span className="text-emerald-400">0</span>
                        ) : ecart < 0 ? (
                          <span className="text-rose-400">{ecart}</span>
                        ) : (
                          <span className="text-cyan-400">+{ecart}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAllocation(stock)}
                            className="h-7 px-2 text-xs bg-slate-900 border-slate-700"
                          >
                            Dotation
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleOpenInspection(stock)}
                            className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-500 font-bold"
                          >
                            Recenser
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* MODAL 1: MONTHLY INSPECTION FORM (RECENSEMENT MENSUEL) */}
      <Dialog open={inspectionModalOpen} onOpenChange={setInspectionModalOpen}>
        <DialogContent className="sm:max-w-[520px] bg-slate-900 border-slate-800 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Boxes className="w-5 h-5 text-blue-400" />
              Recensement Mensuel du Stock Externe
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Point de Vente : <strong className="text-white">{activeStockForInspection?.posName}</strong> | Casier :{' '}
              <strong className="text-blue-300">{activeStockForInspection?.cageNumber}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Chauffeur and Truck Info */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div>
                <Label className="text-[11px] text-slate-400">Chauffeur Inspecteur</Label>
                <Select
                  value={inspectionData.driverName}
                  onValueChange={(val) => setInspectionData((prev) => ({ ...prev, driverName: val }))}
                >
                  <SelectTrigger className="h-9 mt-1 bg-slate-900 border-slate-700 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    {drivers.map((d: any) => (
                      <SelectItem key={d.id} value={d.name || d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Camion de Tournée</Label>
                <Input
                  value={inspectionData.truckPlate}
                  onChange={(e) => setInspectionData((prev) => ({ ...prev, truckPlate: e.target.value }))}
                  className="h-9 mt-1 bg-slate-900 border-slate-700 text-white font-mono text-xs"
                />
              </div>
            </div>

            {/* Counts Input Row */}
            <div className="grid grid-cols-3 gap-3">
              {/* Pleines */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-1.5">
                <Label className="text-[11px] font-bold text-blue-300">Bouteilles Pleines</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={inspectionData.pleines}
                  onChange={(e) => setInspectionData((prev) => ({ ...prev, pleines: parseInt(e.target.value) || 0 }))}
                  className="h-10 bg-slate-950 border-blue-500/40 text-center font-mono text-lg font-black text-blue-300"
                />
                <p className="text-[10px] text-slate-400 text-center">Bouteilles scellées</p>
              </div>

              {/* Vides */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-300">Bouteilles Vides</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={inspectionData.vides}
                  onChange={(e) => setInspectionData((prev) => ({ ...prev, vides: parseInt(e.target.value) || 0 }))}
                  className="h-10 bg-slate-950 border-slate-700 text-center font-mono text-lg font-black text-slate-200"
                />
                <p className="text-[10px] text-slate-400 text-center">Vides à reprendre</p>
              </div>

              {/* Étrangères */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                <Label className="text-[11px] font-bold text-amber-300">Étrangères</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={inspectionData.etrangeres}
                  onChange={(e) =>
                    setInspectionData((prev) => ({ ...prev, etrangeres: parseInt(e.target.value) || 0 }))
                  }
                  className="h-10 bg-slate-950 border-amber-500/40 text-center font-mono text-lg font-black text-amber-300"
                />
                <p className="text-[10px] text-slate-400 text-center">Autre marque</p>
              </div>
            </div>

            {/* Real-Time Discrepancy Calculator */}
            {(() => {
              const total = inspectionData.pleines + inspectionData.vides + inspectionData.etrangeres;
              const dotation = activeStockForInspection?.initialAllocation.totalBottles || 20;
              const diff = total - dotation;

              return (
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between font-mono text-xs ${
                    diff === 0
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : diff < 0
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                  }`}
                >
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      {diff === 0 ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Stock Conforme à la Dotation</span>
                        </>
                      ) : diff < 0 ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <span>ALERTE : {Math.abs(diff)} Bouteille(s) Manquante(s)</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                          <span>Surplus de +{diff} Bouteille(s)</span>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Total Recensé : {total} / Dotation Initiale : {dotation}
                    </div>
                  </div>
                  <div className="text-xl font-black">{total} Btl</div>
                </div>
              );
            })()}

            {/* Notes */}
            <div>
              <Label className="text-[11px] text-slate-400">Observations / Notes du chauffeur</Label>
              <Input
                placeholder="État du casier, cadenassage, motif d'écart..."
                value={inspectionData.notes}
                onChange={(e) => setInspectionData((prev) => ({ ...prev, notes: e.target.value }))}
                className="h-9 mt-1 bg-slate-950 border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setInspectionModalOpen(false)}
              className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 rounded-xl"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveInspection}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
            >
              Enregistrer l'Inventaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: ALLOCATION & CAGE SETTINGS */}
      <Dialog open={allocationModalOpen} onOpenChange={setAllocationModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-800 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-blue-400" />
              Paramétrer la Dotation Initiale & Siège
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Client : <strong className="text-white">{activeStockForAllocation?.posName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-slate-400">N° Siège (Casier)</Label>
                <Input
                  value={allocationData.cageNumber}
                  onChange={(e) => setAllocationData((prev) => ({ ...prev, cageNumber: e.target.value }))}
                  className="h-9 mt-1 bg-slate-950 border-slate-700 text-white font-mono"
                  placeholder="SIÈGE-001"
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Capacité du Casier</Label>
                <Input
                  type="number"
                  value={allocationData.cageCapacity}
                  onChange={(e) =>
                    setAllocationData((prev) => ({ ...prev, cageCapacity: parseInt(e.target.value) || 20 }))
                  }
                  className="h-9 mt-1 bg-slate-950 border-slate-700 text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-slate-400">Nombre de Bouteilles (Dotation)</Label>
                <Input
                  type="number"
                  value={allocationData.totalBottles}
                  onChange={(e) =>
                    setAllocationData((prev) => ({ ...prev, totalBottles: parseInt(e.target.value) || 20 }))
                  }
                  className="h-9 mt-1 bg-slate-950 border-slate-700 text-white font-mono"
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Marque Assignée</Label>
                <Select
                  value={allocationData.brandName}
                  onValueChange={(val) => setAllocationData((prev) => ({ ...prev, brandName: val }))}
                >
                  <SelectTrigger className="h-9 mt-1 bg-slate-950 border-slate-700 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="Afriquia Gaz">Afriquia Gaz</SelectItem>
                    <SelectItem value="Tissir Gaz">Tissir Gaz</SelectItem>
                    <SelectItem value="Camping Gaz">Camping Gaz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-slate-400">Calibre / Type</Label>
                <Select
                  value={allocationData.bottleType}
                  onValueChange={(val) => setAllocationData((prev) => ({ ...prev, bottleType: val }))}
                >
                  <SelectTrigger className="h-9 mt-1 bg-slate-950 border-slate-700 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="12 Kg">12 Kg (Grande bouteille)</SelectItem>
                    <SelectItem value="3 Kg">3 Kg (Petite bouteille)</SelectItem>
                    <SelectItem value="6 Kg">6 Kg (Moyenne)</SelectItem>
                    <SelectItem value="34 Kg">34 Kg (Industrielle)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Consignation Caution (DH)</Label>
                <Input
                  type="number"
                  value={allocationData.depositAmountDh}
                  onChange={(e) =>
                    setAllocationData((prev) => ({ ...prev, depositAmountDh: parseFloat(e.target.value) || 0 }))
                  }
                  className="h-9 mt-1 bg-slate-950 border-slate-700 text-white font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAllocationModalOpen(false)}
              className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 rounded-xl"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveAllocation}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
            >
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: AUDIT & INSPECTION HISTORY */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="sm:max-w-[620px] bg-slate-900 border-slate-800 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              Historique des Recensements Mensuels
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Point de Vente : <strong className="text-white">{selectedStockForHistory?.posName}</strong> | Casier :{' '}
              <strong className="text-blue-300">{selectedStockForHistory?.cageNumber}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 overflow-x-auto max-h-[350px]">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-800 text-xs">
                  <TableHead className="text-slate-300">Date</TableHead>
                  <TableHead className="text-slate-300">Chauffeur</TableHead>
                  <TableHead className="text-slate-300 text-center">Pleines</TableHead>
                  <TableHead className="text-slate-300 text-center">Vides</TableHead>
                  <TableHead className="text-slate-300 text-center">Étrang.</TableHead>
                  <TableHead className="text-slate-300 text-center">Écart</TableHead>
                  <TableHead className="text-slate-300">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedStockForHistory?.inspections || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 text-xs py-8">
                      Aucun historique d'inventaire disponible
                    </TableCell>
                  </TableRow>
                ) : (
                  (selectedStockForHistory?.inspections || []).map((insp) => (
                    <TableRow key={insp.id} className="border-b border-slate-800/60 text-xs">
                      <TableCell className="font-mono text-slate-300">{insp.date}</TableCell>
                      <TableCell className="font-semibold text-white">{insp.driverName}</TableCell>
                      <TableCell className="text-center font-mono text-blue-400 font-bold">{insp.pleines}</TableCell>
                      <TableCell className="text-center font-mono text-slate-400 font-bold">{insp.vides}</TableCell>
                      <TableCell className="text-center font-mono text-amber-400 font-bold">{insp.etrangeres}</TableCell>
                      <TableCell className="text-center font-mono font-bold">
                        {insp.ecart === 0 ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                            0 Conforme
                          </Badge>
                        ) : insp.ecart < 0 ? (
                          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px]">
                            {insp.ecart} Btl
                          </Badge>
                        ) : (
                          <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px]">
                            +{insp.ecart}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400 text-[11px] truncate max-w-[120px]">
                        {insp.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHistoryModalOpen(false)}
              className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 rounded-xl"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
