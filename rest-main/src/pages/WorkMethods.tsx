import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Briefcase, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Users, 
  MapPin, 
  Package, 
  CheckCircle2, 
  Printer, 
  RefreshCw,
  Sparkles,
  UserCheck,
  Check,
  X,
  Truck
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';

interface WorkMethod {
  id: string;
  driver_id: string;
  aide_livreur: string;
  sector_id: string;
  product_ids: string[];
  created_at?: string;
}

export default function WorkMethods() {
  const { drivers = [], bottleTypes = [] } = useApp();
  const { toast } = useToast();
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);

  const [sectors, setSectors] = useState<Array<{ id: string; code: string; secteurs: string; ville?: string }>>([]);
  const [methods, setMethods] = useState<WorkMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [aideLivreur, setAideLivreur] = useState('');
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');

  // Fetch Sectors and Work Methods from Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: sectorsData } = await supabase
        .from('sectors_settings')
        .select('id, code, secteurs, ville');
      if (sectorsData) {
        setSectors(sectorsData);
      }

      const { data: methodsData, error } = await supabase
        .from('work_methods')
        .select('*');

      if (error) {
        const localData = localStorage.getItem('work_methods_v1');
        if (localData) {
          try {
            setMethods(JSON.parse(localData));
          } catch {}
        }
      } else if (methodsData) {
        const parsed = methodsData.map((item: any) => ({
          ...item,
          product_ids: typeof item.product_ids === 'string'
            ? (() => { try { return JSON.parse(item.product_ids); } catch { return []; } })()
            : (Array.isArray(item.product_ids) ? item.product_ids : [])
        }));
        setMethods(parsed);
        try {
          localStorage.setItem('work_methods_v1', JSON.stringify(parsed));
        } catch {}
      }
    } catch (err: any) {
      console.error('Error fetching work methods:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-fill Aide-livreur when driver changes
  useEffect(() => {
    if (selectedDriverId && !editingId) {
      const driver = drivers.find(d => d.id === selectedDriverId);
      if (driver && driver.aideLivreurs) {
        setAideLivreur(driver.aideLivreurs);
      } else {
        setAideLivreur('');
      }
    }
  }, [selectedDriverId, drivers, editingId]);

  const existingAides = useMemo(() => {
    const list = drivers
      .map(d => d.aideLivreurs)
      .filter((v): v is string => Boolean(v && v.trim()));
    return Array.from(new Set(list));
  }, [drivers]);

  // Handle Save (Add or Update)
  const handleSave = async () => {
    if (!selectedDriverId || !aideLivreur.trim() || !selectedSectorId || selectedProducts.length === 0) {
      toast({
        title: tr('Champs incomplets', 'بيانات ناقصة'),
        description: tr(
          'Veuillez renseigner le chauffeur, l\'aide-livreur, le secteur et au moins un produit.',
          'يرجى تحديد السائق، المساعد، القطاع ومنتج واحد على الأقل.'
        ),
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const id = editingId || (window.crypto?.randomUUID?.() || `wm-${Date.now()}`);
    const methodObj: WorkMethod = {
      id,
      driver_id: selectedDriverId,
      aide_livreur: aideLivreur.trim(),
      sector_id: selectedSectorId,
      product_ids: selectedProducts,
    };

    const payload = {
      id: methodObj.id,
      driver_id: methodObj.driver_id,
      aide_livreur: methodObj.aide_livreur,
      sector_id: methodObj.sector_id,
      product_ids: methodObj.product_ids,
    };

    const { error } = await supabase.from('work_methods').upsert(payload);

    let nextMethods: WorkMethod[];
    if (editingId) {
      nextMethods = methods.map(m => (m.id === editingId ? methodObj : m));
    } else {
      nextMethods = [methodObj, ...methods.filter(m => m.id !== id)];
    }

    setMethods(nextMethods);
    try {
      localStorage.setItem('work_methods_v1', JSON.stringify(nextMethods));
    } catch {}

    toast({
      title: tr('Succès', 'تم بنجاح'),
      description: editingId
        ? tr('Méthode de travail mise à jour avec succès.', 'تم تحديث طريقة العمل بنجاح.')
        : tr('Nouvelle méthode de travail enregistrée avec succès.', 'تم تسجيل طريقة العمل بنجاح.'),
    });

    resetForm();
    setSaving(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setSelectedDriverId('');
    setAideLivreur('');
    setSelectedSectorId('');
    setSelectedProducts([]);
  };

  const startEdit = (method: WorkMethod) => {
    setEditingId(method.id);
    setSelectedDriverId(method.driver_id);
    setAideLivreur(method.aide_livreur || '');
    setSelectedSectorId(method.sector_id);
    setSelectedProducts(method.product_ids || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      tr('Voulez-vous vraiment supprimer cette méthode de travail ?', 'هل أنت متأكد من حذف طريقة العمل هذه؟')
    );
    if (!confirmed) return;

    await supabase.from('work_methods').delete().eq('id', id);
    const nextMethods = methods.filter(m => m.id !== id);
    setMethods(nextMethods);
    try {
      localStorage.setItem('work_methods_v1', JSON.stringify(nextMethods));
    } catch {}

    if (editingId === id) resetForm();

    toast({
      title: tr('Supprimé', 'تم الحذف'),
      description: tr('La méthode de travail a été supprimée.', 'تم حذف طريقة العمل.'),
    });
  };

  const toggleSelectAllProducts = () => {
    if (selectedProducts.length === bottleTypes.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(bottleTypes.map(b => b.id));
    }
  };

  const filteredMethods = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return methods;
    return methods.filter(m => {
      const driver = drivers.find(d => d.id === m.driver_id);
      const sector = sectors.find(s => s.id === m.sector_id);
      return (
        (driver?.name || '').toLowerCase().includes(q) ||
        (driver?.code || '').toLowerCase().includes(q) ||
        (m.aide_livreur || '').toLowerCase().includes(q) ||
        (sector?.secteurs || '').toLowerCase().includes(q) ||
        (sector?.code || '').toLowerCase().includes(q)
      );
    });
  }, [methods, searchFilter, drivers, sectors]);

  const assignedDriversCount = useMemo(() => new Set(methods.map(m => m.driver_id)).size, [methods]);
  const coveredSectorsCount = useMemo(() => new Set(methods.map(m => m.sector_id)).size, [methods]);

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Briefcase className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                {tr('Méthode de Travail', 'طريقة العمل وتوزيع الفرق')}
              </h1>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-2.5 py-0.5 font-bold">
                {methods.length} {tr('Équipes Actives', 'فرق نشطة')}
              </Badge>
            </div>
            <p className="text-sm text-slate-300 mt-1 font-medium">
              {tr(
                'Organisation opérationnelle des tournées : Chauffeur, Aide-livreur, Secteur de distribution et Produits autorisés.',
                'التنظيم الميداني اليومي: تخصيص السائق، المساعد، قطاع التوزيع والمنتجات المسموحة لكل جولة.'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="border-slate-700 bg-slate-800/80 text-slate-100 hover:bg-slate-700 font-semibold shadow-sm text-xs h-10 px-4"
          >
            <RefreshCw className={`w-4 h-4 mr-2 text-indigo-400 ${loading ? 'animate-spin' : ''}`} />
            {tr('Actualiser', 'تحديث')}
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="border-slate-700 bg-slate-800/80 text-slate-100 hover:bg-slate-700 font-semibold shadow-sm text-xs h-10 px-4"
          >
            <Printer className="w-4 h-4 mr-2 text-teal-400" />
            {tr('Imprimer Feuille', 'طباعة اللائحة')}
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-800 bg-slate-900/90 rounded-2xl shadow-lg hover:border-slate-700 transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-black text-white">{methods.length}</div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                {tr('Méthodes Actives', 'طرق عمل نشطة')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/90 rounded-2xl shadow-lg hover:border-slate-700 transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-black text-white">{assignedDriversCount}</div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                {tr('Chauffeurs Assignés', 'سائقون معينون')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/90 rounded-2xl shadow-lg hover:border-slate-700 transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-black text-white">{coveredSectorsCount}</div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                {tr('Secteurs Couverts', 'قطاعات مغطاة')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/90 rounded-2xl shadow-lg hover:border-slate-700 transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-black text-white">{bottleTypes.length}</div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                {tr('Articles au Catalogue', 'أنواع القنينات')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Interactive Form Card */}
      <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
        <CardHeader className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-white">
                  {editingId
                    ? tr('Modifier la Méthode de Travail', 'تعديل طريقة العمل')
                    : tr('Configurer une Nouvelle Méthode de Travail', 'إضافة وتعيين طريقة عمل جديدة')}
                </CardTitle>
                <CardDescription className="text-slate-300 text-xs">
                  {tr('Renseignez les 4 paramètres clés pour planifier la tournée.', 'حدد العناصر الأساسية لتنظيم جولة التوزيع.')}
                </CardDescription>
              </div>
            </div>
            {editingId && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetForm} 
                className="border-slate-700 bg-slate-800 text-slate-200 hover:text-white text-xs h-8"
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                {tr('Annuler modification', 'إلغاء التعديل')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Driver */}
            <div className="space-y-2">
              <Label className="text-slate-100 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-indigo-400" />
                {tr('Chauffeur', 'السائق')} <span className="text-rose-400">*</span>
              </Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white font-medium h-12 rounded-xl focus:ring-2 focus:ring-indigo-500/30">
                  <SelectValue placeholder={tr('Choisir un chauffeur...', 'اختر السائق...')} />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-72">
                  {drivers.map(d => (
                    <SelectItem key={d.id} value={d.id} className="py-2.5 cursor-pointer focus:bg-slate-800">
                      <span className="font-semibold text-white">{d.name}</span>
                      {d.code && <span className="ml-2 text-xs text-slate-400 font-mono">[{d.code}]</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Aide-livreur */}
            <div className="space-y-2">
              <Label className="text-slate-100 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                {tr('Aide-livreur', 'المساعد')} <span className="text-rose-400">*</span>
              </Label>
              <div className="space-y-2">
                <Input
                  value={aideLivreur}
                  onChange={e => setAideLivreur(e.target.value)}
                  placeholder={tr('Nom de l\'aide-livreur...', 'اسم المساعد...')}
                  className="bg-slate-950 border-slate-700 text-white font-medium h-12 rounded-xl focus:ring-2 focus:ring-emerald-500/30"
                />
                {existingAides.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center pt-1">
                    <span className="text-xs text-slate-400 font-semibold">{tr('Suggestions:', 'اقتراحات:')}</span>
                    {existingAides.slice(0, 4).map((aide, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setAideLivreur(aide)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors"
                      >
                        {aide}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Sector */}
            <div className="space-y-2">
              <Label className="text-slate-100 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-purple-400" />
                {tr('Secteur Assigné', 'القطاع المخصص')} <span className="text-rose-400">*</span>
              </Label>
              <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white font-medium h-12 rounded-xl focus:ring-2 focus:ring-purple-500/30">
                  <SelectValue placeholder={tr('Choisir un secteur...', 'اختر القطاع...')} />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-72">
                  {sectors.map(s => (
                    <SelectItem key={s.id} value={s.id} className="py-2.5 cursor-pointer focus:bg-slate-800">
                      <span className="font-semibold text-white">{s.code || '-'}</span>
                      <span className="mx-2 text-slate-400">·</span>
                      <span className="text-slate-200">{s.secteurs}</span>
                      {s.ville && <span className="ml-1 text-xs text-slate-400">({s.ville})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 4. Products Selection Box */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <Label className="text-slate-100 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-400" />
                {tr('Produits & Bouteilles Autorisés', 'المنتجات والقنينات المسموحة')} <span className="text-rose-400">*</span>
                <span className="text-xs font-semibold text-indigo-400 ml-2">
                  ({selectedProducts.length} / {bottleTypes.length} {tr('sélectionnés', 'محددة')})
                </span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleSelectAllProducts}
                className="text-xs font-semibold border-slate-700 bg-slate-800 text-indigo-300 hover:bg-slate-700 h-8 px-3 rounded-lg"
              >
                {selectedProducts.length === bottleTypes.length
                  ? tr('Tout désélectionner', 'إلغاء تحديد الكل')
                  : tr('Tout sélectionner', 'تحديد الكل')}
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800 max-h-56 overflow-y-auto">
              {bottleTypes.map(bottle => {
                const checked = selectedProducts.includes(bottle.id);
                return (
                  <label
                    key={bottle.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs font-semibold transition-all ${
                      checked
                        ? 'bg-indigo-600/20 border-indigo-500/60 text-white shadow-sm ring-1 ring-indigo-500/30'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={state => {
                        if (state) {
                          setSelectedProducts([...selectedProducts, bottle.id]);
                        } else {
                          setSelectedProducts(selectedProducts.filter(id => id !== bottle.id));
                        }
                      }}
                      className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                    />
                    <span className="truncate">{bottle.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Form Submit Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            {editingId && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={resetForm} 
                className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 font-semibold h-11 px-5 rounded-xl"
              >
                {tr('Annuler', 'إلغاء')}
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 px-7 rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
            >
              <Check className="w-4 h-4 mr-2" />
              {editingId ? tr('Mettre à jour la Méthode', 'تحديث طريقة العمل') : tr('Enregistrer la Méthode', 'حفظ طريقة العمل')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configured Methods Data Table */}
      <Card className="border-slate-800 bg-slate-900/90 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
        <CardHeader className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                {tr('Méthodes de Travail Configurées', 'لائحة طرق العمل المضبوطة')}
              </CardTitle>
              <CardDescription className="text-slate-300 text-xs">
                {tr(
                  'Visualisation et contrôle des équipes de distribution actives.',
                  'متابعة ومراجعة توزيع الفرق والقطاعات والمنتجات.'
                )}
              </CardDescription>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder={tr('Rechercher chauffeur, secteur, aide...', 'بحث سريع عن سائق، مساعد، قطاع...')}
                className="pl-10 bg-slate-950 border-slate-700 text-white placeholder:text-slate-400 h-10 text-xs rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-800/90 border-b border-slate-700">
                <TableRow>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6">{tr('Chauffeur', 'السائق')}</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4">{tr('Aide-livreur', 'المساعد')}</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4">{tr('Secteur Assigné', 'القطاع المخصص')}</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4">{tr('Produits Autorisés', 'المنتجات المسموحة')}</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6 text-right">{tr('Actions', 'الإجراءات')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-slate-300 font-medium">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                      {tr('Chargement des méthodes de travail...', 'جارٍ تحميل طرق العمل...')}
                    </TableCell>
                  </TableRow>
                ) : filteredMethods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                      {searchFilter
                        ? tr('Aucun résultat trouvé pour votre recherche.', 'لم يتم العثور على أي نتائج مطابقة للبحث.')
                        : tr('Aucune méthode de travail configurée pour l\'instant.', 'لا توجد طريقة عمل مضبوطة حتى الآن.')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMethods.map(method => {
                    const driver = drivers.find(d => d.id === method.driver_id);
                    const sector = sectors.find(s => s.id === method.sector_id);
                    const products = (method.product_ids || [])
                      .map(pid => bottleTypes.find(b => b.id === pid))
                      .filter(Boolean);

                    return (
                      <TableRow key={method.id} className="hover:bg-slate-800/50 border-b border-slate-800 transition-colors">
                        <TableCell className="py-4 px-6">
                          <div className="font-bold text-white text-sm">{driver?.name || tr('Inconnu', 'غير معروف')}</div>
                          {driver?.code && (
                            <Badge variant="outline" className="mt-1 font-mono text-[11px] border-slate-700 bg-slate-800 text-indigo-300 px-2 py-0.5">
                              {driver.code}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-4 px-4">
                          <div className="font-semibold text-slate-200 text-sm">{method.aide_livreur || '-'}</div>
                        </TableCell>
                        <TableCell className="py-4 px-4">
                          <div className="font-bold text-slate-100 text-sm">{sector?.secteurs || tr('Inconnu', 'غير معروف')}</div>
                          <div className="text-xs text-slate-400 font-medium mt-0.5">
                            {sector?.code || '-'} {sector?.ville ? `· ${sector.ville}` : ''}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-4">
                          <div className="flex flex-wrap gap-1.5 max-w-lg">
                            {products.length === 0 ? (
                              <span className="text-xs text-slate-500 font-medium">{tr('Aucun produit', 'لا منتجات')}</span>
                            ) : (
                              products.map((p: any) => (
                                <Badge
                                  key={p.id}
                                  variant="outline"
                                  className="border-slate-700 bg-slate-800 text-slate-200 font-semibold text-xs px-2.5 py-1"
                                >
                                  {p.name}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEdit(method)}
                              className="border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 font-semibold text-xs h-9 px-3 rounded-lg"
                            >
                              <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                              {tr('Modifier', 'تعديل')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(method.id)}
                              className="border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 font-semibold text-xs h-9 px-3 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                              {tr('Supprimer', 'حذف')}
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
        </CardContent>
      </Card>
    </div>
  );
}
