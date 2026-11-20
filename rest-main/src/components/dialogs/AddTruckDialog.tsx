import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, Truck, User, Hash, Radio, Navigation, CheckCircle2, RefreshCw, Satellite } from 'lucide-react';
import { toast } from 'sonner';
import { KNOWN_GPS_FALLBACK_VEHICLES, getLiveGpsVehicles } from '@/lib/gpswoxService';

interface AddTruckDialogProps {
  trigger?: React.ReactNode;
}

export const AddTruckDialog = ({ trigger }: AddTruckDialogProps) => {
  const { addTruck, drivers = [] } = useApp();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);

  const availableDrivers = drivers.filter((driver: any) => !driver.isUnavailable);
  const [open, setOpen] = useState(false);
  const [selectedGpsVehicle, setSelectedGpsVehicle] = useState<string>('');
  const [gpsVehicles, setGpsVehicles] = useState<string[]>(KNOWN_GPS_FALLBACK_VEHICLES);
  const [loadingGps, setLoadingGps] = useState(false);

  const [formData, setFormData] = useState({
    matricule: '',
    driverId: '',
    truckType: 'camion' as 'camion' | 'remorque' | 'petit-camion' | 'clark'
  });

  // Charger les véhicules GPS à l'ouverture du dialogue
  useEffect(() => {
    let active = true;
    const loadGps = async () => {
      setLoadingGps(true);
      try {
        const live = await getLiveGpsVehicles();
        if (active && live.length > 0) {
          const names = Array.from(
            new Set([
              ...live.map((v) => v.name.trim()).filter(Boolean),
              ...KNOWN_GPS_FALLBACK_VEHICLES,
            ])
          );
          setGpsVehicles(names);
        }
      } catch (e) {
        // En cas d'erreur réseau, la liste KNOWN_GPS_FALLBACK_VEHICLES reste immédiatement active
      } finally {
        if (active) setLoadingGps(false);
      }
    };

    if (open) {
      loadGps();
    }
    return () => {
      active = false;
    };
  }, [open]);

  // Lors de la sélection d'un véhicule GPS, remplir automatiquement la Matricule
  const handleGpsSelect = (vehicleName: string) => {
    setSelectedGpsVehicle(vehicleName);
    if (!vehicleName || vehicleName === '__manual__') {
      return;
    }

    const cleanName = vehicleName.trim();
    const lower = cleanName.toLowerCase();
    let suggestedType = formData.truckType;

    if (lower.includes('allo') || lower.includes('l 200') || lower.includes('petit')) {
      suggestedType = 'petit-camion';
    } else if (lower.includes('remorque')) {
      suggestedType = 'remorque';
    } else if (lower.includes('clark')) {
      suggestedType = 'clark';
    } else if (lower.includes('canter') || lower.includes('fighter') || lower.includes('isu') || lower.includes('renault')) {
      suggestedType = 'camion';
    }

    setFormData((prev) => ({
      ...prev,
      matricule: cleanName,
      truckType: suggestedType,
    }));

    toast.info(
      tr(
        `Matricule renseignée : ${cleanName}`,
        `تم ملء رقم الشاحنة: ${cleanName}`
      )
    );
  };

  const handleRefreshGps = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoadingGps(true);
    try {
      const live = await getLiveGpsVehicles();
      if (live.length > 0) {
        const names = Array.from(
          new Set([
            ...live.map((v) => v.name.trim()).filter(Boolean),
            ...KNOWN_GPS_FALLBACK_VEHICLES,
          ])
        );
        setGpsVehicles(names);
        toast.success(tr(`${names.length} balises GPS synchronisées`, `تمت مزامنة ${names.length} جهاز GPS`));
      }
    } finally {
      setLoadingGps(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.matricule.trim()) {
      toast.error(tr('Veuillez renseigner un matricule', 'يرجى إدخال رقم الشاحنة'));
      return;
    }

    if (!formData.driverId) {
      toast.error(tr('Veuillez sélectionner un chauffeur', 'يرجى اختيار سائق'));
      return;
    }

    addTruck({
      id: window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      matricule: formData.matricule.trim(),
      driverId: formData.driverId,
      truckType: formData.truckType,
      isActive: true,
      currentLoad: [],
      updatedAt: new Date().toISOString(),
      nextReturnDate: undefined,
      reposReason: undefined,
      techStatus: 'operational',
    });

    toast.success(tr('Camion ajouté avec succès', 'تمت إضافة الشاحنة بنجاح'));
    setOpen(false);
    setFormData({ matricule: '', driverId: '', truckType: 'camion' });
    setSelectedGpsVehicle('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all rounded-xl h-11 px-6 font-bold">
            <Plus className="w-5 h-5 mr-2" />
            {tr('Ajouter un camion', 'إضافة شاحنة')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 border-none overflow-hidden shadow-2xl">
        <div className="bg-indigo-600 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white">
                  {tr('Nouveau Camion', 'شاحنة جديدة')}
                </DialogTitle>
                <p className="text-indigo-100 text-xs mt-0.5">
                  {tr('Enregistrer un véhicule dans la flotte', 'تسجيل مركبة جديدة في الأسطول')}
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white">
          {/* 1. SÉLECTION VÉHICULE GPS */}
          <div className="space-y-1.5 p-3 rounded-xl border border-cyan-200 bg-cyan-50/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="gpsVehicle" className="text-xs font-bold text-cyan-900 flex items-center gap-1.5">
                <Satellite className="w-4 h-4 text-cyan-600" />
                <span>{tr('Véhicule GPS (GPSwox)', 'مركبة GPS (GPSwox)')}</span>
              </Label>
              <button
                type="button"
                onClick={handleRefreshGps}
                disabled={loadingGps}
                className="text-[11px] font-medium text-cyan-700 hover:text-cyan-900 flex items-center gap-1 transition-colors"
                title={tr('Actualiser la liste GPS', 'تحديث قائمة GPS')}
              >
                <RefreshCw className={`w-3 h-3 ${loadingGps ? 'animate-spin' : ''}`} />
                <span>{loadingGps ? tr('Chargement...', 'تحميل...') : tr('Actualiser', 'تحديث')}</span>
              </button>
            </div>

            <Select value={selectedGpsVehicle} onValueChange={handleGpsSelect}>
              <SelectTrigger
                id="gpsVehicle"
                className="h-10 bg-white border-cyan-300 focus:ring-2 focus:ring-cyan-500 rounded-lg text-xs font-semibold text-slate-800"
              >
                <div className="flex items-center gap-2 truncate">
                  <Navigation className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                  <SelectValue
                    placeholder={tr(
                      'Sélectionner une balise GPS (Ex: Canter 32607 A 57)...',
                      'اختر مركبة GPS (مثال: Canter 32607 A 57)...'
                    )}
                  />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 shadow-xl max-h-56">
                <SelectItem value="__manual__" className="rounded-lg text-slate-500 font-medium italic text-xs">
                  {tr('— Aucun (Saisie manuelle libre) —', '— بدون (إدخال يدوي حر) —')}
                </SelectItem>
                {gpsVehicles.map((name) => (
                  <SelectItem key={name} value={name} className="rounded-lg font-medium text-xs">
                    <div className="flex items-center justify-between w-full gap-3">
                      <span className="font-bold text-slate-900">{name}</span>
                      <span className="text-[10px] bg-cyan-100 text-cyan-800 font-bold px-1.5 py-0.5 rounded">
                        GPS
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-cyan-800/80 leading-tight">
              {tr(
                '💡 Choisissez un véhicule GPS pour remplir automatiquement le Matricule ci-dessous.',
                '💡 اختر مركبة GPS لتعبئة خانة الترقيم (Matricule) تلقائياً بالاسم المختار.'
              )}
            </p>
          </div>

          {/* 2. MATRICULE */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between ml-1">
              <Label htmlFor="matricule" className="text-slate-700 font-semibold text-xs">
                {tr('Matricule', 'الترقيم / اللوحة')}
              </Label>
              {selectedGpsVehicle && selectedGpsVehicle !== '__manual__' && (
                <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  {tr('Rempli via GPS', 'مُعبأ عبر GPS')}
                </span>
              )}
            </div>
            <div className="relative group">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <Input
                id="matricule"
                value={formData.matricule}
                onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                placeholder={tr('Ex: Canter 32607 A 57', 'مثال: Canter 32607 A 57')}
                className="pl-10 h-11 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-600 transition-all rounded-xl font-bold text-slate-900"
                required
              />
            </div>
          </div>

          {/* 3. TYPE DE VÉHICULE */}
          <div className="space-y-1.5">
            <Label htmlFor="truckType" className="text-slate-700 font-semibold text-xs ml-1">
              {tr('Type de véhicule', 'نوع المركبة')}
            </Label>
            <Select
              value={formData.truckType}
              onValueChange={(value: 'camion' | 'remorque' | 'petit-camion' | 'clark') =>
                setFormData({ ...formData, truckType: value })
              }
            >
              <SelectTrigger className="h-11 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-600 transition-all rounded-xl text-xs font-semibold">
                <SelectValue placeholder={tr('Sélectionner le type', 'اختر النوع')} />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                <SelectItem value="camion" className="rounded-lg">
                  <span className="inline-flex items-center gap-2">
                    <img
                      src="/truck-types/camion.png"
                      alt="Camion"
                      className="h-4 w-6 object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <span>{tr('Camion', 'شاحنة')}</span>
                  </span>
                </SelectItem>
                <SelectItem value="remorque" className="rounded-lg">
                  <span className="inline-flex items-center gap-2">
                    <img
                      src="/truck-types/remorque.png"
                      alt="Remorque"
                      className="h-4 w-6 object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <span>{tr('Remorque', 'مقطورة')}</span>
                  </span>
                </SelectItem>
                <SelectItem value="petit-camion" className="rounded-lg">
                  <span className="inline-flex items-center gap-2">
                    <img
                      src="/truck-types/allogaz.png"
                      alt="Allogaz"
                      className="h-4 w-6 object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <span>{tr('Allogaz', 'ألوغاز')}</span>
                  </span>
                </SelectItem>
                <SelectItem value="clark" className="rounded-lg">
                  <span className="inline-flex items-center gap-2">
                    <img
                      src="/truck-types/clark.jpeg"
                      alt="Clark"
                      className="h-4 w-6 object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <span>{tr('Clark', 'كلارك')}</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 4. CHAUFFEUR ASSIGNÉ */}
          <div className="space-y-1.5">
            <Label htmlFor="driverId" className="text-slate-700 font-semibold text-xs ml-1">
              {tr('Assigner un chauffeur', 'تعيين سائق')}
            </Label>
            <div className="relative group">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors z-10" />
              <Select
                value={formData.driverId}
                onValueChange={(value) => setFormData({ ...formData, driverId: value })}
              >
                <SelectTrigger className="pl-10 h-11 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-600 transition-all rounded-xl text-xs font-semibold">
                  <SelectValue placeholder={tr('Sélectionner un chauffeur', 'اختر سائقاً')} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl max-h-56">
                  {availableDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={String(driver.id)} className="rounded-lg text-xs font-medium">
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <Button
              type="submit"
              className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all font-bold rounded-xl text-white"
            >
              {tr('Confirmer', 'تأكيد الحفظ')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 h-11 border-slate-200 font-medium rounded-xl"
            >
              {tr('Annuler', 'إلغاء')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
