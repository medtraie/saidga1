import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
        return originalLatLng(33.5731, -7.5898);
      }
      if (Array.isArray(a)) {
        const lat = Number(a[0]);
        const lng = Number(a[1]);
        if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
          return originalLatLng(33.5731, -7.5898);
        }
        return originalLatLng(lat, lng);
      }
      if (typeof a === 'object') {
        const lat = Number(a.lat ?? a.latitude);
        const lng = Number(a.lng ?? a.longitude);
        if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
          return originalLatLng(33.5731, -7.5898);
        }
        return originalLatLng(lat, lng);
      }
      const lat = Number(a);
      const lng = Number(b);
      if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
        return originalLatLng(33.5731, -7.5898);
      }
      return originalLatLng(lat, lng);
    };
  }

  if ((L as any).LatLng) {
    const OriginalLatLngClass = (L as any).LatLng;
    (L as any).LatLng = function (lat: any, lng: any, alt?: any) {
      const numLat = Number(lat);
      const numLng = Number(lng);
      const safeLat = !isNaN(numLat) && isFinite(numLat) ? numLat : 33.5731;
      const safeLng = !isNaN(numLng) && isFinite(numLng) ? numLng : -7.5898;
      return new OriginalLatLngClass(safeLat, safeLng, alt);
    };
    (L as any).LatLng.prototype = OriginalLatLngClass.prototype;
  }
}

