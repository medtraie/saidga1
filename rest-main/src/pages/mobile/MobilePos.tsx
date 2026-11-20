import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMap,
  useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Robust Leaflet LatLng safety wrapper: permanently prevents "Invalid LatLng object: (undefined, undefined)"
if (L) {
  if (typeof (L as any).latLng === 'function') {
    const originalLatLng = (L as any).latLng;
    (L as any).latLng = function (a: any, b: any, c?: any) {
      if (a === undefined || a === null) {
        return originalLatLng(33.593, -7.648);
      }
      if (Array.isArray(a)) {
        const lat = Number(a[0]);
        const lng = Number(a[1]);
        if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
          return originalLatLng(33.593, -7.648);
        }
        return originalLatLng(lat, lng);
      }
      if (typeof a === 'object') {
        const lat = Number(a.lat ?? a.latitude);
        const lng = Number(a.lng ?? a.longitude);
        if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
          return originalLatLng(33.593, -7.648);
        }
        return originalLatLng(lat, lng);
      }
      const lat = Number(a);
      const lng = Number(b);
      if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
        return originalLatLng(33.593, -7.648);
      }
      return originalLatLng(lat, lng);
    };
  }

  if ((L as any).LatLng) {
    const OriginalLatLngClass = (L as any).LatLng;
    (L as any).LatLng = function (lat: any, lng: any, alt?: any) {
      const numLat = Number(lat);
      const numLng = Number(lng);
      const safeLat = !isNaN(numLat) && isFinite(numLat) ? numLat : 33.593;
      const safeLng = !isNaN(numLng) && isFinite(numLng) ? numLng : -7.648;
      return new OriginalLatLngClass(safeLat, safeLng, alt);
    };
    (L as any).LatLng.prototype = OriginalLatLngClass.prototype;
  }
}
import {
  Smartphone,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
  RefreshCw,
  Search,
  Navigation,
  LogOut,
  ChevronRight,
  ChevronDown,
  Package,
  ArrowRight,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  Phone,
  Plus,
  Minus,
  Check,
  X,
  CreditCard,
  Banknote,
  Send,
  Lock,
  Layers,
  Store,
  Flame,
  CheckCheck,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { pointVenteService, Tournee, TourneeStop, DriverPosAccount, ClientPos, TourneeItem, Delivery48hAlert } from '@/lib/pointVenteService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useApp } from '@/contexts/AppContext';

// Google Maps Layer Definitions (Region: gl=MA, Language: hl=fr)
type MobileMapLayerType = 'google_roads' | 'google_hybrid' | 'google_terrain';

const MOBILE_MAP_LAYERS: Record<MobileMapLayerType, { name: string; url: string; attribution: string }> = {
  google_roads: {
    name: 'Google Plan',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&gl=MA&hl=fr',
    attribution: '&copy; Google Maps (Maroc)',
  },
  google_hybrid: {
    name: 'Google Satellite',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&gl=MA&hl=fr',
    attribution: '&copy; Google Maps Satellite',
  },
  google_terrain: {
    name: 'Google Relief',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&gl=MA&hl=fr',
    attribution: '&copy; Google Maps Relief',
  },
};

// Custom Map view centering
const cleanLabel = (text: any, fallback: string) => {
  if (!text) return fallback;
  if (typeof text === 'object') {
    text = (text as any)?.posName || (text as any)?.clientName || (text as any)?.name || (text as any)?.title || (text as any)?.id || '';
  }
  const s = String(text).trim();
  if (!s || s.includes('[object') || s.includes('undefined')) return fallback;
  return s;
};

function MobileMapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 150);
    const t2 = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);

  useEffect(() => {
    if (
      Array.isArray(center) &&
      typeof center[0] === 'number' &&
      !isNaN(center[0]) &&
      isFinite(center[0]) &&
      typeof center[1] === 'number' &&
      !isNaN(center[1]) &&
      isFinite(center[1])
    ) {
      try {
        map.flyTo(center, zoom, { duration: 1.0 });
      } catch (err) {
        console.warn('Map flyTo safe notice:', err);
      }
    }
  }, [center, zoom, map]);
  return null;
}

