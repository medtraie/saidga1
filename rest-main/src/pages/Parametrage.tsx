import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Sliders, 
  Tag, 
  Layers, 
  MapPin, 
  Users, 
  ShieldAlert, 
  DollarSign, 
  Plus, 
  Trash2, 
  Edit3, 
  Filter, 
  RefreshCw, 
  Printer, 
  Search,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Check,
  X,
  CreditCard,
  Map,
  Truck,
  Smartphone,
  UserPlus,
  Key,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  ExternalLink,
  QrCode
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { pointVenteService, DriverPosAccount } from '@/lib/pointVenteService';

export default function Parametrage() {
  const { drivers = [], bottleTypes = [], returnOrders = [], updateDriver } = useApp();
  const { toast } = useToast();
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);

  const [activeTab, setActiveTab] = useState<string>('pricing');

  // ==========================================
  // 7. DRIVER POS ACCOUNTS (Application Android)
  // ==========================================
  const [driverPosAccounts, setDriverPosAccounts] = useState<DriverPosAccount[]>([]);
  const [driverPosLoading, setDriverPosLoading] = useState(false);
  const [driverPosSaving, setDriverPosSaving] = useState(false);
  const [selectedDriverForPos, setSelectedDriverForPos] = useState('');
  const [driverPosEmail, setDriverPosEmail] = useState('');
  const [driverPosPassword, setDriverPosPassword] = useState('');
  const [driverPosActive, setDriverPosActive] = useState(true);
  const [driverPosEditingId, setDriverPosEditingId] = useState<string | null>(null);
  const [showDriverPosPassword, setShowDriverPosPassword] = useState(false);

  const loadDriverPosAccounts = async () => {
    setDriverPosLoading(true);
    try {
      const accounts = await pointVenteService.getDriverAccounts();
      setDriverPosAccounts(accounts);
    } catch (e: any) {
      console.warn('Driver POS accounts notice:', e?.message);
    } finally {
      setDriverPosLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'driver_pos') {
      loadDriverPosAccounts();
    }
  }, [activeTab]);

  const handleSelectDriverForPos = (driverId: string) => {
    setSelectedDriverForPos(driverId);
    const driver = drivers.find(d => String(d.id) === String(driverId));
    if (driver && !driverPosEditingId) {
      const slug = (driver.name || 'driver').toLowerCase().replace(/[^a-z0-9]/g, '.');
      setDriverPosEmail(`${slug}@sftgaz.ma`);
      setDriverPosPassword(Math.random().toString(36).slice(-8) + '!');
    }
  };

  const handleSaveDriverPosAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverForPos) {
      toast({ title: tr('Chauffeur requis', 'يرجى اختيار سائق'), variant: 'destructive' });
      return;
    }
    if (!driverPosEmail.trim() || !driverPosPassword.trim()) {
      toast({ title: tr('Email et mot de passe requis', 'البريد الإلكتروني وكلمة المرور مطلوبان'), variant: 'destructive' });
      return;
    }
    const driver = drivers.find(d => String(d.id) === String(selectedDriverForPos));
    setDriverPosSaving(true);
    try {
      await pointVenteService.saveDriverAccount({
        id: driverPosEditingId || undefined,
        driverId: selectedDriverForPos,
        driverName: driver?.name || 'Chauffeur',
        email: driverPosEmail.trim(),
        password: driverPosPassword.trim(),
        isActive: driverPosActive,
      });
      toast({
        title: tr('Compte Chauffeur Enregistré', 'تم حفظ حساب السائق بنجاح'),
        description: `${driver?.name} : ${driverPosEmail}`,
      });
      setDriverPosEditingId(null);
      setSelectedDriverForPos('');
      setDriverPosEmail('');
      setDriverPosPassword('');
      setDriverPosActive(true);
      await loadDriverPosAccounts();
    } catch (err: any) {
      toast({ title: tr('Erreur', 'خطأ'), description: err?.message, variant: 'destructive' });
    } finally {
      setDriverPosSaving(false);
    }
  };

  const handleEditDriverPos = (acc: DriverPosAccount) => {
    setDriverPosEditingId(acc.id);
    setSelectedDriverForPos(acc.driverId);
    setDriverPosEmail(acc.email);
    setDriverPosPassword(acc.password || '');
    setDriverPosActive(acc.isActive);
  };

  const handleDeleteDriverPos = async (id: string, name: string) => {
    if (!window.confirm(tr(`Supprimer le compte mobile de ${name} ?`, `هل أنت متأكد من حذف حساب ${name}؟`))) return;
    await pointVenteService.deleteDriverAccount(id);
    toast({ title: tr('Compte supprimé', 'تم حذف الحساب') });
    await loadDriverPosAccounts();
  };

  const handleToggleDriverPosStatus = async (acc: DriverPosAccount) => {
    await pointVenteService.saveDriverAccount({
      ...acc,
      isActive: !acc.isActive,
    });
    toast({ title: tr(acc.isActive ? 'Compte désactivé' : 'Compte activé', acc.isActive ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب') });
    await loadDriverPosAccounts();
  };

  // ==========================================
  // 1. PRICING SETTINGS (Zone 0 & Zone 1)
  // ==========================================
  const [priceZone, setPriceZone] = useState<0 | 1>(0);
  const [pricing, setPricing] = useState<Array<{ id?: string; code: string; designation: string; prix_unitaire: string; prix_achat: string; zone: 0 | 1 }>>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingSearch, setPricingSearch] = useState('');

  const loadPricing = async () => {
    setPricingLoading(true);
    const { data, error } = await supabase
      .from('pricing_settings')
      .select('*')
      .eq('zone', priceZone)
      .order('code', { ascending: true });

    if (error) {
      console.warn('Pricing notice:', error.message);
      if (bottleTypes.length > 0) {
        setPricing(bottleTypes.map((bt: any, idx: number) => ({
          code: `ART-${idx + 1}`,
          designation: bt.name,
          prix_unitaire: bt.price ? String(bt.price) : '',
          prix_achat: bt.purchasePrice ? String(bt.purchasePrice) : '',
          zone: priceZone,
        })));
      }
      setPricingLoading(false);
      return;
    }
    let rows = (data || []).map((r: any) => ({
      id: r.id,
      code: String(r.code ?? ''),
      designation: String(r.designation ?? ''),
      prix_unitaire: Number(r.prix_unitaire ?? 0) === 0 ? '' : String(r.prix_unitaire),
      prix_achat: Number(r.prix_achat ?? 0) === 0 ? '' : String(r.prix_achat),
      zone: Number(r.zone ?? 0) as 0 | 1,
    }));

    if (rows.length === 0 && bottleTypes.length > 0) {
      rows = bottleTypes.map((bt: any, idx: number) => ({
        code: `ART-${idx + 1}`,
        designation: bt.name,
        prix_unitaire: bt.price ? String(bt.price) : '',
        prix_achat: bt.purchasePrice ? String(bt.purchasePrice) : '',
        zone: priceZone,
      }));
    }

    setPricing(rows);
    setPricingLoading(false);
  };

  useEffect(() => {
    loadPricing();
  }, [priceZone, bottleTypes.length]);

  const addPricingRow = () => {
    setPricing(prev => [
      ...prev,
      { code: '', designation: '', prix_unitaire: '', prix_achat: '', zone: priceZone }
    ]);
  };

  const updatePricingRow = (index: number, field: string, value: string) => {
    setPricing(prev => {
      const next = [...prev];
      (next[index] as any)[field] = value;
      return next;
    });
  };

  const savePricingRow = async (index: number) => {
    const row = pricing[index];
    const parsePrice = (value: string) => {
      const n = value.trim();
      if (!n) return null;
      const p = Number(n);
      return Number.isFinite(p) ? p : null;
    };
    const payload = {
      id: row.id,
      code: row.code?.trim() || null,
      designation: row.designation?.trim() || null,
      prix_unitaire: parsePrice(row.prix_unitaire),
      prix_achat: parsePrice(row.prix_achat),
      zone: row.zone,
      updated_at: new Date().toISOString()
    };
    setPricingSaving(true);
    const { data, error } = await supabase.from('pricing_settings').upsert(payload, { onConflict: 'id' }).select().maybeSingle();
    setPricingSaving(false);
    if (error) {
      toast({ title: tr('Échec de sauvegarde', 'فشل الحفظ'), description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: tr('Tarif enregistré', 'تم حفظ التسعيرة بنجاح') });
    if (data) {
      setPricing(prev => {
        const next = [...prev];
        next[index] = { ...row, id: String(data.id) };
        return next;
      });
    }
  };

  const deletePricingRow = async (index: number) => {
    const row = pricing[index];
    if (row.id) {
      if (!window.confirm(tr('Voulez-vous supprimer ce tarif ?', 'هل تريد حذف هذا السعر؟'))) return;
      await supabase.from('pricing_settings').delete().eq('id', row.id);
    }
    setPricing(prev => prev.filter((_, i) => i !== index));
    toast({ title: tr('Tarif supprimé', 'تم حذف السطر') });
  };

  const filteredPricing = useMemo(() => {
    const q = pricingSearch.trim().toLowerCase();
    if (!q) return pricing;
    return pricing.filter(p => p.code.toLowerCase().includes(q) || p.designation.toLowerCase().includes(q));
  }, [pricing, pricingSearch]);

  // ==========================================
  // 2. DIF PRICING (Commission Differences)
  // ==========================================
  const [difs, setDifs] = useState<Array<{ id: string; code: string; designation: string; qte_dif: string; prix_dif: string }>>([]);
  const [difsLoading, setDifsLoading] = useState(false);
  const [difsSaving, setDifsSaving] = useState(false);
  const [difForm, setDifForm] = useState({ code: '', designation: '', qte_dif: '', prix_dif: '' });
  const [selectedDifId, setSelectedDifId] = useState<string | null>(null);
  const [difFilter, setDifFilter] = useState('');

  const loadDifs = async () => {
    setDifsLoading(true);
    const { data, error } = await supabase.from('dif_pricing').select('*').order('code', { ascending: true });
    if (error) {
      toast({ title: tr('Erreur chargement DIF', 'خطأ في تحميل DIF'), description: error.message, variant: 'destructive' });
    } else {
      setDifs((data ?? []).map((r: any) => ({
        id: String(r.id),
        code: String(r.code ?? ''),
        designation: String(r.designation ?? ''),
        qte_dif: String(r.qte_dif ?? ''),
        prix_dif: String(r.prix_dif ?? '')
      })));
    }
    setDifsLoading(false);
  };

  useEffect(() => {
    loadDifs();
  }, []);

  const clearDifForm = () => {
    setSelectedDifId(null);
    setDifForm({ code: '', designation: '', qte_dif: '', prix_dif: '' });
  };

  const handleDifAdd = async () => {
    if (!difForm.code.trim() || !difForm.designation.trim() || !difForm.prix_dif.trim()) {
      toast({ title: tr('Erreur', 'خطأ'), description: tr('Code, désignation et prix requis.', 'الكود، التسمية والسعر مطلوبة.'), variant: 'destructive' });
      return;
    }
    setDifsSaving(true);
    const payload = {
      code: difForm.code.trim(),
      designation: difForm.designation.trim(),
      qte_dif: Number(difForm.qte_dif) || 0,
      prix_dif: Number(difForm.prix_dif) || 0
    };
    const { data, error } = await supabase.from('dif_pricing').insert(payload).select().single();
    setDifsSaving(false);
    if (error) {
      toast({ title: tr('Erreur', 'خطأ'), description: error.message, variant: 'destructive' });
    } else if (data) {
      setDifs(prev => [...prev, { id: String(data.id), code: String(data.code), designation: String(data.designation), qte_dif: String(data.qte_dif), prix_dif: String(data.prix_dif) }]);
      toast({ title: tr('Succès', 'تم بنجاح'), description: tr('Ligne DIF ajoutée', 'تمت إضافة صنف DIF بنجاح') });
      clearDifForm();
    }
  };

  const handleDifUpdate = async () => {
    if (!selectedDifId) return;
    setDifsSaving(true);
    const payload = {
      code: difForm.code.trim(),
      designation: difForm.designation.trim(),
      qte_dif: Number(difForm.qte_dif) || 0,
      prix_dif: Number(difForm.prix_dif) || 0
    };
    const { data, error } = await supabase.from('dif_pricing').update(payload).eq('id', selectedDifId).select().single();
    setDifsSaving(false);
    if (error) {
      toast({ title: tr('Erreur', 'خطأ'), description: error.message, variant: 'destructive' });
    } else if (data) {
      setDifs(prev => prev.map(d => d.id === selectedDifId ? { id: d.id, code: String(data.code), designation: String(data.designation), qte_dif: String(data.qte_dif), prix_dif: String(data.prix_dif) } : d));
      toast({ title: tr('Succès', 'تم بنجاح'), description: tr('Ligne DIF modifiée', 'تم تعديل صنف DIF بنجاح') });
      clearDifForm();
    }
  };

  const handleDifDelete = async () => {
    if (!selectedDifId) return;
    if (!window.confirm(tr('Voulez-vous supprimer cette ligne DIF ?', 'هل تريد حذف هذا الصنف؟'))) return;
    setDifsSaving(true);
    const { error } = await supabase.from('dif_pricing').delete().eq('id', selectedDifId);
    setDifsSaving(false);
    if (error) {
      toast({ title: tr('Erreur', 'خطأ'), description: error.message, variant: 'destructive' });
    } else {
      setDifs(prev => prev.filter(d => d.id !== selectedDifId));
      toast({ title: tr('Succès', 'تم بنجاح'), description: tr('Ligne DIF supprimée', 'تم حذف الصنف') });
      clearDifForm();
    }
  };

  const filteredDifs = useMemo(() => {
    const q = difFilter.trim().toLowerCase();
    if (!q) return difs;
    return difs.filter(d => d.code.toLowerCase().includes(q) || d.designation.toLowerCase().includes(q));
  }, [difs, difFilter]);

  // ==========================================
  // 3. RESERVOIRS PRICING
  // ==========================================
  const [reservoirs, setReservoirs] = useState<Array<{ id: string; code: string; designation: string; prix: string }>>([]);
  const [reservoirsLoading, setReservoirsLoading] = useState(false);
  const [reservoirsSaving, setReservoirsSaving] = useState(false);
  const [reservoirForm, setReservoirForm] = useState({ code: '', designation: '', prix: '' });
  const [selectedReservoirId, setSelectedReservoirId] = useState<string | null>(null);
  const [reservoirFilter, setReservoirFilter] = useState('');

  const loadReservoirs = async () => {
    setReservoirsLoading(true);
    const { data, error } = await supabase.from('reservoirs_pricing').select('*').order('code', { ascending: true });
    if (error) {
      toast({ title: tr('Erreur chargement réservoirs', 'خطأ في تحميل الخزانات'), description: error.message, variant: 'destructive' });
    } else {
      setReservoirs((data ?? []).map((r: any) => ({
        id: String(r.id),
        code: String(r.code ?? ''),
        designation: String(r.designation ?? ''),
        prix: String(r.prix ?? '')
      })));
    }
    setReservoirsLoading(false);
  };

  useEffect(() => {
    loadReservoirs();
  }, []);

  const clearReservoirForm = () => {
    setSelectedReservoirId(null);
    setReservoirForm({ code: '', designation: '', prix: '' });
  };

  const handleReservoirAdd = async () => {
    if (!reservoirForm.code.trim() || !reservoirForm.designation.trim() || !reservoirForm.prix.trim()) {
      toast({ title: tr('Erreur', 'خطأ'), description: tr('Tous les champs sont requis.', 'جميع الحقول مطلوبة.'), variant: 'destructive' });
      return;
    }
    setReservoirsSaving(true);
    const payload = {
      code: reservoirForm.code.trim(),
      designation: reservoirForm.designation.trim(),
      prix: Number(reservoirForm.prix) || 0
    };
    const { data, error } = await supabase.from('reservoirs_pricing').insert(payload).select().single();
    setReservoirsSaving(false);
    if (error) {
      toast({ title: tr('Erreur', 'خطأ'), description: error.message, variant: 'destructive' });
    } else if (data) {
      setReservoirs(prev => [...prev, { id: String(data.id), code: String(data.code), designation: String(data.designation), prix: String(data.prix) }]);
      toast({ title: tr('Succès', 'تم بنجاح'), description: tr('Réservoir ajouté', 'تمت إضافة الخزان بنجاح') });
      clearReservoirForm();
    }
  };

  const handleReservoirUpdate = async () => {
    if (!selectedReservoirId) return;
    setReservoirsSaving(true);
    const payload = {
      code: reservoirForm.code.trim(),
      designation: reservoirForm.designation.trim(),
      prix: Number(reservoirForm.prix) || 0
    };
    const { data, error } = await supabase.from('reservoirs_pricing').update(payload).eq('id', selectedReservoirId).select().single();
    setReservoirsSaving(false);
    if (error) {
      toast({ title: tr('Erreur', 'خطأ'), description: error.message, variant: 'destructive' });
    } else if (data) {
      setReservoirs(prev => prev.map(r => r.id === selectedReservoirId ? { id: r.id, code: String(data.code), designation: String(data.designation), prix: String(data.prix) } : r));
      toast({ title: tr('Succès', 'تم بنجاح'), description: tr('Réservoir modifié', 'تم تعديل الخزان بنجاح') });
      clearReservoirForm();
    }
  };

  const handleReservoirDelete = async () => {
    if (!selectedReservoirId) return;
    if (!window.confirm(tr('Voulez-vous supprimer ce réservoir ?', 'هل تريد حذف هذا الخزان؟'))) return;
    setReservoirsSaving(true);
    const { error } = await supabase.from('reservoirs_pricing').delete().eq('id', selectedReservoirId);
    setReservoirsSaving(false);
    if (error) {
      toast({ title: tr('Erreur', 'خطأ'), description: error.message, variant: 'destructive' });
    } else {
      setReservoirs(prev => prev.filter(r => r.id !== selectedReservoirId));
      toast({ title: tr('Succès', 'تم بنجاح'), description: tr('Réservoir supprimé', 'تم حذف الخزان') });
      clearReservoirForm();
    }
  };

  const filteredReservoirs = useMemo(() => {
    const q = reservoirFilter.trim().toLowerCase();
    if (!q) return reservoirs;
    return reservoirs.filter(r => r.code.toLowerCase().includes(q) || r.designation.toLowerCase().includes(q));
  }, [reservoirs, reservoirFilter]);

  // ==========================================
  // 4. SECTORS SETTINGS & ASSIGNMENTS
  // ==========================================
  const [sectors, setSectors] = useState<Array<{ id: string; code: string; secteurs: string; ville: string; region: string }>>([]);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [sectorsSaving, setSectorsSaving] = useState(false);
  const [sectorForm, setSectorForm] = useState({ code: '', secteurs: '', ville: '', region: '' });
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState('');

  const [driverSectorAssignments, setDriverSectorAssignments] = useState<Record<string, string[]>>({});
  const [driverSectorSavingId, setDriverSectorSavingId] = useState<string | null>(null);

  const loadSectors = async () => {
    setSectorsLoading(true);
    const { data, error } = await supabase.from('sectors_settings').select('*').order('code', { ascending: true });
    if (error) {
      toast({ title: tr('Erreur secteurs', 'خطأ في القطاعات'), description: error.message, variant: 'destructive' });
    } else {
      setSectors((data ?? []).map((r: any) => ({
        id: String(r.id),
        code: String(r.code ?? ''),
        secteurs: String(r.secteurs ?? ''),
        ville: String(r.ville ?? ''),
        region: String(r.region ?? '')
      })));
    }
    setSectorsLoading(false);
  };

  const loadDriverSectorAssignments = async () => {
    const { data } = await supabase.from('driver_sector_assignments').select('driver_id, sector_id');
    const mapping = (data ?? []).reduce<Record<string, string[]>>((acc, row: any) => {
      const driverId = String(row.driver_id ?? '').trim();
      const sectorIds = String(row.sector_id ?? '').split(',').map(v => v.trim()).filter(Boolean);
      if (!driverId || sectorIds.length === 0) return acc;
      acc[driverId] = Array.from(new Set([...(acc[driverId] || []), ...sectorIds]));
      return acc;
    }, {});
    setDriverSectorAssignments(mapping);
  };

  useEffect(() => {
    loadSectors();
    loadDriverSectorAssignments();
  }, []);

  const clearSectorForm = () => {
    setSelectedSectorId(null);
    setSectorForm({ code: '', secteurs: '', ville: '', region: '' });
  };

  const handleSectorAdd = async () => {
    if (!sectorForm.code.trim() || !sectorForm.secteurs.trim()) {
      toast({ title: tr('Erreur', 'خطأ'), description: tr('Code et secteur requis.', 'الكود والقطاع مطلوبان.'), variant: 'destructive' });
      return;
    }
    setSectorsSaving(true);
    const payload = {
      code: sectorForm.code.trim(),
      secteurs: sectorForm.secteurs.trim(),
      ville: sectorForm.ville.trim(),
      region: sectorForm.region.trim()
    };
    const { data, error } = await supabase.from('sectors_settings').insert(payload).select().single();
    setSectorsSaving(false);
    if (error) {
      toast({ title: tr('Erreur', 'خطأ'), description: error.message, variant: 'destructive' });
    } else if (data) {
      setSectors(prev => [...prev, { id: String(data.id), code: String(data.code), secteurs: String(data.secteurs), ville: String(data.ville), region: String(data.region) }]);
      toast({ title: tr('Succès', 'تم بنجاح'), description: tr('Secteur ajouté', 'تمت إضافة القطاع') });
      clearSectorForm();
    }
  };

  const handleSectorUpdate = async () => {
    if (!selectedSectorId) return;
    setSectorsSaving(true);
    const payload = {
      code: sectorForm.code.trim(),
      secteurs: sectorForm.secteurs.trim(),
      ville: sectorForm.ville.trim(),
      region: sectorForm.region.trim()
    };
    const { data, error } = await supabase.from('sectors_settings').update(payload).eq('id', selectedSectorId).select().single();
    setSectorsSaving(false);
    if (error) {
      toast({ title: tr('Erreur', 'خطأ'), description: error.message, variant: 'destructive' });
    } else if (data) {
      setSectors(prev => prev.map(s => s.id === selectedSectorId ? { id: s.id, code: String(data.code), secteurs: String(data.secteurs), ville: String(data.ville), region: String(data.region) } : s));
      toast({ title: tr('Succès', 'تم بنجاح'), description: tr('Secteur modifié', 'تم تعديل القطاع') });
      clearSectorForm();
    }
  };

  const handleSectorDelete = async () => {
    if (!selectedSectorId) return;
    if (!window.confirm(tr('Voulez-vous supprimer ce secteur ?', 'هل تريد حذف هذا القطاع؟'))) return;
    setSectorsSaving(true);
    const { error } = await supabase.from('sectors_settings').delete().eq('id', selectedSectorId);
    setSectorsSaving(false);
    if (error) {
      toast({ title: tr('Erreur', 'خطأ'), description: error.message, variant: 'destructive' });
    } else {
      setSectors(prev => prev.filter(s => s.id !== selectedSectorId));
      toast({ title: tr('Succès', 'تم بنجاح'), description: tr('Secteur supprimé', 'تم حذف القطاع') });
      clearSectorForm();
    }
  };

  const saveDriverSectorAssignment = async (driverId: string) => {
    setDriverSectorSavingId(driverId);
    const sectorIds = driverSectorAssignments[driverId] || [];
    const joined = sectorIds.join(',');
    const driver = drivers.find(d => d.id === driverId);

    const { error } = await supabase.from('driver_sector_assignments').upsert(
      {
        driver_id: driverId,
        sector_id: joined,
        driver_name: driver?.name || null,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'driver_id' }
    );
    setDriverSectorSavingId(null);
    if (error) {
      toast({ title: tr('Échec assignation', 'فشل التعيين'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: tr('Affectation enregistrée', 'تم حفظ التعيين'), description: tr('Secteurs enregistrés pour le chauffeur.', 'تم تعيين القطاعات للسائق بنجاح.') });
    }
  };

  const filteredSectors = useMemo(() => {
    const q = sectorFilter.trim().toLowerCase();
    if (!q) return sectors;
    return sectors.filter(s => s.code.toLowerCase().includes(q) || s.secteurs.toLowerCase().includes(q) || s.ville.toLowerCase().includes(q));
  }, [sectors, sectorFilter]);

  // ==========================================
  // 5. THRESHOLDS & ALERTS (Debt & Foreign Bottles)
  // ==========================================
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, string>>({});
  const [foreignThresholdDrafts, setForeignThresholdDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const dDrafts: Record<string, string> = {};
    const fDrafts: Record<string, string> = {};
    drivers.forEach(d => {
      dDrafts[d.id] = (d.debtThreshold && d.debtThreshold > 0) ? String(d.debtThreshold) : '';
      fDrafts[d.id] = (d.foreignBottlesThreshold && d.foreignBottlesThreshold > 0) ? String(d.foreignBottlesThreshold) : '';
    });
    setThresholdDrafts(dDrafts);
    setForeignThresholdDrafts(fDrafts);
  }, [drivers]);

  const saveDriverThreshold = async (driverId: string) => {
    const val = Number(thresholdDrafts[driverId] || 0);
    await updateDriver(driverId, { debtThreshold: val });
    toast({ title: tr('Seuil de dette enregistré', 'تم حفظ سقف الدين للسائق بنجاح') });
  };

  const saveDriverForeignThreshold = async (driverId: string) => {
    const val = Number(foreignThresholdDrafts[driverId] || 0);
    await updateDriver(driverId, { foreignBottlesThreshold: val });
    toast({ title: tr('Seuil bouteilles étrangères enregistré', 'تم حفظ سقف القنينات الأجنبية بنجاح') });
  };

  // ==========================================
  // 6. DRIVER COMMISSIONS & SITUATION
  // ==========================================
  const [commissionFromDate, setCommissionFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [commissionToDate, setCommissionToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [driverCommissionDrafts, setDriverCommissionDrafts] = useState<Record<string, { saJ: string; saV: string; comm: string; salaire: string; primes: string }>>({});
  const [commissionSavingId, setCommissionSavingId] = useState<string | null>(null);

  useEffect(() => {
    const loadDriverCommissionDrafts = async () => {
      const uid = (await supabase.auth.getSession()).data.session?.user?.id ?? null;
      let drafts: Record<string, any> = {};
      try {
        const raw = localStorage.getItem('driver-commission-settings-v1');
        if (raw) drafts = JSON.parse(raw);
      } catch {}

      if (uid) {
        const { data } = await supabase
          .from('driver_commission_settings')
          .select('driver_id, sa_j, sa_v, comm, salaire, primes')
          .eq('user_id', uid);

        if (data && data.length) {
          data.forEach((row: any) => {
            if (row.driver_id) {
              drafts[row.driver_id] = {
                saJ: String(row.sa_j ?? ''),
                saV: String(row.sa_v ?? ''),
                comm: String(row.comm ?? ''),
                salaire: String(row.salaire ?? ''),
                primes: String(row.primes ?? ''),
              };
            }
          });
        }
      }

      const mapping: Record<string, any> = {};
      drivers.forEach(d => {
        mapping[d.id] = drafts[d.id] || { saJ: '', saV: '', comm: '', salaire: '', primes: '' };
      });
      setDriverCommissionDrafts(mapping);
    };
    loadDriverCommissionDrafts();
  }, [drivers]);

  const commissionRows = useMemo(() => {
    const fromTime = commissionFromDate ? new Date(`${commissionFromDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = commissionToDate ? new Date(`${commissionToDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;

    return drivers.map(driver => {
      const related = (returnOrders || []).filter((order: any) => {
        if (String(order?.driverId || '') !== String(driver.id)) return false;
        const dStr = String(order?.date || '');
        if (!dStr) return false;
        const ms = new Date(dStr).getTime();
        return ms >= fromTime && ms <= toTime;
      });

      const nbv = related.length;
      const distinctDays = new Set(related.map((o: any) => String(o?.date || '').slice(0, 10)).filter(Boolean));
      const nbj = distinctDays.size;

      const draft = driverCommissionDrafts[driver.id] || { saJ: '', saV: '', comm: '', salaire: '', primes: '' };
      const saJ = Number(draft.saJ || 0);
      const saV = Number(draft.saV || 0);
      const comm = Number(draft.comm || 0);
      const salaire = Number(draft.salaire || 0);
      const primes = Number(draft.primes || 0);

      const mtJ = nbj * saJ;
      const mtV = nbv * saV;
      const total = mtJ + mtV + comm + salaire;
      const totalGeneral = total + primes;

      return {
        driverId: driver.id,
        driverName: driver.name,
        driverCode: driver.code || '',
        nbv,
        nbj,
        saJ,
        saV,
        comm,
        salaire,
        primes,
        mtJ,
        mtV,
        total,
        totalGeneral
      };
    });
  }, [drivers, returnOrders, commissionFromDate, commissionToDate, driverCommissionDrafts]);

  const commissionTotals = useMemo(() => {
    return commissionRows.reduce(
      (acc, r) => ({
        nbv: acc.nbv + r.nbv,
        nbj: acc.nbj + r.nbj,
        mtJ: acc.mtJ + r.mtJ,
        mtV: acc.mtV + r.mtV,
        total: acc.total + r.total,
        primes: acc.primes + r.primes,
        totalGeneral: acc.totalGeneral + r.totalGeneral
      }),
      { nbv: 0, nbj: 0, mtJ: 0, mtV: 0, total: 0, primes: 0, totalGeneral: 0 }
    );
  }, [commissionRows]);

  const saveDriverCommissionDraft = async (driverId: string) => {
    const uid = (await supabase.auth.getSession()).data.session?.user?.id ?? null;
    const draft = driverCommissionDrafts[driverId] || { saJ: '', saV: '', comm: '', salaire: '', primes: '' };
    const payload = {
      user_id: uid,
      driver_id: driverId,
      sa_j: Number(draft.saJ || 0),
      sa_v: Number(draft.saV || 0),
      comm: Number(draft.comm || 0),
      salaire: Number(draft.salaire || 0),
      primes: Number(draft.primes || 0),
      updated_at: new Date().toISOString()
    };

    setCommissionSavingId(driverId);
    const { error } = await supabase.from('driver_commission_settings').upsert(payload, { onConflict: 'user_id,driver_id' });
    setCommissionSavingId(null);

    try {
      localStorage.setItem('driver-commission-settings-v1', JSON.stringify(driverCommissionDrafts));
    } catch {}

    if (error) {
      toast({ title: tr('Échec sauvegarde', 'فشل الحفظ'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: tr('Commission enregistrée', 'تم حفظ العمولة بنجاح') });
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 max-w-7xl mx-auto">
      {/* Studio Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Sliders className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                {tr('Paramétrage du Système', 'التهيئة العامة والإعدادات المتقدمة')}
              </h1>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs px-2.5 py-0.5 font-bold">
                Enterprise Studio
              </Badge>
            </div>
            <p className="text-sm text-slate-300 mt-1 font-medium">
              {tr(
                'Pilotage centralisé des tarifs par zone, écarts DIF, réservoirs, secteurs, alertes et commissions.',
                'الإدارة المركزية للأسعار، فوارق DIF، الخزانات، القطاعات، العتبات الآلية وعمولات السائقين.'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              loadPricing();
              loadDifs();
              loadReservoirs();
              loadSectors();
            }}
            className="border-slate-700 bg-slate-800/80 text-slate-100 hover:bg-slate-700 font-semibold shadow-sm text-xs h-10 px-4"
          >
            <RefreshCw className="w-4 h-4 mr-2 text-indigo-400" />
            {tr('Actualiser Tout', 'تحديث الكل')}
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="border-slate-700 bg-slate-800/80 text-slate-100 hover:bg-slate-700 font-semibold shadow-sm text-xs h-10 px-4"
          >
            <Printer className="w-4 h-4 mr-2 text-purple-400" />
            {tr('Imprimer Rapport', 'طباعة التقرير')}
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-slate-800 bg-slate-900/90 rounded-2xl shadow-md p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
          <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">{tr('Tarifs Actifs', 'الأسعار')}</span>
          <div className="text-2xl md:text-3xl font-black text-white mt-1.5">{pricing.length}</div>
        </Card>
        <Card className="border-slate-800 bg-slate-900/90 rounded-2xl shadow-md p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
          <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">{tr('Articles DIF', 'أصناف DIF')}</span>
          <div className="text-2xl md:text-3xl font-black text-indigo-400 mt-1.5">{difs.length}</div>
        </Card>
        <Card className="border-slate-800 bg-slate-900/90 rounded-2xl shadow-md p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
          <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">{tr('Réservoirs', 'الخزانات')}</span>
          <div className="text-2xl md:text-3xl font-black text-purple-400 mt-1.5">{reservoirs.length}</div>
        </Card>
        <Card className="border-slate-800 bg-slate-900/90 rounded-2xl shadow-md p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
          <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">{tr('Secteurs', 'القطاعات')}</span>
          <div className="text-2xl md:text-3xl font-black text-sky-400 mt-1.5">{sectors.length}</div>
        </Card>
        <Card className="border-slate-800 bg-slate-900/90 rounded-2xl shadow-md p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
          <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">{tr('Chauffeurs', 'السائقون')}</span>
          <div className="text-2xl md:text-3xl font-black text-emerald-400 mt-1.5">{drivers.length}</div>
        </Card>
        <Card className="border-slate-800 bg-slate-900/90 rounded-2xl shadow-md p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
          <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">{tr('Total Salaires', 'إجمالي العمولات')}</span>
          <div className="text-xl md:text-2xl font-black text-emerald-400 mt-1.5 truncate">{commissionTotals.totalGeneral.toFixed(0)} DH</div>
        </Card>
      </div>

      {/* Main Tabs Component */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-7 border border-slate-800 bg-slate-900/95 h-auto p-1.5 gap-1.5 rounded-2xl shadow-lg">
          <TabsTrigger 
            value="pricing" 
            className="text-xs font-bold py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Tag className="w-4 h-4" />
            <span>{tr('Tarifs', 'الأسعار')}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="difs" 
            className="text-xs font-bold py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            <span>DIF</span>
          </TabsTrigger>
          <TabsTrigger 
            value="reservoirs" 
            className="text-xs font-bold py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4" />
            <span>{tr('Réservoirs', 'الخزانات')}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="sectors" 
            className="text-xs font-bold py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <MapPin className="w-4 h-4" />
            <span>{tr('Secteurs', 'القطاعات')}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="thresholds" 
            className="text-xs font-bold py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{tr('Seuils', 'العتبات')}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="commissions" 
            className="text-xs font-bold py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            <span>{tr('Commissions', 'العمولات')}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="driver_pos" 
            className="text-xs font-bold py-3 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>{tr('Comptes Chauffeurs POS', 'حسابات سائقي أندرويد')}</span>
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: TARIFS PAR ZONE */}
        {/* ========================================================================= */}
        <TabsContent value="pricing" className="space-y-4 m-0">
          <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
            <CardHeader className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                    <Tag className="w-5 h-5 text-indigo-400" />
                    {tr('Paramétrage des Tarifs par Zone', 'تسعيرات المنتجات حسب المناطق')}
                  </CardTitle>
                  <CardDescription className="text-slate-300 text-xs">
                    {tr('Basculez entre Zone 0 et Zone 1 pour éditer directement les prix unitaires et d\'achat.', 'اختر المنطقة لتعديل سعر البيع والشراء مباشرة.')}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                    <Button
                      size="sm"
                      variant={priceZone === 0 ? 'default' : 'ghost'}
                      onClick={() => setPriceZone(0)}
                      className={`h-9 px-4 rounded-lg font-bold text-xs ${priceZone === 0 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                      Zone 0
                    </Button>
                    <Button
                      size="sm"
                      variant={priceZone === 1 ? 'default' : 'ghost'}
                      onClick={() => setPriceZone(1)}
                      className={`h-9 px-4 rounded-lg font-bold text-xs ${priceZone === 1 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                      Zone 1
                    </Button>
                  </div>

                  <Button onClick={addPricingRow} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 px-5 rounded-xl shadow-lg shadow-emerald-600/20">
                    <Plus className="w-4 h-4 mr-1.5" />
                    {tr('Ajouter Ligne', 'إضافة سطر')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 max-w-sm">
                <Search className="w-4 h-4 text-slate-400" />
                <Input
                  value={pricingSearch}
                  onChange={e => setPricingSearch(e.target.value)}
                  placeholder={tr('Filtrer par code ou désignation...', 'بحث سريع بالكود أو الاسم...')}
                  className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-400 h-10 text-xs rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950">
                <Table>
                  <TableHeader className="bg-slate-800/90 border-b border-slate-700">
                    <TableRow>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 w-36">{tr('Code', 'الكود')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4">{tr('Désignation', 'الاسم / الوصف')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 w-44">{tr('Prix Unitaire (DH)', 'سعر البيع')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 w-44">{tr('Prix d\'Achat (DH)', 'سعر الشراء')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 w-32 text-center">{tr('Marge', 'الهامش')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 w-40 text-right">{tr('Actions', 'الإجراءات')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pricingLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-slate-300 font-medium">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                          {tr('Chargement des tarifs...', 'جارٍ تحميل التسعيرات...')}
                        </TableCell>
                      </TableRow>
                    ) : filteredPricing.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                          {tr('Aucun tarif trouvé. Cliquez sur Ajouter Ligne.', 'لا توجد بيانات، اضغط على إضافة سطر.')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPricing.map((row, idx) => {
                        const pu = Number(row.prix_unitaire || 0);
                        const pa = Number(row.prix_achat || 0);
                        const marge = pu - pa;
                        return (
                          <TableRow key={row.id ?? `pricing-${idx}`} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                            <TableCell className="py-3 px-4">
                              <Input
                                value={row.code}
                                onChange={e => updatePricingRow(idx, 'code', e.target.value)}
                                placeholder="6003"
                                className="bg-slate-900 border-slate-700 text-white font-mono font-semibold h-9 text-xs rounded-lg"
                              />
                            </TableCell>
                            <TableCell className="py-3 px-4">
                              <Input
                                value={row.designation}
                                onChange={e => updatePricingRow(idx, 'designation', e.target.value)}
                                placeholder="TISSIR GAZ 12KG"
                                className="bg-slate-900 border-slate-700 text-white font-medium h-9 text-xs rounded-lg"
                              />
                            </TableCell>
                            <TableCell className="py-3 px-4">
                              <Input
                                type="number"
                                step="0.01"
                                value={row.prix_unitaire}
                                onChange={e => updatePricingRow(idx, 'prix_unitaire', e.target.value)}
                                placeholder="0.00"
                                className="bg-slate-900 border-slate-700 text-emerald-400 font-mono font-bold h-9 text-xs rounded-lg text-right"
                              />
                            </TableCell>
                            <TableCell className="py-3 px-4">
                              <Input
                                type="number"
                                step="0.01"
                                value={row.prix_achat}
                                onChange={e => updatePricingRow(idx, 'prix_achat', e.target.value)}
                                placeholder="0.00"
                                className="bg-slate-900 border-slate-700 text-slate-200 font-mono font-medium h-9 text-xs rounded-lg text-right"
                              />
                            </TableCell>
                            <TableCell className="py-3 px-4 text-center">
                              <Badge
                                variant="outline"
                                className={`text-xs font-mono font-bold px-2.5 py-1 ${
                                  marge > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {marge > 0 ? `+${marge.toFixed(2)}` : marge.toFixed(2)}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => savePricingRow(idx)}
                                  disabled={pricingSaving}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-8 text-xs px-3 rounded-lg shadow-sm"
                                >
                                  {tr('Enregistrer', 'حفظ')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deletePricingRow(idx)}
                                  className="border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 h-8 w-8 p-0 rounded-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: ARTICLES DIF */}
        {/* ========================================================================= */}
        <TabsContent value="difs" className="space-y-4 m-0">
          <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
            <CardHeader className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    {tr('Commission Differences (DIF)', 'إدارة فوارق العمولات DIF')}
                  </CardTitle>
                  <CardDescription className="text-slate-300 text-xs">
                    {tr('Gestion précise des écarts et commissions DIF par produit.', 'ضبط ومتابعة نسب وفوارق DIF لكل صنف.')}
                  </CardDescription>
                </div>
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs font-bold px-3 py-1">
                  {difs.length} {tr('Articles DIF', 'أصناف')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {/* Form Box */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-200">{tr('Code', 'الكود')}</Label>
                  <Input
                    value={difForm.code}
                    onChange={e => setDifForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="Ex: 6003"
                    className="bg-slate-900 border-slate-700 text-white font-mono font-semibold h-10 text-xs mt-1.5 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-200">{tr('Désignation', 'اسم الصنف')}</Label>
                  <Input
                    value={difForm.designation}
                    onChange={e => setDifForm(p => ({ ...p, designation: e.target.value }))}
                    placeholder="Ex: TISSIR GAZ CHARGES 3 KG"
                    className="bg-slate-900 border-slate-700 text-white font-medium h-10 text-xs mt-1.5 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-200">{tr('Qté DIF', 'الكمية')}</Label>
                    <Input
                      type="number"
                      value={difForm.qte_dif}
                      onChange={e => setDifForm(p => ({ ...p, qte_dif: e.target.value }))}
                      placeholder="40"
                      className="bg-slate-900 border-slate-700 text-white font-mono font-bold h-10 text-xs mt-1.5 rounded-xl text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-200">{tr('Prix DIF', 'السعر')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={difForm.prix_dif}
                      onChange={e => setDifForm(p => ({ ...p, prix_dif: e.target.value }))}
                      placeholder="0.50"
                      className="bg-slate-900 border-slate-700 text-emerald-400 font-mono font-bold h-10 text-xs mt-1.5 rounded-xl text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons & Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400" />
                  <Input
                    value={difFilter}
                    onChange={e => setDifFilter(e.target.value)}
                    placeholder={tr('Rechercher DIF par code ou nom...', 'بحث سريع بالكود أو الاسم...')}
                    className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-400 h-10 text-xs rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                <div className="flex items-center gap-2.5">
                  {selectedDifId ? (
                    <>
                      <Button onClick={handleDifUpdate} disabled={difsSaving} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-4 rounded-xl shadow-md">
                        <Edit3 className="w-4 h-4 mr-1.5" />
                        {tr('Modifier Sélection', 'تعديل الصنف')}
                      </Button>
                      <Button onClick={handleDifDelete} disabled={difsSaving} variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 font-bold h-10 px-4 rounded-xl">
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        {tr('Supprimer', 'حذف')}
                      </Button>
                      <Button onClick={clearDifForm} variant="outline" className="border-slate-700 text-slate-300 h-10 px-3 rounded-xl font-semibold">
                        <X className="w-4 h-4 mr-1" />
                        {tr('Annuler', 'إلغاء')}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={handleDifAdd} disabled={difsSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 px-5 rounded-xl shadow-lg shadow-emerald-600/20">
                      <Plus className="w-4 h-4 mr-1.5" />
                      {tr('Ajouter DIF', 'إضافة صنف جديد')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950 max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-800/90 border-b border-slate-700 sticky top-0">
                    <TableRow>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6">{tr('Code', 'الكود')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6">{tr('Désignation', 'اسم الصنف')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6 text-center">{tr('Qté DIF', 'الكمية')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6 text-right">{tr('Prix DIF (DH)', 'السعر بالدرهم')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {difsLoading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-300 font-medium">{tr('Chargement...', 'جارٍ التحميل...')}</TableCell></TableRow>
                    ) : filteredDifs.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-400 font-medium">{tr('Aucune donnée DIF.', 'لا توجد بيانات.')}</TableCell></TableRow>
                    ) : (
                      filteredDifs.map(d => (
                        <TableRow
                          key={d.id}
                          onClick={() => {
                            if (selectedDifId === d.id) {
                              clearDifForm();
                            } else {
                              setSelectedDifId(d.id);
                              setDifForm({ code: d.code, designation: d.designation, qte_dif: d.qte_dif, prix_dif: d.prix_dif });
                            }
                          }}
                          className={`cursor-pointer border-b border-slate-800 transition-colors ${
                            selectedDifId === d.id ? 'bg-indigo-600/20 border-l-4 border-l-indigo-500' : 'hover:bg-slate-800/50'
                          }`}
                        >
                          <TableCell className="font-mono font-bold text-indigo-300 py-3.5 px-6">{d.code || '-'}</TableCell>
                          <TableCell className="text-white font-medium py-3.5 px-6">{d.designation || '-'}</TableCell>
                          <TableCell className="text-center font-mono font-bold text-slate-200 py-3.5 px-6">{d.qte_dif || '0'}</TableCell>
                          <TableCell className="text-right font-mono font-black text-emerald-400 py-3.5 px-6">{Number(d.prix_dif || 0).toFixed(2)} DH</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: RESERVOIRS */}
        {/* ========================================================================= */}
        <TabsContent value="reservoirs" className="space-y-4 m-0">
          <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
            <CardHeader className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                    <Layers className="w-5 h-5 text-purple-400" />
                    {tr('Catalogue des Réservoirs', 'كتالوج وأسعار الخزانات')}
                  </CardTitle>
                  <CardDescription className="text-slate-300 text-xs">
                    {tr('Définition des prix et désignations des réservoirs de gaz.', 'ضبط أسعار وتسميات الخزانات.')}
                  </CardDescription>
                </div>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs font-bold px-3 py-1">
                  {reservoirs.length} {tr('Réservoirs', 'خزانات')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {/* Form Box */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-200">{tr('Code', 'الكود')}</Label>
                  <Input
                    value={reservoirForm.code}
                    onChange={e => setReservoirForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="Ex: 9003"
                    className="bg-slate-900 border-slate-700 text-white font-mono font-semibold h-10 text-xs mt-1.5 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-200">{tr('Désignation', 'اسم الخزان')}</Label>
                  <Input
                    value={reservoirForm.designation}
                    onChange={e => setReservoirForm(p => ({ ...p, designation: e.target.value }))}
                    placeholder="Ex: TISSIR GAZ RESERVOIR 03 KG"
                    className="bg-slate-900 border-slate-700 text-white font-medium h-10 text-xs mt-1.5 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-200">{tr('Prix (DH)', 'السعر بالدرهم')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={reservoirForm.prix}
                    onChange={e => setReservoirForm(p => ({ ...p, prix: e.target.value }))}
                    placeholder="30.00"
                    className="bg-slate-900 border-slate-700 text-emerald-400 font-mono font-bold h-10 text-xs mt-1.5 rounded-xl text-right"
                  />
                </div>
              </div>

              {/* Action Buttons & Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400" />
                  <Input
                    value={reservoirFilter}
                    onChange={e => setReservoirFilter(e.target.value)}
                    placeholder={tr('Rechercher réservoir...', 'بحث سريع عن خزان...')}
                    className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-400 h-10 text-xs rounded-xl font-medium focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>

                <div className="flex items-center gap-2.5">
                  {selectedReservoirId ? (
                    <>
                      <Button onClick={handleReservoirUpdate} disabled={reservoirsSaving} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-4 rounded-xl shadow-md">
                        <Edit3 className="w-4 h-4 mr-1.5" />
                        {tr('Modifier', 'تعديل')}
                      </Button>
                      <Button onClick={handleReservoirDelete} disabled={reservoirsSaving} variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 font-bold h-10 px-4 rounded-xl">
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        {tr('Supprimer', 'حذف')}
                      </Button>
                      <Button onClick={clearReservoirForm} variant="outline" className="border-slate-700 text-slate-300 h-10 px-3 rounded-xl font-semibold">
                        <X className="w-4 h-4 mr-1" />
                        {tr('Annuler', 'إلغاء')}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={handleReservoirAdd} disabled={reservoirsSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 px-5 rounded-xl shadow-lg shadow-emerald-600/20">
                      <Plus className="w-4 h-4 mr-1.5" />
                      {tr('Ajouter Réservoir', 'إضافة خزان جديد')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950 max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-800/90 border-b border-slate-700 sticky top-0">
                    <TableRow>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6">{tr('Code', 'الكود')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6">{tr('Désignation', 'اسم الخزان')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6 text-right">{tr('Prix (DH)', 'السعر بالدرهم')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservoirsLoading ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-10 text-slate-300 font-medium">{tr('Chargement...', 'جارٍ التحميل...')}</TableCell></TableRow>
                    ) : filteredReservoirs.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-10 text-slate-400 font-medium">{tr('Aucun réservoir trouvé.', 'لا توجد بيانات.')}</TableCell></TableRow>
                    ) : (
                      filteredReservoirs.map(r => (
                        <TableRow
                          key={r.id}
                          onClick={() => {
                            if (selectedReservoirId === r.id) {
                              clearReservoirForm();
                            } else {
                              setSelectedReservoirId(r.id);
                              setReservoirForm({ code: r.code, designation: r.designation, prix: r.prix });
                            }
                          }}
                          className={`cursor-pointer border-b border-slate-800 transition-colors ${
                            selectedReservoirId === r.id ? 'bg-indigo-600/20 border-l-4 border-l-indigo-500' : 'hover:bg-slate-800/50'
                          }`}
                        >
                          <TableCell className="font-mono font-bold text-purple-300 py-3.5 px-6">{r.code || '-'}</TableCell>
                          <TableCell className="text-white font-medium py-3.5 px-6">{r.designation || '-'}</TableCell>
                          <TableCell className="text-right font-mono font-black text-emerald-400 py-3.5 px-6">{Number(r.prix || 0).toFixed(2)} DH</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 4: SECTEURS & AFFECTATIONS */}
        {/* ========================================================================= */}
        <TabsContent value="sectors" className="space-y-6 m-0">
          <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
            <CardHeader className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                    <MapPin className="w-5 h-5 text-sky-400" />
                    {tr('Gestion des Secteurs de Distribution', 'إدارة قطاعات التوزيع')}
                  </CardTitle>
                  <CardDescription className="text-slate-300 text-xs">
                    {tr('Créez et organisez vos zones de livraison par ville et région.', 'إنشاء وتنظيم قطاعات التوزيع حسب المدينة والجهة.')}
                  </CardDescription>
                </div>
                <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs font-bold px-3 py-1">
                  {sectors.length} {tr('Secteurs', 'قطاعات')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {/* Form Box */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-200">{tr('Code', 'الكود')}</Label>
                  <Input
                    value={sectorForm.code}
                    onChange={e => setSectorForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="Ex: S210"
                    className="bg-slate-900 border-slate-700 text-white font-mono font-semibold h-10 text-xs mt-1.5 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-200">{tr('Secteur', 'اسم القطاع')}</Label>
                  <Input
                    value={sectorForm.secteurs}
                    onChange={e => setSectorForm(p => ({ ...p, secteurs: e.target.value }))}
                    placeholder="Ex: OULED SAID"
                    className="bg-slate-900 border-slate-700 text-white font-medium h-10 text-xs mt-1.5 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-200">{tr('Ville', 'المدينة')}</Label>
                  <Input
                    value={sectorForm.ville}
                    onChange={e => setSectorForm(p => ({ ...p, ville: e.target.value }))}
                    placeholder="Ex: BENI MELLAL"
                    className="bg-slate-900 border-slate-700 text-white font-medium h-10 text-xs mt-1.5 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-200">{tr('Région', 'الجهة')}</Label>
                  <Input
                    value={sectorForm.region}
                    onChange={e => setSectorForm(p => ({ ...p, region: e.target.value }))}
                    placeholder="Ex: 200"
                    className="bg-slate-900 border-slate-700 text-white font-mono font-medium h-10 text-xs mt-1.5 rounded-xl"
                  />
                </div>
              </div>

              {/* Action Buttons & Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400" />
                  <Input
                    value={sectorFilter}
                    onChange={e => setSectorFilter(e.target.value)}
                    placeholder={tr('Rechercher secteur, ville...', 'بحث عن قطاع أو مدينة...')}
                    className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-400 h-10 text-xs rounded-xl font-medium focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div className="flex items-center gap-2.5">
                  {selectedSectorId ? (
                    <>
                      <Button onClick={handleSectorUpdate} disabled={sectorsSaving} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-4 rounded-xl shadow-md">
                        <Edit3 className="w-4 h-4 mr-1.5" />
                        {tr('Modifier', 'تعديل')}
                      </Button>
                      <Button onClick={handleSectorDelete} disabled={sectorsSaving} variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 font-bold h-10 px-4 rounded-xl">
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        {tr('Supprimer', 'حذف')}
                      </Button>
                      <Button onClick={clearSectorForm} variant="outline" className="border-slate-700 text-slate-300 h-10 px-3 rounded-xl font-semibold">
                        <X className="w-4 h-4 mr-1" />
                        {tr('Annuler', 'إلغاء')}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={handleSectorAdd} disabled={sectorsSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 px-5 rounded-xl shadow-lg shadow-emerald-600/20">
                      <Plus className="w-4 h-4 mr-1.5" />
                      {tr('Ajouter Secteur', 'إضافة قطاع جديد')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Sectors Table */}
              <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950 max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-800/90 border-b border-slate-700 sticky top-0">
                    <TableRow>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6">{tr('Code', 'الكود')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6">{tr('Secteurs', 'اسم القطاع')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6">{tr('Ville', 'المدينة')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6">{tr('Région', 'الجهة')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sectorsLoading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-300 font-medium">{tr('Chargement...', 'جارٍ التحميل...')}</TableCell></TableRow>
                    ) : filteredSectors.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-400 font-medium">{tr('Aucun secteur trouvé.', 'لا توجد قطاعات.')}</TableCell></TableRow>
                    ) : (
                      filteredSectors.map(s => (
                        <TableRow
                          key={s.id}
                          onClick={() => {
                            if (selectedSectorId === s.id) {
                              clearSectorForm();
                            } else {
                              setSelectedSectorId(s.id);
                              setSectorForm({ code: s.code, secteurs: s.secteurs, ville: s.ville, region: s.region });
                            }
                          }}
                          className={`cursor-pointer border-b border-slate-800 transition-colors ${
                            selectedSectorId === s.id ? 'bg-indigo-600/20 border-l-4 border-l-indigo-500' : 'hover:bg-slate-800/50'
                          }`}
                        >
                          <TableCell className="font-mono font-bold text-sky-300 py-3.5 px-6">{s.code || '-'}</TableCell>
                          <TableCell className="text-white font-medium py-3.5 px-6">{s.secteurs || '-'}</TableCell>
                          <TableCell className="text-slate-200 py-3.5 px-6">{s.ville || '-'}</TableCell>
                          <TableCell className="text-slate-400 font-mono py-3.5 px-6">{s.region || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Driver Sectors Assignment */}
          <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
            <CardHeader className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                <Users className="w-5 h-5 text-indigo-400" />
                {tr('Affectation Chauffeurs → Secteurs', 'تعيين وتخصيص القطاعات للسائقين')}
              </CardTitle>
              <CardDescription className="text-slate-300 text-xs">
                {tr('Sélectionnez les secteurs desservis par chaque chauffeur.', 'حدد القطاعات التابعة لكل سائق بنقرات سريعة.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950">
                <Table>
                  <TableHeader className="bg-slate-800/90 border-b border-slate-700">
                    <TableRow>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6">{tr('Chauffeur', 'السائق')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4">{tr('Code', 'الكود')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4">{tr('Secteurs attribués', 'القطاعات المخصصة')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-6 text-right">{tr('Action', 'إجراء')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.map(driver => (
                      <TableRow key={`assign-${driver.id}`} className="hover:bg-slate-800/50 border-b border-slate-800 transition-colors">
                        <TableCell className="py-4 px-6">
                          <div className="font-bold text-white text-sm">{driver.name}</div>
                        </TableCell>
                        <TableCell className="py-4 px-4">
                          <Badge variant="outline" className="font-mono text-xs border-slate-700 bg-slate-800 text-indigo-300">
                            {driver.code || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-4 max-w-md">
                          <div className="max-h-36 overflow-y-auto p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                            {sectors.length === 0 ? (
                              <span className="text-xs text-slate-500 font-medium">{tr('Aucun secteur disponible', 'لا توجد قطاعات')}</span>
                            ) : (
                              sectors.map(sec => {
                                const checked = (driverSectorAssignments[driver.id] || []).includes(sec.id);
                                return (
                                  <label key={`sec-${driver.id}-${sec.id}`} className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer font-medium hover:text-white">
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={state => {
                                        setDriverSectorAssignments(prev => {
                                          const curr = prev[driver.id] || [];
                                          const next = state ? Array.from(new Set([...curr, sec.id])) : curr.filter(id => id !== sec.id);
                                          return { ...prev, [driver.id]: next };
                                        });
                                      }}
                                      className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                    />
                                    <span>{sec.code || '-'} · {sec.secteurs} {sec.ville ? `(${sec.ville})` : ''}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right">
                          <Button
                            size="sm"
                            onClick={() => saveDriverSectorAssignment(driver.id)}
                            disabled={driverSectorSavingId === driver.id}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-9 px-4 rounded-xl shadow-sm"
                          >
                            {driverSectorSavingId === driver.id ? tr('Enregistrement...', 'جارٍ الحفظ...') : tr('Enregistrer', 'حفظ')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 5: SEUILS & ALERTES */}
        {/* ========================================================================= */}
        <TabsContent value="thresholds" className="space-y-6 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Debt Thresholds */}
            <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
              <CardHeader className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  {tr('Seuil de Dette par Chauffeur', 'سقف ديون السائقين')}
                </CardTitle>
                <CardDescription className="text-slate-300 text-xs">
                  {tr('Dès que la dette dépasse le seuil, le chauffeur passe automatiquement en statut Clôturé.', 'عند تجاوز الدين للسقف، يتم قفل الحساب آلياً.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950">
                  <Table>
                    <TableHeader className="bg-slate-800/90 border-b border-slate-700">
                      <TableRow>
                        <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4">{tr('Chauffeur', 'السائق')}</TableHead>
                        <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4">{tr('Dette Actuelle', 'الدين الحالي')}</TableHead>
                        <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 w-36">{tr('Seuil (DH)', 'السقف بالدرهم')}</TableHead>
                        <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 text-center">{tr('État', 'الحالة')}</TableHead>
                        <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 text-right">{tr('Action', 'إجراء')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drivers.map(driver => {
                        const debt = Number(driver.debt || 0);
                        const threshold = Number(driver.debtThreshold || 0);
                        const isClosed = threshold > 0 && debt >= threshold;
                        return (
                          <TableRow key={`debt-${driver.id}`} className="hover:bg-slate-800/50 border-b border-slate-800 transition-colors">
                            <TableCell className="font-bold text-white py-3.5 px-4">{driver.name}</TableCell>
                            <TableCell className={`font-mono font-bold py-3.5 px-4 ${debt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {debt.toLocaleString()} DH
                            </TableCell>
                            <TableCell className="py-3.5 px-4">
                              <Input
                                type="number"
                                min="0"
                                value={thresholdDrafts[driver.id] ?? ''}
                                onChange={e => setThresholdDrafts(p => ({ ...p, [driver.id]: e.target.value }))}
                                placeholder="5000"
                                className="bg-slate-900 border-slate-700 text-white font-mono font-bold h-9 text-xs text-right rounded-lg"
                              />
                            </TableCell>
                            <TableCell className="py-3.5 px-4 text-center">
                              <Badge
                                className={`text-xs font-bold px-2.5 py-1 ${
                                  isClosed
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                }`}
                              >
                                {isClosed ? tr('Clôturé', 'مقفل') : tr('Ouvert', 'مفتوح')}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3.5 px-4 text-right">
                              <Button
                                size="sm"
                                onClick={() => saveDriverThreshold(driver.id)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-8 text-xs px-3 rounded-lg shadow-sm"
                              >
                                {tr('Sauver', 'حفظ')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Foreign Bottles Thresholds */}
            <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
              <CardHeader className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-purple-400" />
                  {tr('Seuil Bouteilles Étrangères', 'سقف القنينات الأجنبية')}
                </CardTitle>
                <CardDescription className="text-slate-300 text-xs">
                  {tr('Alerte et clôture automatique en cas d\'excès de bouteilles étrangères.', 'إشعار وقفل آلي عند تراكم القنينات الأجنبية.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950">
                  <Table>
                    <TableHeader className="bg-slate-800/90 border-b border-slate-700">
                      <TableRow>
                        <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4">{tr('Chauffeur', 'السائق')}</TableHead>
                        <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4">{tr('Total Étrangères', 'الأجنبية الحالية')}</TableHead>
                        <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 w-36">{tr('Seuil (Qté)', 'السقف (عدد)')}</TableHead>
                        <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 text-center">{tr('État', 'الحالة')}</TableHead>
                        <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 text-right">{tr('Action', 'إجراء')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drivers.map(driver => {
                        const count = Number(driver.totalForeignBottles || 0);
                        const threshold = Number(driver.foreignBottlesThreshold || 0);
                        const isClosed = threshold > 0 && count >= threshold;
                        return (
                          <TableRow key={`foreign-${driver.id}`} className="hover:bg-slate-800/50 border-b border-slate-800 transition-colors">
                            <TableCell className="font-bold text-white py-3.5 px-4">{driver.name}</TableCell>
                            <TableCell className={`font-mono font-bold py-3.5 px-4 ${count > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                              {count}
                            </TableCell>
                            <TableCell className="py-3.5 px-4">
                              <Input
                                type="number"
                                min="0"
                                value={foreignThresholdDrafts[driver.id] ?? ''}
                                onChange={e => setForeignThresholdDrafts(p => ({ ...p, [driver.id]: e.target.value }))}
                                placeholder="40"
                                className="bg-slate-900 border-slate-700 text-white font-mono font-bold h-9 text-xs text-right rounded-lg"
                              />
                            </TableCell>
                            <TableCell className="py-3.5 px-4 text-center">
                              <Badge
                                className={`text-xs font-bold px-2.5 py-1 ${
                                  isClosed
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                }`}
                              >
                                {isClosed ? tr('Clôturé', 'مقفل') : tr('Normal', 'عادي')}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3.5 px-4 text-right">
                              <Button
                                size="sm"
                                onClick={() => saveDriverForeignThreshold(driver.id)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-8 text-xs px-3 rounded-lg shadow-sm"
                              >
                                {tr('Sauver', 'حفظ')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 6: COMMISSIONS & SITUATION */}
        {/* ========================================================================= */}
        <TabsContent value="commissions" className="space-y-4 m-0">
          <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
            <CardHeader className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    {tr('Situation des Commissions & Rémunération des Livreurs', 'وضعية العمولات وأجور السائقين')}
                  </CardTitle>
                  <CardDescription className="text-slate-300 text-xs">
                    {tr('Calcul automatique : Nbv (Bons), Nbj (Jours actifs), MtJ (Jours), MTv (Voyages), Comm, Salaire, Primes.', 'حساب تلقائي حسب فترات العمل مع إمكانية تعديل وحفظ ثوابت كل سائق.')}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 bg-slate-950 p-2 rounded-xl border border-slate-800 shadow-inner">
                    <Label className="text-xs font-bold text-slate-300 ml-1">{tr('Du', 'من')}</Label>
                    <Input
                      type="date"
                      value={commissionFromDate}
                      onChange={e => setCommissionFromDate(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white font-mono h-9 text-xs w-36 rounded-lg"
                    />
                    <Label className="text-xs font-bold text-slate-300">{tr('Au', 'إلى')}</Label>
                    <Input
                      type="date"
                      value={commissionToDate}
                      onChange={e => setCommissionToDate(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white font-mono h-9 text-xs w-36 rounded-lg"
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(1);
                      setCommissionFromDate(d.toISOString().slice(0, 10));
                      setCommissionToDate(new Date().toISOString().slice(0, 10));
                    }}
                    className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 font-semibold text-xs h-10 px-3 rounded-xl"
                  >
                    {tr('Mois en cours', 'هذا الشهر')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="rounded-xl border border-slate-700 overflow-x-auto bg-slate-950">
                <Table>
                  <TableHeader className="bg-slate-800/90 border-b border-slate-700">
                    <TableRow>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 min-w-[180px]">{tr('Livreur', 'السائق')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-3 text-center w-16">Nbv</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-3 text-center w-16">Nbj</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-3 text-right w-24">MtJ</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-3 text-right w-24">MTv</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-3 w-24">SaJ</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-3 w-24">SaV</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-3 w-24">Comm</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-3 w-28">{tr('Salaire', 'الراتب')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-3 text-right w-28">{tr('Sous-total', 'المجموع')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-3 w-28">{tr('Primes', 'المنح')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 text-right w-36 font-black text-emerald-400">{tr('Total Général', 'الإجمالي العام')}</TableHead>
                      <TableHead className="text-white font-bold text-xs uppercase tracking-wider py-4 px-4 text-right w-28">{tr('Action', 'إجراء')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionRows.length === 0 ? (
                      <TableRow><TableCell colSpan={13} className="text-center py-10 text-slate-400 font-medium">{tr('Aucun chauffeur actif.', 'لا يوجد سائقون.')}</TableCell></TableRow>
                    ) : (
                      commissionRows.map(row => (
                        <TableRow key={`comm-${row.driverId}`} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                          <TableCell className="py-3.5 px-4">
                            <div className="font-bold text-white text-sm">{row.driverName}</div>
                            {row.driverCode && <div className="text-[11px] font-mono text-slate-400 mt-0.5">{row.driverCode}</div>}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-slate-200 py-3.5 px-3">{row.nbv}</TableCell>
                          <TableCell className="text-center font-mono font-bold text-slate-200 py-3.5 px-3">{row.nbj}</TableCell>
                          <TableCell className="text-right font-mono text-slate-300 py-3.5 px-3">{row.mtJ.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-slate-300 py-3.5 px-3">{row.mtV.toFixed(2)}</TableCell>
                          <TableCell className="py-3.5 px-3">
                            <Input
                              type="number"
                              step="0.01"
                              value={driverCommissionDrafts[row.driverId]?.saJ ?? ''}
                              onChange={e => setDriverCommissionDrafts(p => ({
                                ...p,
                                [row.driverId]: { ...(p[row.driverId] || { saJ: '', saV: '', comm: '', salaire: '', primes: '' }), saJ: e.target.value }
                              }))}
                              placeholder="0"
                              className="bg-slate-900 border-slate-700 text-white font-mono font-bold h-8 text-xs text-right rounded-lg"
                            />
                          </TableCell>
                          <TableCell className="py-3.5 px-3">
                            <Input
                              type="number"
                              step="0.01"
                              value={driverCommissionDrafts[row.driverId]?.saV ?? ''}
                              onChange={e => setDriverCommissionDrafts(p => ({
                                ...p,
                                [row.driverId]: { ...(p[row.driverId] || { saJ: '', saV: '', comm: '', salaire: '', primes: '' }), saV: e.target.value }
                              }))}
                              placeholder="0"
                              className="bg-slate-900 border-slate-700 text-white font-mono font-bold h-8 text-xs text-right rounded-lg"
                            />
                          </TableCell>
                          <TableCell className="py-3.5 px-3">
                            <Input
                              type="number"
                              step="0.01"
                              value={driverCommissionDrafts[row.driverId]?.comm ?? ''}
                              onChange={e => setDriverCommissionDrafts(p => ({
                                ...p,
                                [row.driverId]: { ...(p[row.driverId] || { saJ: '', saV: '', comm: '', salaire: '', primes: '' }), comm: e.target.value }
                              }))}
                              placeholder="0"
                              className="bg-slate-900 border-slate-700 text-white font-mono font-bold h-8 text-xs text-right rounded-lg"
                            />
                          </TableCell>
                          <TableCell className="py-3.5 px-3">
                            <Input
                              type="number"
                              step="0.01"
                              value={driverCommissionDrafts[row.driverId]?.salaire ?? ''}
                              onChange={e => setDriverCommissionDrafts(p => ({
                                ...p,
                                [row.driverId]: { ...(p[row.driverId] || { saJ: '', saV: '', comm: '', salaire: '', primes: '' }), salaire: e.target.value }
                              }))}
                              placeholder="0"
                              className="bg-slate-900 border-slate-700 text-white font-mono font-bold h-8 text-xs text-right rounded-lg"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-slate-100 py-3.5 px-3">{row.total.toFixed(2)}</TableCell>
                          <TableCell className="py-3.5 px-3">
                            <Input
                              type="number"
                              step="0.01"
                              value={driverCommissionDrafts[row.driverId]?.primes ?? ''}
                              onChange={e => setDriverCommissionDrafts(p => ({
                                ...p,
                                [row.driverId]: { ...(p[row.driverId] || { saJ: '', saV: '', comm: '', salaire: '', primes: '' }), primes: e.target.value }
                              }))}
                              placeholder="0"
                              className="bg-slate-900 border-slate-700 text-white font-mono font-bold h-8 text-xs text-right rounded-lg"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono font-black text-emerald-400 py-3.5 px-4 text-sm">{row.totalGeneral.toFixed(2)}</TableCell>
                          <TableCell className="text-right py-3.5 px-4">
                            <Button
                              size="sm"
                              onClick={() => saveDriverCommissionDraft(row.driverId)}
                              disabled={commissionSavingId === row.driverId}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-8 text-xs px-3 rounded-lg shadow-sm"
                            >
                              {commissionSavingId === row.driverId ? tr('...', '...') : tr('Enregistrer', 'حفظ')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}

                    {/* Total Row */}
                    <TableRow className="bg-slate-800/90 font-bold border-t-2 border-slate-600">
                      <TableCell className="text-white font-black py-4 px-4">{tr('TOTAL GLOBAL', 'الإجمالي العام')}</TableCell>
                      <TableCell className="text-center font-mono font-black text-white py-4 px-3">{commissionTotals.nbv}</TableCell>
                      <TableCell className="text-center font-mono font-black text-white py-4 px-3">{commissionTotals.nbj}</TableCell>
                      <TableCell className="text-right font-mono font-black text-slate-200 py-4 px-3">{commissionTotals.mtJ.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-black text-slate-200 py-4 px-3">{commissionTotals.mtV.toFixed(2)}</TableCell>
                      <TableCell colSpan={4} />
                      <TableCell className="text-right font-mono font-black text-white py-4 px-3">{commissionTotals.total.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-black text-slate-200 py-4 px-3">{commissionTotals.primes.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-black text-emerald-300 py-4 px-4 text-base">{commissionTotals.totalGeneral.toFixed(2)} DH</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 7: COMPTES CHAUFFEURS MOBILE POINT DE VENTE (APPLICATION ANDROID)     */}
        {/* ========================================================================= */}
        <TabsContent value="driver_pos" className="space-y-6 m-0">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-2 border-emerald-500/50 rounded-3xl p-6 text-white shadow-2xl backdrop-blur-md">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/40 shadow-inner">
                  <Smartphone className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl md:text-2xl font-black text-white">
                      {tr('Comptes Chauffeurs Mobile - Point de Vente Gaz', 'حسابات سائقي تطبيق أندرويد لتوزيع الغاز')}
                    </h2>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 text-xs font-bold">
                      {tr('Application Android & Web Sync', 'تطبيق أندرويد متزامن')}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    {tr(
                      'Créez et gérez les identifiants d\'accès (Email & Mot de passe) des chauffeurs pour l\'application Android de distribution de gaz. Chaque chauffeur peut ainsi charger son Bon de Sortie, suivre son trajet sur la carte, vendre aux points de vente et clôturer sa tournée pour générer automatiquement le retour.',
                      'قم بإنشاء وإدارة حسابات السائقين (البريد الإلكتروني وكلمة المرور) لتطبيق أندرويد الخاص بتوزيع الغاز. يتيح للسائق فتح سند الخروج وتتبع مساره والبيع المباشر وإغلاق الجولة لتسجيل الرجوع تلقائياً.'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <a
                  href="/mobile/pos"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-3 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 text-sm w-full lg:w-auto"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{tr('Ouvrir Application Mobile (/mobile/pos)', 'فتح تطبيق الهاتف')}</span>
                </a>
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadDriverPosAccounts}
                  className="border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
                >
                  <RefreshCw className={`w-4 h-4 ${driverPosLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Card */}
            <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
              <CardHeader className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                  <span>
                    {driverPosEditingId
                      ? tr('Modifier le Compte Chauffeur', 'تعديل حساب السائق')
                      : tr('Nouveau Compte Chauffeur Mobile', 'إضافة حساب سائق جديد')}
                  </span>
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  {tr('Associez un chauffeur de la flotte à des accès mobiles SFT GAZ', 'ربط سائق من الأسطول ببيانات دخول الهاتف')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSaveDriverPosAccount} className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 block">
                      {tr('Chauffeur SFT GAZ', 'السائق')} *
                    </Label>
                    <select
                      value={selectedDriverForPos}
                      onChange={(e) => handleSelectDriverForPos(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:border-emerald-500 focus:outline-none"
                      required
                    >
                      <option value="">{tr('-- Sélectionner un chauffeur --', '-- اختر سائقاً --')}</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.phone ? `(${d.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 block">
                      {tr('Email de Connexion Android', 'البريد الإلكتروني لتسجيل الدخول')} *
                    </Label>
                    <div className="relative">
                      <Input
                        type="email"
                        value={driverPosEmail}
                        onChange={(e) => setDriverPosEmail(e.target.value)}
                        placeholder="chauffeur@sftgaz.ma"
                        className="bg-slate-950 border-slate-700 text-white font-mono text-sm pr-9"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        {tr('Mot de Passe', 'كلمة المرور')} *
                      </Label>
                      <button
                        type="button"
                        onClick={() => setDriverPosPassword(Math.random().toString(36).slice(-8) + '!')}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold"
                      >
                        {tr('Générer aléatoire', 'توليد تلقائي')}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        type={showDriverPosPassword ? 'text' : 'password'}
                        value={driverPosPassword}
                        onChange={(e) => setDriverPosPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-slate-950 border-slate-700 text-white font-mono text-sm pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowDriverPosPassword(!showDriverPosPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showDriverPosPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="driver-pos-active"
                        checked={driverPosActive}
                        onCheckedChange={(checked) => setDriverPosActive(Boolean(checked))}
                        className="data-[state=checked]:bg-emerald-600 border-slate-600"
                      />
                      <Label htmlFor="driver-pos-active" className="text-xs font-bold text-white cursor-pointer">
                        {tr('Compte Actif (Autorisé à se connecter)', 'حساب مفعل (مسموح بالدخول)')}
                      </Label>
                    </div>
                    <Badge className={driverPosActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]' : 'bg-red-500/20 text-red-300 border-red-500/40 text-[10px]'}>
                      {driverPosActive ? tr('Actif', 'مفعل') : tr('Bloqué', 'معطل')}
                    </Badge>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      type="submit"
                      disabled={driverPosSaving}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl shadow-lg shadow-emerald-900/30"
                    >
                      {driverPosSaving ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      <span>
                        {driverPosEditingId
                          ? tr('Mettre à jour le compte', 'تحديث الحساب')
                          : tr('Créer le compte Chauffeur', 'إنشاء الحساب')}
                      </span>
                    </Button>
                    {driverPosEditingId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setDriverPosEditingId(null);
                          setSelectedDriverForPos('');
                          setDriverPosEmail('');
                          setDriverPosPassword('');
                          setDriverPosActive(true);
                        }}
                        className="border-slate-700 bg-slate-950 text-slate-300"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Accounts Table Card */}
            <Card className="lg:col-span-2 border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md flex flex-col">
              <CardHeader className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <span>{tr('Liste des Comptes Chauffeurs Mobile', 'قائمة حسابات السائقين')}</span>
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    {tr('Chauffeurs configurés pour l\'application Android Point de Vente', 'السائقون المهيئون لتطبيق نقط البيع')}
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-emerald-400 border border-slate-700 font-bold px-3 py-1">
                  {driverPosAccounts.length} {tr('comptes', 'حساب')}
                </Badge>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-950/80">
                    <TableRow className="border-b border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs font-bold uppercase">{tr('Chauffeur', 'السائق')}</TableHead>
                      <TableHead className="text-slate-400 text-xs font-bold uppercase">{tr('Identifiants (Email / Mot de passe)', 'البريد وكلمة المرور')}</TableHead>
                      <TableHead className="text-slate-400 text-xs font-bold uppercase text-center">{tr('Statut', 'الحالة')}</TableHead>
                      <TableHead className="text-slate-400 text-xs font-bold uppercase text-center">{tr('Dernière Connexion', 'آخر دخول')}</TableHead>
                      <TableHead className="text-slate-400 text-xs font-bold uppercase text-right">{tr('Actions', 'الإجراءات')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driverPosAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                          <Smartphone className="w-10 h-10 mx-auto mb-2 text-slate-600 opacity-50" />
                          <p className="text-sm font-medium">{tr('Aucun compte chauffeur configuré pour le moment.', 'لا يوجد حسابات سائقين مهيأة حالياً.')}</p>
                          <p className="text-xs text-slate-600 mt-1">{tr('Utilisez le formulaire à gauche pour en créer un.', 'استخدم النموذج لإنشاء أول حساب.')}</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      driverPosAccounts.map((acc) => (
                        <TableRow key={acc.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                          <TableCell className="py-3 px-4">
                            <div className="font-bold text-white text-sm">{acc.driverName}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                              <Truck className="w-3 h-3 text-slate-500" />
                              <span>ID: {acc.driverId.slice(0, 8)}...</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4">
                            <div className="font-mono text-emerald-400 text-xs font-bold">{acc.email}</div>
                            <div className="font-mono text-slate-400 text-[11px] mt-0.5">
                              {acc.password ? `PW: ${acc.password}` : '••••••••'}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleDriverPosStatus(acc)}
                              className="focus:outline-none"
                            >
                              <Badge className={acc.isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-bold cursor-pointer hover:bg-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/40 text-xs font-bold cursor-pointer hover:bg-red-500/30'}>
                                {acc.isActive ? tr('Actif', 'مفعل') : tr('Inactif', 'معطل')}
                              </Badge>
                            </button>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center text-xs text-slate-400 font-mono">
                            {acc.lastLogin ? new Date(acc.lastLogin).toLocaleDateString() : tr('Jamais', 'أبداً')}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditDriverPos(acc)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                                title={tr('Modifier', 'تعديل')}
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteDriverPos(acc.id, acc.driverName)}
                                className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/40"
                                title={tr('Supprimer', 'حذف')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
