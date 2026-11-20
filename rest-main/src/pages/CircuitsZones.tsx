import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Polygon,
  Circle,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  MapPin,
  Truck,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Palette,
  Layers,
  Plus,
  Trash2,
  Edit,
  Crosshair,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Clock,
  Gauge,
  Navigation,
  Download,
  Eye,
  EyeOff,
  Store,
  ChevronDown,
  RefreshCw,
  Info,
  Maximize2,
  Minimize2,
  Check,
  X,
  SlidersHorizontal,
  Flame,
  FastForward,
  Volume2,
  Bell,
  Target,
  Shield,
  Activity,
} from 'lucide-react';
import {
  circuitZoneService,
  GeofenceZone,
  ZoneEventLog,
  VehicleTrajetData,
  TrajetFilterOptions,
  TRAJET_PALETTE,
  isPointInPolygon,
} from '@/lib/circuitZoneService';
import { getLiveGpsVehicles, KNOWN_GPS_FALLBACK_VEHICLES, LiveVehicle } from '@/lib/gpswoxService';
import { pointVenteService, ClientPos } from '@/lib/pointVenteService';

// Tile providers
type MapTileKey = 'google_hybrid' | 'google_roads' | 'osm';
const MAP_TILES: Record<MapTileKey, { name: string; url: string; attribution: string }> = {
  google_hybrid: {
    name: 'Google Satellite / Hybride',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&gl=MA&hl=fr',
    attribution: '&copy; Google Satellite',
  },
  google_roads: {
    name: 'Google Maps Routes',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&gl=MA&hl=fr',
    attribution: '&copy; Google Maps',
  },
  osm: {
    name: 'OpenStreetMap Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
};

// Helper: Custom Map Pan / FitBounds Controller
function MapViewController({
  center,
  zoom,
  bounds,
}: {
  center: [number, number];
  zoom?: number;
  bounds?: L.LatLngBoundsExpression | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, duration: 1.2 });
        return;
      } catch {}
    }
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom || map.getZoom(), { duration: 1.2 });
    }
  }, [center, zoom, bounds, map]);
  return null;
}