// Map click listener for interactive POS placement
function MapEventsHandler({
  isPicking,
  onPick,
}: {
  isPicking: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (isPicking && e.latlng && !isNaN(e.latlng.lat) && !isNaN(e.latlng.lng)) {
        onPick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Visual Gas Bottle Cylinder Component (Realistic Moroccan Design)
const GasBottleVisual = ({
  name = '12kg',
  className = 'w-10 h-14'
}: {
  name?: string;
  className?: string;
}) => {
  const lower = name.toLowerCase();
  const is3 = lower.includes('3kg') || lower.includes('3 kg') || lower.includes('3 kgs');
  const is6 = lower.includes('6kg') || lower.includes('6 kg') || lower.includes('6 kgs');
  const badgeText = is3 ? '3KG' : is6 ? '6KG' : '12KG';

  const primaryGrad = is3 ? '#ef4444' : is6 ? '#06b6d4' : '#3b82f6';
  const secondaryGrad = is3 ? '#991b1b' : is6 ? '#0891b2' : '#1e3a8a';

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 48 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-lg">
        {/* Valve / Cap */}
        <rect x="20" y="2" width="8" height="6" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1.2" />
        <path d="M16 8H32V13C32 14.5 30.5 15 29 15H19C17.5 15 16 14.5 16 13V8Z" fill="#64748b" />
        {/* Bottle Body */}
        <path
          d="M12 18C12 15 15 14 18 14H30C33 14 36 15 36 18V50C36 54 33 56 29 56H19C15 56 12 54 12 50V18Z"
          fill={`url(#grad-${badgeText})`}
          stroke="#0f172a"
          strokeWidth="1.5"
        />
        {/* Base Ring */}
        <path d="M15 56H33V60C33 61.5 31.5 62 30 62H18C16.5 62 15 61.5 15 60V56Z" fill="#1e293b" />
        {/* Highlight Reflection */}
        <path d="M15 20C15 18 17 17 19 17C17 19 17 48 19 52C17 52 15 50 15 48V20Z" fill="white" fillOpacity="0.3" />
        <defs>
          <linearGradient id={`grad-${badgeText}`} x1="12" y1="14" x2="36" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor={primaryGrad} />
            <stop offset="1" stopColor={secondaryGrad} />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute bottom-3 text-[9px] font-black text-white tracking-tighter drop-shadow-md">
        {badgeText}
      </span>
    </div>
  );
};

// Icons
const createDriverLocationIcon = () =>
  L.divIcon({
    className: 'mobile-driver-pos',
    html: `
    <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; width:44px; height:44px; border-radius:999px; background:rgba(14,165,233,0.3); animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:absolute; width:36px; height:36px; border-radius:999px; background:#0284c7; border:3px solid #ffffff; box-shadow:0 0 12px rgba(2,132,199,0.8); display:flex; align-items:center; justify-content:center; color:white;">
        <svg style="width:20px; height:20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
      </div>
    </div>
  `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

const createStopMarkerIcon = (status: 'livre' | 'en_attente' | 'annule', seq: number, isOverdue?: boolean) => {
  const isDelivered = status === 'livre';
  const color = isDelivered ? '#10b981' : (isOverdue ? '#f97316' : '#f43f5e');
  const pulse = isDelivered ? '' : (isOverdue ? 'animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;' : 'animation:pulse 2s infinite;');
  return L.divIcon({
    className: 'mobile-stop-pos',
    html: `
      <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
        <div style="position:absolute; width:36px; height:36px; border-radius:999px; background:${color}; opacity:0.35; ${pulse}"></div>
        <div style="width:28px; height:28px; border-radius:999px; background:${color}; border:2.5px solid #ffffff; box-shadow:0 3px 10px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; color:white; font-size:12px; font-weight:900;">
          ${isDelivered ? '✓' : (isOverdue ? '⚠️' : seq)}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const createPickTargetIcon = () =>
  L.divIcon({
    className: 'mobile-pick-target',
    html: `
      <div style="position:relative; width:48px; height:48px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
        <div style="position:absolute; width:48px; height:48px; border-radius:999px; background:rgba(6,182,212,0.35); animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="position:absolute; width:38px; height:38px; border-radius:999px; background:#0891b2; border:3px solid #ffffff; box-shadow:0 0 16px rgba(6,182,212,0.9); display:flex; align-items:center; justify-content:center; color:white; font-size:18px;">
          📍
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });

export interface BottleAnomalyData {
  code: string;
  designation: string;
  quantity: number;
}

export default function MobilePos() {
  const { toast } = useToast();
  const { bottleTypes = [] } = useApp();

  // Mobile Session
  const [currentAccount, setCurrentAccount] = useState<DriverPosAccount | null>(() => {
    try {
      const stored = localStorage.getItem('driver_pos_current_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Driver Accounts list for quick 1-tap login
  const [availableAccounts, setAvailableAccounts] = useState<DriverPosAccount[]>([]);
  const [availableBons, setAvailableBons] = useState<any[]>([]);

  // Auth Inputs
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Tournee Data
  const [activeTournee, setActiveTournee] = useState<Tournee | null>(null);
  const [loadingTournee, setLoadingTournee] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'livraisons' | 'stock'>('map');
  const [statusFilter, setStatusFilter] = useState<'all' | 'livre' | 'en_attente' | 'alerte_48h'>('all');
  const [alerts48h, setAlerts48h] = useState<Delivery48hAlert[]>([]);
  const [clientPosList, setClientPosList] = useState<ClientPos[]>([]);
  const [showAlerts48hModal, setShowAlerts48hModal] = useState(false);
  const [mobileLayer, setMobileLayer] = useState<MobileMapLayerType>('google_roads');
  const [showBottlesDrawer, setShowBottlesDrawer] = useState(true);
  const [switchBsModalOpen, setSwitchBsModalOpen] = useState(false);

  // GPS Location
  const [driverGps, setDriverGps] = useState<[number, number]>([33.585, -7.64]);

  // Safe driver coordinates: guaranteed valid finite numbers, strictly avoiding TDZ and LatLng errors
  const safeDriverGps: [number, number] = useMemo(() => {
    const lat = Number(driverGps?.[0]);
    const lng = Number(driverGps?.[1]);
    if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
      return [lat, lng];
    }
    return [33.593, -7.648];
  }, [driverGps]);

  // Delivery Modal State (Multi-Bottle Support)
  const [deliveryModalStop, setDeliveryModalStop] = useState<TourneeStop | null>(null);
  const [bottleQuantities, setBottleQuantities] = useState<Record<string, {
    full: number;
    empty: number;
    defective: number;
    foreign: number;
    purchased: number;
  }>>({});
  const [specialToggles, setSpecialToggles] = useState<Record<string, boolean>>({});
  const [bottleAnomalies, setBottleAnomalies] = useState<Record<string, {
    defective: BottleAnomalyData;
    foreign: BottleAnomalyData;
    purchased: BottleAnomalyData;
    isSaved?: boolean;
  }>>({});
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'cheque'>('cash');
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  // Mark / Pick POS on Map State
  const [isPickingPos, setIsPickingPos] = useState(false);
  const [posPickCoords, setPosPickCoords] = useState<[number, number]>([33.585, -7.64]);
  const [markPosModalOpen, setMarkPosModalOpen] = useState(false);
  const [newPosName, setNewPosName] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newPosPhone, setNewPosPhone] = useState('');
  const [newPosIce, setNewPosIce] = useState('');
  const [newPosPatente, setNewPosPatente] = useState('');
  const [newPosAddress, setNewPosAddress] = useState('');
  const [savingPosGps, setSavingPosGps] = useState(false);

  // Close Tournee Modal State
  const [closeTourModalOpen, setCloseTourModalOpen] = useState(false);
  const [closingTour, setClosingTour] = useState(false);
  const [tourClosedSuccess, setTourClosedSuccess] = useState(false);

  // GPS Tracker hook
  useEffect(() => {
    if ('geolocation' in navigator) {
      const handlePos = (pos: GeolocationPosition) => {
        const lat = Number(pos?.coords?.latitude);
        const lng = Number(pos?.coords?.longitude);
        if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
          setDriverGps([lat, lng]);
        }
      };

      navigator.geolocation.getCurrentPosition(handlePos, () => setDriverGps([33.593, -7.648]), { enableHighAccuracy: true });
      const watchId = navigator.geolocation.watchPosition(handlePos, () => {}, { enableHighAccuracy: true, maximumAge: 10000 });
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Broadcast driver live GPS to web dashboard
  useEffect(() => {
    if (currentAccount?.driverId && safeDriverGps && safeDriverGps[0] && safeDriverGps[1]) {
      pointVenteService.updateDriverLiveGps(currentAccount.driverId, safeDriverGps).catch(() => {});
    }
  }, [currentAccount?.driverId, safeDriverGps]);

  // Load driver accounts and available Bons de Sortie
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        if (typeof pointVenteService?.getDriverAccounts === 'function') {
          const accounts = await pointVenteService.getDriverAccounts();
          if (isMounted) setAvailableAccounts(accounts || []);
        }
      } catch (err) {
        console.warn('Error loading driver accounts:', err);
      }

      // Load all client points of sale from cloud
      try {
        const pos = await pointVenteService.getClientPosList();
        if (isMounted) setClientPosList(pos || []);
      } catch (err) {
        console.warn('Error loading client pos in mobile:', err);
      }

      try {
        if (typeof pointVenteService?.getActiveBonsDeSortie === 'function') {
          const bons = await pointVenteService.getActiveBonsDeSortie();
          if (isMounted) {
            setAvailableBons(bons || []);
          }
        }
      } catch (err) {
        console.warn('Error loading bons de sortie:', err);
      }
    };
    initData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for real-time POS changes from web dashboard
  useEffect(() => {
    let isMounted = true;
    const handlePosChange = (e: any) => {
      if (Array.isArray(e?.detail)) {
        setClientPosList(e.detail);
      } else {
        pointVenteService.getClientPosList().then(list => {
          if (isMounted) setClientPosList(list || []);
        }).catch(() => {});
      }
    };
    window.addEventListener('sft-client-pos-changed', handlePosChange);
    return () => {
      isMounted = false;
      window.removeEventListener('sft-client-pos-changed', handlePosChange);
    };
  }, []);

  // Fetch driver's active tournee
  const loadTournee = async (driverId: string) => {
    setLoadingTournee(true);
    try {
      if (typeof pointVenteService?.getActiveTourneeForDriver === 'function') {
        const tour = await pointVenteService.getActiveTourneeForDriver(driverId);
        if (tour) {
          setActiveTournee(tour);
        } else if (typeof pointVenteService?.getTournees === 'function') {
          const allTournees = await pointVenteService.getTournees();
          const existing = allTournees.find((t) => t.driverId === driverId && t.status === 'en_cours');
          setActiveTournee(existing || null);
        }
      }

      // Check 48h unsupplied clients
      try {
        const freshPos = await pointVenteService.getClientPosList();
        setClientPosList(freshPos || []);
      } catch {}

      try {
        const alerts = await pointVenteService.get48hDeliveryAlerts(driverId);
        setAlerts48h(alerts || []);
        if (alerts && alerts.length > 0) {
          toast({
            title: '⚠️ ALERTE 48H CHAUFFEUR',
            description: `${alerts.length} client(s) n'ont pas été approvisionnés depuis plus de 48 heures !`,
            variant: 'destructive',
          });
        }
      } catch (err) {
        console.warn('Error loading 48h alerts:', err);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTournee(false);
    }
  };

  useEffect(() => {
    if (currentAccount?.driverId) {
      loadTournee(currentAccount.driverId);
    } else {
      pointVenteService.get48hDeliveryAlerts().then(setAlerts48h).catch(() => {});
    }
  }, [currentAccount]);

  // Quick Switch Bon de Sortie
  const handleSelectBonDeSortie = async (bon: any) => {
    setLoadingTournee(true);
    try {
      const tour = await pointVenteService.createTourneeFromSupplyOrder(bon);
      setActiveTournee(tour);
      // Auto-set current account if driver isn't set yet
      if (!currentAccount && tour.driverId) {
        const matchingAcc = availableAccounts.find(a => a.driverId === tour.driverId);
        if (matchingAcc) {
          setCurrentAccount(matchingAcc);
        } else {
          setCurrentAccount({
            id: tour.driverId,
            driverId: tour.driverId,
            driverName: tour.driverName || 'Chauffeur',
            email: `${(tour.driverName || 'driver').toLowerCase().replace(/\s+/g, '')}@sftgaz.ma`,
            isActive: true,
          });
        }
      }
      setSwitchBsModalOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTournee(false);
    }
  };

  // Auth Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await pointVenteService.authenticateDriver(authEmail, authPassword);
      if (!res.success || !res.driverAccount) {
        setAuthError(res.error || 'Email ou mot de passe incorrect.');
        return;
      }
      localStorage.setItem('driver_pos_current_session', JSON.stringify(res.driverAccount));
      setCurrentAccount(res.driverAccount);
      await loadTournee(res.driverAccount.driverId);
    } catch (err: any) {
      setAuthError(err?.message || 'Erreur lors de la connexion.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Quick 1-Tap Driver Login
  const handleQuickLogin = async (account: DriverPosAccount) => {
    setAuthLoading(true);
    try {
      localStorage.setItem('driver_pos_current_session', JSON.stringify(account));
      setCurrentAccount(account);
      await loadTournee(account.driverId);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('driver_pos_current_session');
    setCurrentAccount(null);
    setActiveTournee(null);
    setTourClosedSuccess(false);
  };

  // Bottles load items (strictly from the active tournee of the driver's Bon de Sortie)
  const loadItems = useMemo(() => {
    return activeTournee?.remainingLoad || activeTournee?.initialLoad || [];
  }, [activeTournee]);

  // Catalog of available bottle types with codes and designations for selection
  const availableBottleOptions = useMemo(() => {
    const map = new Map<string, { code: string; designation: string; id: string }>();

    // Standard Moroccan gas bottles
    const standardCatalog = [
      { code: '6112', designation: 'AFRIQUIA GAZ CHARGES 12 KGS', id: '6112' },
      { code: '6003', designation: 'TISSIR GAZ CHARGES 3 KG', id: '6003' },
      { code: '8103', designation: 'AFRIQUIA GAZ CHARGES 3 KG', id: '8103' },
      { code: '6134', designation: 'AFRIQUIA GAZ CHARGES 34 KGS', id: '6134' },
      { code: '9112', designation: 'AFRIQUIA GAZ RESERVOIRS 12 KGS', id: '9112' },
      { code: '9003', designation: 'TISSIR GAZ RESERVOIRS 3 KGS', id: '9003' },
      { code: '9103', designation: 'AFRIQUIA GAZ RESERVOIRS 3 KGS', id: '9103' },
    ];
    standardCatalog.forEach(c => map.set(c.code, c));

    // From active loadItems
    loadItems.forEach(it => {
      let code = '6112';
      const nameUpper = (it.bottleTypeName || '').toUpperCase();
      if (nameUpper.includes('34')) code = '6134';
      else if (nameUpper.includes('TISSIR') && nameUpper.includes('3')) code = '6003';
      else if (nameUpper.includes('AFRIQUIA') && nameUpper.includes('3')) code = '8103';
      else if (nameUpper.includes('12')) code = '6112';

      map.set(code, {
        code,
        designation: it.bottleTypeName,
        id: it.bottleTypeId || code,
      });
    });

    // From bottleTypes context
    (bottleTypes || []).forEach((bt: any) => {
      const code = String(bt.code || bt.codeArticle || '').trim();
      if (code && !map.has(code)) {
        map.set(code, { code, designation: bt.name, id: bt.id });
      }
    });

    return Array.from(map.values());
  }, [loadItems, bottleTypes]);

  // Open delivery modal for a stop & initialize bottle quantities and anomalies
  const openDeliveryForStop = (stop: TourneeStop) => {
    setDeliveryModalStop(stop);

    // Initialize bottle counters per bottle type loaded in this Bon de Sortie
    const initialMap: Record<string, {
      full: number;
      empty: number;
      defective: number;
      foreign: number;
      purchased: number;
    }> = {};

    const initialAnomalies: Record<string, {
      defective: BottleAnomalyData;
      foreign: BottleAnomalyData;
      purchased: BottleAnomalyData;
      isSaved?: boolean;
    }> = {};

    const items = loadItems;

    items.forEach((it, idx) => {
      // Default initial delivery: 20 or remaining quantity
      const defaultFull = Math.min(20, it.quantity);
      const key = it.bottleTypeId || `btle-${idx}`;
      initialMap[key] = {
        full: defaultFull,
        empty: defaultFull,
        defective: 0,
        foreign: 0,
        purchased: 0,
      };

      let defaultCode = '6112';
      const nameUpper = (it.bottleTypeName || '').toUpperCase();
      if (nameUpper.includes('34')) defaultCode = '6134';
      else if (nameUpper.includes('TISSIR') && nameUpper.includes('3')) defaultCode = '6003';
      else if (nameUpper.includes('AFRIQUIA') && nameUpper.includes('3')) defaultCode = '8103';
      else if (nameUpper.includes('12')) defaultCode = '6112';

      initialAnomalies[key] = {
        defective: { code: defaultCode, designation: it.bottleTypeName, quantity: 0 },
        foreign: { code: defaultCode, designation: it.bottleTypeName, quantity: 0 },
        purchased: { code: defaultCode, designation: it.bottleTypeName, quantity: 0 },
        isSaved: false,
      };
    });

    setBottleQuantities(initialMap);
    setBottleAnomalies(initialAnomalies);
    setSpecialToggles({});
    setPaymentMethod('cash');
  };

  // Save / Validate anomalies for a specific bottle item
  const handleSaveAnomalies = (key: string) => {
    const anom = bottleAnomalies[key];
    if (!anom) return;

    const defQty = anom.defective.quantity || 0;
    const forQty = anom.foreign.quantity || 0;
    const purQty = anom.purchased.quantity || 0;

    setBottleQuantities(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        defective: defQty,
        foreign: forQty,
        purchased: purQty,
      }
    }));

    setBottleAnomalies(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        isSaved: true,
      }
    }));

    setSpecialToggles(prev => ({ ...prev, [key]: false }));

    const totalSaved = defQty + forQty + purQty;
    toast({
      title: "Anomalies enregistrées",
      description: `${totalSaved} bouteille(s) spéciale(s) enregistrée(s) avec succès.`,
    });
  };

  // Adjust bottle quantities in delivery dialog
  const adjustBottleQty = (bottleTypeId: string, kind: 'full' | 'empty', delta: number) => {
    setBottleQuantities((prev) => {
      const current = prev[bottleTypeId] || { full: 0, empty: 0 };
      const nextVal = Math.max(0, current[kind] + delta);
      return {
        ...prev,
        [bottleTypeId]: {
          ...current,
          [kind]: nextVal,
        },
      };
    });
  };

  // Calculate live delivery total amount
  const deliveryModalTotal = useMemo(() => {
    let sum = 0;
    loadItems.forEach((it, idx) => {
      const key = it.bottleTypeId || `btle-${idx}`;
      const qty = bottleQuantities[key]?.full || 0;
      sum += qty * (it.unitPrice || 0);
    });
    return sum;
  }, [loadItems, bottleQuantities]);

  // Submit delivery at POS
  const handleConfirmDelivery = async () => {
    if (!deliveryModalStop) return;
    setSubmittingDelivery(true);

    let tour = activeTournee;
    if (!tour) {
      // Auto-create active daily tournee for this driver
      const newTourneeId = crypto.randomUUID();
      tour = {
        id: newTourneeId,
        tourneeNumber: `TRN-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        driverId: currentAccount?.driverId || 'driver-1',
        driverName: currentAccount?.driverName || 'Chauffeur',
        truckId: 'truck-1',
        matricule: 'SFT-CAMION',
        status: 'en_cours',
        initialLoad: loadItems,
        remainingLoad: loadItems,
        stops: [],
        totalDeliveredFull: 0,
        totalCollectedEmpty: 0,
        totalSalesAmount: 0,
        totalCashCollected: 0,
        totalCreditDebt: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const existing = await pointVenteService.getTournees();
      await pointVenteService.saveAllTournees([tour, ...existing]);
      setActiveTournee(tour);
    }

    const deliveredItems = loadItems
      .map((it, idx) => {
        const key = it.bottleTypeId || `btle-${idx}`;
        const qtyFull = bottleQuantities[key]?.full || 0;
        return {
          bottleTypeId: it.bottleTypeId,
          bottleTypeName: it.bottleTypeName,
          quantityFull: qtyFull,
          unitPrice: it.unitPrice || 0,
          total: qtyFull * (it.unitPrice || 0),
        };
      })
      .filter((d) => d.quantityFull > 0);

    const collectedEmpty = loadItems
      .map((it, idx) => {
        const key = it.bottleTypeId || `btle-${idx}`;
        const qtyEmpty = bottleQuantities[key]?.empty || 0;
        return {
          bottleTypeId: it.bottleTypeId,
          bottleTypeName: it.bottleTypeName,
          quantityEmpty: qtyEmpty,
        };
      })
      .filter((c) => c.quantityEmpty > 0);

    const defectiveItems = loadItems
      .map((it, idx) => {
        const key = it.bottleTypeId || `btle-${idx}`;
        const anom = bottleAnomalies[key]?.defective;
        const qtyDef = anom?.quantity || bottleQuantities[key]?.defective || 0;
        return {
          bottleTypeId: it.bottleTypeId,
          bottleTypeName: anom?.designation || it.bottleTypeName,
          quantity: qtyDef,
          code: anom?.code,
        };
      })
      .filter((d) => d.quantity > 0);

    const foreignItems = loadItems
      .map((it, idx) => {
        const key = it.bottleTypeId || `btle-${idx}`;
        const anom = bottleAnomalies[key]?.foreign;
        const qtyForeign = anom?.quantity || bottleQuantities[key]?.foreign || 0;
        return {
          bottleTypeId: it.bottleTypeId,
          bottleTypeName: anom?.designation || it.bottleTypeName,
          quantity: qtyForeign,
          code: anom?.code,
        };
      })
      .filter((f) => f.quantity > 0);

    const purchasedItems = loadItems
      .map((it, idx) => {
        const key = it.bottleTypeId || `btle-${idx}`;
        const anom = bottleAnomalies[key]?.purchased;
        const qtyPurchased = anom?.quantity || bottleQuantities[key]?.purchased || 0;
        return {
          bottleTypeId: it.bottleTypeId,
          bottleTypeName: anom?.designation || it.bottleTypeName,
          quantity: qtyPurchased,
          code: anom?.code,
          unitPrice: 30,
        };
      })
      .filter((p) => p.quantity > 0);

    const total = deliveryModalTotal;
    const isCash = paymentMethod === 'cash';

    try {
      const updatedTournee = await pointVenteService.recordDeliveryStop(tour.id, {
        tourneeId: tour.id,
        stopId: deliveryModalStop.id,
        clientId: deliveryModalStop.clientId,
        clientName: deliveryModalStop.clientName,
        posName: deliveryModalStop.posName,
        lat: deliveryModalStop.lat,
        lng: deliveryModalStop.lng,
        status: 'livre',
        deliveredItems,
        collectedEmpty,
        defectiveItems,
        foreignItems,
        purchasedItems,
        paymentMethod,
        amountPaid: isCash ? total : 0,
        amountDebt: isCash ? 0 : total,
      });

      setActiveTournee(updatedTournee);
      setDeliveryModalStop(null);

      // Refresh client POS list
      pointVenteService.getClientPosList().then(setClientPosList).catch(() => {});
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingDelivery(false);
    }
  };

  // Toggle / Start Picking POS on Map
  const handleTogglePickPos = () => {
    if (!isPickingPos) {
      setActiveTab('map');
      const startCoords: [number, number] = [
        safeDriverGps[0] ?? 33.593,
        safeDriverGps[1] ?? -7.648,
      ];
      setPosPickCoords(startCoords);
      setIsPickingPos(true);
    } else {
      setIsPickingPos(false);
    }
  };

  // Quick Mark POS Location from Selected Map Circle
  const handleSavePosLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPosName.trim()) return;
    setSavingPosGps(true);
    try {
      const clientId = `client-${Date.now().toString(36)}`;
      const lat = Number(posPickCoords?.[0]);
      const lng = Number(posPickCoords?.[1]);
      const safeLat = !isNaN(lat) && isFinite(lat) ? lat : (safeDriverGps[0] ?? 33.593);
      const safeLng = !isNaN(lng) && isFinite(lng) ? lng : (safeDriverGps[1] ?? -7.648);

      await pointVenteService.addClientPos({
        clientId,
        clientName: newClientName.trim() || newPosName.trim(),
        posName: newPosName.trim(),
        phone: newPosPhone.trim(),
        ice: newPosIce.trim(),
        patente: newPosPatente.trim(),
        address: newPosAddress.trim(),
        circuitName: 'Circuit Casablanca Ouest',
        lat: safeLat,
        lng: safeLng,
        assignedDriverId: currentAccount?.driverId,
        assignedDriverName: currentAccount?.driverName,
        lastDeliveryDriver: currentAccount?.driverName,
      });

      await pointVenteService.updateClientPosGps(
        clientId,
        safeLat,
        safeLng,
        newPosName.trim()
      );

      // Refresh local POS list
      pointVenteService.getClientPosList().then(setClientPosList).catch(() => {});

      if (activeTournee?.id) {
        await pointVenteService.addStopToTournee(activeTournee.id, {
          clientId,
          clientName: newClientName.trim() || newPosName.trim(),
          posName: newPosName.trim(),
          ice: newPosIce.trim(),
          patente: newPosPatente.trim(),
          lat: safeLat,
          lng: safeLng,
        });
        if (currentAccount?.driverId) {
          await loadTournee(currentAccount.driverId);
        }
      }

      setMarkPosModalOpen(false);
      setIsPickingPos(false);
      setNewPosName('');
      setNewClientName('');
      setNewPosPhone('');
      setNewPosIce('');
      setNewPosPatente('');
      setNewPosAddress('');
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPosGps(false);
    }
  };

  // Clôturer la Tournée
  const handleCloseTournee = async () => {
    if (!activeTournee) return;
    setClosingTour(true);
    try {
      await pointVenteService.closeTournee(activeTournee.id, 'Clôturée par le chauffeur sur Android');
      setCloseTourModalOpen(false);
      setTourClosedSuccess(true);
      if (currentAccount?.driverId) {
        await loadTournee(currentAccount.driverId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClosingTour(false);
    }
  };

  // Total initial bottles count
  const totalInitialBottles = useMemo(() => {
    return (activeTournee?.initialLoad || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
  }, [activeTournee]);

  // Total remaining bottles count
  const totalRemainingBottles = useMemo(() => {
    return (activeTournee?.remainingLoad || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
  }, [activeTournee]);

  // Points de Vente assigned to or visible by this driver (matching web app)
  const driverPosList = useMemo(() => {
    if (!currentAccount) return clientPosList;
    const dId = String(currentAccount.driverId || '').trim().toLowerCase();
    const dName = String(currentAccount.driverName || '').trim().toLowerCase();

    return clientPosList.filter(pos => {
      const assignedId = String(pos.assignedDriverId || '').trim().toLowerCase();
      const assignedName = String(pos.assignedDriverName || '').trim().toLowerCase();
      const lastDriver = String(pos.lastDeliveryDriver || '').trim().toLowerCase();

      // 0. Points visible by all drivers (unrestricted)
      if (!assignedId && !assignedName) {
        return true;
      }
      // 1. Direct assignment by ID or Name
      if (assignedId && (assignedId === dId || assignedId === dName)) {
        return true;
      }
      if (assignedName && (assignedName === dName || assignedName.includes(dName) || dName.includes(assignedName))) {
        return true;
      }
      if (lastDriver && (lastDriver === dName || lastDriver.includes(dName) || dName.includes(lastDriver))) {
        return true;
      }
      // 2. Included in active tournee stops
      if (activeTournee?.stops?.some(s => s.clientId === pos.clientId || s.id === pos.id || s.posName === pos.posName)) {
        return true;
      }
      return false;
    });
  }, [clientPosList, currentAccount, activeTournee]);

  // Normalized stops with guaranteed valid coordinates and clean human labels
  const stops = useMemo(() => {
    const rawStops = activeTournee?.stops || [];
    const usedPosIds = new Set<string>();
    const usedPosNames = new Set<string>();

    const mappedStops: TourneeStop[] = rawStops.map((s, idx) => {
      const lat = Number(s?.lat);
      const lng = Number(s?.lng);

      const seqNum = (typeof s?.sequenceOrder === 'number' && !isNaN(s.sequenceOrder)) 
        ? s.sequenceOrder 
        : (typeof s?.sequenceOrder === 'string' && !isNaN(Number(s.sequenceOrder))) 
          ? Number(s.sequenceOrder) 
          : idx + 1;

      let rawPos = s?.posName;
      if (typeof rawPos === 'object') {
        rawPos = (rawPos as any)?.posName || (rawPos as any)?.name || (rawPos as any)?.title || '';
      }
      let posNameStr = String(rawPos || '').trim();
      if (!posNameStr || posNameStr.includes('[object') || posNameStr.includes('undefined')) {
        posNameStr = `Point de Vente #${seqNum}`;
      }

      let rawClient = s?.clientName;
      if (typeof rawClient === 'object') {
        rawClient = (rawClient as any)?.name || (rawClient as any)?.clientName || '';
      }
      let clientNameStr = String(rawClient || '').trim();
      if (!clientNameStr || clientNameStr.includes('[object') || clientNameStr.includes('undefined')) {
        clientNameStr = `Client #${seqNum}`;
      }

      if (s.id) usedPosIds.add(String(s.id).toLowerCase());
      if (s.clientId) usedPosIds.add(String(s.clientId).toLowerCase());
      if (posNameStr) usedPosNames.add(posNameStr.toLowerCase());

      const matchedPos = driverPosList.find(p => 
        (p.id && String(p.id).toLowerCase() === String(s.id).toLowerCase()) ||
        (p.clientId && String(p.clientId).toLowerCase() === String(s.clientId).toLowerCase()) ||
        (p.posName && p.posName.trim().toLowerCase() === posNameStr.toLowerCase())
      );

      return {
        ...s,
        posName: posNameStr,
        clientName: clientNameStr,
        phone: (s as any).phone || matchedPos?.phone,
        address: (s as any).address || matchedPos?.address,
        ice: s.ice || matchedPos?.ice,
        patente: s.patente || matchedPos?.patente,
        lat: !isNaN(lat) && isFinite(lat) ? lat : (matchedPos?.lat ?? (33.593 + (idx * 0.005))),
        lng: !isNaN(lng) && isFinite(lng) ? lng : (matchedPos?.lng ?? (-7.648 + (idx * 0.005))),
      };
    });

    // Append any registered points of sale assigned to this driver that aren't already represented in tournee stops
    const extraStops: TourneeStop[] = [];
    driverPosList.forEach((pos, pIdx) => {
      const pId = String(pos.id || '').toLowerCase();
      const pClientId = String(pos.clientId || '').toLowerCase();
      const pName = String(pos.posName || '').trim().toLowerCase();

      if (usedPosIds.has(pId) || usedPosIds.has(pClientId) || usedPosNames.has(pName)) {
        return;
      }

      const seqNum = mappedStops.length + extraStops.length + 1;
      extraStops.push({
        id: pos.id || `pos-${pIdx + 1}`,
        tourneeId: activeTournee?.id || 'live-pos',
        clientId: pos.clientId || pos.id || `client-${pIdx + 1}`,
        clientName: pos.clientName || pos.posName,
        posName: pos.posName,
        ice: pos.ice,
        patente: pos.patente,
        phone: pos.phone,
        address: pos.address,
        lat: typeof pos.lat === 'number' && !isNaN(pos.lat) && isFinite(pos.lat) ? pos.lat : (33.593 + (pIdx * 0.005)),
        lng: typeof pos.lng === 'number' && !isNaN(pos.lng) && isFinite(pos.lng) ? pos.lng : (-7.648 + (pIdx * 0.005)),
        status: (pos.status === 'livre' ? 'livre' : 'en_attente') as const,
        sequenceOrder: seqNum,
        deliveredItems: [],
        collectedEmpty: [],
        paymentMethod: 'cash' as const,
        amountPaid: 0,
        amountDebt: 0,
      } as TourneeStop);
    });

    return [...mappedStops, ...extraStops];
  }, [activeTournee?.stops, driverPosList]);

  const deliveredCount = useMemo(() => {
    return stops.filter((s) => s.status === 'livre').length;
  }, [stops]);

  const filteredStops = useMemo(() => {
    return stops.filter((s) => {
      const isOverdue = alerts48h.some(
        (a) => a.clientId === s.clientId || a.posName === s.posName
      );
      if (statusFilter === 'livre' && s.status !== 'livre') return false;
      if (statusFilter === 'en_attente' && s.status === 'livre') return false;
      if (statusFilter === 'alerte_48h' && !isOverdue) return false;
      return true;
    });
  }, [stops, statusFilter, alerts48h]);

  // ==========================================
  // VIEW 1: LOGIN SCREEN
  // ==========================================
  if (!currentAccount) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 text-white notranslate" translate="no">
        <div className="w-full max-w-sm space-y-5">
          {/* Logo & Brand Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 p-1 shadow-2xl shadow-emerald-500/30 flex items-center justify-center">
              <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">SFT GAZ ANDROID</h1>
              <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest">
                Point de Vente & Tournées Gaz
              </p>
            </div>
          </div>

          {/* Traditional Login Form */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Email Chauffeur</label>
                <Input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="magsinier@sftgaz.ma"
                  className="bg-slate-950 border-slate-800 text-white font-mono h-11 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Mot de Passe</label>
                <Input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-950 border-slate-800 text-white font-mono h-11 rounded-xl text-xs"
                />
              </div>

              {authError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-2.5 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black h-11 rounded-xl shadow-lg"
              >
                {authLoading ? 'Connexion en cours...' : 'Se Connecter'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: SUCCESS SCREEN AFTER CLOSING TOUR
  // ==========================================
  if (tourClosedSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center notranslate" translate="no">
        <div className="w-full max-w-sm bg-slate-900 border-2 border-emerald-500/50 rounded-3xl p-6 shadow-2xl space-y-5">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Tournée Clôturée !</h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Toutes les données de ventes, de bouteilles pleines restantes et de bouteilles vides ont été synchronisées vers l'application SFT GAZ.
            </p>
          </div>
          <div className="bg-black/50 p-4 rounded-2xl border border-white/10 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Ventes :</span>
              <strong className="text-emerald-400 font-mono text-sm">{(activeTournee?.totalSalesAmount || 0).toFixed(2)} DH</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Espèces Encaissées :</span>
              <strong className="text-emerald-300 font-mono text-sm">{(activeTournee?.totalCashCollected || 0).toFixed(2)} DH</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Vides Ramassés :</span>
              <strong className="text-amber-400 font-mono text-sm">{activeTournee?.totalCollectedEmpty || 0} btles</strong>
            </div>
          </div>
          <Button
            onClick={() => setTourClosedSuccess(false)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl"
          >
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: MAIN DRIVER MOBILE WORKSPACE
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col select-none max-w-md mx-auto shadow-2xl relative notranslate" translate="no">
      {/* Mobile App Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 flex items-center justify-center font-black text-white text-xs shadow-md">
            SFT
          </div>
          <div>
            <div className="font-black text-sm text-white flex items-center gap-1.5 leading-tight">
              <span>{currentAccount.driverName}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            {/* Clickable B.S Switcher Badge */}
            <button
              type="button"
              onClick={() => setSwitchBsModalOpen(true)}
              className="text-[10px] text-slate-300 hover:text-white flex items-center gap-1 font-mono transition-colors"
            >
              <span>B.S:</span>
              <strong className="text-emerald-400 underline decoration-dotted">
                {activeTournee?.supplyOrderNumber || 'Choisir un B.S'}
              </strong>
              <ChevronDown className="w-3 h-3 text-emerald-400" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Interactive + POS Map Circle Button */}
          <Button
            size="sm"
            onClick={handleTogglePickPos}
            className={`h-8 font-black text-[11px] px-2.5 rounded-lg flex items-center gap-1.5 shadow-md transition-all active:scale-95 ${
              isPickingPos
                ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400 animate-pulse'
                : 'bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{isPickingPos ? '✕ Annuler' : '+ POS'}</span>
          </Button>

          {/* Logout */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLogout}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* 48-Hour Inactivity Driver Alert Strip */}
      {alerts48h.length > 0 && (
        <div
          onClick={() => setShowAlerts48hModal(true)}
          className="bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 text-white px-3 py-2 text-xs font-bold flex items-center justify-between cursor-pointer shadow-lg animate-pulse border-b border-rose-400 z-20 shrink-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">⚠️</span>
            <span>ALERTE 48H : {alerts48h.length} client(s) sans gaz (+48h) !</span>
          </div>
          <span className="bg-black/40 hover:bg-black/60 px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider flex items-center gap-1">
            Détails ➔
          </span>
        </div>
      )}

      {/* Driver Status Strip */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-3 py-2 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-slate-400">Livrées: </span>
            <strong className="text-emerald-400 font-black">
              {deliveredCount}/{stops.length}
            </strong>
          </div>
          <div>
            <span className="text-slate-400">Vides: </span>
            <strong className="text-amber-400 font-black">{activeTournee?.totalCollectedEmpty || 0}</strong>
          </div>
          <div>
            <span className="text-slate-400">Restant: </span>
            <strong className="text-cyan-400 font-black">{totalRemainingBottles} btles</strong>
          </div>
        </div>
        <div>
          <strong className="text-emerald-300 font-mono font-black">
            {(activeTournee?.totalCashCollected || 0).toFixed(0)} DH
          </strong>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🌟 ANIMATED BOTTLES EXHIBITION BAR (CHARGEMENT B.S DE DÉPART)            */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 p-2.5 space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="text-xs font-black uppercase text-slate-200 tracking-wider">
              Bouteilles en Camion ({totalRemainingBottles}/{totalInitialBottles})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowBottlesDrawer((prev) => !prev)}
            className="text-[11px] text-cyan-400 font-bold flex items-center gap-0.5 hover:underline"
          >
            <span>{showBottlesDrawer ? 'Masquer' : 'Afficher'}</span>
            {showBottlesDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <AnimatePresence>
          {showBottlesDrawer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              {loadItems.length === 0 ? (
                <div className="text-center py-4 px-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-300 space-y-2">
                  <div className="text-xs font-semibold text-slate-400">
                    Aucun Bon de Sortie actif rattaché au camion.
                  </div>
                  {availableBons.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSwitchBsModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Charger les Bouteilles depuis un B.S ({availableBons.length} B.S dispo)</span>
                    </button>
                  ) : (
                    <div className="text-[11px] text-slate-500">
                      Créez un Bon de Sortie sur le tableau de bord web pour charger le camion.
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 no-scrollbar">
                  {loadItems.map((item, idx) => (
                    <motion.div
                      key={item.bottleTypeId || idx}
                      initial={{ opacity: 0, scale: 0.75, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 20, delay: idx * 0.08 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className="min-w-[140px] p-3 rounded-2xl bg-gradient-to-b from-slate-800/95 via-slate-900/95 to-slate-950 border border-slate-700/80 shadow-xl flex flex-col justify-between relative overflow-hidden group shrink-0"
                    >
                      {/* Top Bottle Header with Animation */}
                      <div className="flex items-center justify-between">
                        <motion.div
                          animate={{ y: [0, -3, 0] }}
                          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: idx * 0.2 }}
                        >
                          <GasBottleVisual name={item.bottleTypeName} className="w-8 h-12" />
                        </motion.div>
                        <div className="text-right">
                          <span className="font-mono text-lg font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">
                            {item.quantity}
                          </span>
                          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">pleines</div>
                        </div>
                      </div>

                      {/* Name & Pricing */}
                      <div className="mt-2 space-y-0.5">
                        <div className="text-xs font-bold text-white truncate" title={item.bottleTypeName}>
                          {item.bottleTypeName}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>Prix:</span>
                          <span className="text-emerald-300 font-bold">{item.unitPrice || 24.7} DH</span>
                        </div>
                      </div>

                      {/* Stock Status Bar */}
                      <div className="w-full h-1.5 bg-slate-950 rounded-full mt-2 overflow-hidden border border-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (item.quantity / 50) * 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.2 + idx * 0.1 }}
                          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Tab Switcher */}
      <div className="grid grid-cols-3 bg-slate-900 p-1 border-b border-slate-800 gap-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'map' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Carte Google</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('livraisons')}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'livraisons' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Points Vente ({stops.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'stock' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Stock ({totalRemainingBottles})</span>
        </button>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* ============================== */}
        {/* TAB 1: GOOGLE MAPS LEAFLET     */}
        {/* ============================== */}
        {activeTab === 'map' && (
          <div className="flex-1 w-full h-[65vh] min-h-[460px] relative">
            {/* Map Top Status Filter Buttons (Separated Livrés / En Attente) */}
            <div className="absolute top-3 left-3 z-[990] flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 gap-1 shadow-lg backdrop-blur-sm max-w-[240px] overflow-x-auto">
              <button
                type="button"
                onClick={() => setStatusFilter(prev => prev === 'all' ? 'all' : 'all')}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  statusFilter === 'all' ? 'bg-slate-700 text-white shadow' : 'text-slate-400'
                }`}
              >
                ⚪ Tous ({stops.length})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(prev => prev === 'livre' ? 'all' : 'livre')}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                  statusFilter === 'livre' ? 'bg-emerald-600 text-white shadow ring-1 ring-emerald-400' : 'text-emerald-400'
                }`}
              >
                🟢 Livrés ({deliveredCount})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(prev => prev === 'en_attente' ? 'all' : 'en_attente')}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                  statusFilter === 'en_attente' ? 'bg-rose-600 text-white shadow ring-1 ring-rose-400' : 'text-rose-400'
                }`}
              >
                🔴 Attente ({stops.length - deliveredCount})
              </button>

              {alerts48h.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter(prev => prev === 'alerte_48h' ? 'all' : 'alerte_48h')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                    statusFilter === 'alerte_48h' ? 'bg-amber-600 text-white shadow ring-1 ring-amber-400' : 'text-amber-400'
                  }`}
                >
                  ⚠️ 48h ({alerts48h.length})
                </button>
              )}
            </div>

            {/* Floating Top Banner when in +POS Picking Mode */}
            {!markPosModalOpen && isPickingPos && (
              <div className="absolute top-14 left-2 right-2 z-[1000] bg-slate-900/95 border-2 border-cyan-400 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md flex items-center justify-between gap-2 animate-in slide-in-from-top-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 animate-bounce" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">
                      Cliquez sur la carte pour placer la zone du Point de Vente
                    </div>
                    <div className="text-[10px] text-cyan-300 font-medium">
                      Touchez le cercle ⭕ ou le bouton pour remplir la fiche POS
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => setMarkPosModalOpen(true)}
                    className="h-8 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs px-2.5 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Remplir Fiche POS</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsPickingPos(false)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-white rounded-xl"
                    title="Annuler"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Google Map Layer Switcher Button */}
            <div className="absolute top-3 right-3 z-[1000] flex items-center bg-slate-900/95 border border-slate-700/80 rounded-xl p-1 shadow-xl backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setMobileLayer('google_roads')}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                  mobileLayer === 'google_roads' ? 'bg-indigo-600 text-white' : 'text-slate-300'
                }`}
              >
                Plan
              </button>
              <button
                type="button"
                onClick={() => setMobileLayer('google_hybrid')}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                  mobileLayer === 'google_hybrid' ? 'bg-indigo-600 text-white' : 'text-slate-300'
                }`}
              >
                Sat
              </button>
              <button
                type="button"
                onClick={() => setMobileLayer('google_terrain')}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                  mobileLayer === 'google_terrain' ? 'bg-indigo-600 text-white' : 'text-slate-300'
                }`}
              >
                Relief
              </button>
            </div>

            <MapContainer
              center={safeDriverGps}
              zoom={13}
              className="w-full h-full bg-slate-950 z-0"
              style={{ width: '100%', height: '100%', minHeight: '460px' }}
              zoomControl={false}
            >
              <TileLayer
                attribution={MOBILE_MAP_LAYERS[mobileLayer]?.attribution || '&copy; Google Maps'}
                url={MOBILE_MAP_LAYERS[mobileLayer]?.url || MOBILE_MAP_LAYERS.google_roads.url}
              />

              <MobileMapController center={safeDriverGps} zoom={13} />

              {/* Map click listener when in +POS mode */}
              <MapEventsHandler
                isPicking={isPickingPos}
                onPick={(lat, lng) => setPosPickCoords([lat, lng])}
              />

              {/* Interactive Circle & Target Marker when in +POS Mode */}
              {isPickingPos && (
                <>
                  <Circle
                    center={posPickCoords}
                    radius={50}
                    pathOptions={{
                      color: '#06b6d4',
                      fillColor: '#22d3ee',
                      fillOpacity: 0.35,
                      weight: 3,
                      dashArray: '5, 5',
                    }}
                    eventHandlers={{
                      click: () => setMarkPosModalOpen(true),
                    }}
                  />
                  <Marker
                    position={posPickCoords}
                    icon={createPickTargetIcon()}
                    eventHandlers={{
                      click: () => setMarkPosModalOpen(true),
                    }}
                  >
                    <Popup autoPan={false}>
                      <div className="p-2 text-center text-slate-900 min-w-[170px]">
                        <div className="font-black text-xs text-cyan-700">📍 Définir Point de Vente (POS)</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {posPickCoords[0].toFixed(5)}, {posPickCoords[1].toFixed(5)}
                        </div>
                        <button
                          type="button"
                          onClick={() => setMarkPosModalOpen(true)}
                          className="mt-2 w-full px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs rounded-lg shadow active:scale-95 transition-all"
                        >
                          Remplir Fiche POS 📝
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                </>
              )}

              {/* Driver Location Marker */}
              <Marker position={safeDriverGps} icon={createDriverLocationIcon()}>
                <Popup>
                  <div className="p-1 text-slate-900 text-xs font-bold">
                    <span>Position Camion SFT GAZ</span>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {safeDriverGps[0].toFixed(5)}, {safeDriverGps[1].toFixed(5)}
                    </div>
                  </div>
                </Popup>
              </Marker>

              {/* Delivery Tour Line */}
              {stops.length > 0 && (
                <Polyline
                  positions={[safeDriverGps, ...stops.map((s) => [s.lat, s.lng] as [number, number])]}
                  color="#0284c7"
                  weight={4}
                  opacity={0.8}
                  dashArray="6, 6"
                />
              )}

              {/* POS Markers */}
              {filteredStops.map((stop, idx) => {
                const isOverdue = alerts48h.some(
                  (a) => a.clientId === stop.clientId || a.posName === stop.posName
                );
                return (
                  <Marker
                    key={stop.id || `stop-${idx}`}
                    position={[stop.lat, stop.lng]}
                    icon={createStopMarkerIcon(stop.status, stop.sequenceOrder || idx + 1, isOverdue)}
                    eventHandlers={{
                      click: () => openDeliveryForStop(stop),
                    }}
                  >
                    <Popup>
                      <div className="p-2 text-slate-900 text-xs min-w-[160px]">
                        {isOverdue && (
                          <div className="mb-1.5 p-1 rounded bg-amber-100 text-amber-900 font-black text-[10px] flex items-center gap-1">
                            <span>⚠️</span>
                            <span>Alerte 48h sans gaz !</span>
                          </div>
                        )}
                        <div className="font-black text-sm">{cleanLabel(stop.posName, `Arrêt #${stop.sequenceOrder || idx + 1}`)}</div>
                        <div className="text-slate-600 text-[11px] mt-0.5">{cleanLabel(stop.clientName, 'Client')}</div>
                        <div className="mt-2">
                          {stop.status === 'livre' ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">🟢 Livré</span>
                          ) : (
                            <button
                              onClick={() => openDeliveryForStop(stop)}
                              className="bg-emerald-600 text-white font-bold px-3 py-1 rounded text-xs mt-1 w-full"
                            >
                              Enregistrer Vente
                            </button>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* Quick floating action bar over map */}
            <div className="absolute bottom-4 left-3 right-3 z-10 space-y-2">
              <Button
                onClick={() => setCloseTourModalOpen(true)}
                className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black py-3.5 rounded-2xl shadow-2xl flex items-center justify-center gap-2 text-sm border border-emerald-400/40"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Clôturer la Tournée (Fin de Journée)</span>
              </Button>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* TAB 2: STOPS LIST (LIVRAISONS) */}
        {/* ============================== */}
        {activeTab === 'livraisons' && (
          <div className="p-3 space-y-3 pb-24 overflow-y-auto">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-xl font-bold transition-all ${
                  statusFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-400'
                }`}
              >
                Tous ({stops.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('livre')}
                className={`px-3 py-1 rounded-xl font-bold transition-all flex items-center gap-1 ${
                  statusFilter === 'livre' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-emerald-400'
                }`}
              >
                🟢 Livrés ({deliveredCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('en_attente')}
                className={`px-3 py-1 rounded-xl font-bold transition-all flex items-center gap-1 ${
                  statusFilter === 'en_attente' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-rose-400'
                }`}
              >
                🔴 En Attente ({stops.length - deliveredCount})
              </button>
              {alerts48h.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('alerte_48h')}
                  className={`px-3 py-1 rounded-xl font-bold transition-all flex items-center gap-1 ${
                    statusFilter === 'alerte_48h' ? 'bg-amber-600 text-white' : 'bg-slate-900 text-amber-400'
                  }`}
                >
                  ⚠️ 48h ({alerts48h.length})
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1">
              <span>LISTE DU CIRCUIT ({filteredStops.length} ARRÊTS)</span>
              <span className="text-emerald-400">{deliveredCount} livrés</span>
            </div>

            {filteredStops.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
                Aucun arrêt correspondant à ce filtre.
              </div>
            ) : (
              filteredStops.map((stop, idx) => {
                const isDelivered = stop.status === 'livre';
                const isOverdue = alerts48h.some(a => a.clientId === stop.clientId || a.posName === stop.posName);
                const overdueInfo = alerts48h.find(a => a.clientId === stop.clientId || a.posName === stop.posName);

                return (
                  <motion.div
                    key={stop.id || idx}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => openDeliveryForStop(stop)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isDelivered
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-slate-300'
                        : (isOverdue ? 'bg-slate-900 border-amber-500/50 hover:border-amber-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-white')
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            isDelivered
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : (isOverdue ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30')
                          }`}
                        >
                          {isDelivered ? '✓' : (isOverdue ? '⚠️' : stop.sequenceOrder || idx + 1)}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white leading-tight">
                            {cleanLabel(stop.posName, `Arrêt #${stop.sequenceOrder || idx + 1}`)}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">Client: {cleanLabel(stop.clientName, 'Client')}</div>
                          {isOverdue && (
                            <div className="text-[10px] text-amber-300 font-bold flex items-center gap-1 mt-1 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>Non approvisionné depuis +{overdueInfo?.hoursSinceLastDelivery || 48}h</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <Badge
                        className={
                          isDelivered
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] shrink-0'
                            : (isOverdue ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] shrink-0' : 'bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] shrink-0')
                        }
                      >
                        {isDelivered ? '🟢 Livré' : (isOverdue ? '⚠️ Retard 48h' : '🔴 À livrer')}
                      </Badge>
                    </div>

                    {isDelivered ? (
                      <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300 font-mono">
                        <span>Livrées: {stop.deliveredItems?.map((d) => `${d.quantityFull}x ${d.bottleTypeName}`).join(', ') || 'OK'}</span>
                        <strong>{stop.amountPaid ? `${stop.amountPaid} DH` : 'Crédit'}</strong>
                      </div>
                    ) : (
                      <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span>Tapez pour enregistrer la distribution</span>
                        <ChevronRight className="w-4 h-4 text-emerald-400" />
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}

            <Button
              onClick={() => setCloseTourModalOpen(true)}
              className="w-full bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black py-3.5 rounded-2xl shadow-xl mt-4"
            >
              🏁 Clôturer la Tournée
            </Button>
          </div>
        )}

        {/* ============================== */}
        {/* TAB 3: TRUCK STOCK (CHARGEMENT)*/}
        {/* ============================== */}
        {activeTab === 'stock' && (
          <div className="p-3 space-y-4 pb-24 overflow-y-auto">
            {/* Animated Cards for Each Gas Bottle Type */}
            <div className="space-y-3">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider block px-1">
                Détail des Bouteilles de Gaz Chargées
              </span>

              {loadItems.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
                  Aucun chargement détecté.
                </div>
              ) : (
                loadItems.map((it, idx) => (
                  <motion.div
                    key={it.bottleTypeId || idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <GasBottleVisual name={it.bottleTypeName} className="w-10 h-14" />
                      <div>
                        <div className="font-black text-sm text-white">{it.bottleTypeName}</div>
                        <div className="text-xs text-slate-400 font-mono">Prix unitaire: {it.unitPrice || 24.7} DH</div>
                        <div className="text-[11px] text-emerald-400 mt-1 font-bold">
                          Valeur totale: {((it.quantity || 0) * (it.unitPrice || 24.7)).toFixed(2)} DH
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-medium">Quantité</span>
                      <span className="text-2xl font-black font-mono text-emerald-400">{it.quantity}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Empty Bottles Collected */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-lg">
              <div>
                <span className="text-xs font-bold uppercase text-slate-400 block">Total Bouteilles Vides Ramassées</span>
                <span className="text-[11px] text-slate-500">Stockées pour le retour au dépôt</span>
              </div>
              <span className="font-black text-2xl text-amber-400 font-mono">
                {activeTournee?.totalCollectedEmpty || 0}
              </span>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-lg">
              <span className="text-xs font-bold uppercase text-slate-400 block">Encaissements Terrain</span>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Espèces :</span>
                <strong className="text-emerald-400 font-mono font-bold">
                  {(activeTournee?.totalCashCollected || 0).toFixed(2)} DH
                </strong>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Crédit / Dettes :</span>
                <strong className="text-amber-400 font-mono font-bold">
                  {(activeTournee?.totalCreditDebt || 0).toFixed(2)} DH
                </strong>
              </div>
            </div>

            <Button
              onClick={() => setCloseTourModalOpen(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-2xl shadow-xl"
            >
              🏁 Clôturer la Tournée & Valider
            </Button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ENREGISTRER UNE VENTE / DISTRIBUTION POINT DE VENTE              */}
      {/* ========================================================================= */}
      <Dialog open={Boolean(deliveryModalStop)} onOpenChange={(open) => !open && setDeliveryModalStop(null)}>
        <DialogContent className="sm:max-w-md w-[calc(100vw-1.5rem)] max-w-md bg-slate-900 border-slate-800 text-white rounded-3xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-400" />
              <span>Livraison Point de Vente</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {cleanLabel(deliveryModalStop?.posName, 'Point de Vente')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <span className="text-xs font-bold uppercase text-slate-400 block">
              Choix des Bouteilles (Pleines livrées / Vides reprises) :
            </span>

            {/* List of Loaded Bottle Types with interactive +/- counters */}
            {loadItems.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs text-center space-y-2">
                <AlertCircle className="w-5 h-5 text-amber-400 mx-auto" />
                <div className="font-bold">Aucun Bon de Sortie actif rattaché au camion.</div>
                <div className="text-[11px] text-amber-300/80">
                  Veuillez d'abord sélectionner ou créer un Bon de Sortie pour charger les bouteilles dans le camion.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {loadItems.map((item, idx) => {
                const key = item.bottleTypeId || `btle-${idx}`;
                const currentFull = bottleQuantities[key]?.full || 0;
                const currentEmpty = bottleQuantities[key]?.empty || 0;
                const defaultItemCode = (item.bottleTypeName || '').toUpperCase().includes('34')
                  ? '6134'
                  : (item.bottleTypeName || '').toUpperCase().includes('TISSIR') && (item.bottleTypeName || '').toUpperCase().includes('3')
                  ? '6003'
                  : (item.bottleTypeName || '').toUpperCase().includes('AFRIQUIA') && (item.bottleTypeName || '').toUpperCase().includes('3')
                  ? '8103'
                  : '6112';

                const anom = bottleAnomalies[key] || {
                  defective: { code: defaultItemCode, designation: item.bottleTypeName, quantity: 0 },
                  foreign: { code: defaultItemCode, designation: item.bottleTypeName, quantity: 0 },
                  purchased: { code: defaultItemCode, designation: item.bottleTypeName, quantity: 0 },
                  isSaved: false,
                };

                const currentDefective = anom.defective?.quantity ?? (bottleQuantities[key]?.defective || 0);
                const currentForeign = anom.foreign?.quantity ?? (bottleQuantities[key]?.foreign || 0);
                const currentPurchased = anom.purchased?.quantity ?? (bottleQuantities[key]?.purchased || 0);

                const isSurplusEmpty = currentEmpty > currentFull;
                const hasSpecialValues = currentDefective > 0 || currentForeign > 0 || currentPurchased > 0;
                const isSpecialOpen = Boolean(specialToggles[key] || (isSurplusEmpty && !anom.isSaved) || (hasSpecialValues && specialToggles[key] !== false));
                const totalSpecialQty = currentDefective + currentForeign + currentPurchased;

                return (
                  <div key={key} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GasBottleVisual name={item.bottleTypeName} className="w-6 h-9" />
                        <div>
                          <div className="font-bold text-xs text-white">{item.bottleTypeName}</div>
                          <div className="text-[10px] text-emerald-400 font-mono">
                            {item.unitPrice || 24.7} DH / unité
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500">Sous-total:</span>
                        <div className="font-mono text-xs font-bold text-emerald-300">
                          {(currentFull * (item.unitPrice || 24.7)).toFixed(2)} DH
                        </div>
                      </div>
                    </div>

                    {/* Full Counter (Direct numeric input, sans boutons +/-) */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Flame className="w-4 h-4" />
                        Pleines Livrées:
                      </span>
                      <div className="flex items-center">
                        <Input
                          type="number"
                          min="0"
                          value={currentFull === 0 ? '' : currentFull}
                          placeholder="0"
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setBottleQuantities((prev) => ({
                              ...prev,
                              [key]: {
                                full: val,
                                empty: prev[key]?.empty ?? 0,
                                defective: prev[key]?.defective ?? 0,
                                foreign: prev[key]?.foreign ?? 0,
                                purchased: prev[key]?.purchased ?? 0,
                              },
                            }));
                          }}
                          className="h-9 w-24 text-center font-bold text-sm font-mono bg-slate-900 border-slate-700 text-emerald-300 focus:border-emerald-500 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Empty Counter (Direct numeric input, sans boutons +/-) */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4" />
                        Vides Ramassées:
                      </span>
                      <div className="flex items-center">
                        <Input
                          type="number"
                          min="0"
                          value={currentEmpty === 0 ? '' : currentEmpty}
                          placeholder="0"
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setBottleQuantities((prev) => ({
                              ...prev,
                              [key]: {
                                empty: val,
                                full: prev[key]?.full ?? 0,
                                defective: prev[key]?.defective ?? 0,
                                foreign: prev[key]?.foreign ?? 0,
                                purchased: prev[key]?.purchased ?? 0,
                              },
                            }));
                          }}
                          className="h-9 w-24 text-center font-bold text-sm font-mono bg-slate-900 border-slate-700 text-amber-300 focus:border-amber-500 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Bouton Toggle Bouteilles Spéciales / Anomalies */}
                    <div className="pt-2 border-t border-slate-900">
                      <button
                        type="button"
                        onClick={() => {
                          setSpecialToggles(prev => ({ ...prev, [key]: !isSpecialOpen }));
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between border ${
                          isSpecialOpen || hasSpecialValues || isSurplusEmpty
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <AlertTriangle className={`w-3.5 h-3.5 ${isSurplusEmpty || hasSpecialValues ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
                          <span>
                            {isSurplusEmpty 
                              ? `Surplus de ${currentEmpty - currentFull} bouteille(s) vide(s) (Anomalies / Achat)`
                              : 'Bouteilles Spéciales / Anomalies'}
                          </span>
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-slate-800 text-slate-300">
                          {isSpecialOpen ? 'Masquer' : (anom.isSaved || totalSpecialQty > 0 ? `✓ ${totalSpecialQty} enregistrée(s)` : '+ Déclarer')}
                        </span>
                      </button>

                      {/* Champs Bouteilles Défectueuses, Étrangères & Achat Livreur - Design Compact & Moderne */}
                      {isSpecialOpen && (
                        <div className="mt-2 p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-inner space-y-2 max-w-full overflow-hidden">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-800/80 text-[11px]">
                            <span className="font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              Détail des Anomalies :
                            </span>
                            {isSurplusEmpty && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                                Écart: +{currentEmpty - currentFull}
                              </span>
                            )}
                          </div>

                          {/* 1. Bouteilles Défectueuses */}
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-rose-500/20 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-rose-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
                                Bouteilles Défectueuses :
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">Qté</span>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <select
                                value={anom.defective?.code || defaultItemCode}
                                onChange={(e) => {
                                  const code = e.target.value;
                                  const opt = availableBottleOptions.find(o => o.code === code);
                                  setBottleAnomalies(prev => ({
                                    ...prev,
                                    [key]: {
                                      ...anom,
                                      defective: {
                                        ...anom.defective,
                                        code,
                                        designation: opt?.designation || anom.defective.designation,
                                      }
                                    }
                                  }));
                                }}
                                className="min-w-0 flex-1 h-8 px-2 text-[11px] font-medium rounded-lg bg-slate-950 border border-slate-700/80 text-white focus:outline-none focus:border-rose-500 truncate"
                              >
                                {availableBottleOptions.map(opt => (
                                  <option key={`def-opt-${opt.code}`} value={opt.code} className="bg-slate-900 text-white">
                                    {opt.code} • {opt.designation}
                                  </option>
                                ))}
                              </select>
                              <Input
                                type="number"
                                min="0"
                                value={anom.defective?.quantity === 0 ? '' : (anom.defective?.quantity || '')}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setBottleAnomalies(prev => ({
                                    ...prev,
                                    [key]: {
                                      ...anom,
                                      defective: {
                                        ...anom.defective,
                                        quantity: val,
                                      }
                                    }
                                  }));
                                }}
                                className="w-16 h-8 text-center font-bold text-xs font-mono bg-slate-950 border-rose-900/60 text-rose-300 focus:border-rose-500 rounded-lg shrink-0"
                              />
                            </div>
                          </div>

                          {/* 2. Bouteilles Étrangères */}
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-amber-500/20 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                                Bouteilles Étrangères :
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">Qté</span>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <select
                                value={anom.foreign?.code || defaultItemCode}
                                onChange={(e) => {
                                  const code = e.target.value;
                                  const opt = availableBottleOptions.find(o => o.code === code);
                                  setBottleAnomalies(prev => ({
                                    ...prev,
                                    [key]: {
                                      ...anom,
                                      foreign: {
                                        ...anom.foreign,
                                        code,
                                        designation: opt?.designation || anom.foreign.designation,
                                      }
                                    }
                                  }));
                                }}
                                className="min-w-0 flex-1 h-8 px-2 text-[11px] font-medium rounded-lg bg-slate-950 border border-slate-700/80 text-white focus:outline-none focus:border-amber-500 truncate"
                              >
                                {availableBottleOptions.map(opt => (
                                  <option key={`for-opt-${opt.code}`} value={opt.code} className="bg-slate-900 text-white">
                                    {opt.code} • {opt.designation}
                                  </option>
                                ))}
                              </select>
                              <Input
                                type="number"
                                min="0"
                                value={anom.foreign?.quantity === 0 ? '' : (anom.foreign?.quantity || '')}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setBottleAnomalies(prev => ({
                                    ...prev,
                                    [key]: {
                                      ...anom,
                                      foreign: {
                                        ...anom.foreign,
                                        quantity: val,
                                      }
                                    }
                                  }));
                                }}
                                className="w-16 h-8 text-center font-bold text-xs font-mono bg-slate-950 border-amber-900/60 text-amber-300 focus:border-amber-500 rounded-lg shrink-0"
                              />
                            </div>
                          </div>

                          {/* 3. Achat Livreur (Bouteilles Vides) */}
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-purple-500/20 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-purple-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
                                Achat Livreur (Bouteilles Vides) :
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">Qté</span>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <select
                                value={anom.purchased?.code || defaultItemCode}
                                onChange={(e) => {
                                  const code = e.target.value;
                                  const opt = availableBottleOptions.find(o => o.code === code);
                                  setBottleAnomalies(prev => ({
                                    ...prev,
                                    [key]: {
                                      ...anom,
                                      purchased: {
                                        ...anom.purchased,
                                        code,
                                        designation: opt?.designation || anom.purchased.designation,
                                      }
                                    }
                                  }));
                                }}
                                className="min-w-0 flex-1 h-8 px-2 text-[11px] font-medium rounded-lg bg-slate-950 border border-slate-700/80 text-white focus:outline-none focus:border-purple-500 truncate"
                              >
                                {availableBottleOptions.map(opt => (
                                  <option key={`pur-opt-${opt.code}`} value={opt.code} className="bg-slate-900 text-white">
                                    {opt.code} • {opt.designation}
                                  </option>
                                ))}
                              </select>
                              <Input
                                type="number"
                                min="0"
                                value={anom.purchased?.quantity === 0 ? '' : (anom.purchased?.quantity || '')}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setBottleAnomalies(prev => ({
                                    ...prev,
                                    [key]: {
                                      ...anom,
                                      purchased: {
                                        ...anom.purchased,
                                        quantity: val,
                                      }
                                    }
                                  }));
                                }}
                                className="w-16 h-8 text-center font-bold text-xs font-mono bg-slate-950 border-purple-900/60 text-purple-300 focus:border-purple-500 rounded-lg shrink-0"
                              />
                            </div>
                          </div>

                          {/* Bouton Enregistrer Compact & Rapide */}
                          <Button
                            type="button"
                            onClick={() => handleSaveAnomalies(key)}
                            className="w-full h-8 mt-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-[0.98]"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Enregistrer</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {/* Price & Mode Règlement */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 font-bold uppercase">Total à Encaisser</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {deliveryModalTotal.toFixed(2)} DH
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Espèces</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === 'credit'
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Crédit / Dette</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cheque')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === 'cheque'
                      ? 'bg-sky-600/20 border-sky-500 text-sky-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Chèque</span>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2">
            <Button
              type="button"
              disabled={submittingDelivery || loadItems.length === 0}
              onClick={handleConfirmDelivery}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl shadow-lg disabled:opacity-50"
            >
              {submittingDelivery ? 'Enregistrement...' : 'Valider la Vente & Encaisser'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeliveryModalStop(null)}
              className="w-full border-slate-700 text-slate-300 rounded-xl"
            >
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: SWITCHER DE BON DE SORTIE                                        */}
      {/* ========================================================================= */}
      <Dialog open={switchBsModalOpen} onOpenChange={setSwitchBsModalOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              <span>Sélectionner un Bon de Sortie</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Choisissez le Bon de Sortie avec lequel vous démarrez la tournée :
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-60 overflow-y-auto">
            {availableBons.map((b) => {
              const num = b.order_number || b.ordernumber || b.orderNumber;
              const isSelected = activeTournee?.supplyOrderNumber === num;
              const items = Array.isArray(b.items) ? b.items : [];
              const count = items.reduce(
                (sum: number, it: any) => sum + Number(it.fullQuantity || it.quantity || 0),
                0
              );

              return (
                <div
                  key={b.id || num}
                  onClick={() => handleSelectBonDeSortie(b)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-black text-sm flex items-center gap-2">
                      <span>B.S N° {num}</span>
                      {isSelected && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded">
                          Actif
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {b.driver_name || 'Chauffeur'} • {count} bouteilles chargées
                    </div>
                  </div>
                  <strong className="text-xs font-mono text-emerald-400">{b.total || 0} DH</strong>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: REMPLIR LES DONNÉES DU POINT DE VENTE SÉLECTIONNÉ SUR LA CARTE   */}
      {/* ========================================================================= */}
      <Dialog open={markPosModalOpen} onOpenChange={setMarkPosModalOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white rounded-3xl p-5 max-h-[90vh] overflow-y-auto z-[2000]">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <div>Nouveau Point de Vente (POS)</div>
                <div className="text-[11px] text-slate-400 font-normal">Fiche Point de Vente & Client</div>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Position GPS captée depuis la carte. Veuillez renseigner les informations du point de vente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePosLocation} className="space-y-3.5 py-2">
            {/* Coordinates Badge */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-cyan-500/30 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                <span className="text-slate-400">Position GPS sélectionnée :</span>
              </div>
              <strong className="text-cyan-300 font-bold">
                {posPickCoords[0].toFixed(5)}, {posPickCoords[1].toFixed(5)}
              </strong>
            </div>

            {/* POS Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Nom du Point de Vente (Magasin)</span>
                <span className="text-rose-400 text-[10px]">* Requis</span>
              </label>
              <Input
                value={newPosName}
                onChange={(e) => setNewPosName(e.target.value)}
                placeholder="Ex: Épicerie Al Baraka - Bourgogne"
                className="bg-slate-950 border-slate-800 text-white text-xs h-11 rounded-xl focus:border-cyan-500"
                required
                autoFocus
              />
            </div>

            {/* Client / Owner Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">
                Nom du Client / Responsable (Optionnel)
              </label>
              <Input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Ex: Mohamed Alami"
                className="bg-slate-950 border-slate-800 text-white text-xs h-11 rounded-xl focus:border-cyan-500"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">
                Numéro de Téléphone (Optionnel)
              </label>
              <Input
                value={newPosPhone}
                onChange={(e) => setNewPosPhone(e.target.value)}
                placeholder="Ex: 06 61 23 45 67"
                type="tel"
                className="bg-slate-950 border-slate-800 text-white text-xs h-11 rounded-xl focus:border-cyan-500"
              />
            </div>

            {/* ICE & Patente (Optionnels) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  ICE (Optionnel)
                </label>
                <Input
                  value={newPosIce}
                  onChange={(e) => setNewPosIce(e.target.value)}
                  placeholder="Ex: 001234567000089"
                  className="bg-slate-950 border-slate-800 text-white text-xs h-11 rounded-xl focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  PATENTE (Optionnel)
                </label>
                <Input
                  value={newPosPatente}
                  onChange={(e) => setNewPosPatente(e.target.value)}
                  placeholder="Ex: 12345678"
                  className="bg-slate-950 border-slate-800 text-white text-xs h-11 rounded-xl focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">
                Adresse / Quartier (Optionnel)
              </label>
              <Input
                value={newPosAddress}
                onChange={(e) => setNewPosAddress(e.target.value)}
                placeholder="Ex: Boulevard Bourgogne, Casablanca"
                className="bg-slate-950 border-slate-800 text-white text-xs h-11 rounded-xl focus:border-cyan-500"
              />
            </div>

            <DialogFooter className="flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                disabled={savingPosGps || !newPosName.trim()}
                className="w-full bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-black py-3 rounded-xl shadow-lg active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5"
              >
                {savingPosGps ? (
                  <span>Enregistrement en cours...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Enregistrer et Ajouter à la Tournée</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMarkPosModalOpen(false)}
                className="w-full text-slate-400 hover:text-white text-xs h-9"
              >
                Annuler
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 4: CLÔTURER LA TOURNÉE                                              */}
      {/* ========================================================================= */}
      <Dialog open={closeTourModalOpen} onOpenChange={setCloseTourModalOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Clôturer la Tournée</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Confirmez l'arrivée au dépôt. Le Bon de Retour (B.R) sera automatiquement rempli dans l'application web.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Arrêts Livrés :</span>
                <strong className="text-emerald-400">
                  {deliveredCount} / {stops.length}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bouteilles Vides Ramassées :</span>
                <strong className="text-amber-400">{activeTournee?.totalCollectedEmpty || 0} btles</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bouteilles Pleines Restantes :</span>
                <strong className="text-cyan-400">{totalRemainingBottles} btles</strong>
              </div>
              <div className="flex justify-between border-t border-slate-900 pt-2">
                <span className="text-slate-400">Total Espèces à Verser :</span>
                <strong className="text-emerald-300 font-mono text-sm">
                  {(activeTournee?.totalCashCollected || 0).toFixed(2)} DH
                </strong>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2">
            <Button
              type="button"
              disabled={closingTour}
              onClick={handleCloseTournee}
              className="w-full bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black py-3 rounded-xl shadow-lg"
            >
              {closingTour ? 'Clôture en cours...' : 'Confirmer & Transférer vers Retour Web'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloseTourModalOpen(false)}
              className="w-full border-slate-700 text-slate-300 rounded-xl"
            >
              Continuer la tournée
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 5: ALERTE 48H - CLIENTS NON APPROVISIONNÉS EN PRIORITÉ              */}
      {/* ========================================================================= */}
      <Dialog open={showAlerts48hModal} onOpenChange={setShowAlerts48hModal}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white rounded-3xl p-5 max-h-[85vh] overflow-y-auto z-[2000]">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Clients Non Approvisionnés (&gt; 48h)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Ces points de vente n'ont pas reçu de gaz depuis plus de 48 heures. Action prioritaire recommandée :
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {alerts48h.map((alert, idx) => (
              <div key={alert.posId || idx} className="bg-slate-950 border border-amber-500/30 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-sm text-white">{alert.posName}</div>
                    <div className="text-xs text-indigo-300 mt-0.5">{alert.clientName}</div>
                  </div>
                  <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-black px-2 py-0.5 rounded-lg">
                    +{alert.hoursSinceLastDelivery}h
                  </span>
                </div>

                <div className="text-xs text-slate-400">
                  📍 {alert.address || alert.circuitName || 'Casablanca'}
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  {alert.phone ? (
                    <a
                      href={`tel:${alert.phone}`}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Appeler</span>
                    </a>
                  ) : <span className="text-xs text-slate-500">Pas de téléphone</span>}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowAlerts48hModal(false);
                      setActiveTab('map');
                      setDriverGps([alert.lat, alert.lng]);
                    }}
                    className="border-slate-700 bg-slate-900 text-slate-200 text-xs h-8 px-2.5 rounded-xl"
                  >
                    <MapPin className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                    <span>Localiser sur Carte</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowAlerts48hModal(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