import {
  Store,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  Navigation,
  Smartphone,
  ChevronRight,
  Package,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  Trash2,
  X,
  Eye,
  Plus,
  Layers,
  Map as MapIcon,
  Check,
  Fuel,
  Compass
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { pointVenteService, Tournee, TourneeStop, ClientPos, Delivery48hAlert } from '@/lib/pointVenteService';
import { getLiveGpsVehicles, LiveVehicle } from '@/lib/gpswoxService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// Google Maps Layer Definitions (Region: MA, Language: fr)
type GoogleMapLayer = 'google_roads' | 'google_hybrid' | 'google_terrain';

const GOOGLE_MAP_LAYERS: Record<GoogleMapLayer, { name: string; url: string; attribution: string }> = {
  google_roads: {
    name: 'Google Maps (Routes)',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&gl=MA&hl=fr',
    attribution: '&copy; Google Maps (Maroc)',
  },
  google_hybrid: {
    name: 'Google Satellite (Hybride)',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&gl=MA&hl=fr',
    attribution: '&copy; Google Maps Satellite',
  },
  google_terrain: {
    name: 'Google Maps (Relief)',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&gl=MA&hl=fr',
    attribution: '&copy; Google Maps Terrain',
  },
};

const CIRCUIT_COLORS = [
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#0284c7', // Sky
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#dc2626', // Red
  '#0891b2', // Cyan
];

// Helper to sanitize labels
const cleanLabel = (text: any, fallback: string): string => {
  if (!text) return fallback;
  if (typeof text === 'object') {
    text = (text as any)?.posName || (text as any)?.clientName || (text as any)?.name || (text as any)?.title || (text as any)?.id || '';
  }
  const s = String(text).trim();
  if (!s || s.includes('[object') || s.includes('undefined') || s.includes('null')) return fallback;
  return s;
};

// Custom Map center controller with debouncing and distance check
function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const lastCenterRef = useRef<[number, number]>(center);

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
        const curr = map.getCenter();
        const dist = Math.abs(curr.lat - center[0]) + Math.abs(curr.lng - center[1]);
        if (dist > 0.0002 || map.getZoom() !== zoom) {
          map.flyTo(center, zoom, { duration: 1.0 });
          lastCenterRef.current = center;
        }
      } catch (err) {
        console.warn('Map flyTo notice:', err);
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

const createPickTargetIcon = () =>
  L.divIcon({
    className: 'custom-pick-pos-marker',
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

// Custom Leaflet Icons
const depotIcon = L.divIcon({
  className: 'custom-depot-marker',
  html: `
    <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; width:44px; height:44px; border-radius:999px; background:rgba(99,102,241,0.25); animation:pulse 2s infinite;"></div>
      <div style="width:34px; height:34px; border-radius:12px; background:#4f46e5; border:2.5px solid #ffffff; box-shadow:0 4px 12px rgba(79,70,229,0.5); display:flex; align-items:center; justify-content:center; color:white;">
        <svg style="width:18px; height:18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const createTruckIcon = (driverName: string, isMoving: boolean, isLiveGps?: boolean) => L.divIcon({
  className: 'custom-truck-marker',
  html: `
    <div style="position:relative; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
      <div style="position:relative; width:40px; height:40px; border-radius:12px; background:#0284c7; border:2.5px solid #ffffff; box-shadow:0 0 16px rgba(2,132,199,0.7); display:flex; align-items:center; justify-content:center; color:white;">
        <svg style="width:20px; height:20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>
        ${isLiveGps ? '<span style="position:absolute; top:-3px; right:-3px; width:10px; height:10px; border-radius:999px; background:#10b981; border:2px solid #ffffff; animation:pulse 1.5s infinite;"></span>' : ''}
      </div>
      <div style="background:#0f172a; color:#38bdf8; font-size:10px; font-weight:900; padding:1px 6px; border-radius:999px; border:1px solid #0284c7; white-space:nowrap; margin-top:3px; box-shadow:0 2px 5px rgba(0,0,0,0.4); display:flex; items-center; gap:3px;">
        ${isLiveGps ? '<span style="color:#10b981;">●</span>' : ''} ${driverName}
      </div>
    </div>
  `,
  iconSize: [44, 52],
  iconAnchor: [22, 26],
});

const createPosIcon = (status: 'livre' | 'en_attente' | 'annule', sequence: number, isOverdue?: boolean) => {
  const isDelivered = status === 'livre';
  const bg = isDelivered ? '#10b981' : (isOverdue ? '#f97316' : '#f43f5e');
  const pulse = isDelivered ? '' : 'animation:pulse 1.8s infinite;';
  return L.divIcon({
    className: 'custom-pos-marker',
    html: `
      <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
        <div style="position:absolute; width:36px; height:36px; border-radius:999px; background:${bg}; opacity:0.35; ${pulse}"></div>
        <div style="width:28px; height:28px; border-radius:999px; background:${bg}; border:2.5px solid #ffffff; box-shadow:0 3px 12px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; font-size:11px; font-weight:900;">
          ${isDelivered ? '✓' : (isOverdue ? '⚠️' : sequence)}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

export const formatFullAddress = (pos: ClientPos): string => {
  const parts: string[] = [];
  if (pos.address && pos.address.trim()) {
    parts.push(pos.address.trim());
  }
  if (pos.circuitName && !parts.some(p => p.toLowerCase().includes(pos.circuitName!.toLowerCase()))) {
    parts.push(pos.circuitName.replace(/^Circuit\s+/i, ''));
  }
  if (!parts.some(p => p.toLowerCase().includes('casablanca') || p.toLowerCase().includes('rabat'))) {
    parts.push('Casablanca');
  }
  if (!parts.some(p => p.toLowerCase().includes('maroc') || p.toLowerCase().includes('morocco'))) {
    parts.push('Maroc');
  }
  return parts.join(', ');
};

export default function PointVente() {
  const { supplyOrders = [], drivers = [], trucks = [] } = useApp();
  const { language } = useLanguage();
  const { toast } = useToast();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);

  // States
  const [tournees, setTournees] = useState<Tournee[]>([]);
  const [clientPosList, setClientPosList] = useState<ClientPos[]>([]);
  const [alerts48h, setAlerts48h] = useState<Delivery48hAlert[]>([]);
  const [posToDelete, setPosToDelete] = useState<ClientPos | null>(null);
  const [liveDriverGps, setLiveDriverGps] = useState<Record<string, { lat: number; lng: number; updatedAt: string }>>({});
  const [liveGpsVehicles, setLiveGpsVehicles] = useState<LiveVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriverFilter, setSelectedDriverFilterState] = useState<string>(() => {
    try {
      return sessionStorage.getItem('sft_pos_selected_driver') || 'all';
    } catch {
      return 'all';
    }
  });

  const setSelectedDriverFilter = React.useCallback((val: string | ((prev: string) => string)) => {
    setSelectedDriverFilterState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        sessionStorage.setItem('sft_pos_selected_driver', next);
      } catch {}
      return next;
    });
  }, []);
  const [statusFilter, setStatusFilter] = useState<'all' | 'livre' | 'en_attente' | 'alerte_48h'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTournee, setSelectedTournee] = useState<Tournee | null>(null);
  const [mapLayer, setMapLayer] = useState<GoogleMapLayer>('google_roads');
  const [mapCenter, setMapCenter] = useState<[number, number]>([33.5731, -7.5898]); // Casablanca
  const [mapZoom, setMapZoom] = useState<number>(12);
  const [createTourneeModalOpen, setCreateTourneeModalOpen] = useState(false);
  const [selectedBsToLaunch, setSelectedBsToLaunch] = useState<string>('');
  const [createPosModalOpen, setCreatePosModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'pos_list' | 'history'>('map');

  // Picking POS on Map State
  const [isPickingPos, setIsPickingPos] = useState(false);
  const [posPickCoords, setPosPickCoords] = useState<[number, number]>([33.585, -7.635]);

  // Form State for new POS
  const [newPosData, setNewPosData] = useState({
    posName: '',
    clientName: '',
    phone: '',
    ice: '',
    patente: '',
    address: '',
    lat: 33.585,
    lng: -7.635,
    circuitName: 'Circuit Casablanca Ouest',
    assignedDriverId: '',
    assignedDriverName: '',
  });
  const [savingPos, setSavingPos] = useState(false);
  const [deleteAllPosDialogOpen, setDeleteAllPosDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Load Data safely without re-rendering if identical
  const loadData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      // Sync active tournées with clientPosList to purge any deleted points
      await pointVenteService.syncTourneesWithClientPos().catch(() => {});

      const [tList, posList, gpsMap, vehicles, alertList] = await Promise.all([
        pointVenteService.getTournees(),
        pointVenteService.getClientPosList(),
        pointVenteService.getAllDriverLiveGps().catch(() => ({})),
        getLiveGpsVehicles().catch(() => []),
        pointVenteService.get48hDeliveryAlerts().catch(() => []),
      ]);

      setTournees(prev => {
        if (JSON.stringify(prev) === JSON.stringify(tList)) return prev;
        return tList || [];
      });

      setClientPosList(prev => {
        if (JSON.stringify(prev) === JSON.stringify(posList)) return prev;
        return posList || [];
      });

      setAlerts48h(prev => {
        if (JSON.stringify(prev) === JSON.stringify(alertList)) return prev;
        return alertList || [];
      });

      setLiveDriverGps(prev => {
        if (JSON.stringify(prev) === JSON.stringify(gpsMap)) return prev;
        return gpsMap || {};
      });

      setLiveGpsVehicles(prev => {
        if (JSON.stringify(prev) === JSON.stringify(vehicles)) return prev;
        return vehicles || [];
      });

      setSelectedTournee(prev => {
        if (!prev) return (tList && tList.length > 0) ? tList[0] : null;
        const matching = (tList || []).find((t) => t.id === prev.id);
        return matching || prev;
      });
    } catch (e) {
      console.error('[PointVente] loadData error:', e);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(false), 15000); // Silent background polling every 15s

    const handlePosChanged = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setClientPosList(e.detail);
      } else {
        loadData(false);
      }
    };
    const handleTourneesChanged = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setTournees(e.detail);
      } else {
        loadData(false);
      }
    };

    window.addEventListener('sft-client-pos-changed', handlePosChanged);
    window.addEventListener('sft-tournees-changed', handleTourneesChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sft-client-pos-changed', handlePosChanged);
      window.removeEventListener('sft-tournees-changed', handleTourneesChanged);
    };
  }, []);

  // Unique List of Drivers available for filtering
  const availableFilterDrivers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    (drivers || []).forEach(d => {
      if (d && (d.id || d.name)) {
        const id = String(d.id || d.name);
        map.set(id.toLowerCase(), { id, name: d.name || 'Chauffeur', count: 0 });
      }
    });

    (tournees || []).forEach(t => {
      const cleanName = cleanLabel(t.driverName, 'Chauffeur');
      let foundKey = '';
      const tId = t.driverId ? String(t.driverId).toLowerCase() : '';
      const tName = cleanName.toLowerCase();

      for (const [key, val] of map.entries()) {
        if ((tId && key === tId) || val.name.toLowerCase() === tName || key === tName) {
          foundKey = key;
          break;
        }
      }
      if (foundKey) {
        map.get(foundKey)!.count += 1;
      } else {
        const newId = t.driverId ? String(t.driverId) : cleanName;
        map.set(newId.toLowerCase(), { id: newId, name: cleanName, count: 1 });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [drivers, tournees]);

  // Filtered Tournees based on selectedDriverFilter
  const filteredTournees = useMemo(() => {
    if (!selectedDriverFilter || selectedDriverFilter === 'all') {
      return tournees;
    }
    const filterKey = String(selectedDriverFilter).trim().toLowerCase();
    const matchedDriverObj = availableFilterDrivers.find(d => 
      String(d.id).trim().toLowerCase() === filterKey || 
      d.name.trim().toLowerCase() === filterKey
    );
    const filterName = matchedDriverObj ? matchedDriverObj.name.trim().toLowerCase() : filterKey;

    return tournees.filter((t) => {
      const tDriverId = String(t.driverId || '').trim().toLowerCase();
      const tDriverName = String(t.driverName || '').trim().toLowerCase();

      if (tDriverId && (tDriverId === filterKey || (matchedDriverObj && tDriverId === String(matchedDriverObj.id).toLowerCase()))) {
        return true;
      }
      if (tDriverName && (tDriverName === filterName || tDriverName.includes(filterName) || filterName.includes(tDriverName))) {
        return true;
      }
      return false;
    });
  }, [tournees, selectedDriverFilter, availableFilterDrivers]);

  // Filtered Client Points de Vente based on selectedDriverFilter
  // When 'all': shows all registered points of sale
  // When a driver is selected: shows ONLY the points of sale assigned to/visited by that driver
  const filteredClientPosList = useMemo(() => {
    if (selectedDriverFilter === 'all') return clientPosList;
    const targetDriver = availableFilterDrivers.find(d => 
      String(d.id).trim().toLowerCase() === String(selectedDriverFilter).trim().toLowerCase() ||
      d.name.trim().toLowerCase() === String(selectedDriverFilter).trim().toLowerCase()
    );
    const targetId = targetDriver ? String(targetDriver.id).trim().toLowerCase() : String(selectedDriverFilter).trim().toLowerCase();
    const targetName = targetDriver?.name?.trim().toLowerCase() || targetId;

    // Collect all POS IDs and names assigned to or visited in this driver's tournées
    const driverPosIds = new Set<string>();
    const driverPosNames = new Set<string>();
    filteredTournees.forEach(t => {
      (t.stops || []).forEach(s => {
        if (s.id) driverPosIds.add(String(s.id).toLowerCase());
        if (s.clientId) driverPosIds.add(String(s.clientId).toLowerCase());
        if (s.posName) driverPosNames.add(String(s.posName).trim().toLowerCase());
      });
    });

    return clientPosList.filter(pos => {
      const pId = String(pos.id || '').toLowerCase();
      const pClientId = String(pos.clientId || '').toLowerCase();
      const pName = String(pos.posName || '').trim().toLowerCase();

      const assignedId = String(pos.assignedDriverId || '').trim().toLowerCase();
      const assignedName = String(pos.assignedDriverName || '').trim().toLowerCase();
      const lastDriver = String(pos.lastDeliveryDriver || '').trim().toLowerCase();

      // 0. Points visible by all drivers (unrestricted)
      if (!assignedId && !assignedName) {
        return true;
      }

      // 1. Direct driver assignment
      if (assignedId && (assignedId === targetId || assignedId === targetName)) {
        return true;
      }
      if (assignedName && (assignedName === targetName || assignedName.includes(targetName) || targetName.includes(assignedName))) {
        return true;
      }
      if (lastDriver && (lastDriver === targetName || lastDriver.includes(targetName) || targetName.includes(lastDriver))) {
        return true;
      }

      // 2. Scheduled or visited in this driver's tournées
      if (driverPosIds.has(pId) || driverPosIds.has(pClientId) || driverPosNames.has(pName)) {
        return true;
      }

      return false;
    });
  }, [clientPosList, selectedDriverFilter, availableFilterDrivers, filteredTournees]);

  // Aggregate Stats: Dynamically computed from filteredTournees (Updates in real time per selected driver!)
  const stats = useMemo(() => {
    const isGlobal = selectedDriverFilter === 'all';
    const active = filteredTournees.filter(t => t.status === 'en_cours').length;
    const closed = filteredTournees.filter(t => t.status === 'cloturee' || t.status === 'validee_retour').length;
    let totalDeliveredBottles = 0;
    let totalEmptyCollected = 0;
    let totalCash = 0;

    filteredTournees.forEach(t => {
      totalDeliveredBottles += Number(t.totalDeliveredFull) || 0;
      totalEmptyCollected += Number(t.totalCollectedEmpty) || 0;
      totalCash += Number(t.totalCashCollected) || 0;
    });

    const targetPosList = isGlobal ? clientPosList : filteredClientPosList;

    if (targetPosList.length === 0) {
      return {
        active,
        closed,
        totalStops: 0,
        deliveredStops: 0,
        pendingStops: 0,
        completionRate: 0,
        totalDeliveredBottles,
        totalEmptyCollected,
        totalCash,
      };
    }

    const validPosIds = new Set<string>();
    const validPosNames = new Set<string>();
    targetPosList.forEach(p => {
      if (p.id) validPosIds.add(String(p.id).toLowerCase());
      if (p.clientId) validPosIds.add(String(p.clientId).toLowerCase());
      if (p.posName) validPosNames.add(String(p.posName).trim().toLowerCase());
    });

    let totalStops = 0;
    let deliveredStops = 0;

    filteredTournees.forEach(t => {
      (t.stops || []).forEach(st => {
        const stId = String(st.id || '').toLowerCase();
        const stClientId = String(st.clientId || '').toLowerCase();
        const stPosName = String(st.posName || '').trim().toLowerCase();
        const stLat = Number(st.lat);
        const stLng = Number(st.lng);
        const matchInCatalog = 
          validPosIds.has(stId) || 
          validPosIds.has(stClientId) || 
          validPosNames.has(stPosName) ||
          targetPosList.some(p => Math.abs(p.lat - stLat) < 0.0005 && Math.abs(p.lng - stLng) < 0.0005);
        if (!matchInCatalog) return; // Don't count deleted points of sale!

        totalStops += 1;
        if (st.status === 'livre') deliveredStops += 1;
      });
    });

    const displayTotalStops = totalStops === 0 ? targetPosList.length : Math.max(totalStops, targetPosList.length);
    const pendingStops = Math.max(0, displayTotalStops - deliveredStops);
    const completionRate = displayTotalStops > 0 ? Math.round((deliveredStops / displayTotalStops) * 100) : 0;

    return {
      active,
      closed,
      totalStops: displayTotalStops,
      deliveredStops,
      pendingStops,
      completionRate,
      totalDeliveredBottles,
      totalEmptyCollected,
      totalCash,
    };
  }, [filteredTournees, selectedDriverFilter, clientPosList, filteredClientPosList]);

  // Filter 48h Alerts based on selected driver (if any)
  const filteredAlerts48h = useMemo(() => {
    if (selectedDriverFilter === 'all') return alerts48h;
    const targetDriver = availableFilterDrivers.find(d => String(d.id) === String(selectedDriverFilter));
    const targetName = targetDriver?.name?.trim().toLowerCase();

    const driverStopPosIds = new Set<string>();
    filteredTournees.forEach(t => {
      (t.stops || []).forEach(s => {
        if (s.clientId) driverStopPosIds.add(s.clientId);
        if (s.posName) driverStopPosIds.add(s.posName.trim().toLowerCase());
      });
    });

    return alerts48h.filter(a => {
      if (driverStopPosIds.has(a.clientId) || driverStopPosIds.has(a.posName.trim().toLowerCase())) return true;
      if (targetName && a.lastDeliveryDriver && a.lastDeliveryDriver.toLowerCase().includes(targetName)) return true;
      return false;
    });
  }, [alerts48h, selectedDriverFilter, availableFilterDrivers, filteredTournees]);

  // Handler for driver filter change that auto-centers map and selects active tournee
  const handleDriverFilterChange = (driverId: string) => {
    setSelectedDriverFilter(driverId);
    if (driverId === 'all') {
      setMapCenter([33.5731, -7.5898]);
      setMapZoom(12);
    } else {
      const filterKey = driverId.toLowerCase();
      const matchedDriverObj = availableFilterDrivers.find(d => 
        String(d.id).toLowerCase() === filterKey || d.name.toLowerCase() === filterKey
      );
      const filterName = matchedDriverObj ? matchedDriverObj.name.toLowerCase() : filterKey;

      const driverTournees = tournees.filter(t => {
        const tId = String(t.driverId || '').toLowerCase();
        const tName = String(t.driverName || '').toLowerCase();
        return (tId && tId === filterKey) || (tName && (tName === filterName || tName.includes(filterName)));
      });

      if (driverTournees.length > 0) {
        const activeTrn = driverTournees.find(t => t.status === 'en_cours') || driverTournees[0];
        setSelectedTournee(activeTrn);
        const loc = getDriverLocation(activeTrn);
        setMapCenter(loc.coords);
        setMapZoom(13.5);
      }
    }
  };

  // Determine Real Live Coordinates for a Driver's Truck
  const getDriverLocation = (trn: Tournee): { coords: [number, number]; isLive: boolean; label: string } => {
    // 1. Live Phone GPS from driver
    const phoneGps = liveDriverGps[trn.driverId];
    if (phoneGps && typeof phoneGps.lat === 'number' && !isNaN(phoneGps.lat) && isFinite(phoneGps.lat) && typeof phoneGps.lng === 'number' && !isNaN(phoneGps.lng) && isFinite(phoneGps.lng)) {
      return { coords: [phoneGps.lat, phoneGps.lng], isLive: true, label: 'GPS Mobile Live' };
    }

    // 2. Live Tracker from GPSWOX via truck
    if (trn.truckId) {
      const trk = trucks.find(t => t.id === trn.truckId);
      if (trk && trk.matricule) {
        const matClean = trk.matricule.replace(/[\s\-_]+/g, '').toLowerCase();
        const matchedVeh = liveGpsVehicles.find(v => {
          const vPlate = (v.plate || v.name || '').replace(/[\s\-_]+/g, '').toLowerCase();
          return vPlate.includes(matClean) || matClean.includes(vPlate);
        });
        if (matchedVeh && typeof matchedVeh.lat === 'number' && !isNaN(matchedVeh.lat) && isFinite(matchedVeh.lat)) {
          return { coords: [matchedVeh.lat, matchedVeh.lng], isLive: true, label: 'GPS Véhicule Live' };
        }
      }
    }

    // 3. Next pending stop
    const nextStop = (trn.stops || []).find(s => s.status === 'en_attente') || (trn.stops || [])[0];
    if (nextStop && typeof nextStop.lat === 'number' && !isNaN(nextStop.lat) && isFinite(nextStop.lat) && typeof nextStop.lng === 'number' && !isNaN(nextStop.lng) && isFinite(nextStop.lng)) {
      return { coords: [nextStop.lat + 0.0015, nextStop.lng + 0.0015], isLive: false, label: 'Arrêt Prévu' };
    }

    // 4. Default Depot
    return { coords: [33.565, -7.61], isLive: false, label: 'Dépôt Central' };
  };

  // Distinct Trucks to display on Map:
  // When selectedDriverFilter === 'all': displays ALL active trucks/drivers in the fleet!
  // When selectedDriverFilter !== 'all': displays ONLY the single truck belonging to that selected driver!
  const trucksOnMap = useMemo(() => {
    const list: Array<{
      key: string;
      driverId: string;
      driverName: string;
      truckName: string;
      coords: [number, number];
      isLive: boolean;
      label: string;
      tournee?: Tournee;
      status: string;
      totalDelivered: number;
      totalStops: number;
      deliveredCount: number;
      salesAmount: number;
    }> = [];

    // Filter drivers based on selectedDriverFilter
    let targetDrivers = availableFilterDrivers;
    if (selectedDriverFilter !== 'all') {
      const filterKey = String(selectedDriverFilter).trim().toLowerCase();
      const matched = availableFilterDrivers.find(d => 
        String(d.id).trim().toLowerCase() === filterKey || 
        d.name.trim().toLowerCase() === filterKey
      );
      if (matched) {
        targetDrivers = [matched];
      } else {
        targetDrivers = availableFilterDrivers.filter(d => 
          String(d.id).toLowerCase() === filterKey || d.name.toLowerCase().includes(filterKey)
        );
      }
    }

    const depotBase: [number, number] = [33.565, -7.61];
    let depotOffsetIndex = 0;
    const claimedVehiclePlates = new Set<string>();

    targetDrivers.forEach((drv) => {
      // Find all tournees for this driver
      const drvTournees = tournees.filter(t => {
        const tId = String(t.driverId || '').trim().toLowerCase();
        const tName = String(t.driverName || '').trim().toLowerCase();
        const dId = String(drv.id).trim().toLowerCase();
        const dName = drv.name.trim().toLowerCase();
        return (tId && (tId === dId || tId === dName)) || (tName && (tName === dName || tName === dId));
      });

      // Prefer active tournee ('en_cours') if available, otherwise most recent tournee
      const activeTrn = drvTournees.find(t => t.status === 'en_cours') || drvTournees[0];

      // Find truck details
      let truckObj = activeTrn?.truckId ? trucks.find(t => t.id === activeTrn.truckId) : null;
      if (!truckObj) {
        truckObj = trucks.find(t => 
          (t.assignedDriverId && String(t.assignedDriverId).toLowerCase() === String(drv.id).toLowerCase()) ||
          (t.driverName && t.driverName.toLowerCase().includes(drv.name.toLowerCase()))
        ) || null;
      }

      // Determine live or estimated location
      let coords: [number, number] | null = null;
      let isLive = false;
      let label = 'Dépôt Central';

      // 1. Phone Live GPS
      const phoneGps = liveDriverGps[drv.id] || (activeTrn && liveDriverGps[activeTrn.driverId]);
      if (phoneGps && typeof phoneGps.lat === 'number' && !isNaN(phoneGps.lat) && isFinite(phoneGps.lat) && typeof phoneGps.lng === 'number' && !isNaN(phoneGps.lng) && isFinite(phoneGps.lng)) {
        coords = [phoneGps.lat, phoneGps.lng];
        isLive = true;
        label = 'GPS Mobile Live';
      }

      // 2. GPSWOX Live Vehicle tracker
      if (!coords && truckObj && truckObj.matricule) {
        const matClean = truckObj.matricule.replace(/[\s\-_]+/g, '').toLowerCase();
        const matchedVeh = liveGpsVehicles.find(v => {
          const vPlate = (v.plate || v.name || '').replace(/[\s\-_]+/g, '').toLowerCase();
          return vPlate.includes(matClean) || matClean.includes(vPlate);
        });
        if (matchedVeh && typeof matchedVeh.lat === 'number' && !isNaN(matchedVeh.lat) && isFinite(matchedVeh.lat)) {
          coords = [matchedVeh.lat, matchedVeh.lng];
          isLive = true;
          label = 'GPS Véhicule Live';
          if (matchedVeh.plate) claimedVehiclePlates.add(matchedVeh.plate.toLowerCase());
        }
      }

      // 3. Next pending stop of active tournee
      if (!coords && activeTrn) {
        const nextStop = (activeTrn.stops || []).find(s => s.status === 'en_attente');
        if (nextStop && typeof nextStop.lat === 'number' && !isNaN(nextStop.lat) && isFinite(nextStop.lat)) {
          coords = [nextStop.lat + 0.0012, nextStop.lng + 0.0012];
          isLive = false;
          label = 'Arrêt Prévu';
        }
      }

      // 4. Fallback depot position (spread slightly in global mode so each truck is distinct)
      if (!coords) {
        if (selectedDriverFilter === 'all') {
          const angle = (depotOffsetIndex * (2 * Math.PI / Math.max(1, targetDrivers.length)));
          const radius = 0.003; // ~300m circle around depot
          coords = [
            depotBase[0] + (Math.sin(angle) * radius),
            depotBase[1] + (Math.cos(angle) * radius)
          ];
          depotOffsetIndex++;
        } else {
          coords = [depotBase[0], depotBase[1]];
        }
        label = 'Dépôt Central';
      }

      const deliveredCount = activeTrn?.stops?.filter(s => s.status === 'livre').length || 0;
      const totalStops = activeTrn?.stops?.length || 0;

      list.push({
        key: `truck-driver-${drv.id}`,
        driverId: drv.id,
        driverName: drv.name,
        truckName: truckObj ? `${truckObj.matricule || truckObj.name}` : (activeTrn?.truckId || 'Camion SFT'),
        coords,
        isLive,
        label,
        tournee: activeTrn,
        status: activeTrn?.status || 'disponible',
        totalDelivered: activeTrn?.totalDeliveredFull || 0,
        totalStops,
        deliveredCount,
        salesAmount: activeTrn?.totalSalesAmount || 0,
      });
    });

    // In 'all' mode: if there are other unassigned live GPS vehicles, show them as active trucks too
    if (selectedDriverFilter === 'all') {
      liveGpsVehicles.forEach((veh, idx) => {
        const vPlate = (veh.plate || veh.name || '').toLowerCase();
        if (vPlate && !claimedVehiclePlates.has(vPlate) && typeof veh.lat === 'number' && !isNaN(veh.lat) && isFinite(veh.lat)) {
          list.push({
            key: `truck-gps-${veh.id || idx}`,
            driverId: `veh-${idx}`,
            driverName: veh.plate || veh.name || `Camion #${idx + 1}`,
            truckName: veh.plate || veh.name || 'Camion GPS',
            coords: [veh.lat, veh.lng],
            isLive: true,
            label: 'GPS Tracker Live',
            status: 'en_cours',
            totalDelivered: 0,
            totalStops: 0,
            deliveredCount: 0,
            salesAmount: 0,
          });
        }
      });
    }

    return list;
  }, [availableFilterDrivers, selectedDriverFilter, tournees, trucks, liveDriverGps, liveGpsVehicles]);

  // Circuits to display on Map:
  // When selectedDriverFilter === 'all': draws circuits for active tournées (one per driver)
  // When selectedDriverFilter !== 'all': draws ONLY the circuit for the selected driver!
  const activeCircuitsToDraw = useMemo(() => {
    const seenDrivers = new Set<string>();
    const circuits: Tournee[] = [];

    if (selectedTournee && filteredTournees.some(t => t.id === selectedTournee.id)) {
      circuits.push(selectedTournee);
      seenDrivers.add(String(selectedTournee.driverId || selectedTournee.driverName).toLowerCase());
    }

    filteredTournees.forEach(t => {
      const dKey = String(t.driverId || t.driverName).toLowerCase();
      if (t.status === 'en_cours' && !seenDrivers.has(dKey)) {
        circuits.push(t);
        seenDrivers.add(dKey);
      }
    });

    if (circuits.length === 0) {
      filteredTournees.forEach(t => {
        const dKey = String(t.driverId || t.driverName).toLowerCase();
        if (!seenDrivers.has(dKey)) {
          circuits.push(t);
          seenDrivers.add(dKey);
        }
      });
    }

    return circuits;
  }, [filteredTournees, selectedTournee]);

  // Stops to display on map with guaranteed valid coordinates and strict filtering
  const activeStops = useMemo(() => {
    const targetPosList = selectedDriverFilter === 'all' ? clientPosList : filteredClientPosList;
    if (!targetPosList || targetPosList.length === 0) {
      return []; // Absolutely no markers on map when list of POS is empty or none for this driver!
    }

    const validPosMap = new Map<string, ClientPos>();
    targetPosList.forEach(p => {
      if (p.id) validPosMap.set(String(p.id).toLowerCase(), p);
      if (p.clientId) validPosMap.set(String(p.clientId).toLowerCase(), p);
      if (p.posName) validPosMap.set(String(p.posName).trim().toLowerCase(), p);
    });

    let stops: Array<TourneeStop & { tourneeDriver: string; tourneeNum: string; isOverdue48h?: boolean; hoursSinceLastDelivery?: number }> = [];
    const matchedPosSet = new Set<string>();

    filteredTournees.forEach(t => {
      (t.stops || []).forEach(s => {
        const lat = Number(s?.lat);
        const lng = Number(s?.lng);
        if (!isNaN(lat) && isFinite(lat) && !isNaN(lng) && isFinite(lng)) {
          const sId = String(s.id || '').toLowerCase();
          const sClientId = String(s.clientId || '').toLowerCase();
          const sPosName = String(s.posName || '').trim().toLowerCase();

          const matchedPos = validPosMap.get(sId) || validPosMap.get(sClientId) || validPosMap.get(sPosName) ||
            targetPosList.find(p => Math.abs(p.lat - lat) < 0.0005 && Math.abs(p.lng - lng) < 0.0005);

          if (!matchedPos) {
            return; // Exclude deleted or uncatalogued points from map!
          }

          matchedPosSet.add(matchedPos.id || matchedPos.clientId);

          const alert = alerts48h.find(a => a.clientId === s.clientId || a.posId === matchedPos.id || a.posName === s.posName);
          stops.push({
            ...s,
            id: s.id || matchedPos.id,
            clientId: matchedPos.clientId,
            posName: matchedPos.posName || s.posName,
            clientName: matchedPos.clientName || s.clientName,
            lat,
            lng,
            tourneeDriver: t.driverName,
            tourneeNum: t.tourneeNumber,
            isOverdue48h: Boolean(alert),
            hoursSinceLastDelivery: alert?.hoursSinceLastDelivery,
          });
        }
      });
    });

    // Also include any points from targetPosList that haven't been added to any tournée stops yet
    targetPosList.forEach((pos) => {
      const key = pos.id || pos.clientId;
      if (!matchedPosSet.has(key)) {
        const alert = alerts48h.find(a => a.posId === pos.id || a.clientId === pos.clientId || a.posName === pos.posName);
        stops.push({
          id: pos.id,
          tourneeId: '',
          clientId: pos.clientId,
          clientName: pos.clientName,
          posName: pos.posName,
          lat: pos.lat,
          lng: pos.lng,
          status: 'en_attente',
          sequenceOrder: stops.length + 1,
          deliveredItems: [],
          collectedEmpty: [],
          paymentMethod: 'cash',
          amountPaid: 0,
          amountDebt: 0,
          tourneeDriver: pos.lastDeliveryDriver || (selectedDriverFilter !== 'all' ? availableFilterDrivers.find(d => String(d.id) === String(selectedDriverFilter))?.name || 'Chauffeur' : 'En attente'),
          tourneeNum: 'Catalogue POS',
          isOverdue48h: Boolean(alert),
          hoursSinceLastDelivery: alert?.hoursSinceLastDelivery,
        });
      }
    });

    return stops.filter(s => {
      if (statusFilter === 'livre' && s.status !== 'livre') return false;
      if (statusFilter === 'en_attente' && s.status === 'livre') return false;
      if (statusFilter === 'alerte_48h' && !s.isOverdue48h) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.clientName?.toLowerCase().includes(q) ||
          s.posName?.toLowerCase().includes(q) ||
          s.tourneeDriver?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [filteredTournees, selectedDriverFilter, clientPosList, filteredClientPosList, statusFilter, searchQuery, alerts48h, availableFilterDrivers]);

  // Launch Tournee from Bon de Sortie
  const handleLaunchTournee = async () => {
    if (!selectedBsToLaunch) return;
    const bs = supplyOrders.find(o => o.id === selectedBsToLaunch || o.orderNumber === selectedBsToLaunch);
    if (!bs) return;

    try {
      const created = await pointVenteService.createTourneeFromSupplyOrder(bs, clientPosList);
      toast({
        title: tr('Tournée démarrée', 'تم إطلاق الجولة'),
        description: tr(`Tournée ${created.tourneeNumber} activée avec succès pour le chauffeur.`, `تم تفعيل الجولة ${created.tourneeNumber} بنجاح للسائق.`),
      });
      setCreateTourneeModalOpen(false);
      setSelectedBsToLaunch('');
      await loadData();
    } catch (err: any) {
      toast({
        title: tr('Erreur', 'خطأ'),
        description: err?.message || tr('Impossible de lancer la tournée', 'تعذر إطلاق الجولة'),
        variant: 'destructive',
      });
    }
  };

  // Open modal with pre-selected coordinates and pre-assigned driver
  const openCreatePosModal = (coords?: [number, number]) => {
    const targetDriver = availableFilterDrivers.find(d => 
      String(d.id).trim().toLowerCase() === String(selectedDriverFilter).trim().toLowerCase() ||
      d.name.trim().toLowerCase() === String(selectedDriverFilter).trim().toLowerCase()
    );

    const lat = coords ? Number(coords[0].toFixed(6)) : (isPickingPos ? Number(posPickCoords[0].toFixed(6)) : newPosData.lat);
    const lng = coords ? Number(coords[1].toFixed(6)) : (isPickingPos ? Number(posPickCoords[1].toFixed(6)) : newPosData.lng);

    const driverId = selectedDriverFilter !== 'all' ? (targetDriver ? String(targetDriver.id) : selectedDriverFilter) : (newPosData.assignedDriverId || '');
    const driverName = selectedDriverFilter !== 'all' ? (targetDriver ? targetDriver.name : selectedDriverFilter) : (newPosData.assignedDriverName || '');

    setNewPosData(prev => ({
      ...prev,
      lat,
      lng,
      assignedDriverId: driverId,
      assignedDriverName: driverName,
    }));
    setCreatePosModalOpen(true);
  };

  // Create new Point de Vente
  const handleCreatePos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPosData.posName.trim()) return;
    setSavingPos(true);
    try {
      const targetDriver = availableFilterDrivers.find(d => 
        String(d.id).trim().toLowerCase() === String(selectedDriverFilter).trim().toLowerCase() ||
        d.name.trim().toLowerCase() === String(selectedDriverFilter).trim().toLowerCase()
      );

      let finalDriverId = newPosData.assignedDriverId;
      let finalDriverName = newPosData.assignedDriverName;

      if (!finalDriverId && selectedDriverFilter !== 'all') {
        finalDriverId = targetDriver ? String(targetDriver.id) : selectedDriverFilter;
        finalDriverName = targetDriver ? targetDriver.name : selectedDriverFilter;
      }

      if (finalDriverId && !finalDriverName) {
        const found = availableFilterDrivers.find(d => String(d.id) === String(finalDriverId));
        if (found) finalDriverName = found.name;
      }

      const created = await pointVenteService.addClientPos({
        clientId: `client-${Date.now().toString(36)}`,
        clientName: newPosData.clientName.trim() || newPosData.posName.trim(),
        posName: newPosData.posName.trim(),
        address: newPosData.address.trim(),
        phone: newPosData.phone.trim(),
        ice: newPosData.ice?.trim() || undefined,
        patente: newPosData.patente?.trim() || undefined,
        lat: Number(newPosData.lat) || 33.585,
        lng: Number(newPosData.lng) || -7.635,
        circuitName: newPosData.circuitName.trim() || 'Circuit Casablanca',
        assignedDriverId: finalDriverId || undefined,
        assignedDriverName: finalDriverName || undefined,
        lastDeliveryDriver: finalDriverName || undefined,
      });

      // Instantly update active list state
      setClientPosList(prev => {
        const without = prev.filter(p => p.id !== created.id);
        return [...without, created];
      });

      toast({
        title: tr('Point de Vente Enregistré dans Supabase', 'تم حفظ نقطة البيع في السحابة بنجاح'),
        description: tr(`Le point de vente "${newPosData.posName}" est synchronisé et restera conservé après actualisation.`, `تم حفظ نقطة البيع "${newPosData.posName}" في Supabase وستبقى محفوظة بعد التحديث.`),
      });

      setCreatePosModalOpen(false);
      setIsPickingPos(false);
      setNewPosData({
        posName: '',
        clientName: '',
        phone: '',
        ice: '',
        patente: '',
        address: '',
        lat: 33.585,
        lng: -7.635,
        circuitName: 'Circuit Casablanca Ouest',
        assignedDriverId: '',
        assignedDriverName: '',
      });

      if (created && typeof created.lat === 'number' && typeof created.lng === 'number') {
        setMapCenter([created.lat, created.lng]);
        setMapZoom(15);
      }

      await loadData();
    } catch (err: any) {
      toast({
        title: tr('Erreur', 'خطأ'),
        description: err?.message || tr('Impossible d\'ajouter le point de vente', 'تعذر حفظ نقطة البيع'),
        variant: 'destructive',
      });
    } finally {
      setSavingPos(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-2 border-indigo-500/40 rounded-3xl p-6 text-white shadow-2xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/40 shadow-inner">
              <Store className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black text-white">
                  {tr('Points de Vente & Circuits de Distribution', 'نقاط البيع ومسارات التوزيع')}
                </h1>
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-3 py-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {tr('Live Hub Android & GPS', 'اتصال مباشر مع أندرويد و GPS')}
                </Badge>
              </div>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {tr(
                  'Supervision en temps réel des camions de gaz, des circuits de distribution par chauffeur et du statut de livraison des points de vente (Livré 🟢 / En attente 🔴).',
                  'المراقبة الحية لشاحنات توزيع الغاز، مسارات كل سائق وحالة التسليم في مختلف نقاط البيع (تم التسليم 🟢 / في الانتظار 🔴).'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
            <Button
              onClick={() => openCreatePosModal()}
              variant="outline"
              className="border-indigo-500/50 bg-indigo-950/60 text-indigo-200 hover:bg-indigo-900 hover:text-white font-bold rounded-2xl text-xs h-11"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>{tr('+ Nouveau Point de Vente', '+ إضافة نقطة بيع')}</span>
            </Button>
            <Button
              onClick={() => setCreateTourneeModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-4 h-11 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 text-xs flex items-center gap-2"
            >
              <Truck className="w-4 h-4" />
              <span>{tr('Démarrer Tournée (B.S)', 'بدء جولة (سند خروج)')}</span>
            </Button>
            <a
              href="/mobile/pos"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 h-11 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 text-xs"
              title={tr('Ouvrir l\'application chauffeur mobile', 'فتح تطبيق الهاتف للسائق')}
            >
              <Smartphone className="w-4 h-4" />
              <span>{tr('App Mobile', 'تطبيق الهاتف')}</span>
            </a>
            <Button
              variant="outline"
              onClick={() => {
                loadData(true);
                toast({ title: tr('Actualisation terminée', 'تم التحديث بنجاح') });
              }}
              className="border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800 h-11 w-11 p-0 rounded-2xl"
              title={tr('Actualiser', 'تحديث')}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Active Driver Filter Indicator Banner */}
        {selectedDriverFilter !== 'all' && (
          <div className="mt-4 p-3.5 bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-950/80 border border-indigo-500/50 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 font-medium">
                {tr('Statistiques filtrées par Chauffeur :', 'الإحصائيات مصفاة حسب السائق:')}
              </span>
              <strong className="text-white bg-indigo-600 px-3 py-1 rounded-xl border border-indigo-400/50 text-xs font-black shadow-inner flex items-center gap-1.5">
                <span>👤</span>
                <span>{availableFilterDrivers.find(d => String(d.id).toLowerCase() === String(selectedDriverFilter).toLowerCase())?.name || selectedDriverFilter}</span>
              </strong>
              <Badge className="bg-slate-950 text-indigo-300 border border-indigo-500/40 text-[10px] font-mono">
                {filteredTournees.length} {tr(filteredTournees.length > 1 ? 'Tournées' : 'Tournée', 'جولة')}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDriverFilterChange('all')}
              className="h-8 px-3 border-indigo-500/40 bg-indigo-950/60 hover:bg-indigo-900 text-indigo-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <X className="w-3.5 h-3.5" />
              <span>{tr('Réinitialiser (Tous les chauffeurs)', 'إلغاء التصفية (عرض الجميع)')}</span>
            </Button>
          </div>
        )}

        {/* 6 Modernized Executive Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-5 pt-5 border-t border-white/10">
          {/* Card 1: Tournées Actives */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-slate-950 border border-indigo-500/30 hover:border-indigo-400/60 rounded-2xl p-4 shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300/80">
                {tr('Tournées Actives', 'الجولات النشطة')}
              </span>
              <div className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30 shadow-inner">
                <Truck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl lg:text-3xl font-black text-indigo-400 mt-2 font-mono tracking-tight">
              {stats.active}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              <span>{stats.closed} {tr('clôturées', 'مغلقة')}</span>
            </div>
          </div>

          {/* Card 2: Points de Vente */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-950 border border-white/10 hover:border-white/25 rounded-2xl p-4 shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {tr('Points de Vente', 'نقاط البيع')}
              </span>
              <div className="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 border border-slate-700 shadow-inner">
                <Store className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl lg:text-3xl font-black text-white mt-2 font-mono tracking-tight">
              {stats.totalStops}
            </div>
            <div className="mt-1 text-[10px] text-slate-400 truncate">
              {selectedDriverFilter === 'all' ? tr('Sur l\'ensemble des circuits', 'إجمالي المسارات') : tr('Attribués au chauffeur', 'خاصة بهذا السائق')}
            </div>
          </div>

          {/* Card 3: Livrés 🟢 */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-950/70 via-slate-900/90 to-slate-950 border border-emerald-500/30 hover:border-emerald-400/60 rounded-2xl p-4 shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                {tr('Livrés (🟢)', 'تم التسليم')}
              </span>
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl lg:text-3xl font-black text-emerald-400 mt-2 font-mono tracking-tight">
              {stats.deliveredStops}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-300/80 font-bold">
              <span>{stats.completionRate}% {tr('complété', 'مكتمل')}</span>
            </div>
          </div>

          {/* Card 4: En Attente 🔴 */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-rose-950/70 via-slate-900/90 to-slate-950 border border-rose-500/30 hover:border-rose-400/60 rounded-2xl p-4 shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                {tr('En Attente (🔴)', 'في الانتظار')}
              </span>
              <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30 shadow-inner">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl lg:text-3xl font-black text-rose-400 mt-2 font-mono tracking-tight">
              {stats.pendingStops}
            </div>
            <div className="mt-1 text-[10px] text-rose-300/80 truncate">
              {tr('En cours de distribution', 'قيد التوزيع حالياً')}
            </div>
          </div>

          {/* Card 5: Bouteilles Livrées */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-amber-950/70 via-slate-900/90 to-slate-950 border border-amber-500/30 hover:border-amber-400/60 rounded-2xl p-4 shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300/90">
                {tr('Bouteilles Livrées', 'قنينات تم توزيعها')}
              </span>
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-inner">
                <Package className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl lg:text-3xl font-black text-amber-400 mt-2 font-mono tracking-tight">
              {stats.totalDeliveredBottles}
            </div>
            <div className="mt-1 text-[10px] text-slate-400 truncate">
              {stats.totalEmptyCollected} {tr('vides récupérées', 'فارغة مسترجعة')}
            </div>
          </div>

          {/* Card 6: Cash Encaissé */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-teal-950/70 via-slate-900/90 to-slate-950 border border-teal-500/30 hover:border-teal-400/60 rounded-2xl p-4 shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-300/90">
                {tr('Cash Encaissé', 'المبالغ المحصلة')}
              </span>
              <div className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/30 shadow-inner">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl lg:text-2xl font-black text-emerald-400 mt-2 font-mono tracking-tight truncate">
              {stats.totalCash.toFixed(0)} <span className="text-xs text-emerald-300 font-bold">DH</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400 truncate">
              {tr('Espèces collectées', 'تحصيلات نقدية')}
            </div>
          </div>
        </div>
      </div>

      {/* 48-Hour Inactivity Alert Banner */}
      {alerts48h.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-rose-950 border-2 border-amber-500/50 rounded-2xl p-4 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>{tr('Alerte Approvisionnement : Retard > 48 Heures', 'تنبيه التزويد: تأخر أكثر من 48 ساعة')}</span>
                <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">
                  {alerts48h.length} {tr('Points de Vente', 'نقاط بيع')}
                </Badge>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {tr(
                  `${alerts48h.length} client(s) n'ont pas reçu de bouteilles de gaz depuis plus de 48 heures. Des alertes directes ont été transmises aux chauffeurs sur leur application mobile.`,
                  `يوجد ${alerts48h.length} زبائن لم يتم تزويدهم بقنينات الغاز منذ أكثر من 48 ساعة. تم توجيه تنبيهات مباشرة للسائقين على تطبيق الهاتف.`
                )}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setStatusFilter('alerte_48h');
              setActiveTab('map');
            }}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-9 rounded-xl shadow-md shrink-0 flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{tr('Afficher sur la Carte (48h)', 'عرض المحلات المتأخرة على الخريطة')}</span>
          </Button>
        </div>
      )}

      {/* Tabs Switcher: Carte Live / Points de Vente / Historique */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-2xl">
          <TabsTrigger value="map" className="rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <MapIcon className="w-3.5 h-3.5 mr-2" />
            {tr('Carte & Circuits en Direct', 'الخريطة والمسارات المباشرة')}
          </TabsTrigger>
          <TabsTrigger value="pos_list" className="rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Store className="w-3.5 h-3.5 mr-2" />
            {tr('Liste des Points de Vente', 'قائمة نقاط البيع')} ({filteredClientPosList.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Clock className="w-3.5 h-3.5 mr-2" />
            {tr('Historique des Tournées', 'سجل الجولات')} ({filteredTournees.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Live Interactive Map */}
        <TabsContent value="map" className="space-y-4 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Side: Filter & Tournées List */}
            <div className="space-y-4 lg:col-span-1">
              {/* Filters Card */}
              <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-400" />
                    {tr('Filtres d\'affichage', 'تصفية العرض')}
                  </span>
                  <Badge className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                    {activeStops.length} {tr('arrêts', 'نقطة')}
                  </Badge>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-indigo-400" />
                      {tr('Chauffeur & Camion', 'السائق والشاحنة')}
                    </label>
                    {selectedDriverFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => handleDriverFilterChange('all')}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-bold"
                      >
                        {tr('Tous', 'الكل')}
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedDriverFilter}
                    onChange={(e) => handleDriverFilterChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 hover:border-indigo-500 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all cursor-pointer font-medium"
                  >
                    <option value="all">
                      🌐 {tr('Tous les chauffeurs', 'جميع السائقين')} ({tournees.length} {tr('tournées', 'جولات')})
                    </option>
                    {availableFilterDrivers.map(d => (
                      <option key={d.id} value={d.id}>
                        👤 {d.name} {d.count > 0 ? `(${d.count} ${d.count === 1 ? tr('tournée', 'جولة') : tr('tournées', 'جولات')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    {tr('Statut des Points de Vente', 'حالة نقاط البيع')}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={`text-[11px] font-bold py-1.5 rounded-lg border transition-all ${
                        statusFilter === 'all'
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {tr('Tous', 'الكل')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('livre')}
                      className={`text-[11px] font-bold py-1.5 rounded-lg border transition-all ${
                        statusFilter === 'livre'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-slate-950 text-emerald-400/80 border-slate-800 hover:text-emerald-300'
                      }`}
                    >
                      🟢 {tr('Livrés', 'مسلم')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('en_attente')}
                      className={`text-[11px] font-bold py-1.5 rounded-lg border transition-all ${
                        statusFilter === 'en_attente'
                          ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                          : 'bg-slate-950 text-rose-400/80 border-slate-800 hover:text-rose-300'
                      }`}
                    >
                      🔴 {tr('En Attente', 'انتظار')}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={tr('Rechercher magasin / client...', 'بحث عن محل أو زبون...')}
                      className="bg-slate-950 border-slate-800 pl-8 text-xs text-white"
                    />
                  </div>
                </div>
              </Card>

              {/* Active Tournees Card */}
              <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl overflow-hidden">
                <CardHeader className="p-4 border-b border-slate-800 bg-slate-950/60">
                  <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
                    <span>{tr('Tournées du Jour', 'جولات اليوم')}</span>
                    <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px]">
                      {filteredTournees.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <div className="p-2 space-y-2 max-h-[380px] overflow-y-auto">
                  {filteredTournees.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      {tr('Aucune tournée en cours.', 'لا توجد جولات حالياً.')}
                    </div>
                  ) : (
                    filteredTournees.map((trn, idx) => {
                      const isSelected = selectedTournee?.id === trn.id;
                      const deliveredCount = trn.stops?.filter(s => s.status === 'livre').length || 0;
                      const totalStopsCount = trn.stops?.length || 0;
                      const percent = totalStopsCount > 0 ? Math.round((deliveredCount / totalStopsCount) * 100) : 0;
                      const color = CIRCUIT_COLORS[idx % CIRCUIT_COLORS.length];
                      const loc = getDriverLocation(trn);

                      return (
                        <div
                          key={trn.id}
                          onClick={() => {
                            setSelectedTournee(trn);
                            setMapCenter(loc.coords);
                            setMapZoom(13);
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-950/70 border-indigo-500 text-white shadow-md'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-xs text-white flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }}></span>
                              {cleanLabel(trn.driverName, 'Chauffeur')}
                            </span>
                            <div className="flex items-center gap-1">
                              {loc.isLive && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-1.5 py-0">
                                  ● Live
                                </Badge>
                              )}
                              <Badge className={
                                trn.status === 'en_cours'
                                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[9px]'
                                  : 'bg-slate-800 text-slate-400 border-slate-700 text-[9px]'
                              }>
                                {trn.status === 'en_cours' ? tr('En cours', 'جارية') : tr('Clôturée', 'مغلقة')}
                              </Badge>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-400 font-mono mt-1">
                            B.S: <strong className="text-indigo-300">{trn.supplyOrderNumber || trn.tourneeNumber}</strong>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-400">{tr('Progression', 'التقدم')}:</span>
                              <span className="font-bold text-emerald-400">{deliveredCount}/{totalStopsCount} ({percent}%)</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${percent}%`, backgroundColor: color }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>

            {/* Right Side: Interactive Map & Live Tracking */}
            <div className="space-y-4 lg:col-span-3">
              <Card className="border-slate-800 bg-slate-900/95 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-md p-0 flex flex-col h-[650px] relative">
                {/* Map Top Bar */}
                <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-10">
                  {/* Status Filter Separators */}
                  <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-1 gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        statusFilter === 'all'
                          ? 'bg-slate-700 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>⚪ {tr('Tous', 'الكل')}</span>
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">{stats.totalStops}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatusFilter('livre')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        statusFilter === 'livre'
                          ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/50'
                          : 'text-emerald-400 hover:bg-emerald-950/40'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                      <span>🟢 {tr('Livrés', 'تم تسليمها')}</span>
                      <span className="bg-emerald-950 px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-300 border border-emerald-500/40">
                        {stats.deliveredStops}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatusFilter('en_attente')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        statusFilter === 'en_attente'
                          ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400/50'
                          : 'text-rose-400 hover:bg-rose-950/40'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping"></span>
                      <span>🔴 {tr('En Attente', 'في الانتظار')}</span>
                      <span className="bg-rose-950 px-1.5 py-0.5 rounded text-[10px] font-mono text-rose-300 border border-rose-500/40">
                        {stats.pendingStops}
                      </span>
                    </button>

                    {alerts48h.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setStatusFilter('alerte_48h')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          statusFilter === 'alerte_48h'
                            ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400/50'
                            : 'text-amber-400 hover:bg-amber-950/40'
                        }`}
                      >
                        <span>⚠️ {tr('Alerte 48h', 'تنبيه 48 ساعة')}</span>
                        <span className="bg-amber-950 px-1.5 py-0.5 rounded text-[10px] font-mono text-amber-300 border border-amber-500/40">
                          {alerts48h.length}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={() => setMapLayer('google_roads')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          mapLayer === 'google_roads' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Google Plan
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapLayer('google_hybrid')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          mapLayer === 'google_hybrid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Google Satellite
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapLayer('google_terrain')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          mapLayer === 'google_terrain' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Google Relief
                      </button>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMapCenter([33.5731, -7.5898]);
                        setMapZoom(12);
                      }}
                      className="h-8 text-xs border-slate-700 bg-slate-900 text-slate-200"
                    >
                      <Navigation className="w-3 h-3 mr-1" />
                      {tr('Centrer Ville', 'توسيط المدينة')}
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => {
                        setIsPickingPos((prev) => !prev);
                        setPosPickCoords([mapCenter[0], mapCenter[1]]);
                      }}
                      className={`h-8 text-xs font-bold transition-all ${
                        isPickingPos
                          ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 mr-1" />
                      <span>{isPickingPos ? tr('✕ Annuler', '✕ إلغاء') : tr('+ POS sur Carte', '+ POS على الخريطة')}</span>
                    </Button>
                  </div>
                </div>

                {/* Map Canvas */}
                <div className="flex-1 w-full h-full relative" style={{ minHeight: '520px' }}>
                  {/* Floating Top Banner when in +POS Picking Mode */}
                  {isPickingPos && (
                    <div className="absolute top-4 left-4 right-4 z-[1000] bg-slate-900/95 border-2 border-cyan-400 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-in slide-in-from-top-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center shrink-0">
                          <MapPin className="w-5 h-5 animate-bounce" />
                        </div>
                        <div>
                          <div className="text-sm font-black text-white">
                            {tr('Définition d\'un Point de Vente sur la Carte', 'تحديد مكان نقطة البيع على الخريطة')}
                          </div>
                          <div className="text-xs text-cyan-300 font-medium">
                            {tr('Cliquez sur la carte pour déplacer le cercle ⭕ puis cliquez sur la bulle pour remplir les données', 'انقر على الخريطة لنقل الدائرة ⭕ ثم اضغط لتعبئة بيانات POS')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => openCreatePosModal(posPickCoords)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-9 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>{tr('Remplir Fiche POS', 'تعبئة بيانات POS')}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsPickingPos(false)}
                          className="h-9 w-9 p-0 text-slate-400 hover:text-white rounded-xl"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <MapContainer
                    center={mapCenter}
                    zoom={mapZoom}
                    scrollWheelZoom={true}
                    className="w-full h-full z-0"
                    style={{ width: '100%', height: '100%', minHeight: '520px' }}
                  >
                    <MapViewController center={mapCenter} zoom={mapZoom} />

                    {/* Interactive Map Click for +POS Placement */}
                    <MapEventsHandler
                      isPicking={isPickingPos}
                      onPick={(lat, lng) => setPosPickCoords([lat, lng])}
                    />

                    {/* Interactive Circle & Pin when in +POS Mode */}
                    {isPickingPos && (
                      <>
                        <Circle
                          center={posPickCoords}
                          radius={55}
                          pathOptions={{
                            color: '#06b6d4',
                            fillColor: '#22d3ee',
                            fillOpacity: 0.35,
                            weight: 3,
                            dashArray: '5, 5',
                          }}
                          eventHandlers={{
                            click: () => openCreatePosModal(posPickCoords),
                          }}
                        />
                        <Marker
                          position={posPickCoords}
                          icon={createPickTargetIcon()}
                          eventHandlers={{
                            click: () => openCreatePosModal(posPickCoords),
                          }}
                        >
                          <Popup autoPan={false}>
                            <div className="p-2 text-center text-slate-900 min-w-[180px]">
                              <div className="font-black text-xs text-cyan-700">📍 تحديد نقطة بيع (POS)</div>
                              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                {posPickCoords[0].toFixed(5)}, {posPickCoords[1].toFixed(5)}
                              </div>
                              <button
                                type="button"
                                onClick={() => openCreatePosModal(posPickCoords)}
                                className="mt-2 w-full px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg shadow active:scale-95 transition-all"
                              >
                                تعبئة بيانات POS 📝
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                      </>
                    )}

                    {/* Google Maps Layer (Region: MA, Language: fr) */}
                    <TileLayer
                      key={mapLayer}
                      attribution={GOOGLE_MAP_LAYERS[mapLayer].attribution}
                      url={GOOGLE_MAP_LAYERS[mapLayer].url}
                    />

                    {/* SFT GAZ CENTRAL DEPOT MARKER */}
                    <Marker position={[33.565, -7.61]} icon={depotIcon}>
                      <Popup>
                        <div className="p-2 text-slate-900">
                          <div className="font-black text-sm text-indigo-700">Dépôt Central SFT GAZ</div>
                          <div className="text-xs text-slate-600 mt-1">Point de départ et de retour de toutes les tournées.</div>
                        </div>
                      </Popup>
                    </Marker>

                    {/* Circuit Polylines for active tournées */}
                    {activeCircuitsToDraw.map((trn, idx) => {
                      const isSelected = selectedTournee?.id === trn.id;
                      const color = CIRCUIT_COLORS[idx % CIRCUIT_COLORS.length];
                      const points: [number, number][] = [
                        [33.565, -7.61], // Start from depot
                        ...(trn.stops || [])
                          .filter(s => typeof s.lat === 'number' && !isNaN(s.lat) && isFinite(s.lat) && typeof s.lng === 'number' && !isNaN(s.lng) && isFinite(s.lng))
                          .map(s => [s.lat, s.lng] as [number, number]),
                      ];
                      return (
                        <Polyline
                          key={`poly-${trn.id}`}
                          positions={points}
                          color={color}
                          weight={isSelected ? 5 : 3.5}
                          opacity={isSelected ? 0.95 : 0.65}
                          dashArray={isSelected ? undefined : '5, 8'}
                        />
                      );
                    })}

                    {/* Driver / Truck Markers:
                        - If selectedDriverFilter === 'all': shows all active trucks/drivers in fleet
                        - If selectedDriverFilter !== 'all': shows ONLY the single truck for the selected driver!
                    */}
                    {trucksOnMap.map((truckItem) => {
                      return (
                        <Marker
                          key={truckItem.key}
                          position={truckItem.coords}
                          icon={createTruckIcon(truckItem.driverName, truckItem.status === 'en_cours', truckItem.isLive)}
                        >
                          <Popup>
                            <div className="p-3 text-slate-900 min-w-[220px]">
                              <div className="flex items-center justify-between mb-1">
                                <div className="font-black text-sm text-sky-700 flex items-center gap-1.5">
                                  <Truck className="w-4 h-4" />
                                  <span>{truckItem.driverName}</span>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  truckItem.isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {truckItem.label}
                                </span>
                              </div>

                              <div className="text-xs text-slate-700 font-semibold mt-1">
                                Véhicule: <strong className="text-slate-900 font-mono">{truckItem.truckName}</strong>
                              </div>

                              {truckItem.tournee ? (
                                <>
                                  <div className="text-xs text-slate-600 font-mono mt-0.5">
                                    Tournée: <strong>{truckItem.tournee.tourneeNumber}</strong>
                                    {truckItem.tournee.supplyOrderNumber && (
                                      <span> (B.S: {truckItem.tournee.supplyOrderNumber})</span>
                                    )}
                                  </div>
                                  <div className="mt-2 pt-2 border-t text-xs flex justify-between font-bold">
                                    <span>Progression:</span>
                                    <span className="text-emerald-700 font-black">
                                      {truckItem.deliveredCount} / {truckItem.totalStops} arrêts
                                    </span>
                                  </div>
                                  <div className="mt-1 text-[11px] text-slate-600 flex justify-between">
                                    <span>Livrées: <strong>{truckItem.totalDelivered} btles</strong></span>
                                    <span>Ventes: <strong className="text-emerald-700">{truckItem.salesAmount.toFixed(0)} DH</strong></span>
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-slate-500 mt-1 italic">
                                  {tr('En attente de démarrage de tournée', 'في انتظار بدء الجولة')}
                                </div>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}

                    {/* POS Stops Pins */}
                    {activeStops.map((stop, idx) => (
                      <Marker
                        key={stop.id || `stop-${idx}`}
                        position={[stop.lat, stop.lng]}
                        icon={createPosIcon(stop.status, stop.sequenceOrder, stop.isOverdue48h)}
                      >
                        <Popup>
                          <div className="p-3 text-slate-900 min-w-[220px]">
                            {stop.isOverdue48h && (
                              <div className="mb-2 p-1.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold flex items-center gap-1.5">
                                <span className="text-amber-600">⚠️</span>
                                <span>Alerte 48h : Sans livraison depuis {stop.hoursSinceLastDelivery || 48}h !</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between mb-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                stop.status === 'livre' ? 'bg-emerald-100 text-emerald-800' : (stop.isOverdue48h ? 'bg-amber-100 text-amber-900 font-black' : 'bg-rose-100 text-rose-800')
                              }`}>
                                {stop.status === 'livre' ? '🟢 Livré' : (stop.isOverdue48h ? '⚠️ En Attente (>48h)' : '🔴 En attente')}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">Arrêt #{stop.sequenceOrder}</span>
                            </div>
                            <div className="font-black text-sm text-slate-900">
                              {cleanLabel(stop.posName, cleanLabel(stop.clientName, `Point de Vente #${stop.sequenceOrder}`))}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              Client: <strong>{cleanLabel(stop.clientName, 'Client')}</strong>
                            </div>
                            <div className="text-xs text-indigo-700 font-semibold mt-1">
                              Chauffeur: {cleanLabel(stop.tourneeDriver, 'Chauffeur')}
                            </div>

                            {stop.status === 'livre' ? (
                              <div className="mt-2 pt-2 border-t border-slate-200 space-y-1 text-xs">
                                <div className="text-emerald-700 font-bold">
                                  Livrées: {stop.deliveredItems?.map(d => `${d.quantityFull}x ${d.bottleTypeName}`).join(', ') || '-'}
                                </div>
                                <div className="text-amber-700 font-bold">
                                  Vides récupérées: {stop.collectedEmpty?.map(c => `${c.quantityEmpty}x ${c.bottleTypeName}`).join(', ') || '-'}
                                </div>
                                <div className="text-slate-900 font-black">
                                  Montant: {(stop.amountPaid || 0).toFixed(2)} DH ({stop.paymentMethod})
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                                Prévu pour livraison lors du passage du camion.
                              </div>
                            )}

                            <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-mono">
                                GPS: {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const matchedPos = clientPosList.find(p => 
                                    p.id === stop.clientId || 
                                    p.clientId === stop.clientId || 
                                    (p.posName && stop.posName && p.posName.trim().toLowerCase() === stop.posName.trim().toLowerCase()) ||
                                    (Math.abs(p.lat - stop.lat) < 0.0005 && Math.abs(p.lng - stop.lng) < 0.0005)
                                  );
                                  if (matchedPos) {
                                    setPosToDelete(matchedPos);
                                  } else {
                                    setPosToDelete({
                                      id: stop.id || stop.clientId || `pos-${Date.now()}`,
                                      clientId: stop.clientId,
                                      clientName: stop.clientName,
                                      posName: stop.posName || stop.clientName,
                                      lat: stop.lat,
                                      lng: stop.lng,
                                    });
                                  }
                                }}
                                className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-[11px] font-bold py-1 px-2 rounded-lg flex items-center gap-1 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>{tr('Supprimer', 'حذف')}</span>
                              </button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </Card>

              {/* Selected Tournee Details Banner */}
              {selectedTournee && (
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-indigo-300 font-mono">
                        Tournée active: <strong className="text-white">{selectedTournee.tourneeNumber}</strong> (B.S: {selectedTournee.supplyOrderNumber})
                      </div>
                      <div className="font-bold text-sm text-white">
                        Chauffeur: {cleanLabel(selectedTournee.driverName, 'Chauffeur')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap text-xs">
                    <div className="bg-black/50 px-3 py-1.5 rounded-xl border border-white/10">
                      <span className="text-slate-400 block text-[10px]">Arrêts Livrés</span>
                      <strong className="text-emerald-400">
                        {selectedTournee.stops?.filter(s => s.status === 'livre').length || 0} / {selectedTournee.stops?.length || 0}
                      </strong>
                    </div>
                    <div className="bg-black/50 px-3 py-1.5 rounded-xl border border-white/10">
                      <span className="text-slate-400 block text-[10px]">Vides Récupérés</span>
                      <strong className="text-amber-400">{selectedTournee.totalCollectedEmpty || 0} btles</strong>
                    </div>
                    <div className="bg-black/50 px-3 py-1.5 rounded-xl border border-white/10">
                      <span className="text-slate-400 block text-[10px]">Cash Encaissé</span>
                      <strong className="text-emerald-300">{(selectedTournee.totalCashCollected || 0).toFixed(2)} DH</strong>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        const loc = getDriverLocation(selectedTournee);
                        setMapCenter(loc.coords);
                        setMapZoom(14);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9"
                    >
                      <Navigation className="w-3.5 h-3.5 mr-1" />
                      {tr('Centrer Camion', 'توسيط الشاحنة')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Points de Vente Database */}
        <TabsContent value="pos_list" className="space-y-4 m-0">
          <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-indigo-400" />
                  {tr('Points de Vente & Magasins Répertoriés', 'قاعدة بيانات نقاط البيع والمحلات')}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {tr('Tous les magasins clients géolocalisés pour la distribution de gaz.', 'جميع المحلات والزبائن المحددة جغرافياً لتوزيع قنينات الغاز.')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {clientPosList.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setDeleteAllPosDialogOpen(true)}
                    className="border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/60 hover:text-white font-bold text-xs h-10 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    {tr('Vider la Liste / Tout Supprimer', 'تفريغ القائمة / حذف الكل')}
                  </Button>
                )}
                <Button
                  onClick={() => openCreatePosModal()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-10 rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {tr('Ajouter un Point de Vente', 'إضافة نقطة بيع جديدة')}
                </Button>
              </div>
            </div>

            {/* Filter banner if driver is selected */}
            {selectedDriverFilter !== 'all' && (
              <div className="mt-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs text-indigo-200">
                  <Filter className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    {tr('Affichage filtré pour le chauffeur :', 'عرض مخصص للسائق :')}{' '}
                    <strong className="text-white">
                      {availableFilterDrivers.find(d => String(d.id) === String(selectedDriverFilter))?.name || selectedDriverFilter}
                    </strong>
                    {' '}({filteredClientPosList.length} {tr('point(s) de vente', 'نقطة بيع')})
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedDriverFilter('all')}
                  className="text-xs text-indigo-300 hover:text-white hover:bg-indigo-900/50 h-7"
                >
                  {tr('Afficher tous les chauffeurs', 'عرض جميع السائقين')}
                </Button>
              </div>
            )}

            {filteredClientPosList.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
                  <Store className="w-8 h-8" />
                </div>
                <div className="text-white font-bold text-base">
                  {tr('Aucun point de vente répertorié', 'لا توجد أي نقطة بيع مسجلة')}
                </div>
                <p className="text-slate-400 text-xs max-w-md mx-auto">
                  {selectedDriverFilter !== 'all'
                    ? tr('Ce chauffeur n\'a aucun point de vente assigné dans ses tournées actuelles.', 'هذا السائق ليس لديه نقاط بيع مسندة في جولاته الحالية.')
                    : tr('La liste est vide. Cliquez sur le bouton ci-dessous pour ajouter un point de vente manuellement ou via la carte.', 'القائمة فارغة. انقر على الزر أدناه لإضافة نقطة بيع يدوياً أو عبر الخريطة.')}
                </p>
                <Button
                  onClick={() => openCreatePosModal()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {tr('Ajouter un Point de Vente', 'إضافة نقطة بيع')}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {filteredClientPosList.map((pos, idx) => {
                  const isOverdue = alerts48h.some(a => a.posId === pos.id || a.clientId === pos.clientId);
                  const alertInfo = alerts48h.find(a => a.posId === pos.id || a.clientId === pos.clientId);

                  return (
                    <div
                      key={pos.id || idx}
                      className={`bg-slate-950/70 border rounded-2xl p-4 space-y-3 transition-all shadow-sm ${
                        isOverdue ? 'border-amber-500/40 hover:border-amber-400' : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-sm text-white">{cleanLabel(pos.posName, `Point de Vente #${idx + 1}`)}</div>
                          <div className="text-xs text-indigo-300 mt-0.5">{cleanLabel(pos.clientName, 'Client')}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {(pos.assignedDriverName || pos.lastDeliveryDriver) && (
                            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              <span>{cleanLabel(pos.assignedDriverName || pos.lastDeliveryDriver, 'Chauffeur')}</span>
                            </Badge>
                          )}
                          <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">
                            {pos.circuitName || 'Casablanca'}
                          </Badge>
                        </div>
                      </div>

                      {/* 48h Delivery Status Alert */}
                      {isOverdue ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-950/40 border border-amber-500/40 p-2 rounded-xl">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                          <span>⚠️ {tr(`Non approvisionné depuis ${alertInfo?.hoursSinceLastDelivery || 48}h`, `لم يتم تزويده منذ ${alertInfo?.hoursSinceLastDelivery || 48} ساعة`)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                          <Check className="w-3 h-3" />
                          <span>{tr('Approvisionné récemment', 'تم تزويده مؤخراً')}</span>
                        </div>
                      )}

                      {/* Full Address Card (Adresse Complète) */}
                      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-indigo-400 flex items-center gap-1 uppercase tracking-wide text-[10px]">
                            <MapPin className="w-3 h-3 text-indigo-400" />
                            {tr('Adresse Complète', 'العنوان الكامل')}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${pos.lat},${pos.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 font-bold hover:underline flex items-center gap-0.5 text-[10px]"
                          >
                            Google Maps ↗
                          </a>
                        </div>

                        <div className="text-xs font-semibold text-white leading-relaxed">
                          📍 {formatFullAddress(pos)}
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 text-[11px] font-mono text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-400 font-bold">GPS:</span>
                            <span className="text-slate-300 font-bold">{pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}</span>
                          </div>
                          <span className="text-[10px] text-slate-500">{pos.circuitName || 'Casablanca'}</span>
                        </div>
                      </div>

                      {/* Contact & Fiscal Info */}
                      <div className="flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
                        {pos.phone ? (
                          <a href={`tel:${pos.phone}`} className="flex items-center gap-1 text-slate-300 hover:text-indigo-400">
                            <span>📞 {pos.phone}</span>
                          </a>
                        ) : <span className="text-slate-600">📞 Non renseigné</span>}

                        {(pos.ice || pos.patente) && (
                          <div className="flex items-center gap-1 text-[10px] font-mono">
                            {pos.ice && <span className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400">ICE: {pos.ice}</span>}
                            {pos.patente && <span className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400">PAT: {pos.patente}</span>}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons: Delete + View on Map */}
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPosToDelete(pos)}
                          className="border border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white text-xs h-8 px-2.5 rounded-xl transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          {tr('Supprimer', 'حذف')}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMapCenter([pos.lat, pos.lng]);
                            setMapZoom(15);
                            setActiveTab('map');
                          }}
                          className="border-slate-700 bg-slate-900 text-slate-200 text-xs h-8 px-3 rounded-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all"
                        >
                          <MapPin className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                          {tr('Voir sur la Carte', 'عرض على الخريطة')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 3: Tournées History */}
        <TabsContent value="history" className="space-y-4 m-0">
          <Card className="border-slate-800 bg-slate-900/95 shadow-xl rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              {tr('Historique Complet des Tournées', 'السجل الكامل لجميع الجولات')}
            </h3>

            {/* Filter banner if driver is selected */}
            {selectedDriverFilter !== 'all' && (
              <div className="mb-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs text-indigo-200">
                  <Filter className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    {tr('Historique filtré pour le chauffeur :', 'السجل مخصص للسائق :')}{' '}
                    <strong className="text-white">
                      {availableFilterDrivers.find(d => String(d.id) === String(selectedDriverFilter))?.name || selectedDriverFilter}
                    </strong>
                    {' '}({filteredTournees.length} {tr('tournée(s)', 'جولة')})
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedDriverFilter('all')}
                  className="text-xs text-indigo-300 hover:text-white hover:bg-indigo-900/50 h-7"
                >
                  {tr('Afficher tous les chauffeurs', 'عرض جميع السائقين')}
                </Button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">N° Tournée</th>
                    <th className="p-3">B.S Associé</th>
                    <th className="p-3">Chauffeur</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3 text-center">Arrêts</th>
                    <th className="p-3 text-center">Bouteilles Pleines</th>
                    <th className="p-3 text-center">Vides Reprises</th>
                    <th className="p-3 text-right">Ventes (DH)</th>
                    <th className="p-3 text-right">Cash Encaissé</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTournees.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Clock className="w-8 h-8 text-slate-600" />
                          <span className="font-bold text-sm text-slate-300">
                            {tr('Aucune tournée trouvée pour ce chauffeur.', 'لم يتم العثور على أي جولة لهذا السائق.')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTournees.map((trn) => {
                      const deliveredCount = trn.stops?.filter(s => s.status === 'livre').length || 0;
                      const totalStopsCount = trn.stops?.length || 0;
                      return (
                        <tr key={trn.id} className="hover:bg-slate-800/50">
                          <td className="p-3 font-mono font-bold text-white">{trn.tourneeNumber}</td>
                          <td className="p-3 font-mono text-indigo-300">{trn.supplyOrderNumber}</td>
                          <td className="p-3 font-bold text-white">{cleanLabel(trn.driverName, 'Chauffeur')}</td>
                          <td className="p-3">
                            <Badge className={
                              trn.status === 'en_cours'
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }>
                              {trn.status === 'en_cours' ? 'En cours' : (trn.status === 'validee_retour' ? 'Validée Retour' : 'Clôturée')}
                            </Badge>
                          </td>
                          <td className="p-3 text-center font-bold text-white">{deliveredCount}/{totalStopsCount}</td>
                          <td className="p-3 text-center text-amber-400 font-bold">{trn.totalDeliveredFull || 0}</td>
                          <td className="p-3 text-center text-slate-300">{trn.totalCollectedEmpty || 0}</td>
                          <td className="p-3 text-right font-bold text-white">{(trn.totalSalesAmount || 0).toFixed(2)} DH</td>
                          <td className="p-3 text-right font-black text-emerald-400">{(trn.totalCashCollected || 0).toFixed(2)} DH</td>
                          <td className="p-3 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedTournee(trn);
                                const loc = getDriverLocation(trn);
                                setMapCenter(loc.coords);
                                setMapZoom(13);
                                setActiveTab('map');
                              }}
                              className="text-indigo-400 hover:text-white hover:bg-indigo-600/30 text-xs h-7"
                            >
                              {tr('Voir Circuit', 'عرض المسار')}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal 1: Launch Tournee from Bon de Sortie */}
      <Dialog open={createTourneeModalOpen} onOpenChange={setCreateTourneeModalOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 text-white border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-400" />
              <span>{tr('Démarrer une Tournée Mobile Chauffeur', 'بدء جولة جديدة للسائق')}</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              {tr(
                'Sélectionnez un Bon de Sortie (B.S) existant pour générer la tournée sur l\'application mobile du chauffeur avec son stock de départ.',
                'اختر سند خروج موجود لتوليد جولة جديدة على تطبيق الهاتف للسائق مع حمولته الابتدائية.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 uppercase">
                {tr('Sélectionner le Bon de Sortie (B.S)', 'اختر سند الخروج')}
              </label>
              <select
                value={selectedBsToLaunch}
                onChange={(e) => setSelectedBsToLaunch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">{tr('-- Choisir un Bon de Sortie --', '-- اختر سند خروج --')}</option>
                {supplyOrders.map((bs) => (
                  <option key={bs.id} value={bs.id}>
                    {bs.orderNumber} · {bs.driverName} ({new Date(bs.date).toLocaleDateString()}) - Total: {bs.total} DH
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateTourneeModalOpen(false)}
              className="border-slate-700 bg-slate-950 text-slate-300"
            >
              {tr('Annuler', 'إلغاء')}
            </Button>
            <Button
              onClick={handleLaunchTournee}
              disabled={!selectedBsToLaunch}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
            >
              {tr('Lancer la Tournée', 'إطلاق الجولة')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Create new Point de Vente */}
      <Dialog open={createPosModalOpen} onOpenChange={setCreatePosModalOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 text-white border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Store className="w-5 h-5 text-indigo-400" />
              <span>{tr('Ajouter un Point de Vente (Magasin)', 'إضافة نقطة بيع (محل)')}</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              {tr(
                'Enregistrez un nouveau magasin client pour qu\'il apparaisse sur la carte et dans les tournées des chauffeurs.',
                'سجل محلاً جديداً ليظهر على الخريطة ومسارات التوزيع لجميع السائقين.'
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePos} className="space-y-3 py-2">
            {/* Chauffeur Assigné */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {tr('Chauffeur Assigné', 'السائق المخصص لهذا المحل')}
              </label>
              <select
                value={newPosData.assignedDriverId}
                onChange={(e) => {
                  const drvId = e.target.value;
                  const drvObj = availableFilterDrivers.find(d => String(d.id) === drvId);
                  setNewPosData(prev => ({
                    ...prev,
                    assignedDriverId: drvId,
                    assignedDriverName: drvObj ? drvObj.name : (drvId ? drvId : ''),
                  }));
                }}
                className="w-full bg-slate-950 border border-slate-800 text-white text-xs h-10 rounded-xl px-3 focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="">{tr('Tous les chauffeurs (Visible par tous)', 'جميع السائقين (مرئي للجميع)')}</option>
                {availableFilterDrivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.count > 0 ? `(${d.count} tournées)` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {tr('Nom du Point de Vente *', 'اسم نقطة البيع / المحل *')}
              </label>
              <Input
                value={newPosData.posName}
                onChange={(e) => setNewPosData({ ...newPosData, posName: e.target.value })}
                placeholder="Ex: Épicerie Al Amal"
                className="bg-slate-950 border-slate-800 text-white text-xs h-10 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {tr('Nom du Client / Responsable', 'اسم الزبون / المسؤول')}
              </label>
              <Input
                value={newPosData.clientName}
                onChange={(e) => setNewPosData({ ...newPosData, clientName: e.target.value })}
                placeholder="Ex: Ahmed Alami"
                className="bg-slate-950 border-slate-800 text-white text-xs h-10 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  {tr('Téléphone', 'الهاتف')}
                </label>
                <Input
                  value={newPosData.phone}
                  onChange={(e) => setNewPosData({ ...newPosData, phone: e.target.value })}
                  placeholder="0661234567"
                  className="bg-slate-950 border-slate-800 text-white text-xs h-10 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  {tr('Circuit / Secteur', 'المسار / الحي')}
                </label>
                <Input
                  value={newPosData.circuitName}
                  onChange={(e) => setNewPosData({ ...newPosData, circuitName: e.target.value })}
                  placeholder="Ex: Bourgogne"
                  className="bg-slate-950 border-slate-800 text-white text-xs h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  ICE <span className="text-slate-500 font-normal">({tr('Optionnel', 'اختياري')})</span>
                </label>
                <Input
                  value={newPosData.ice}
                  onChange={(e) => setNewPosData({ ...newPosData, ice: e.target.value })}
                  placeholder="001234567000089"
                  className="bg-slate-950 border-slate-800 text-white text-xs h-10 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  PATENTE <span className="text-slate-500 font-normal">({tr('Optionnel', 'اختياري')})</span>
                </label>
                <Input
                  value={newPosData.patente}
                  onChange={(e) => setNewPosData({ ...newPosData, patente: e.target.value })}
                  placeholder="12345678"
                  className="bg-slate-950 border-slate-800 text-white text-xs h-10 rounded-xl font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {tr('Adresse', 'العنوان')}
              </label>
              <Input
                value={newPosData.address}
                onChange={(e) => setNewPosData({ ...newPosData, address: e.target.value })}
                placeholder="Ex: Rue 14, Bourgogne, Casablanca"
                className="bg-slate-950 border-slate-800 text-white text-xs h-10 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  {tr('Latitude GPS', 'خط العرض')}
                </label>
                <Input
                  type="number"
                  step="0.0001"
                  value={newPosData.lat}
                  onChange={(e) => setNewPosData({ ...newPosData, lat: parseFloat(e.target.value) || 33.585 })}
                  className="bg-slate-950 border-slate-800 text-white text-xs h-10 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  {tr('Longitude GPS', 'خط الطول')}
                </label>
                <Input
                  type="number"
                  step="0.0001"
                  value={newPosData.lng}
                  onChange={(e) => setNewPosData({ ...newPosData, lng: parseFloat(e.target.value) || -7.635 })}
                  className="bg-slate-950 border-slate-800 text-white text-xs h-10 rounded-xl"
                  required
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreatePosModalOpen(false)}
                className="border-slate-700 bg-slate-950 text-slate-300"
              >
                {tr('Annuler', 'إلغاء')}
              </Button>
              <Button
                type="submit"
                disabled={savingPos}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              >
                {savingPos ? tr('Enregistrement...', 'جاري الحفظ...') : tr('Enregistrer', 'حفظ')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Confirmation de Suppression de Point de Vente */}
      <Dialog open={Boolean(posToDelete)} onOpenChange={(open) => !open && setPosToDelete(null)}>
        <DialogContent className="sm:max-w-md bg-slate-900 text-white border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-400">
              <Trash2 className="w-5 h-5 text-rose-500" />
              <span>{tr('Confirmer la suppression', 'تأكيد الحذف')}</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              {tr(
                `Êtes-vous sûr de vouloir supprimer définitivement le point de vente "${posToDelete?.posName}" ? Cette action est irréversible.`,
                `هل أنت متأكد من رغبتك في حذف نقطة البيع "${posToDelete?.posName}" نهائياً من النظام؟`
              )}
            </DialogDescription>
          </DialogHeader>

          {posToDelete && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <div className="font-bold text-white text-sm">{posToDelete.posName}</div>
              <div className="text-slate-400">📍 {formatFullAddress(posToDelete)}</div>
              <div className="text-[11px] font-mono text-cyan-400">
                GPS: {posToDelete.lat.toFixed(4)}, {posToDelete.lng.toFixed(4)}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPosToDelete(null)}
              className="border-slate-700 bg-slate-950 text-slate-300"
            >
              {tr('Annuler', 'إلغاء')}
            </Button>
            <Button
              onClick={async () => {
                if (!posToDelete) return;
                try {
                  await pointVenteService.deleteClientPos(posToDelete.id);
                  toast({
                    title: tr('Point de Vente Supprimé', 'تم الحذف'),
                    description: tr(`"${posToDelete.posName}" a été supprimé avec succès.`, `تم حذف "${posToDelete.posName}" بنجاح.`),
                  });
                  setPosToDelete(null);
                  await loadData();
                } catch (err: any) {
                  toast({
                    title: tr('Erreur', 'خطأ'),
                    description: err?.message || tr('Impossible de supprimer', 'تعذر الحذف'),
                    variant: 'destructive',
                  });
                }
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              {tr('Oui, Supprimer', 'نعم، حذف')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 4: Confirmation de Suppression de TOUS les Points de Vente */}
      <Dialog open={deleteAllPosDialogOpen} onOpenChange={setDeleteAllPosDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 text-white border-rose-500/40">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <span>{tr('Supprimer TOUS les Points de Vente ?', 'حذف جميع نقاط البيع؟')}</span>
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-xs">
              {tr(
                'Êtes-vous absolument sûr de vouloir vider toute la liste ? Tous les points de vente répertoriés seront définitivement supprimés et retirés de la carte.',
                'هل أنت متأكد تماماً من رغبتك في تفريغ القائمة بالكامل؟ سيتم حذف جميع نقاط البيع المسجلة نهائياً وإزالتها من الخريطة.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-rose-950/30 rounded-xl border border-rose-500/30 text-xs text-rose-200">
            ⚠️ {tr('Cette action est irréversible. La liste sera réinitialisée à 0 point de vente.', 'هذا الإجراء لا يمكن التراجع عنه. ستصبح قائمة نقاط البيع فارغة تماماً.')}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={deletingAll}
              onClick={() => setDeleteAllPosDialogOpen(false)}
              className="border-slate-700 bg-slate-950 text-slate-300"
            >
              {tr('Annuler', 'إلغاء')}
            </Button>
            <Button
              disabled={deletingAll}
              onClick={async () => {
                setDeletingAll(true);
                try {
                  await pointVenteService.deleteAllClientPos();
                  toast({
                    title: tr('Liste Vidée', 'تم تفريغ القائمة'),
                    description: tr('Tous les points de vente ont été supprimés avec succès.', 'تم حذف جميع نقاط البيع بنجاح.'),
                  });
                  setDeleteAllPosDialogOpen(false);
                  await loadData();
                } catch (err: any) {
                  toast({
                    title: tr('Erreur', 'خطأ'),
                    description: err?.message || tr('Impossible de vider la liste', 'تعذر الحذف'),
                    variant: 'destructive',
                  });
                } finally {
                  setDeletingAll(false);
                }
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              {deletingAll ? tr('Suppression...', 'جاري الحذف...') : tr('Oui, Tout Supprimer', 'نعم، حذف الكل')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
