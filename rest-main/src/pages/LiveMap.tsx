import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Radio, 
  Navigation, 
  Route, 
  Crosshair, 
  Play, 
  Pause, 
  RefreshCw, 
  Settings2, 
  ShieldCheck, 
  AlertCircle, 
  AlertTriangle,
  Wifi, 
  WifiOff, 
  Battery, 
  Fuel, 
  Gauge, 
  MapPin, 
  Truck, 
  User, 
  Search, 
  Layers, 
  ChevronLeft, 
  ChevronRight, 
  Compass, 
  Activity, 
  ExternalLink,
  CheckCircle2,
  Phone,
  Eye,
  EyeOff,
  Database,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, Marker, Popup, TileLayer, Polyline, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabaseClient';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { 
  getGpsConfig, 
  saveGpsConfig, 
  testGpsConnection, 
  loginGpswox, 
  fetchGpswoxDevices, 
  LiveVehicle, 
  GpsConfig,
  normalizeApiUrl
} from '@/lib/gpswoxService';

type FilterMode = 'all' | 'moving' | 'stopped' | 'offline';
type MapLayerType = 'google_roads' | 'google_hybrid' | 'google_terrain' | 'osm' | 'dark';

const MOROCCO_CENTER: [number, number] = [32.0, -6.5];

// Map Tile Layers powered by Google Maps API (Region: MA, Language: fr)
const MAP_LAYERS: Record<MapLayerType, { name: string; url: string; attribution: string; subdomains?: string[] }> = {
  google_roads: {
    name: 'Google Maps (Routes)',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&gl=MA&hl=fr',
    attribution: '&copy; Google Maps (Maroc)',
  },
  google_hybrid: {
    name: 'Google Maps (Satellite / Hybride)',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&gl=MA&hl=fr',
    attribution: '&copy; Google Maps Satellite (Maroc)',
  },
  google_terrain: {
    name: 'Google Maps (Relief / Terrain)',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&gl=MA&hl=fr',
    attribution: '&copy; Google Maps Terrain (Maroc)',
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  dark: {
    name: 'Cyber Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB &copy; OpenStreetMap',
    subdomains: ['a', 'b', 'c', 'd'],
  },
};

// Base coordinates for simulation across major Moroccan distribution axes
const MOROCCAN_HUBS = [
  { name: 'Casablanca Port / Ain Sebaa', lat: 33.595, lng: -7.58 },
  { name: 'Rabat Agdal / Hay Riad', lat: 33.98, lng: -6.85 },
  { name: 'Marrakech Sidi Ghanem', lat: 31.65, lng: -8.03 },
  { name: 'Tanger Med / Zone Franche', lat: 35.76, lng: -5.81 },
  { name: 'Fès Route de Meknès', lat: 34.02, lng: -5.02 },
  { name: 'Agadir Anza / Dakhla', lat: 30.42, lng: -9.59 },
  { name: 'Meknès Bassatine', lat: 33.89, lng: -5.55 },
  { name: 'Oujda Zone Industrielle', lat: 34.68, lng: -1.91 },
];

const createVehicleIcon = (vehicle: LiveVehicle, isSelected: boolean) => {
  const isMoving = vehicle.moving && vehicle.online;
  const isStopped = vehicle.online && !vehicle.moving;

  const color = isSelected
    ? '#0284c7' // Bright Sky blue
    : isMoving
    ? '#10b981' // Emerald green
    : isStopped
    ? '#f59e0b' // Amber
    : '#64748b'; // Slate

  const glowColor = isSelected
    ? 'rgba(2, 132, 199, 0.4)'
    : isMoving
    ? 'rgba(16, 185, 129, 0.4)'
    : isStopped
    ? 'rgba(245, 158, 11, 0.3)'
    : 'rgba(100, 116, 139, 0.15)';

  const heading = vehicle.heading || 0;

  return L.divIcon({
    className: 'custom-live-marker',
    html: `
      <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
        ${
          isSelected
            ? `<div style="position:absolute; width:52px; height:52px; border-radius:999px; border:2.5px solid ${color}; animation:ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity:0.75;"></div>`
            : isMoving
            ? `<div style="position:absolute; width:44px; height:44px; border-radius:999px; background:${glowColor}; animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>`
            : ''
        }
        <div style="
          position:absolute; 
          width:36px; 
          height:36px; 
          border-radius:12px; 
          background: #ffffff;
          border: 2.5px solid ${color};
          box-shadow: 0 0 14px ${glowColor}, 0 4px 8px rgba(15,23,42,0.18);
          display:flex; 
          align-items:center; 
          justify-content:center;
          transform: rotate(${heading}deg);
          transition: transform 0.4s ease;
        ">
          <svg style="width:18px; height:18px; fill:${color};" viewBox="0 0 24 24">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>

        <div style="
          position:absolute; 
          bottom:-9px; 
          left:50%; 
          transform:translateX(-50%); 
          background:#0f172a; 
          color:#ffffff; 
          border:1px solid ${color}; 
          font-size:9px; 
          font-weight:800; 
          padding:1px 5px; 
          border-radius:5px; 
          white-space:nowrap;
          box-shadow:0 2px 5px rgba(0,0,0,0.25);
          letter-spacing:0.3px;
        ">
          ${vehicle.plate}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
};

function MapViewWatcher({ targetVehicle }: { targetVehicle?: LiveVehicle | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetVehicle && Number.isFinite(targetVehicle.lat) && Number.isFinite(targetVehicle.lng)) {
      map.flyTo([targetVehicle.lat, targetVehicle.lng], 14, {
        animate: true,
        duration: 1.2,
      });
    }
  }, [targetVehicle, map]);
  return null;
}