// Helper: Map Click Handler for polygon drawing
function MapDrawingHandler({
  isDrawing,
  onAddPoint,
}: {
  isDrawing: boolean;
  onAddPoint: (latlng: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onAddPoint([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

export default function CircuitsZones() {
  const { trucks, drivers } = useApp();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isAr = language === 'ar';

  // State: Data
  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [eventLogs, setEventLogs] = useState<ZoneEventLog[]>([]);
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [pointsDeVente, setPointsDeVente] = useState<ClientPos[]>([]);
  const [trajetColors, setTrajetColors] = useState<Record<string, string>>({});
  const [trajetsData, setTrajetsData] = useState<Record<string, VehicleTrajetData>>({});

  // Advanced Trajet Filter States
  const [periodPreset, setPeriodPreset] = useState<'today' | 'yesterday' | '3days' | '7days' | 'custom'>('today');
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fromTime, setFromTime] = useState<string>('00:00');
  const [toTime, setToTime] = useState<string>('23:59');
  const [minSpeedFilter, setMinSpeedFilter] = useState<number>(0);
  const [hideStops, setHideStops] = useState<boolean>(false);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState<string>('');

  // Selections & Map
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [activeTile, setActiveTile] = useState<MapTileKey>('google_hybrid');
  const [mapCenter, setMapCenter] = useState<[number, number]>([32.3392, -6.4159]); // Beni Mellal / Fleet Area
  const [mapZoom, setMapZoom] = useState<number>(12);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);

  // Layer Toggles
  const [showTrajets, setShowTrajets] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showPosPins, setShowPosPins] = useState(true);
  const [showStops, setShowStops] = useState(true);

  // Drawing Mode
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);

  // Zone Dialogs (Create / Edit)
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Partial<GeofenceZone> | null>(null);

  // Trajectory Playback Simulation
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(100); // 0 to 100%
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const playbackTimerRef = useRef<any>(null);

  // Logs & UI
  const [logFilter, setLogFilter] = useState<'all' | 'violation' | 'entry' | 'exit'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTrajets, setLoadingTrajets] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Period Preset Change Handler
  const handlePeriodChange = (preset: 'today' | 'yesterday' | '3days' | '7days' | 'custom') => {
    setPeriodPreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yStr = y.toISOString().split('T')[0];
      setFromDate(yStr);
      setToDate(yStr);
    } else if (preset === '3days') {
      const d = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      setFromDate(d.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === '7days') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setFromDate(d.toISOString().split('T')[0]);
      setToDate(todayStr);
    }
  };

  // Load Initial Core Data
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Zones
      const loadedZones = await circuitZoneService.getZones();
      setZones(loadedZones);

      // 2. Event Logs
      const loadedLogs = await circuitZoneService.getEventLogs();
      setEventLogs(loadedLogs);

      // 3. Trajet Custom Colors
      const colors = circuitZoneService.getTrajetColors();
      setTrajetColors(colors);

      // 4. Vehicles from Live GPSwox Fleet
      const liveDevs = await getLiveGpsVehicles();
      const validVehicles: LiveVehicle[] =
        Array.isArray(liveDevs) && liveDevs.length > 0
          ? liveDevs
          : KNOWN_GPS_FALLBACK_VEHICLES.map((plate, idx) => ({
              id: `dev-${idx + 1}`,
              name: plate,
              plate,
              driverName: idx === 0 ? 'AZIZ AOUDU' : idx === 1 ? 'TARIK MAHIL' : idx === 2 ? 'LIV ZIDOUH YASSIN' : 'Chauffeur assigné',
              lat: 32.3047 + (idx % 3) * 0.015,
              lng: -6.4159 + (idx % 2) * 0.02,
              speed: idx % 3 === 0 ? 38 : 0,
              heading: 90,
              moving: idx % 3 === 0,
              isMoving: idx % 3 === 0,
              online: true,
              status: (idx % 3 === 0 ? 'moving' : 'stopped') as 'moving' | 'stopped',
              lastUpdate: '14:30',
            }));

      setVehicles(validVehicles);

      // Set Map Center to the average of vehicle locations
      if (validVehicles.length > 0) {
        const avgLat = validVehicles.reduce((acc, v) => acc + (v.lat || 0), 0) / validVehicles.length;
        const avgLng = validVehicles.reduce((acc, v) => acc + (v.lng || 0), 0) / validVehicles.length;
        if (avgLat && avgLng) {
          setMapCenter([avgLat, avgLng]);
        }
      }

      // Auto-select first 3 vehicles by default
      if (validVehicles.length > 0 && selectedVehicleIds.length === 0) {
        setSelectedVehicleIds(validVehicles.slice(0, 3).map((v) => v.id));
      }

      // 5. Points de Vente
      const posList = await pointVenteService.getClients();
      setPointsDeVente(posList);
    } catch (err) {
      console.error('[CircuitsZones] Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedVehicleIds.length]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Load Trajets with Advanced Filter Options
  const reloadTrajets = useCallback(async () => {
    if (selectedVehicleIds.length === 0) {
      setTrajetsData({});
      return;
    }

    setLoadingTrajets(true);
    const filterOpts: TrajetFilterOptions = {
      fromDate,
      toDate,
      fromTime: `${fromTime}:00`,
      toTime: `${toTime}:59`,
      minSpeed: minSpeedFilter,
      hideStops,
    };

    const newTrajets: Record<string, VehicleTrajetData> = {};
    const allPointsForBounds: [number, number][] = [];

    for (const vId of selectedVehicleIds) {
      const veh = vehicles.find((v) => v.id === vId);
      if (!veh) continue;
      try {
        const t = await circuitZoneService.fetchVehicleTrajet(veh, filterOpts);
        if (t && t.points && t.points.length > 0) {
          newTrajets[vId] = t;
          t.points.forEach((p) => allPointsForBounds.push([p.lat, p.lng]));
        }
      } catch (e) {
        console.warn(`Could not fetch trajet for vehicle ${vId}`, e);
      }
    }

    setTrajetsData(newTrajets);
    setLoadingTrajets(false);

    // Auto-fit bounds if we have points
    if (allPointsForBounds.length > 1) {
      setMapBounds(allPointsForBounds);
    }
  }, [selectedVehicleIds, vehicles, fromDate, toDate, fromTime, toTime, minSpeedFilter, hideStops]);

  // Trigger trajet reload when filters change
  useEffect(() => {
    reloadTrajets();
  }, [reloadTrajets]);

  // Playback Simulation Engine
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = setInterval(() => {
        setPlaybackProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return Math.min(100, prev + 1 * playbackSpeed);
        });
      }, 100);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  // Intrusion & Violation Checks
  const activeIntrusions = useMemo(() => {
    return circuitZoneService.detectZoneIntrusions(vehicles, zones);
  }, [vehicles, zones]);

  const posSalesViolations = useMemo(() => {
    return circuitZoneService.checkPosSalesViolations(zones, pointsDeVente);
  }, [zones, pointsDeVente]);

  // Contained POS count for the active editing zone
  const containedPosCount = useMemo(() => {
    if (!editingZone?.coordinates || editingZone.coordinates.length < 3) return 0;
    return pointsDeVente.filter((p) => {
      if (!p.latitude || !p.longitude) return false;
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (isNaN(lat) || isNaN(lng)) return false;
      return isPointInPolygon([lat, lng], editingZone.coordinates as [number, number][]);
    }).length;
  }, [editingZone?.coordinates, pointsDeVente]);

  // Change Trajet Color Handler
  const handleUpdateTrajetColor = async (vehicleId: string, newColor: string) => {
    await circuitZoneService.saveVehicleTrajetColor(vehicleId, newColor);
    setTrajetColors((prev) => ({ ...prev, [vehicleId]: newColor }));

    setTrajetsData((prev) => {
      if (!prev[vehicleId]) return prev;
      return {
        ...prev,
        [vehicleId]: { ...prev[vehicleId], color: newColor },
      };
    });

    toast({
      title: isAr ? 'تم حفظ لون المسار بنجاح' : 'Couleur du Trajet Mise à Jour',
      description: isAr
        ? 'تم تطبيق اللون الجديد وحفظه لمركبتك.'
        : 'La couleur GPS a été modifiée et sauvegardée pour ce véhicule.',
    });
  };

  // Toggle vehicle selection
  const handleToggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(vehicleId) ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId]
    );
  };

  const handleSelectAllVehicles = () => {
    if (selectedVehicleIds.length === vehicles.length) {
      setSelectedVehicleIds([]);
    } else {
      setSelectedVehicleIds(vehicles.map((v) => v.id));
    }
  };

  // Center on all active items
  const handleFitAllMap = () => {
    const points: [number, number][] = [];
    Object.values(trajetsData).forEach((t) => {
      t.points.forEach((p) => points.push([p.lat, p.lng]));
    });
    vehicles.forEach((v) => {
      if (v.lat && v.lng) points.push([v.lat, v.lng]);
    });
    if (points.length > 0) {
      setMapBounds(points);
    } else {
      setMapCenter([32.3392, -6.4159]);
      setMapZoom(12);
    }
  };

  // Drawing Controls
  const handleStartDrawing = () => {
    setIsDrawing(true);
    setDrawingPoints([]);
    toast({
      title: isAr ? 'وضع رسم المنطقة نشط' : 'Mode Dessin de Zone Activé',
      description: isAr
        ? 'انقر على الخريطة لتحديد أركان المنطقة الجغرافية (3 نقاط على الأقل).'
        : 'Cliquez sur la carte pour délimiter le polygone de la zone.',
    });
  };

  const handleAddDrawingPoint = (point: [number, number]) => {
    setDrawingPoints((prev) => [...prev, point]);
  };

  const handleUndoDrawingPoint = () => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  };

  const handleCancelDrawing = () => {
    setIsDrawing(false);
    setDrawingPoints([]);
  };

  const handleFinishDrawing = () => {
    if (drawingPoints.length < 3) {
      toast({
        variant: 'destructive',
        title: isAr ? 'نقاط غير كافية' : 'Polygone Incomplet',
        description: isAr
          ? 'يجب تحديد 3 نقاط على الأقل لتكوين منطقة مغلقة.'
          : 'Veuillez marquer au moins 3 points pour former une zone valide.',
      });
      return;
    }

    const avgLat = drawingPoints.reduce((acc, p) => acc + p[0], 0) / drawingPoints.length;
    const avgLng = drawingPoints.reduce((acc, p) => acc + p[1], 0) / drawingPoints.length;

    // Calculate perimeter and area
    let perim = 0;
    for (let i = 1; i < drawingPoints.length; i++) {
      perim += circuitZoneService.calculateDistanceKm(
        drawingPoints[i - 1][0],
        drawingPoints[i - 1][1],
        drawingPoints[i][0],
        drawingPoints[i][1]
      );
    }
    perim += circuitZoneService.calculateDistanceKm(
      drawingPoints[drawingPoints.length - 1][0],
      drawingPoints[drawingPoints.length - 1][1],
      drawingPoints[0][0],
      drawingPoints[0][1]
    );

    // Approximate area in km2
    let areaKm2 = 0;
    const n = drawingPoints.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x1 = drawingPoints[i][1] * 111.32 * Math.cos((avgLat * Math.PI) / 180);
      const y1 = drawingPoints[i][0] * 110.574;
      const x2 = drawingPoints[j][1] * 111.32 * Math.cos((avgLat * Math.PI) / 180);
      const y2 = drawingPoints[j][0] * 110.574;
      areaKm2 += x1 * y2 - x2 * y1;
    }
    const finalArea = Number((Math.abs(areaKm2) / 2).toFixed(2));

    const defaultTruck = trucks[0];
    const defaultDriver = drivers[0];

    setEditingZone({
      name: `Zone Commerciale ${zones.length + 1}`,
      code: `ZN-0${zones.length + 1}`,
      type: 'exclusive',
      shape: 'polygon',
      coordinates: [...drawingPoints],
      center: [avgLat, avgLng],
      color: TRAJET_PALETTE[zones.length % TRAJET_PALETTE.length],
      fillColor: TRAJET_PALETTE[zones.length % TRAJET_PALETTE.length],
      fillOpacity: 0.22,
      assignedVehicleId: defaultTruck?.id || '293',
      assignedVehiclePlate: defaultTruck?.plate || 'Allo gaz 99799 D 6',
      assignedDriverId: defaultDriver?.id || 'drv-1',
      assignedDriverName: defaultDriver?.name || 'AZIZ AOUDU',
      speedLimitKmh: 60,
      alertLevel: 'critical',
      transitAllowed: false,
      scheduleActive: '24h/24',
      dailyQuotaTarget: 120,
      surfaceKm2: finalArea || 3.4,
      perimeterKm: Number(perim.toFixed(1)) || 7.2,
      isActive: true,
      notes: 'Territoire de distribution exclusif SFT GAZ. Interdiction stricte de livraison pour les tiers.',
    });

    setIsDrawing(false);
    setDrawingPoints([]);
    setIsZoneDialogOpen(true);
  };

  // Save Zone
  const handleSaveZone = async () => {
    if (!editingZone || !editingZone.name || !editingZone.coordinates) return;

    let updatedList: GeofenceZone[] = [];
    if (editingZone.id) {
      updatedList = zones.map((z) =>
        z.id === editingZone.id
          ? ({ ...z, ...editingZone, updatedAt: new Date().toISOString() } as GeofenceZone)
          : z
      );
    } else {
      const newZone: GeofenceZone = {
        ...(editingZone as any),
        id: `zone-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedList = [newZone, ...zones];
    }

    await circuitZoneService.saveZones(updatedList);
    setZones(updatedList);
    setIsZoneDialogOpen(false);
    setEditingZone(null);

    toast({
      title: isAr ? 'تم حفظ المنطقة بنجاح' : 'Zone Enregistrée avec Succès',
      description: isAr
        ? 'تم تفعيل حدود المنطقة وقواعد الحماية الخاصة بها.'
        : 'La zone et ses règles de protection territoriale sont maintenant actives.',
    });
  };

  // Delete Zone
  const handleDeleteZone = async (zoneId: string) => {
    if (window.confirm(isAr ? 'هل أنت متأكد من حذف هذه المنطقة؟' : 'Supprimer définitivement cette zone ?')) {
      await circuitZoneService.deleteZone(zoneId);
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      toast({
        title: isAr ? 'تم حذف المنطقة' : 'Zone Supprimée',
        description: isAr ? 'تمت إزالة المنطقة من النظام.' : 'La zone a été retirée du système.',
      });
    }
  };

  // Export CSV
  const handleExportLogsCsv = () => {
    if (eventLogs.length === 0) {
      toast({
        title: isAr ? 'لا توجد بيانات للتصدير' : 'Aucun journal disponible',
        description: isAr ? 'سجل الأحداث فارغ حالياً.' : 'Le journal des événements est vide.',
      });
      return;
    }

    const headers = ['Date/Heure', 'Type', 'Zone', 'Véhicule', 'Chauffeur', 'Vitesse (km/h)', 'Autorisé', 'Détails'];
    const rows = eventLogs.map((log) => [
      `"${log.timestamp}"`,
      `"${log.eventType}"`,
      `"${log.zoneName}"`,
      `"${log.vehiclePlate}"`,
      `"${log.driverName}"`,
      `"${log.speedKmh ?? 0}"`,
      `"${log.isAuthorized ? 'OUI' : 'NON'}"`,
      `"${log.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SFT_GAZ_Circuit_Zone_Logs_${fromDate}_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: isAr ? 'تم تصدير ملف CSV' : 'Export CSV Réussi',
      description: isAr ? 'تم تحميل سجل الأحداث بنجاح.' : 'Le fichier télématique a été téléchargé.',
    });
  };

  // Filtered Vehicles for left sidebar
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearchQuery.trim()) return vehicles;
    const q = vehicleSearchQuery.toLowerCase();
    return vehicles.filter(
      (v) =>
        v.plate.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q)
    );
  }, [vehicles, vehicleSearchQuery]);

  // Filtered Event Logs
  const filteredEventLogs = useMemo(() => {
    return eventLogs.filter((log) => {
      if (logFilter === 'violation' && log.eventType !== 'violation') return false;
      if (logFilter === 'entry' && log.eventType !== 'entry') return false;
      if (logFilter === 'exit' && log.eventType !== 'exit') return false;
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        return (
          log.vehiclePlate.toLowerCase().includes(q) ||
          log.driverName.toLowerCase().includes(q) ||
          log.zoneName.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [eventLogs, logFilter, logSearchQuery]);

  // Stats
  const totalKmLoaded = useMemo(() => {
    return Object.values(trajetsData).reduce((acc, t) => acc + (t.totalDistanceKm || 0), 0);
  }, [trajetsData]);

  const totalPointsLoaded = useMemo(() => {
    return Object.values(trajetsData).reduce((acc, t) => acc + (t.points?.length || 0), 0);
  }, [trajetsData]);

  // Custom High-Contrast Marker Generators
  const createVehicleIcon = (vehicle: LiveVehicle, isTrespassing: boolean, customColor: string) => {
    const isMoving = vehicle.isMoving;
    const color = customColor || (vehicle.status === 'online' ? '#10b981' : '#64748b');

    const html = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        ${
          isTrespassing
            ? `<div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(239, 68, 68, 0.5); animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
            : isMoving
            ? `<div style="position: absolute; width: 40px; height: 40px; border-radius: 50%; background: ${color}44; animation: pulse 2s infinite;"></div>`
            : ''
        }
        <div style="
          width: 34px;
          height: 34px;
          background: ${isTrespassing ? '#ef4444' : '#090d16'};
          border: 2.5px solid ${isTrespassing ? '#ffffff' : color};
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.8), 0 0 12px ${color};
          transform: rotate(${vehicle.heading || 0}deg);
          transition: transform 0.3s ease;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${isTrespassing ? '#ffffff' : color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
            <path d="M15 18H9"/>
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
            <circle cx="17" cy="18" r="2"/>
            <circle cx="7" cy="18" r="2"/>
          </svg>
        </div>
        ${
          isTrespassing
            ? `<div style="position: absolute; top: -10px; right: -10px; background: #dc2626; color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; font-weight: bold; display: flex; align-items: center; justify-content: center; border: 2px solid white;">!</div>`
            : ''
        }
      </div>
    `;

    return L.divIcon({
      html,
      className: 'sft-vehicle-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
    });
  };

  return (
    <div className="space-y-4 pb-12 text-slate-100">
      {/* Top Professional Header Banner with Solid High-Contrast Dark Card Container */}
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Title & Badge */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 shadow-xl shadow-cyan-500/25 ring-2 ring-cyan-400/40">
              <Compass className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow">
                  {isAr ? 'الدوائر والمناطق وتتبع المسارات' : 'Circuits & Zones : Trajets GPSwox'}
                </h1>
                <Badge className="border border-cyan-400/50 bg-cyan-950 text-cyan-300 font-mono text-[11px] font-bold px-2.5 py-0.5">
                  SERVEUR SFTM DIRECT
                </Badge>
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-200 mt-1">
                {isAr
                  ? 'تحميل ومتابعة مسارات شاحنات الأسطول بالألوان وحماية مناطق البيع الحصرية'
                  : 'Tracé télématique par couleur, historique GPSwox et régulation territoriale des ventes'}
              </p>
            </div>
          </div>

          {/* Unified Clean Toolbar - Streamlined & Organized */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Draw Zone - Primary CTA */}
            <Button
              size="sm"
              onClick={isDrawing ? handleCancelDrawing : handleStartDrawing}
              className={`h-9 px-3.5 font-black text-xs shadow-lg transition-all ${
                isDrawing
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse'
                  : 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black shadow-cyan-500/25'
              }`}
            >
              {isDrawing ? <X className="h-4 w-4 mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
              {isDrawing
                ? isAr ? 'إلغاء وضع الرسم' : 'Annuler le Dessin'
                : isAr ? 'رسم منطقة جديدة' : 'Dessiner une Zone'}
            </Button>

            {/* Advanced Filter Toggle */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className={`h-9 px-3 font-bold text-xs gap-1.5 transition-all shadow ${
                isFilterPanelOpen
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                  : 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100'
              }`}
            >
              <Filter className="h-3.5 w-3.5 text-cyan-400" />
              {isAr ? 'فلتر المسار' : 'Filtre Trajet'}
              <Badge className="ml-1 bg-cyan-950 text-cyan-300 text-[10px] font-mono px-1.5 py-0 border border-cyan-800">
                {periodPreset.toUpperCase()}
              </Badge>
            </Button>

            {/* Quick Actions Group: Zoom, Refresh, CSV */}
            <div className="flex items-center rounded-xl border border-slate-700 bg-slate-800/90 p-0.5 shadow">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleFitAllMap}
                title={isAr ? 'ضبط زوم الخريطة' : 'Ajuster la vue'}
                className="h-8 px-2.5 text-xs text-slate-200 hover:text-white hover:bg-slate-700 gap-1 font-bold"
              >
                <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
                <span className="hidden sm:inline">{isAr ? 'الزوم' : 'Centrer'}</span>
              </Button>

              <div className="h-4 w-px bg-slate-700" />

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  loadAllData();
                  reloadTrajets();
                }}
                disabled={loading || loadingTrajets}
                title={isAr ? 'تحديث المسارات' : 'Actualiser'}
                className="h-8 px-2.5 text-xs text-slate-200 hover:text-white hover:bg-slate-700 gap-1 font-bold"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading || loadingTrajets ? 'animate-spin text-cyan-400' : 'text-slate-300'}`} />
                <span className="hidden sm:inline">{isAr ? 'تحديث' : 'Actualiser'}</span>
              </Button>

              <div className="h-4 w-px bg-slate-700" />

              <Button
                size="sm"
                variant="ghost"
                onClick={handleExportLogsCsv}
                title={isAr ? 'تصدير التقرير CSV' : 'Exporter CSV'}
                className="h-8 px-2.5 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-slate-700 gap-1 font-bold"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ADVANCED FILTER DRAWER (Collapsible, High-Contrast 2026 UI) */}
      {isFilterPanelOpen && (
        <Card className="border-cyan-500/40 bg-slate-900/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-3 duration-200">
          <CardHeader className="p-3.5 border-b border-slate-800 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-cyan-400" />
              <CardTitle className="text-sm font-bold text-white">
                {isAr ? 'معايير فلترة وتحميل المسار من GPSwox' : 'Filtre Avancé de l’Historique Trajet (GPSwox)'}
              </CardTitle>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsFilterPanelOpen(false)}
              className="h-7 w-7 p-0 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-4 text-xs">
            {/* Quick Period Presets */}
            <div>
              <Label className="text-slate-200 font-semibold mb-2 block">
                {isAr ? 'الفترة الزمنية السريعة :' : 'Période Rapide :'}
              </Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'today', label: isAr ? 'اليوم' : "Aujourd'hui" },
                  { id: 'yesterday', label: isAr ? 'أمس' : 'Hier' },
                  { id: '3days', label: isAr ? 'آخر 3 أيام' : '3 Derniers Jours' },
                  { id: '7days', label: isAr ? 'آخر 7 أيام' : '7 Derniers Jours' },
                  { id: 'custom', label: isAr ? 'تاريخ مخصص' : 'Personnalisé' },
                ].map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={periodPreset === p.id ? 'default' : 'outline'}
                    onClick={() => handlePeriodChange(p.id as any)}
                    className={`text-xs h-8 font-bold ${
                      periodPreset === p.id
                        ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 border-cyan-400'
                        : 'border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Dates & Time Ranges */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-slate-200 font-medium">
                  {isAr ? 'تاريخ البداية :' : 'Date Début :'}
                </Label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPeriodPreset('custom');
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-200 font-medium">
                  {isAr ? 'تاريخ النهاية :' : 'Date Fin :'}
                </Label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPeriodPreset('custom');
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-200 font-medium">
                  {isAr ? 'من الساعة :' : 'Heure Début :'}
                </Label>
                <input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-200 font-medium">
                  {isAr ? 'إلى الساعة :' : 'Heure Fin :'}
                </Label>
                <input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            {/* Speed & Stops Options */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-semibold">{isAr ? 'السرعة الدنيا :' : 'Vitesse Min :'}</span>
                  <select
                    value={minSpeedFilter}
                    onChange={(e) => setMinSpeedFilter(Number(e.target.value))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white font-mono outline-none"
                  >
                    <option value={0}>{isAr ? 'الكل (بما فيها الوقفات)' : 'Tous les points (0 km/h+)'}</option>
                    <option value={5}>{isAr ? 'حركة خفيفة (> 5 كم/س)' : 'En mouvement (> 5 km/h)'}</option>
                    <option value={20}>{isAr ? 'طرق رئيسية (> 20 كم/س)' : 'Conduite active (> 20 km/h)'}</option>
                    <option value={40}>{isAr ? 'سرعة عالية (> 40 كم/س)' : 'Grande vitesse (> 40 km/h)'}</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-medium">
                  <input
                    type="checkbox"
                    checked={hideStops}
                    onChange={(e) => setHideStops(e.target.checked)}
                    className="rounded text-cyan-500 bg-slate-950 border-slate-700"
                  />
                  <span>{isAr ? 'إخفاء نقاط التوقف التام' : 'Masquer les arrêts complets'}</span>
                </label>
              </div>

              <Button
                size="sm"
                onClick={reloadTrajets}
                disabled={loadingTrajets}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs gap-1.5 shadow"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingTrajets ? 'animate-spin' : ''}`} />
                {isAr ? 'تطبيق الفلتر وتحميل' : 'Appliquer et Recharger Trajets'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-Time Violation Alert Bar */}
      {activeIntrusions.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-rose-500/60 bg-gradient-to-r from-rose-950 via-slate-950 to-rose-950 p-4 shadow-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 ring-2 ring-rose-500/50 animate-pulse">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-rose-200">
                    {isAr ? 'تنبيه اختراق أمني لمنطقة حصرية !' : 'ALERTE : Intrusion en Zone Exclusive Détectée !'}
                  </span>
                  <Badge className="bg-rose-600 text-white font-mono text-[11px] font-bold">
                    {activeIntrusions.length} {isAr ? 'مخالفات' : 'violation(s)'}
                  </Badge>
                </div>
                <p className="text-xs text-rose-100 font-medium mt-0.5">
                  {activeIntrusions[0].vehiclePlate} ({activeIntrusions[0].driverName}){' '}
                  {isAr ? 'داخل' : 'est actuellement dans la zone'} « {activeIntrusions[0].zoneName} »{' '}
                  {isAr ? 'المملوكة لـ' : 'assignée à'}{' '}
                  <span className="font-bold underline text-white">{activeIntrusions[0].assignedDriverName}</span>.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => {
                const target = activeIntrusions[0];
                setMapCenter([target.lat, target.lng]);
                setMapZoom(14);
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs gap-1.5 shadow-lg shadow-rose-600/30"
            >
              <Crosshair className="h-3.5 w-3.5" />
              {isAr ? 'تحديد الموقع على الخريطة' : 'Localiser la Violation'}
            </Button>
          </div>
        </div>
      )}

      {/* Top 4 KPI Metric Cards with Vivid High-Contrast Typography */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {/* Card 1: Total Loaded Kilometers */}
        <Card className="border-slate-700 bg-slate-900/90 shadow-xl backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {isAr ? 'المسافة المحملة' : 'Distance Trajets'}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">{totalKmLoaded.toFixed(1)}</span>
                <span className="text-xs font-bold text-cyan-400 font-mono">KM</span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30">
              <Gauge className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: GPS Points Loaded */}
        <Card className="border-slate-700 bg-slate-900/90 shadow-xl backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {isAr ? 'نقاط GPS المحملة' : 'Points GPSwox'}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">{totalPointsLoaded}</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">PTS</span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30">
              <Navigation className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Active Fleet */}
        <Card className="border-slate-700 bg-slate-900/90 shadow-xl backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {isAr ? 'المركبات المحددة' : 'Véhicules Trajet'}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">
                  {selectedVehicleIds.length} <span className="text-sm text-slate-400">/ {vehicles.length}</span>
                </span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-300 ring-1 ring-purple-500/30">
              <Truck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Geofence Zones Active */}
        <Card className="border-slate-700 bg-slate-900/90 shadow-xl backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {isAr ? 'المناطق الجغرافية' : 'Zones Géofence'}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">{zones.length}</span>
                <span className="text-xs font-bold text-amber-400">
                  {zones.filter((z) => z.type === 'exclusive').length} {isAr ? 'حصرية' : 'excl.'}
                </span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drawing Mode Notification Banner */}
      {isDrawing && (
        <div className="rounded-xl border border-cyan-400 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400">
              <Compass className="h-5 w-5 animate-spin" />
            </div>
            <div>
              <div className="text-sm font-black text-cyan-300">
                {isAr ? 'وضع رسم محيط المنطقة نشط' : 'Dessin de Zone Actif'} (
                {drawingPoints.length} {isAr ? 'نقاط محددة' : 'points'})
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {isAr
                  ? 'انقر على الخريطة لتحديد النقاط. يجب تحديد 3 نقاط على الأقل ثم اضغط على تأكيد.'
                  : 'Cliquez sur la carte pour chaque sommet. Connectez au moins 3 points puis validez.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={drawingPoints.length === 0}
              onClick={handleUndoDrawingPoint}
              className="border-slate-700 bg-slate-800 text-slate-200 text-xs font-bold"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              {isAr ? 'تراجع' : 'Annuler Point'}
            </Button>
            <Button
              size="sm"
              onClick={handleFinishDrawing}
              disabled={drawingPoints.length < 3}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              {isAr ? 'تأكيد وحفظ المنطقة' : 'Finaliser la Zone'}
            </Button>
          </div>
        </div>
      )}

      {/* Main Interactive Map & Vehicle Controller Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Column: Vehicle List with Real-Time Color Customizer */}
        <Card className="lg:col-span-1 border-slate-700 bg-slate-900/90 shadow-2xl backdrop-blur-md flex flex-col h-[700px]">
          <CardHeader className="p-3.5 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-cyan-400" />
                <CardTitle className="text-sm font-bold text-white">
                  {isAr ? 'شاحنات الأسطول وألوان المسار' : 'Flotte & Couleurs Trajets'}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllVehicles}
                className="text-xs h-7 px-2 font-bold text-cyan-300 hover:bg-cyan-500/10"
              >
                {selectedVehicleIds.length === vehicles.length
                  ? isAr ? 'إلغاء الكل' : 'Désélectionner'
                  : isAr ? 'تحديد الكل' : 'Tout afficher'}
              </Button>
            </div>

            {/* Vehicle search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder={isAr ? 'بحث برقم الشاحنة أو السائق...' : 'Rechercher camion ou chauffeur...'}
                value={vehicleSearchQuery}
                onChange={(e) => setVehicleSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-950 border-slate-800 text-white placeholder:text-slate-500"
              />
            </div>
          </CardHeader>

          {/* Vehicle List with Prominent Color Picker */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
            {filteredVehicles.map((v, idx) => {
              const isSelected = selectedVehicleIds.includes(v.id);
              const color = trajetColors[v.id] || TRAJET_PALETTE[idx % TRAJET_PALETTE.length];
              const trajet = trajetsData[v.id];

              return (
                <div
                  key={v.id}
                  className={`rounded-xl border p-2.5 transition-all ${
                    isSelected
                      ? 'border-slate-600 bg-slate-800/80 shadow-md ring-1 ring-cyan-500/30'
                      : 'border-slate-800/60 bg-slate-950/40 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleVehicle(v.id)}
                        className="rounded border-slate-600 bg-slate-900 text-cyan-500 h-4 w-4 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-white">{v.plate}</span>
                          <span
                            className="inline-block h-3 w-3 rounded-full shadow-sm ring-1 ring-white/40"
                            style={{ backgroundColor: color }}
                          />
                        </div>
                        <p className="text-xs font-semibold text-slate-300 truncate max-w-[130px]">
                          {v.driverName}
                        </p>
                      </div>
                    </div>

                    {/* Interactive Color Picker Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          title={isAr ? 'تغيير لون مسار هذه المركبة' : 'Modifier la couleur du trajet'}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/30 shadow-lg transition-transform hover:scale-110 active:scale-95"
                          style={{ backgroundColor: color }}
                        >
                          <Palette className="h-3.5 w-3.5 text-white drop-shadow-md" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-60 border-slate-700 bg-slate-900 p-3 shadow-2xl text-slate-100 z-[9999]">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">
                              {isAr ? 'لون مسار المركبة :' : 'Couleur du Trajet :'}
                            </span>
                            <span className="font-mono text-[11px] text-cyan-300 font-bold">{color}</span>
                          </div>
                          {/* 12 Neon Preset Colors Grid */}
                          <div className="grid grid-cols-4 gap-2">
                            {TRAJET_PALETTE.map((palColor) => (
                              <button
                                key={palColor}
                                onClick={() => handleUpdateTrajetColor(v.id, palColor)}
                                className={`h-8 w-full rounded-lg transition-all hover:scale-110 flex items-center justify-center ${
                                  color.toLowerCase() === palColor.toLowerCase()
                                    ? 'ring-2 ring-white scale-105 shadow-lg'
                                    : 'border border-white/20'
                                }`}
                                style={{ backgroundColor: palColor }}
                              >
                                {color.toLowerCase() === palColor.toLowerCase() && (
                                  <Check className="h-4 w-4 text-white drop-shadow" />
                                )}
                              </button>
                            ))}
                          </div>
                          {/* Native Hex Picker */}
                          <div className="pt-2 border-t border-slate-800">
                            <label className="text-[11px] text-slate-300 font-medium block mb-1">
                              {isAr ? 'أو اختر كود مخصص :' : 'Sélection Personnalisée :'}
                            </label>
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => handleUpdateTrajetColor(v.id, e.target.value)}
                              className="h-8 w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-0.5"
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Telematics Micro-Stats */}
                  {trajet && isSelected && (
                    <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-slate-950 p-2 text-xs font-mono border border-slate-800/80">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">DIST</span>
                        <span className="font-bold text-cyan-300">{trajet.totalDistanceKm} km</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">V-MAX</span>
                        <span className="font-bold text-emerald-300">{trajet.maxSpeedKmh} km/h</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">ARRÊTS</span>
                        <span className="font-bold text-amber-300">{trajet.stopsCount}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Map Layer Switcher & Layer Toggles in Sidebar Footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">{isAr ? 'نوع الخريطة :' : 'Fond de Carte :'}</span>
              <select
                value={activeTile}
                onChange={(e) => setActiveTile(e.target.value as MapTileKey)}
                className="bg-slate-900 text-white font-bold border border-slate-700 rounded-lg px-2.5 py-1 text-xs outline-none"
              >
                <option value="google_hybrid">Google Satellite / Hybride</option>
                <option value="google_roads">Google Maps Routes</option>
                <option value="osm">OpenStreetMap</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <label className="flex items-center gap-2 text-slate-200 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTrajets}
                  onChange={(e) => setShowTrajets(e.target.checked)}
                  className="rounded text-cyan-500"
                />
                <span>{isAr ? 'المسارات' : 'Trajets'}</span>
              </label>

              <label className="flex items-center gap-2 text-slate-200 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showZones}
                  onChange={(e) => setShowZones(e.target.checked)}
                  className="rounded text-indigo-500"
                />
                <span>{isAr ? 'المناطق' : 'Zones'}</span>
              </label>

              <label className="flex items-center gap-2 text-slate-200 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showVehicles}
                  onChange={(e) => setShowVehicles(e.target.checked)}
                  className="rounded text-emerald-500"
                />
                <span>{isAr ? 'الشاحنات' : 'Camions'}</span>
              </label>

              <label className="flex items-center gap-2 text-slate-200 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPosPins}
                  onChange={(e) => setShowPosPins(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span>{isAr ? 'نقاط البيع' : 'Clients POS'}</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Center / Right Columns: Large Leaflet Map with Playback Controls */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden relative h-[700px] flex flex-col">
          {/* Sleek Floating Map Playback Controls */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] w-[92%] max-w-xl rounded-2xl border border-slate-700/90 bg-slate-950/95 px-3.5 py-2 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
            <Button
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`h-8 px-3 font-black text-xs gap-1.5 shadow ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
              }`}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? (isAr ? 'إيقاف' : 'Pause') : (isAr ? 'تشغيل المسار' : 'Rejouer')}
            </Button>

            <input
              type="range"
              min="0"
              max="100"
              value={playbackProgress}
              onChange={(e) => {
                setPlaybackProgress(Number(e.target.value));
                if (isPlaying) setIsPlaying(false);
              }}
              className="flex-1 cursor-pointer accent-cyan-400 h-2 bg-slate-800 rounded-lg"
            />

            <span className="font-mono text-xs font-black text-cyan-300 w-11 text-right">
              {playbackProgress}%
            </span>

            {/* Compact Speed Selector */}
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5">
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                    playbackSpeed === spd
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPlaybackProgress(0)}
              title={isAr ? 'إعادة من البداية' : 'Recommencer'}
              className="h-7 w-7 p-0 text-slate-300 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Leaflet MapContainer */}
          <div className="flex-1 w-full h-full">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%', background: '#090d16' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution={MAP_TILES[activeTile].attribution}
                url={MAP_TILES[activeTile].url}
              />

              <MapViewController center={mapCenter} zoom={mapZoom} bounds={mapBounds} />
              <MapDrawingHandler isDrawing={isDrawing} onAddPoint={handleAddDrawingPoint} />

              {/* RENDER GEOFENCE ZONES */}
              {showZones &&
                zones.map((zone) => {
                  const isConflictZone = activeIntrusions.some((i) => i.zoneId === zone.id);
                  const strokeColor = isConflictZone ? '#ef4444' : zone.color || '#3b82f6';
                  const fillColor = isConflictZone ? '#ef4444' : zone.fillColor || zone.color || '#3b82f6';

                  return (
                    <Polygon
                      key={zone.id}
                      positions={zone.coordinates}
                      pathOptions={{
                        color: strokeColor,
                        fillColor: fillColor,
                        fillOpacity: zone.fillOpacity || 0.22,
                        weight: isConflictZone ? 4 : 2.5,
                        dashArray: zone.type === 'exclusive' ? '6, 6' : undefined,
                      }}
                    >
                      <Popup className="sft-clean-popup">
                        <div className="p-2 space-y-2 text-slate-900 min-w-[210px]">
                          <div className="flex items-center justify-between border-b pb-1.5">
                            <span className="font-black text-sm text-slate-900">{zone.name}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                zone.type === 'exclusive'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {zone.type}
                            </span>
                          </div>

                          <div className="text-xs space-y-1 text-slate-800">
                            <div>
                              <span className="text-slate-500 font-bold">Chauffeur : </span>
                              <span className="font-semibold">{zone.assignedDriverName || 'Non assigné'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 font-bold">Camion : </span>
                              <span className="font-mono font-bold text-slate-900">{zone.assignedVehiclePlate || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 font-bold">Vitesse max : </span>
                              <span className="font-mono font-bold">{zone.speedLimitKmh || 60} km/h</span>
                            </div>
                            {zone.notes && (
                              <p className="text-[11px] text-slate-600 italic mt-1">{zone.notes}</p>
                            )}
                          </div>

                          <div className="pt-2 flex items-center justify-between border-t gap-1">
                            <button
                              onClick={() => {
                                setEditingZone({ ...zone });
                                setIsZoneDialogOpen(true);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-md text-xs flex items-center gap-1 font-bold"
                            >
                              <Edit className="h-3 w-3" />
                              {isAr ? 'تعديل' : 'Modifier'}
                            </button>
                            <button
                              onClick={() => handleDeleteZone(zone.id)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-xs flex items-center gap-1 font-bold"
                            >
                              <Trash2 className="h-3 w-3" />
                              {isAr ? 'حذف' : 'Supprimer'}
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Polygon>
                  );
                })}

              {/* RENDER TRAJETS GPS (EACH VEHICLE HAS ITS OWN VIVID NEON COLOR) */}
              {showTrajets &&
                selectedVehicleIds.map((vId) => {
                  const trajet = trajetsData[vId];
                  if (!trajet || !trajet.points || trajet.points.length < 2) return null;

                  // Apply Playback Progress slicing
                  const totalPts = trajet.points.length;
                  const sliceCount = Math.max(2, Math.round((totalPts * playbackProgress) / 100));
                  const visiblePoints = trajet.points.slice(0, sliceCount);
                  const positions = visiblePoints.map((p) => [p.lat, p.lng] as [number, number]);
                  const lineColor = trajet.color || trajetColors[vId] || '#06b6d4';
                  const currentPlaybackPoint = visiblePoints[visiblePoints.length - 1];

                  return (
                    <React.Fragment key={`trajet-${vId}`}>
                      {/* Outer Glow Halo Line */}
                      <Polyline
                        positions={positions}
                        pathOptions={{
                          color: lineColor,
                          weight: 8,
                          opacity: 0.35,
                          lineCap: 'round',
                          lineJoin: 'round',
                        }}
                      />
                      {/* Core Vivid Sharp Trajet Line */}
                      <Polyline
                        positions={positions}
                        pathOptions={{
                          color: lineColor,
                          weight: 4,
                          opacity: 1,
                          lineCap: 'round',
                          lineJoin: 'round',
                        }}
                      >
                        <Popup className="sft-clean-popup">
                          <div className="p-2 text-slate-900 text-xs space-y-1">
                            <p className="font-black text-sm" style={{ color: lineColor }}>
                              {trajet.plate}
                            </p>
                            <p className="font-semibold text-slate-700">Chauffeur: {trajet.driverName}</p>
                            <p className="font-mono text-slate-800">
                              Distance: <span className="font-bold">{trajet.totalDistanceKm} km</span>
                            </p>
                            <p className="font-mono text-slate-800">
                              Vitesse moy: <span className="font-bold">{trajet.avgSpeedKmh} km/h</span> (Max: {trajet.maxSpeedKmh} km/h)
                            </p>
                            <p className="font-mono text-slate-500 text-[10px]">Date: {trajet.date}</p>
                          </div>
                        </Popup>
                      </Polyline>

                      {/* Start Marker (Green Flag A) */}
                      {positions.length > 0 && (
                        <Marker
                          position={positions[0]}
                          icon={L.divIcon({
                            html: `<div style="background:#10b981; color:white; width:22px; height:22px; border-radius:50%; font-size:11px; display:flex; align-items:center; justify-content:center; border:2.5px solid white; font-weight:900; box-shadow:0 2px 8px rgba(0,0,0,0.5);">A</div>`,
                            className: 'sft-start-marker',
                            iconSize: [22, 22],
                          })}
                        >
                          <Popup className="sft-clean-popup">
                            <div className="p-1 text-slate-900 text-xs font-bold">
                              🏁 Point de Départ ({trajet.plate})
                              <div className="text-[11px] font-normal text-slate-600">
                                {trajet.points[0]?.timestamp || ''}
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      )}

                      {/* End Marker (Red Flag B) */}
                      {positions.length > 1 && (
                        <Marker
                          position={positions[positions.length - 1]}
                          icon={L.divIcon({
                            html: `<div style="background:#ef4444; color:white; width:22px; height:22px; border-radius:50%; font-size:11px; display:flex; align-items:center; justify-content:center; border:2.5px solid white; font-weight:900; box-shadow:0 2px 8px rgba(0,0,0,0.5);">B</div>`,
                            className: 'sft-end-marker',
                            iconSize: [22, 22],
                          })}
                        >
                          <Popup className="sft-clean-popup">
                            <div className="p-1 text-slate-900 text-xs font-bold">
                              🎯 Point d'Arrivée ({trajet.plate})
                              <div className="text-[11px] font-normal text-slate-600">
                                {trajet.points[trajet.points.length - 1]?.timestamp || ''}
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      )}

                      {/* Animated Playback Current Position Node */}
                      {currentPlaybackPoint && isPlaying && (
                        <Marker
                          position={[currentPlaybackPoint.lat, currentPlaybackPoint.lng]}
                          icon={L.divIcon({
                            html: `
                              <div style="position:relative; display:flex; align-items:center; justify-content:center;">
                                <div style="position:absolute; width:36px; height:36px; border-radius:50%; background:${lineColor}66; animation:ping 1s infinite;"></div>
                                <div style="width:24px; height:24px; border-radius:50%; background:${lineColor}; border:2.5px solid white; box-shadow:0 0 12px ${lineColor}; display:flex; align-items:center; justify-content:center;">
                                  <div style="width:6px; height:6px; border-radius:50%; background:white;"></div>
                                </div>
                              </div>
                            `,
                            className: 'sft-playback-cursor',
                            iconSize: [24, 24],
                          })}
                        >
                          <Popup className="sft-clean-popup">
                            <div className="p-1 text-slate-900 text-xs">
                              <span className="font-black" style={{ color: lineColor }}>{trajet.plate}</span>
                              <div className="font-mono font-bold">{currentPlaybackPoint.speed} km/h</div>
                              <div className="text-slate-500 text-[10px]">{currentPlaybackPoint.timestamp}</div>
                            </div>
                          </Popup>
                        </Marker>
                      )}
                    </React.Fragment>
                  );
                })}

              {/* RENDER LIVE VEHICLES */}
              {showVehicles &&
                vehicles.map((v, idx) => {
                  const isSelected = selectedVehicleIds.includes(v.id);
                  if (selectedVehicleIds.length > 0 && !isSelected) return null;

                  const isTrespassing = activeIntrusions.some((i) => i.vehicleId === v.id);
                  const customColor = trajetColors[v.id] || TRAJET_PALETTE[idx % TRAJET_PALETTE.length];
                  const markerIcon = createVehicleIcon(v, isTrespassing, customColor);

                  return (
                    <Marker key={v.id} position={[v.lat, v.lng]} icon={markerIcon}>
                      <Popup className="sft-clean-popup">
                        <div className="p-2 space-y-1.5 text-slate-900 min-w-[220px]">
                          <div className="flex items-center justify-between border-b pb-1.5">
                            <span className="font-mono font-black text-sm text-slate-950">{v.plate}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${
                                isTrespassing
                                  ? 'bg-rose-600 text-white animate-pulse'
                                  : v.isMoving
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {isTrespassing ? 'INTRUSION !' : v.isMoving ? 'En Mouvement' : 'Arrêté'}
                            </span>
                          </div>

                          <div className="text-xs space-y-1 text-slate-800">
                            <div>
                              <span className="text-slate-500 font-bold">Chauffeur : </span>
                              <span className="font-semibold">{v.driverName}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 font-bold">Vitesse actuelle : </span>
                              <span className="font-mono font-black text-slate-950">{v.speed} km/h</span>
                            </div>
                            <div>
                              <span className="text-slate-500 font-bold">Dernier signal : </span>
                              <span className="text-slate-700 font-mono">{v.lastUpdate}</span>
                            </div>
                          </div>

                          {isTrespassing && (
                            <div className="rounded-lg bg-rose-50 border border-rose-300 p-2 text-xs text-rose-900 font-bold">
                              ⚠️ Intrusion détectée hors de son secteur assigné !
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

              {/* RENDER POINTS DE VENTE (POS) */}
              {showPosPins &&
                pointsDeVente.map((pos) => {
                  if (!pos.latitude || !pos.longitude) return null;
                  const isConflict = posSalesViolations.some((c) => c.posId === pos.id);

                  return (
                    <Marker
                      key={pos.id}
                      position={[Number(pos.latitude), Number(pos.longitude)]}
                      icon={L.divIcon({
                        html: `
                          <div style="
                            width: 22px;
                            height: 22px;
                            background: ${isConflict ? '#ea580c' : '#0f172a'};
                            border: 2px solid ${isConflict ? '#ffffff' : '#38bdf8'};
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.6);
                          ">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${isConflict ? '#ffffff' : '#38bdf8'};"></div>
                          </div>
                        `,
                        className: 'sft-pos-marker',
                        iconSize: [22, 22],
                      })}
                    >
                      <Popup className="sft-clean-popup">
                        <div className="p-2 text-slate-900 text-xs space-y-1">
                          <p className="font-black text-sm text-slate-900">{pos.nom}</p>
                          <p className="text-slate-700">Secteur: <span className="font-semibold">{pos.zone || 'Non défini'}</span></p>
                          <p className="text-slate-700">Chauffeur: <span className="font-semibold">{pos.chauffeur || 'N/A'}</span></p>
                          {isConflict && (
                            <p className="text-amber-800 bg-amber-50 border border-amber-300 rounded p-1 font-bold mt-1">
                              ⚠️ Alerte Conflit de Vente Détecté
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

              {/* RENDER ACTIVE DRAWING POLYGON */}
              {isDrawing && drawingPoints.length > 0 && (
                <>
                  <Polyline
                    positions={drawingPoints}
                    pathOptions={{
                      color: '#06b6d4',
                      weight: 3.5,
                      dashArray: '5, 8',
                    }}
                  />
                  {drawingPoints.map((pt, i) => (
                    <Marker
                      key={i}
                      position={pt}
                      icon={L.divIcon({
                        html: `<div style="background:#06b6d4; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 8px #06b6d4;"></div>`,
                        className: 'sft-draw-vertex',
                        iconSize: [12, 12],
                        iconAnchor: [6, 6],
                      })}
                    />
                  ))}
                </>
              )}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Tabs Section: Geofence Zones, Telematics Logs, and Sales Territory Protection */}
      <Tabs defaultValue="zones" className="w-full space-y-4">
        <TabsList className="bg-slate-900/90 border border-slate-700 p-1 rounded-xl">
          <TabsTrigger
            value="zones"
            className="gap-2 text-xs font-bold text-slate-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 rounded-lg transition-all"
          >
            <Layers className="h-4 w-4" />
            {isAr ? 'قائمة المناطق الجغرافية' : 'Territoires & Géofences'} ({zones.length})
          </TabsTrigger>

          <TabsTrigger
            value="logs"
            className="gap-2 text-xs font-bold text-slate-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 rounded-lg transition-all"
          >
            <Clock className="h-4 w-4" />
            {isAr ? 'سجل الدخول والمخالفات التليماتيكية' : 'Journal Télématique'} ({eventLogs.length})
          </TabsTrigger>

          <TabsTrigger
            value="salesProtection"
            className="gap-2 text-xs font-bold text-slate-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 rounded-lg transition-all"
          >
            <ShieldCheck className="h-4 w-4" />
            {isAr ? 'حماية نقاط البيع والزبائن' : 'Régulation des Ventes & Anti-Démarchage'}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Zones List Table */}
        <TabsContent value="zones">
          <Card className="border-slate-700 bg-slate-900/90 shadow-2xl backdrop-blur-md">
            <CardHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-white">
                  {isAr ? 'المناطق الجغرافية المحمية' : 'Zones de Distribution Définies'}
                </CardTitle>
                <CardDescription className="text-xs text-slate-300 font-medium">
                  {isAr
                    ? 'إدارة القطاعات الحصرية والسرعة القصوى والشاحنات المصرح بها'
                    : 'Gérez les secteurs exclusifs, limites de vitesse et chauffeurs responsables'}
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={handleStartDrawing}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs gap-1.5 shadow"
              >
                <Plus className="h-4 w-4" />
                {isAr ? 'إضافة منطقة جديدة' : 'Nouvelle Zone'}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-300 uppercase text-[11px] font-bold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">{isAr ? 'المنطقة' : 'Nom & Code'}</th>
                      <th className="py-3 px-4">{isAr ? 'النوع' : 'Exclusivité'}</th>
                      <th className="py-3 px-4">{isAr ? 'الشاحنة المخصصة' : 'Véhicule Assigné'}</th>
                      <th className="py-3 px-4">{isAr ? 'السائق المسؤول' : 'Chauffeur Responsable'}</th>
                      <th className="py-3 px-4">{isAr ? 'السرعة القصوى' : 'Vitesse Max'}</th>
                      <th className="py-3 px-4 text-center">{isAr ? 'اللون' : 'Couleur'}</th>
                      <th className="py-3 px-4 text-right">{isAr ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {zones.map((zone) => (
                      <tr key={zone.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-sm text-white">{zone.name}</div>
                          <div className="font-mono text-xs text-cyan-400 font-semibold">{zone.code}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            className={`text-xs font-bold ${
                              zone.type === 'exclusive'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                            }`}
                          >
                            {zone.type === 'exclusive' ? (isAr ? 'حصرية' : 'Exclusive') : (isAr ? 'مشتركة' : 'Partagée')}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black text-cyan-300 text-sm">
                          {zone.assignedVehiclePlate || 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-200 font-semibold text-xs">
                          {zone.assignedDriverName || 'Non assigné'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          {zone.speedLimitKmh || 60} km/h
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className="inline-block h-5 w-5 rounded-full border-2 border-white shadow-md"
                            style={{ backgroundColor: zone.color }}
                          />
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setMapCenter(zone.center);
                              setMapZoom(14);
                            }}
                            className="h-8 w-8 p-0 text-cyan-400 hover:bg-cyan-500/20"
                            title={isAr ? 'عرض على الخريطة' : 'Voir sur la carte'}
                          >
                            <Crosshair className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingZone({ ...zone });
                              setIsZoneDialogOpen(true);
                            }}
                            className="h-8 w-8 p-0 text-slate-200 hover:bg-slate-800"
                            title={isAr ? 'تعديل' : 'Modifier'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteZone(zone.id)}
                            className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-500/20"
                            title={isAr ? 'حذف' : 'Supprimer'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Telematics Event Logs */}
        <TabsContent value="logs">
          <Card className="border-slate-700 bg-slate-900/90 shadow-2xl backdrop-blur-md">
            <CardHeader className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-black text-white">
                  {isAr ? 'سجل الأحداث والدخول والمخالفات' : 'Journal Télématique & Détection des Violations'}
                </CardTitle>
                <CardDescription className="text-xs text-slate-300 font-medium">
                  {isAr
                    ? 'تسجيل دقيق لوقت الدخول والخروج واختراق المناطق المحظورة'
                    : 'Horodatage précis des passages et détection des franchissements non autorisés'}
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder={isAr ? 'بحث في السجل...' : 'Filtrer les logs...'}
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs w-48 bg-slate-950 border-slate-700 text-white"
                  />
                </div>

                <Select value={logFilter} onValueChange={(val: any) => setLogFilter(val)}>
                  <SelectTrigger className="h-8 text-xs w-40 bg-slate-950 border-slate-700 text-white font-bold">
                    <SelectValue placeholder="Filtre type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                    <SelectItem value="all">{isAr ? 'جميع الأحداث' : 'Tous les logs'}</SelectItem>
                    <SelectItem value="violation">{isAr ? 'المخالفات فقط' : 'Violations Uniquement'}</SelectItem>
                    <SelectItem value="entry">{isAr ? 'عمليات الدخول' : 'Entrées en Zone'}</SelectItem>
                    <SelectItem value="exit">{isAr ? 'عمليات الخروج' : 'Sorties de Zone'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-300 uppercase text-[11px] font-bold border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-3 px-4">{isAr ? 'الوقت' : 'Horodatage'}</th>
                      <th className="py-3 px-4">{isAr ? 'الحدث' : 'Événement'}</th>
                      <th className="py-3 px-4">{isAr ? 'المنطقة' : 'Zone'}</th>
                      <th className="py-3 px-4">{isAr ? 'المركبة' : 'Véhicule'}</th>
                      <th className="py-3 px-4">{isAr ? 'السائق' : 'Chauffeur'}</th>
                      <th className="py-3 px-4">{isAr ? 'السرعة' : 'Vitesse'}</th>
                      <th className="py-3 px-4">{isAr ? 'التفاصيل التليماتيكية' : 'Détails'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredEventLogs.map((log) => (
                      <tr
                        key={log.id}
                        className={`transition-colors ${
                          log.eventType === 'violation'
                            ? 'bg-rose-950/40 hover:bg-rose-950/60 text-rose-200'
                            : 'hover:bg-slate-800/50 text-slate-200'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-300 text-xs">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={`text-xs font-bold ${
                              log.eventType === 'violation'
                                ? 'bg-rose-600 text-white shadow'
                                : log.eventType === 'entry'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {log.eventType === 'violation'
                              ? isAr ? 'مخالفة' : 'VIOLATION'
                              : log.eventType === 'entry'
                              ? isAr ? 'دخول' : 'ENTRÉE'
                              : isAr ? 'خروج' : 'SORTIE'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-bold text-white">{log.zoneName}</td>
                        <td className="py-3 px-4 font-mono font-black text-cyan-300">{log.vehiclePlate}</td>
                        <td className="py-3 px-4 font-semibold text-slate-200">{log.driverName}</td>
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {log.speedKmh ? `${log.speedKmh} km/h` : '-'}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-300">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Sales Territory Protection */}
        <TabsContent value="salesProtection">
          <Card className="border-slate-700 bg-slate-900/90 shadow-2xl backdrop-blur-md">
            <CardHeader className="p-4 border-b border-slate-800">
              <CardTitle className="text-base font-black text-white flex items-center gap-2">
                <Store className="h-5 w-5 text-cyan-400" />
                {isAr ? 'حماية نقاط البيع وتفادي التداخل التجاري' : 'Régulation des Points de Vente & Anti-Démarchage'}
              </CardTitle>
              <CardDescription className="text-xs text-slate-300 font-medium">
                {isAr
                  ? 'مراقبة التزام السائقين بمناطقهم لمنع بيع سائق لزبائن سائق آخر'
                  : 'Garantit qu’un chauffeur ne vend pas dans le secteur réservé d’un confrère'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {isAr ? 'إجمالي نقاط البيع' : 'Total Points de Vente'}
                  </div>
                  <div className="text-2xl font-black text-white mt-1 font-mono">{pointsDeVente.length}</div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {isAr ? 'نقاط بيع محمية بمناطق' : 'POS Sécurisés en Zone'}
                  </div>
                  <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                    {pointsDeVente.filter((p) => p.zone).length}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {isAr ? 'تنبيهات تداخل تجاري' : 'Conflits de Vente Détectés'}
                  </div>
                  <div className="text-2xl font-black text-amber-400 mt-1 font-mono">
                    {posSalesViolations.length}
                  </div>
                </div>
              </div>

              {/* Conflict details list */}
              {posSalesViolations.length > 0 ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 space-y-2">
                  <div className="text-sm font-black text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    {isAr ? 'قائمة نقاط البيع التي تشهد تداخلاً محتملاً :' : 'Conflits Territoriaux Identifiés :'}
                  </div>
                  <div className="divide-y divide-amber-900/40 text-xs">
                    {posSalesViolations.map((c, i) => (
                      <div key={i} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-white text-sm">{c.posName}</span>
                          <span className="text-slate-300 ml-2">
                            (Zone: <span className="font-semibold text-white">{c.zoneName}</span> — Titulaire:{' '}
                            <span className="font-bold text-cyan-300">{c.assignedDriver}</span>)
                          </span>
                        </div>
                        <Badge className="bg-amber-600 text-white font-mono text-xs font-bold px-2 py-0.5 shadow">
                          Visité par {c.violatingDriver}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-xs font-semibold text-emerald-300 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  {isAr
                    ? 'ممتاز ! لا توجد أي مخالفات أو بيع غير مصرح به في مناطق الزملاء حالياً. احترام تام للقطاعات.'
                    : 'Aucun conflit de vente ou démarchage croisé détecté. Respect parfait de la sectorisation par les chauffeurs.'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ZONE CREATION / EDIT DIALOG (PARAMÈTRES AVANCÉS 2026) */}
      <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
        <DialogContent className="z-[9999] border-slate-700 bg-slate-900/98 text-slate-100 max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl rounded-2xl p-6 backdrop-blur-2xl">
          <DialogHeader className="space-y-2 border-b border-slate-800 pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                  <Compass className="h-4 w-4" />
                </div>
                {editingZone?.id
                  ? isAr ? 'تعديل المنطقة الجغرافية وقواعد الحماية' : 'Paramètres Avancés de la Zone Géographique'
                  : isAr ? 'تخصيص وحفظ المنطقة الجغرافية الجديدة' : 'Créer & Configurer une Nouvelle Zone'}
              </DialogTitle>
              <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold">
                {editingZone?.shape === 'polygon' ? (isAr ? 'مضلع GPS' : 'Polygone GPS') : (isAr ? 'دائري' : 'Circulaire')}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-slate-300 font-medium">
              {isAr
                ? 'تحديد خصائص الأمان والتليماتيك، الشاحنة والسائق المخصص، حدود السرعة والأهداف التجارية'
                : 'Définissez la protection territoriale, les règles télématiques, les seuils d’alerte et l’assignation camion/chauffeur.'}
            </DialogDescription>

            {/* Live Computed Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-2 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">{isAr ? 'المساحة' : 'Superficie'}</span>
                <span className="font-mono text-sm font-black text-emerald-200">
                  {editingZone?.surfaceKm2 ?? 0} <span className="text-[10px]">km²</span>
                </span>
              </div>
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 p-2 text-center">
                <span className="text-[10px] uppercase font-bold text-cyan-300 block">{isAr ? 'المحيط' : 'Périmètre'}</span>
                <span className="font-mono text-sm font-black text-cyan-200">
                  {editingZone?.perimeterKm ?? 0} <span className="text-[10px]">km</span>
                </span>
              </div>
              <div className="rounded-xl border border-purple-500/30 bg-purple-950/40 p-2 text-center">
                <span className="text-[10px] uppercase font-bold text-purple-300 block">{isAr ? 'نقاط المحيط' : 'Sommets GPS'}</span>
                <span className="font-mono text-sm font-black text-purple-200">
                  {editingZone?.coordinates?.length ?? 0} <span className="text-[10px]">{isAr ? 'نقاط' : 'pts'}</span>
                </span>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 p-2 text-center">
                <span className="text-[10px] uppercase font-bold text-amber-300 block">{isAr ? 'نقاط البيع' : 'Clients POS'}</span>
                <span className="font-mono text-sm font-black text-amber-200">
                  {containedPosCount} <span className="text-[10px]">{isAr ? 'نقطة بيع' : 'pos'}</span>
                </span>
              </div>
            </div>
          </DialogHeader>

          {editingZone && (
            <Tabs defaultValue="identification" className="w-full pt-2">
              <TabsList className="grid grid-cols-3 bg-slate-950/80 border border-slate-800 p-1 rounded-xl mb-4">
                <TabsTrigger
                  value="identification"
                  className="text-xs font-bold data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 rounded-lg py-1.5"
                >
                  <Store className="h-3.5 w-3.5 mr-1 inline" />
                  {isAr ? 'التعريف والأسطول' : 'Identification & Flotte'}
                </TabsTrigger>
                <TabsTrigger
                  value="telematics"
                  className="text-xs font-bold data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 rounded-lg py-1.5"
                >
                  <ShieldAlert className="h-3.5 w-3.5 mr-1 inline" />
                  {isAr ? 'التليماتيك والأمان' : 'Télématique & Alertes'}
                </TabsTrigger>
                <TabsTrigger
                  value="appearance"
                  className="text-xs font-bold data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 rounded-lg py-1.5"
                >
                  <Palette className="h-3.5 w-3.5 mr-1 inline" />
                  {isAr ? 'الأهداف والمظهر' : 'Objectifs & Visuel'}
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: IDENTIFICATION & FLEET */}
              <TabsContent value="identification" className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-200 font-semibold">{isAr ? 'اسم المنطقة' : 'Nom de la Zone'}</Label>
                    <Input
                      value={editingZone.name || ''}
                      onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })}
                      placeholder="Ex: Zone Industrielle & Dépôts"
                      className="bg-slate-950 border-slate-700 text-xs text-white font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-200 font-semibold">{isAr ? 'رمز المنطقة' : 'Code Zone'}</Label>
                    <Input
                      value={editingZone.code || ''}
                      onChange={(e) => setEditingZone({ ...editingZone, code: e.target.value })}
                      placeholder="ZN-01"
                      className="bg-slate-950 border-slate-700 text-xs font-mono text-white font-bold"
                    />
                  </div>
                </div>

                {/* Exclusivity Type */}
                <div className="space-y-1.5">
                  <Label className="text-slate-200 font-semibold">{isAr ? 'نوع الحماية والقطاع' : 'Règle de Sectorisation'}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingZone({ ...editingZone, type: 'exclusive' })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        editingZone.type === 'exclusive'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md ring-1 ring-amber-400'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                        <ShieldAlert className="h-4 w-4 text-amber-400" />
                        {isAr ? 'منطقة حصرية' : 'Zone Exclusive'}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {isAr ? 'ممنوعة كلياً على شاحنات الزملاء الأخرى' : 'Interdite aux autres camions. Alerte intrusion active.'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingZone({ ...editingZone, type: 'shared' })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        editingZone.type === 'shared'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-400'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                        <Layers className="h-4 w-4 text-cyan-400" />
                        {isAr ? 'منطقة مشتركة' : 'Zone Partagée'}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {isAr ? 'مسموحة لجميع شاحنات الأسطول' : 'Accès multi-camions autorisé sans alerte.'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingZone({ ...editingZone, type: 'forbidden' })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        editingZone.type === 'forbidden'
                          ? 'bg-rose-500/20 border-rose-400 text-rose-200 shadow-md ring-1 ring-rose-400'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                        <Shield className="h-4 w-4 text-rose-400" />
                        {isAr ? 'محظورة كلياً' : 'Zone Interdite'}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {isAr ? 'No-Go zone: ممنوعة على أي شاحنة' : 'No-Go zone. Tout véhicule y déclenche une alerte.'}
                      </p>
                    </button>
                  </div>
                </div>

                {/* Truck & Driver Assignment with Auto-Sync */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-slate-200 font-semibold">{isAr ? 'الشاحنة المخصصة' : 'Véhicule Assigné'}</Label>
                    <Select
                      value={editingZone.assignedVehiclePlate || ''}
                      onValueChange={(plate) => {
                        const t = trucks.find((tr) => tr.plate === plate);
                        const matchingDriver = drivers.find((d) => d.truckId === t?.id || (t && (d as any).truckPlate === t.plate));
                        setEditingZone({
                          ...editingZone,
                          assignedVehiclePlate: plate,
                          assignedVehicleId: t?.id || plate,
                          ...(matchingDriver && !editingZone.assignedDriverName
                            ? { assignedDriverName: matchingDriver.name, assignedDriverId: matchingDriver.id }
                            : {}),
                        });
                      }}
                    >
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-xs text-white font-bold">
                        <SelectValue placeholder="Choisir camion" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 z-[10000]">
                        {trucks.map((t) => (
                          <SelectItem key={t.id} value={t.plate}>
                            {t.plate} ({t.brand || 'Camion'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-slate-200 font-semibold">{isAr ? 'السائق المسؤول' : 'Chauffeur Responsable'}</Label>
                    <Select
                      value={editingZone.assignedDriverName || ''}
                      onValueChange={(driverName) => {
                        const d = drivers.find((dr) => dr.name === driverName);
                        const matchingTruck = trucks.find((tr) => tr.id === d?.truckId);
                        setEditingZone({
                          ...editingZone,
                          assignedDriverName: driverName,
                          assignedDriverId: d?.id || driverName,
                          ...(matchingTruck && !editingZone.assignedVehiclePlate
                            ? { assignedVehiclePlate: matchingTruck.plate, assignedVehicleId: matchingTruck.id }
                            : {}),
                        });
                      }}
                    >
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-xs text-white font-bold">
                        <SelectValue placeholder="Choisir chauffeur" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 z-[10000]">
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.name}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: TELEMATICS & INTRUSION ALERTS */}
              <TabsContent value="telematics" className="space-y-4 text-xs">
                {/* Speed Limit */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-200 font-semibold">{isAr ? 'السرعة القصوى المسموحة' : 'Vitesse Maximale Autorisée'}</Label>
                    <span className="font-mono text-sm font-black text-cyan-400">
                      {editingZone.speedLimitKmh || 60} km/h
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="20"
                      max="110"
                      step="5"
                      value={editingZone.speedLimitKmh || 60}
                      onChange={(e) => setEditingZone({ ...editingZone, speedLimitKmh: Number(e.target.value) })}
                      className="flex-1 cursor-pointer accent-cyan-400 h-2 bg-slate-800 rounded-lg"
                    />
                    <div className="flex gap-1.5">
                      {[40, 60, 80].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => setEditingZone({ ...editingZone, speedLimitKmh: spd })}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                            editingZone.speedLimitKmh === spd
                              ? 'bg-cyan-500 text-slate-950 font-black'
                              : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {spd}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Intrusion Alert Level */}
                <div className="space-y-1.5">
                  <Label className="text-slate-200 font-semibold">{isAr ? 'درجة الإنذار عند الاختراق' : 'Niveau de Sévérité d’Alerte'}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingZone({ ...editingZone, alertLevel: 'critical' })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        (editingZone.alertLevel || 'critical') === 'critical'
                          ? 'bg-rose-500/20 border-rose-500 text-rose-200 ring-1 ring-rose-400'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                        <Volume2 className="h-4 w-4 text-rose-400" />
                        {isAr ? 'إنذار حرج صوتي' : 'Critique (Sonore)'}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {isAr ? 'صفارة فورية + إشعار أحمر طارئ' : 'Alerte sonore urgente et bandeau rouge clignotant.'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingZone({ ...editingZone, alertLevel: 'warning' })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        editingZone.alertLevel === 'warning'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-400'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                        <Bell className="h-4 w-4 text-amber-400" />
                        {isAr ? 'تنبيه بصري' : 'Avertissement Visuel'}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {isAr ? 'شارة برتقالية مع تسجيل الحادثة' : 'Signalement visuel et enregistrement dans le journal.'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingZone({ ...editingZone, alertLevel: 'silent' })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        editingZone.alertLevel === 'silent'
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-400'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                        <Activity className="h-4 w-4 text-indigo-400" />
                        {isAr ? 'تسجيل صامت' : 'Silencieux (Log)'}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {isAr ? 'حفظ تليماتيكي فقط بدون إزعاج' : 'Enregistrement en tâche de fond pour audit.'}
                      </p>
                    </button>
                  </div>
                </div>

                {/* Transit Tolerance & Active Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-slate-200 font-semibold">{isAr ? 'سماحية المرور السريع' : 'Tolérance de Transit Routier'}</Label>
                    <Select
                      value={editingZone.transitAllowed ? 'true' : 'false'}
                      onValueChange={(val) => setEditingZone({ ...editingZone, transitAllowed: val === 'true' })}
                    >
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-xs text-white font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 z-[10000]">
                        <SelectItem value="false">
                          {isAr ? '❌ منع تام (أي دخول = مخالفة)' : '❌ Interdiction stricte (Toute incursion = violation)'}
                        </SelectItem>
                        <SelectItem value="true">
                          {isAr ? '✅ مسموح المرور فقط (> 35 كم/س)' : '✅ Toléré en transit (> 35 km/h sans arrêt)'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-slate-200 font-semibold">{isAr ? 'ساعات تفعيل المراقبة' : 'Horaires de Surveillance'}</Label>
                    <Select
                      value={editingZone.scheduleActive || '24h/24'}
                      onValueChange={(val) => setEditingZone({ ...editingZone, scheduleActive: val })}
                    >
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-xs text-white font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 z-[10000]">
                        <SelectItem value="24h/24">
                          {isAr ? '24 ساعة / 24 طيلة الأسبوع' : '24h/24 & 7j/7 (Surveillance permanente)'}
                        </SelectItem>
                        <SelectItem value="07:00-19:00">
                          {isAr ? 'ساعات التوزيع (07:00 - 19:00)' : 'Tournée de jour (07:00 - 19:00)'}
                        </SelectItem>
                        <SelectItem value="19:00-07:00">
                          {isAr ? 'ساعات الليل والراحة (19:00 - 07:00)' : 'Période nocturne (19:00 - 07:00)'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: OBJECTIVES & VISUAL STYLING */}
              <TabsContent value="appearance" className="space-y-4 text-xs">
                {/* Target Quota */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-200 font-semibold">
                      {isAr ? 'الهدف اليومي للتوزيع (قنينات مملوءة)' : 'Objectif Quotidien de Livraison (Bouteilles Pleines)'}
                    </Label>
                    <span className="font-mono text-xs font-bold text-amber-300">
                      {editingZone.dailyQuotaTarget || 120} {isAr ? 'قنينة / يوم' : 'bouteilles / jour'}
                    </span>
                  </div>
                  <Input
                    type="number"
                    value={editingZone.dailyQuotaTarget || 120}
                    onChange={(e) => setEditingZone({ ...editingZone, dailyQuotaTarget: Number(e.target.value) })}
                    className="bg-slate-950 border-slate-700 text-xs font-mono text-white font-bold"
                  />
                </div>

                {/* Color Palette (12 Swatches) & Custom Picker */}
                <div className="space-y-2">
                  <Label className="text-slate-200 font-semibold">{isAr ? 'لون المنطقة على الخريطة' : 'Couleur & Signalétique Visuelle'}</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {TRAJET_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditingZone({ ...editingZone, color: c, fillColor: c })}
                        className={`h-7 w-7 rounded-full border-2 transition-transform ${
                          (editingZone.color || '#3b82f6').toLowerCase() === c.toLowerCase()
                            ? 'scale-125 border-white shadow-lg ring-2 ring-cyan-400'
                            : 'border-slate-800 hover:scale-110 opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}

                    <div className="flex items-center gap-1.5 ml-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1">
                      <input
                        type="color"
                        value={editingZone.color || '#3b82f6'}
                        onChange={(e) =>
                          setEditingZone({
                            ...editingZone,
                            color: e.target.value,
                            fillColor: e.target.value,
                          })
                        }
                        className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      <span className="font-mono text-[11px] text-white font-bold uppercase">
                        {editingZone.color || '#3b82f6'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fill Opacity Slider with Real-time Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-200 font-semibold">{isAr ? 'شفافية التعبئة على الخريطة' : 'Opacité de Remplissage'}</Label>
                    <span className="font-mono text-xs font-bold text-cyan-300">
                      {Math.round((editingZone.fillOpacity ?? 0.22) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0.10"
                      max="0.70"
                      step="0.05"
                      value={editingZone.fillOpacity ?? 0.22}
                      onChange={(e) => setEditingZone({ ...editingZone, fillOpacity: Number(e.target.value) })}
                      className="flex-1 cursor-pointer accent-cyan-400 h-2 bg-slate-800 rounded-lg"
                    />
                    {/* Live Preview Box */}
                    <div
                      className="h-7 px-3 rounded-lg border border-white/20 flex items-center justify-center font-mono text-[11px] font-bold text-white shadow-inner"
                      style={{
                        backgroundColor: editingZone.color || '#3b82f6',
                        opacity: editingZone.fillOpacity ?? 0.22,
                      }}
                    >
                      Aperçu
                    </div>
                  </div>
                </div>

                {/* Notes & Special Delivery Guidelines */}
                <div className="space-y-1.5">
                  <Label className="text-slate-200 font-semibold">{isAr ? 'ملاحظات وتوجيهات خاصة' : 'Remarques / Directives de Livraison'}</Label>
                  <Input
                    value={editingZone.notes || ''}
                    onChange={(e) => setEditingZone({ ...editingZone, notes: e.target.value })}
                    placeholder={
                      isAr
                        ? 'مثال: أولوية التوزيع للمحلات التجارية قبل الساعة 11:00'
                        : 'Ex: Priorité de livraison aux dépôts du centre avant 11h. Interdiction formelle aux tiers.'
                    }
                    className="bg-slate-950 border-slate-700 text-xs text-white"
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-800 pt-3">
            <Button
              variant="outline"
              onClick={() => setIsZoneDialogOpen(false)}
              className="border-slate-700 bg-slate-800 text-slate-200 text-xs font-bold"
            >
              {isAr ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button
              onClick={handleSaveZone}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/25 gap-1.5"
            >
              <Check className="h-4 w-4" />
              {isAr ? 'تأكيد وحفظ المنطقة' : 'Enregistrer la Zone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