export default function LiveMap() {
  const { trucks = [], drivers = [] } = useApp();
  const { language } = useLanguage();
  const { toast } = useToast();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);

  // Core State
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('google_hybrid');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState('10');
  const [clusterEnabled, setClusterEnabled] = useState(true);
  const [tracesEnabled, setTraceEnabled] = useState(true);
  const [traceHistory, setTraceHistory] = useState<Record<string, [number, number][]>>({});
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // GPSwox Settings Dialog & Form State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gpsConfig, setGpsConfig] = useState<GpsConfig>({ apiUrl: '', email: '', password: '' });
  const [gpsFormUrl, setGpsFormUrl] = useState('');
  const [gpsFormEmail, setGpsFormEmail] = useState('');
  const [gpsFormPassword, setGpsFormPassword] = useState('');
  const [gpsFormHash, setGpsFormHash] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; deviceCount?: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const mapRef = useRef<L.Map | null>(null);

  // Driver lookup map
  const driverMap = useMemo(() => {
    const map = new Map<string, any>();
    (drivers || []).forEach((d: any) => {
      if (d?.id) map.set(String(d.id), d);
    });
    return map;
  }, [drivers]);

  // Load GPS Configuration from Supabase / localStorage
  const reloadConfig = useCallback(async () => {
    const cfg = await getGpsConfig();
    setGpsConfig(cfg);
    setGpsFormUrl(cfg.apiUrl || 'http://167.86.91.143/');
    setGpsFormEmail(cfg.email || '');
    setGpsFormPassword(cfg.password || '');
    setGpsFormHash(cfg.apiHash || '');
  }, []);

  useEffect(() => {
    reloadConfig();
    const handleUpdate = () => {
      reloadConfig();
    };
    window.addEventListener('gps_config_updated', handleUpdate);
    return () => window.removeEventListener('gps_config_updated', handleUpdate);
  }, [reloadConfig]);

  // Generate realistic fleet simulation from user's actual trucks
  const generateSimulatedFleet = useCallback((): LiveVehicle[] => {
    const rawTrucks = Array.isArray(trucks) && trucks.length > 0
      ? trucks
      : [
          { id: 'sim-1', matricule: '12450-A-26', driverId: 'd-1', isActive: true, truckType: 'camion' },
          { id: 'sim-2', matricule: '98412-B-50', driverId: 'd-2', isActive: true, truckType: 'camion' },
          { id: 'sim-3', matricule: '34109-D-01', driverId: 'd-3', isActive: true, truckType: 'petit-camion' },
          { id: 'sim-4', matricule: '77215-A-11', driverId: 'd-4', isActive: true, truckType: 'camion' },
          { id: 'sim-5', matricule: '65902-H-33', driverId: 'd-5', isActive: false, truckType: 'camion' },
        ];

    return rawTrucks.map((truck: any, index: number) => {
      const hub = MOROCCAN_HUBS[index % MOROCCAN_HUBS.length];
      const driver = truck.driverId ? driverMap.get(String(truck.driverId)) : null;

      const seed = index + 1;
      const isOnline = truck.isActive !== false;
      const isMoving = isOnline && index % 3 !== 2;
      const speed = isMoving ? 35 + ((seed * 13) % 55) : 0;
      const heading = (seed * 67) % 360;

      const latOffset = ((Math.sin(seed * 4.2) * 0.15) + (Math.random() * 0.005));
      const lngOffset = ((Math.cos(seed * 3.8) * 0.15) + (Math.random() * 0.005));

      const bottleTotal = (truck.currentLoad || []).reduce((acc: number, item: any) => acc + (Number(item?.quantity) || 0), 0);

      return {
        id: String(truck.id),
        name: truck.matricule || `Camion #${index + 1}`,
        plate: truck.matricule || `MAT-${1000 + index}`,
        driverName: driver?.name || (truck.driverName ?? `Chauffeur ${index + 1}`),
        driverPhone: driver?.telephone,
        lat: hub.lat + latOffset,
        lng: hub.lng + lngOffset,
        speed,
        heading,
        moving: isMoving,
        online: isOnline,
        status: !isOnline ? 'offline' : isMoving ? 'moving' : 'stopped',
        timestamp: new Date().toISOString(),
        imei: `8649200${100000 + index}`,
        batteryLevel: 85 + (seed % 15),
        fuelLevel: 45 + ((seed * 9) % 50),
        bottlesCount: bottleTotal || 120 + ((seed * 40) % 280),
        source: 'simulated',
      };
    });
  }, [trucks, driverMap]);

  // Main Live Data Fetcher: GPSwox first, fallback to AppContext fleet
  const fetchLiveFleet = useCallback(async () => {
    setIsLoading(true);
    setConnectionNotice(null);

    // 1. Try Supabase Edge Function
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('gpswox');
      if (!invokeError && data && Array.isArray(data.devices) && data.devices.length > 0) {
        setVehicles(data.devices);
        setIsLiveConnected(true);
        setLastSyncTime(new Date().toISOString());

        setTraceHistory((prev) => {
          const next = { ...prev };
          data.devices.forEach((v: LiveVehicle) => {
            const currentTrail = next[v.id] ? [...next[v.id]] : [];
            currentTrail.push([v.lat, v.lng]);
            next[v.id] = currentTrail.slice(-80);
          });
          return next;
        });
        setIsLoading(false);
        return;
      }
    } catch {}

    // 2. Direct GPSwox client-side connection
    const cfg = await getGpsConfig();
    const apiUrl = cfg.apiUrl || 'http://167.86.91.143/';

    if (apiUrl && (cfg.apiHash || (cfg.email && cfg.password))) {
      let hash = cfg.apiHash;

      if (!hash && cfg.email && cfg.password) {
        const loginRes = await loginGpswox(apiUrl, cfg.email, cfg.password);
        if (loginRes.success && loginRes.apiHash) {
          hash = loginRes.apiHash;
          // Cache the hash
          cfg.apiHash = hash;
          saveGpsConfig(cfg).catch(() => {});
        } else {
          setConnectionNotice(loginRes.error || "Échec d'authentification GPSwox (401). Vérifiez vos identifiants.");
        }
      }

      if (hash) {
        const devRes = await fetchGpswoxDevices(apiUrl, hash);
        if (devRes.success && devRes.devices.length > 0) {
          setVehicles(devRes.devices);
          setIsLiveConnected(true);
          setLastSyncTime(new Date().toISOString());

          setTraceHistory((prev) => {
            const next = { ...prev };
            devRes.devices.forEach((v) => {
              const currentTrail = next[v.id] ? [...next[v.id]] : [];
              currentTrail.push([v.lat, v.lng]);
              next[v.id] = currentTrail.slice(-80);
            });
            return next;
          });
          setIsLoading(false);
          return;
        } else if (devRes.error) {
          setConnectionNotice(devRes.error);
        }
      }
    }

    // 3. Fallback: Fleet Simulation from App Trucks
    const simulated = generateSimulatedFleet();
    setVehicles(simulated);
    setIsLiveConnected(false);
    setLastSyncTime(new Date().toISOString());

    setTraceHistory((prev) => {
      const next = { ...prev };
      simulated.forEach((v) => {
        const currentTrail = next[v.id] ? [...next[v.id]] : [];
        currentTrail.push([v.lat, v.lng]);
        next[v.id] = currentTrail.slice(-50);
      });
      return next;
    });

    setIsLoading(false);
  }, [generateSimulatedFleet]);

  // Initial load and periodic polling
  useEffect(() => {
    fetchLiveFleet();
  }, [fetchLiveFleet]);

  useEffect(() => {
    if (isPaused) return;
    const intervalMs = Math.max(3, parseInt(refreshIntervalSec, 10) || 10) * 1000;
    const interval = setInterval(() => {
      fetchLiveFleet();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [fetchLiveFleet, isPaused, refreshIntervalSec]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (filterMode === 'moving' && (!v.online || !v.moving)) return false;
      if (filterMode === 'stopped' && (!v.online || v.moving)) return false;
      if (filterMode === 'offline' && v.online) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesPlate = v.plate.toLowerCase().includes(q);
        const matchesName = v.name.toLowerCase().includes(q);
        const matchesDriver = v.driverName.toLowerCase().includes(q);
        const matchesImei = (v.imei || '').toLowerCase().includes(q);
        if (!matchesPlate && !matchesName && !matchesDriver && !matchesImei) return false;
      }
      return true;
    });
  }, [vehicles, filterMode, searchQuery]);

  // Metrics
  const counts = useMemo(() => {
    let moving = 0;
    let stopped = 0;
    let offline = 0;
    let totalSpeed = 0;

    vehicles.forEach((v) => {
      if (!v.online) {
        offline += 1;
      } else if (v.moving) {
        moving += 1;
        totalSpeed += v.speed;
      } else {
        stopped += 1;
      }
    });

    const avgSpeed = moving > 0 ? Math.round(totalSpeed / moving) : 0;
    return { total: vehicles.length, moving, stopped, offline, avgSpeed };
  }, [vehicles]);

  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === selectedVehicleId) || null;
  }, [vehicles, selectedVehicleId]);

  // Fit all markers
  const handleFitAll = () => {
    if (!mapRef.current || vehicles.length === 0) return;
    const bounds = L.latLngBounds(vehicles.map((v) => [v.lat, v.lng]));
    mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  };

  // Test GPSwox Modal
  const handleTestInModal = async () => {
    if (!gpsFormUrl.trim()) {
      toast({ title: tr('URL requise', 'الرابط مطلوب'), description: tr('Veuillez saisir l\'URL du serveur GPS.', 'يرجى إدخال رابط الخادم.'), variant: 'destructive' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testGpsConnection({
        apiUrl: gpsFormUrl.trim(),
        email: gpsFormEmail.trim(),
        password: gpsFormPassword.trim(),
        apiHash: gpsFormHash.trim() || undefined,
      });
      setTestResult(res);
      if (res.apiHash && !gpsFormHash.trim()) {
        setGpsFormHash(res.apiHash);
      }
      if (res.success) {
        toast({ title: tr('Connexion réussie', 'تم الاتصال بنجاح'), description: res.message });
      } else {
        toast({ title: tr('Échec du test', 'فشل الاختبار'), description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Erreur réseau' });
    } finally {
      setIsTesting(false);
    }
  };

  // Save GPSwox in Modal
  const handleSaveInModal = async () => {
    setIsSaving(true);
    const newConfig: GpsConfig = {
      apiUrl: gpsFormUrl.trim(),
      email: gpsFormEmail.trim(),
      password: gpsFormPassword.trim(),
      apiHash: gpsFormHash.trim() || undefined,
    };
    const res = await saveGpsConfig(newConfig);
    setIsSaving(false);
    if (res.success) {
      setGpsConfig(newConfig);
      toast({
        title: tr('Configuration GPS enregistrée', 'تم حفظ إعدادات GPS'),
        description: tr('Synchronisation immédiate avec le serveur.', 'جارٍ التحديث الفوري مع الخادم.'),
      });
      setSettingsOpen(false);
      fetchLiveFleet();
    } else {
      toast({ title: tr('Erreur sauvegarde', 'خطأ في الحفظ'), description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-3 md:p-6 gap-3 bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Command HUD Header */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl shadow-xl backdrop-blur-md shrink-0">
        {/* Left: Branding & Status Radar */}
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 shrink-0">
            <Radio className="w-6 h-6 animate-pulse text-cyan-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                {tr('Télémétrie Flotte en Direct', 'تتبع الأسطول المباشر')}
              </h1>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                LIVE HUD
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-medium">
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isLiveConnected ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]' : 'bg-amber-400 shadow-[0_0_10px_#f59e0b]'}`} />
                <span className={isLiveConnected ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                  {isLiveConnected ? tr('Satellite GPSwox Connecté', 'متصل بأقمار GPSwox') : tr('Flotte Locale Active (Simulation)', 'الأسطول المحلي نشط (محاكاة)')}
                </span>
              </span>
              <span>•</span>
              <span className="text-slate-300 font-bold">{counts.total} {tr('véhicules', 'مركبة')}</span>
              {lastSyncTime && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    {new Date(lastSyncTime).toLocaleTimeString()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Live KPI Counters */}
        <div className="grid grid-cols-4 gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 rounded-lg text-center transition-all ${filterMode === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'hover:bg-slate-900/60 text-slate-400'}`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider">{tr('Tous', 'الكل')}</div>
            <div className="text-sm font-black text-white">{counts.total}</div>
          </button>
          <button
            onClick={() => setFilterMode('moving')}
            className={`px-3 py-1 rounded-lg text-center transition-all ${filterMode === 'moving' ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300' : 'hover:bg-slate-900/60 text-slate-400'}`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{tr('En route', 'متحرك')}</div>
            <div className="text-sm font-black text-emerald-300">{counts.moving}</div>
          </button>
          <button
            onClick={() => setFilterMode('stopped')}
            className={`px-3 py-1 rounded-lg text-center transition-all ${filterMode === 'stopped' ? 'bg-amber-950/80 border border-amber-500/40 text-amber-300' : 'hover:bg-slate-900/60 text-slate-400'}`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">{tr('Arrêt', 'متوقف')}</div>
            <div className="text-sm font-black text-amber-300">{counts.stopped}</div>
          </button>
          <div className="px-3 py-1 rounded-lg text-center text-slate-400">
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">{tr('Vit. Moy.', 'السرعة')}</div>
            <div className="text-sm font-black text-cyan-300">{counts.avgSpeed} <span className="text-[9px] font-normal">km/h</span></div>
          </div>
        </div>

        {/* Right: Map Controls & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={activeLayer} onValueChange={(val) => setActiveLayer(val as MapLayerType)}>
            <SelectTrigger className="h-9 w-36 bg-slate-800 border-slate-700 text-xs font-bold text-slate-200">
              <Layers className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              {Object.entries(MAP_LAYERS).map(([key, layer]) => (
                <SelectItem key={key} value={key} className="text-xs font-medium cursor-pointer">
                  {layer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setClusterEnabled((prev) => !prev)}
            className={`h-9 text-xs font-bold border-slate-700 ${
              clusterEnabled ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
            {tr('Clusters', 'تجميع')}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setTraceEnabled((prev) => !prev)}
            className={`h-9 text-xs font-bold border-slate-700 hidden sm:flex ${
              tracesEnabled ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Route className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
            {tr('Traces', 'المسارات')}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleFitAll}
            className="h-9 text-xs font-bold bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
          >
            <Crosshair className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
            {tr('Centrer', 'تركيز')}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPaused((prev) => !prev)}
            className={`h-9 text-xs font-bold border-slate-700 ${
              isPaused ? 'bg-amber-950 border-amber-500/50 text-amber-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 mr-1 text-amber-400" /> : <Pause className="w-3.5 h-3.5 mr-1 text-slate-400" />}
            {isPaused ? tr('Reprendre', 'استئناف') : tr('Pause', 'إيقاف')}
          </Button>

          <Button
            size="icon"
            onClick={() => void fetchLiveFleet()}
            disabled={isLoading}
            className="h-9 w-9 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            title={tr('Rafraîchir maintenant', 'تحديث فوري')}
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="h-9 text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-600/30"
          >
            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
            {tr('GPSwox Config', 'إعدادات GPS')}
          </Button>
        </div>
      </div>

      {/* Warning banner if GPSwox configured but returned an error */}
      {connectionNotice && (
        <div className="bg-amber-950/70 border border-amber-500/50 text-amber-200 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">{tr('Notification Serveur GPS:', 'تنبيه خادم GPS:')} </span>
              <span>{connectionNotice}</span>
              <span className="text-amber-300/80 ml-2">({tr('Mode flotte locale actif en attente de reconnexion', 'المحاكاة المحلية نشطة بانتظار الاتصال')})</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            className="h-7 text-[11px] font-bold border-amber-500/50 bg-amber-900/40 hover:bg-amber-800 text-amber-200 shrink-0"
          >
            {tr('Modifier les identifiants', 'تعديل البيانات')}
          </Button>
        </div>
      )}

      {/* Main Map Viewport & Collapsible Vehicle Drawer */}
      <div className="flex-1 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative flex bg-slate-900">
        {/* Interactive Leaflet Map */}
        <div className="flex-1 h-full w-full relative z-0">
          <MapContainer
            center={MOROCCO_CENTER}
            zoom={6}
            className="h-full w-full bg-slate-950"
            whenReady={(evt) => {
              mapRef.current = evt.target;
            }}
          >
            <TileLayer
              attribution={MAP_LAYERS[activeLayer].attribution}
              url={MAP_LAYERS[activeLayer].url}
              subdomains={MAP_LAYERS[activeLayer].subdomains || ['a', 'b', 'c']}
            />

            <MapViewWatcher targetVehicle={selectedVehicle} />

            {/* Vehicle Movement Traces */}
            {tracesEnabled &&
              filteredVehicles.map((vehicle) => {
                const line = traceHistory[vehicle.id] || [];
                if (line.length < 2) return null;
                const isSelected = selectedVehicleId === vehicle.id;
                return (
                  <Polyline
                    key={`trace-${vehicle.id}`}
                    positions={line}
                    pathOptions={{
                      color: isSelected ? '#38bdf8' : vehicle.moving ? '#10b981' : '#94a3b8',
                      weight: isSelected ? 4 : 2.5,
                      opacity: isSelected ? 0.95 : 0.65,
                      dashArray: vehicle.moving ? undefined : '4, 8',
                    }}
                  />
                );
              })}

            {/* Vehicle Markers */}
            {clusterEnabled ? (
              <MarkerClusterGroup chunkedLoading>
                {filteredVehicles.map((vehicle) => {
                  const isSelected = selectedVehicleId === vehicle.id;
                  return (
                    <Marker
                      key={vehicle.id}
                      position={[vehicle.lat, vehicle.lng]}
                      icon={createVehicleIcon(vehicle, isSelected)}
                      eventHandlers={{
                        click: () => setSelectedVehicleId(vehicle.id),
                      }}
                    >
                      <Popup className="cyber-popup">
                        <div className="p-1 min-w-[220px] text-slate-900">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                            <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                              {vehicle.plate}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              vehicle.moving ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {vehicle.moving ? `${Math.round(vehicle.speed)} km/h` : 'Arrêté'}
                            </span>
                          </div>
                          <div className="mt-2 text-xs space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Chauffeur:</span>
                              <strong className="text-slate-800">{vehicle.driverName}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Source:</span>
                              <span className="font-bold text-indigo-700">
                                {vehicle.source === 'gpswox' ? '📡 Satellite GPSwox' : '🚗 Flotte Interne'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Carburant:</span>
                              <strong className="text-slate-800">{vehicle.fuelLevel ?? 75}%</strong>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                              <span>Coordonnées:</span>
                              <span className="font-mono">{vehicle.lat.toFixed(4)}, {vehicle.lng.toFixed(4)}</span>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            ) : (
              filteredVehicles.map((vehicle) => {
                const isSelected = selectedVehicleId === vehicle.id;
                return (
                  <Marker
                    key={vehicle.id}
                    position={[vehicle.lat, vehicle.lng]}
                    icon={createVehicleIcon(vehicle, isSelected)}
                    eventHandlers={{
                      click: () => setSelectedVehicleId(vehicle.id),
                    }}
                  >
                    <Popup className="cyber-popup">
                      <div className="p-1 min-w-[220px] text-slate-900">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                          <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                            {vehicle.plate}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            vehicle.moving ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {vehicle.moving ? `${Math.round(vehicle.speed)} km/h` : 'Arrêté'}
                          </span>
                        </div>
                        <div className="mt-2 text-xs space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Chauffeur:</span>
                            <strong className="text-slate-800">{vehicle.driverName}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Source:</span>
                            <span className="font-bold text-indigo-700">
                              {vehicle.source === 'gpswox' ? '📡 Satellite GPSwox' : '🚗 Flotte Interne'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })
            )}
          </MapContainer>
        </div>

        {/* Selected Vehicle Floating Bottom Telemetry Bar */}
        <AnimatePresence>
          {selectedVehicle && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[480px] bg-slate-900/95 border border-slate-700 p-4 rounded-2xl shadow-2xl backdrop-blur-md z-10 text-white"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-mono font-black text-base tracking-wider">{selectedVehicle.plate}</div>
                    <div className="text-xs text-slate-400">{selectedVehicle.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={selectedVehicle.moving ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}>
                    {selectedVehicle.moving ? `${Math.round(selectedVehicle.speed)} km/h` : 'À l\'arrêt'}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedVehicleId(null)}
                    className="h-7 w-7 text-slate-400 hover:text-white"
                  >
                    ✕
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 py-3 text-xs">
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                    <User className="w-3 h-3 text-cyan-400" /> Chauffeur
                  </div>
                  <div className="font-bold text-white mt-1 truncate">{selectedVehicle.driverName}</div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-emerald-400" /> Vitesse
                  </div>
                  <div className="font-mono font-black text-emerald-400 text-sm mt-0.5">
                    {Math.round(selectedVehicle.speed)} <span className="text-[10px]">km/h</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                    <Fuel className="w-3 h-3 text-amber-400" /> Carburant
                  </div>
                  <div className="font-mono font-black text-amber-400 text-sm mt-0.5">
                    {selectedVehicle.fuelLevel ?? 75}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-cyan-400" />
                  Source: <strong className="text-slate-200">{selectedVehicle.source === 'gpswox' ? 'GPSwox Sat' : 'Flotte Interne'}</strong>
                </span>
                <span className="font-mono">
                  {selectedVehicle.lat.toFixed(4)}, {selectedVehicle.lng.toFixed(4)}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsible Left Fleet Drawer */}
        <div
          className={`absolute top-0 bottom-0 left-0 bg-slate-900/95 border-r border-slate-800 z-10 transition-all duration-300 flex flex-col ${
            sidebarOpen ? 'w-80 md:w-96' : 'w-0 -translate-x-full'
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2 font-black text-sm text-white">
              <Truck className="w-4 h-4 text-cyan-400" />
              <span>{tr('Liste des Véhicules', 'قائمة المركبات')}</span>
              <span className="text-xs text-slate-400 font-mono">({filteredVehicles.length})</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSidebarOpen(false)}
              className="h-7 w-7 text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr('Filtrer par immatriculation, chauffeur...', 'بحث برقم الشاحنة أو السائق...')}
                className="pl-9 h-9 bg-slate-950 border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 rounded-xl"
              />
            </div>
          </div>

          {/* Vehicle List */}
          <ScrollArea className="flex-1 p-3 space-y-2">
            {filteredVehicles.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                {tr('Aucun véhicule ne correspond aux filtres.', 'لا توجد مركبات تطابق البحث.')}
              </div>
            ) : (
              filteredVehicles.map((vehicle) => {
                const isSelected = selectedVehicleId === vehicle.id;
                return (
                  <div
                    key={vehicle.id}
                    onClick={() => setSelectedVehicleId(vehicle.id)}
                    className={`p-3 rounded-xl border mb-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-cyan-500/60 bg-cyan-950/30 shadow-lg shadow-cyan-500/10'
                        : 'border-slate-800/80 bg-slate-950/40 hover:bg-slate-800/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs bg-slate-900 border border-slate-700 text-white px-2 py-0.5 rounded">
                          {vehicle.plate}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold truncate max-w-[120px]">
                          {vehicle.name}
                        </span>
                      </div>
                      <Badge className={vehicle.moving ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]' : 'bg-slate-800 text-slate-400 border-slate-700 text-[10px]'}>
                        {vehicle.moving ? `${Math.round(vehicle.speed)} km/h` : 'Arrêté'}
                      </Badge>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-xs text-slate-300">
                      <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                        <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{vehicle.driverName}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {vehicle.source === 'gpswox' ? '📡 Sat' : '🚗 Sim'}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Fuel className="w-3 h-3 text-amber-400" />
                          {vehicle.fuelLevel ?? 75}%
                        </span>
                        <span className="flex items-center gap-1">
                          <Battery className="w-3 h-3 text-emerald-400" />
                          {vehicle.batteryLevel ?? 90}%
                        </span>
                      </div>
                      <span className="text-[10px] text-cyan-400 font-medium">
                        {tr('Localiser →', 'تحديد الموقع ←')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </ScrollArea>
        </div>

        {/* Sidebar Toggle Handle when closed */}
        {!sidebarOpen && (
          <Button
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-10 h-10 w-10 bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 shadow-xl rounded-xl"
            title={tr('Ouvrir la liste des véhicules', 'فتح قائمة المركبات')}
          >
            <ChevronRight className="w-5 h-5 text-cyan-400" />
          </Button>
        )}
      </div>

      {/* GPSwox Configuration Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-white text-base">
                  {tr('Configuration Serveur GPSwox', 'إعدادات خادم GPSwox')}
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs">
                  {tr('Liaison satellite en temps réel avec votre instance GPSwox.', 'الربط المباشر مع خادم GPSwox لتتبع أسطول الشاحنات.')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-200">{tr('URL API GPSwox', 'رابط خادم GPSwox')}</Label>
                <button
                  type="button"
                  onClick={() => setGpsFormUrl('http://167.86.91.143/')}
                  className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline"
                >
                  167.86.91.143
                </button>
              </div>
              <Input
                value={gpsFormUrl}
                onChange={(e) => setGpsFormUrl(e.target.value)}
                placeholder="http://167.86.91.143/"
                className="bg-slate-950 border-slate-800 text-xs text-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-200">{tr('Email / Nom d\'utilisateur', 'البريد أو اسم المستخدم')}</Label>
              <Input
                value={gpsFormEmail}
                onChange={(e) => setGpsFormEmail(e.target.value)}
                placeholder="baalsaid2411@gmail.com"
                className="bg-slate-950 border-slate-800 text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-200">{tr('Mot de passe', 'كلمة المرور')}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={gpsFormPassword}
                  onChange={(e) => setGpsFormPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-950 border-slate-800 text-xs text-white pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400 hover:text-white"
                  onClick={() => setShowPassword((p) => !p)}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">
                {tr('Clé API / Hash Utilisateur (Optionnel)', 'مفتاح API / Hash المستخدم (اختياري)')}
              </Label>
              <Input
                value={gpsFormHash}
                onChange={(e) => setGpsFormHash(e.target.value)}
                placeholder="user_api_hash (recommandé si mot de passe inconnu)"
                className="bg-slate-950 border-slate-800 text-xs font-mono text-slate-300"
              />
            </div>

            {/* Helper hint on how to get API Key */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-[11px] text-slate-300 space-y-1">
              <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                {tr('Connexion satellite par Clé API (user_api_hash) :', 'الاتصال عبر مفتاح API (user_api_hash):')}
              </div>
              <p className="text-slate-400 leading-relaxed">
                {tr(
                  'Si votre mot de passe est différent de celui du compte, connectez-vous sur http://167.86.91.143 > Mon Compte > Clé API et collez-la ici pour activer le suivi en direct instantanément.',
                  'إذا كانت كلمة المرور مختلفة، يمكنك تسجيل الدخول إلى http://167.86.91.143 > حسابي > مفتاح API ولصقه هنا لتفعيل التتبع الحي فوراً.'
                )}
              </p>
            </div>

            {/* Test result feedback banner */}
            {testResult && (
              <div
                className={`rounded-xl border p-3 text-xs ${
                  testResult.success
                    ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                    : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                  {testResult.success ? tr('Succès', 'نجاح') : tr('Échec', 'فشل')}
                </div>
                <div className="mt-1 text-slate-300">{testResult.message}</div>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isTesting || isSaving}
              onClick={handleTestInModal}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-cyan-400 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? tr('Test...', 'اختبار...') : tr('Tester Connexion', 'اختبار الاتصال')}
            </Button>
            <Button
              disabled={isSaving || isTesting}
              onClick={handleSaveInModal}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex-1"
            >
              <Database className="w-3.5 h-3.5 mr-1.5" />
              {isSaving ? tr('Sauvegarde...', 'حفظ...') : tr('Enregistrer & Synchroniser', 'حفظ ومزامنة')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
