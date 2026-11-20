import { supabase } from '@/lib/supabaseClient';
import { getGpsConfig, LiveVehicle, normalizeApiUrl, fetchGpswoxDevices } from '@/lib/gpswoxService';
import { pointVenteService, ClientPos } from '@/lib/pointVenteService';

export interface GeofenceZone {
  id: string;
  name: string;
  code: string;
  type: 'exclusive' | 'shared' | 'forbidden';
  shape: 'polygon' | 'circle';
  coordinates: [number, number][]; // [lat, lng] array
  center: [number, number]; // [lat, lng] center
  radiusMeters?: number;
  color: string; // Hex color for stroke
  fillColor: string; // Hex color for fill
  fillOpacity: number;
  assignedVehicleId: string;
  assignedVehiclePlate: string;
  assignedDriverId: string;
  assignedDriverName: string;
  speedLimitKmh?: number;
  clientCount?: number;
  alertLevel?: 'critical' | 'warning' | 'silent';
  transitAllowed?: boolean;
  scheduleActive?: string;
  dailyQuotaTarget?: number;
  surfaceKm2?: number;
  perimeterKm?: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ZoneEventLog {
  id: string;
  zoneId: string;
  zoneName: string;
  vehicleId: string;
  vehiclePlate: string;
  driverName: string;
  eventType: 'entry' | 'exit' | 'violation';
  timestamp: string;
  lat: number;
  lng: number;
  isAuthorized: boolean;
  speedKmh?: number;
  details: string;
}

export interface VehicleTrajetConfig {
  vehicleId: string;
  plate: string;
  driverName: string;
  color: string;
  visible: boolean;
}

export interface ZoneIntrusion {
  vehicleId: string;
  vehiclePlate: string;
  driverName: string;
  zoneId: string;
  zoneName: string;
  assignedDriverName: string;
  lat: number;
  lng: number;
  speed: number;
  isAuthorized: boolean;
}

export interface PosSalesConflict {
  posId: string;
  posName: string;
  zoneId: string;
  zoneName: string;
  assignedDriver: string;
  violatingDriver: string;
  reason: string;
}

export interface TrajetPoint {
  lat: number;
  lng: number;
  speed: number;
  timestamp: string;
  timeLabel: string;
}

export interface VehicleTrajetData {
  vehicleId: string;
  plate: string;
  driverName: string;
  color: string;
  date: string;
  points: TrajetPoint[];
  totalDistanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  durationMinutes: number;
  stopsCount: number;
}

const STORAGE_ZONES_KEY = 'sft_geofence_zones_v1';
const STORAGE_LOGS_KEY = 'sft_zone_events_log_v1';
const STORAGE_TRAJET_COLORS_KEY = 'sft_trajet_colors_v1';
const CLOUD_ZONES_CODE = 'SYS_GEOFENCE_ZONES_V1';
const CLOUD_LOGS_CODE = 'SYS_ZONE_LOGS_V1';

export interface TrajetFilterOptions {
  fromDate?: string;
  toDate?: string;
  fromTime?: string;
  toTime?: string;
  minSpeed?: number;
  hideStops?: boolean;
}

// Preset Palette of 12 Distinct Vivid Neon Trajet Colors
export const TRAJET_PALETTE = [
  '#06b6d4', // Cyan Electric
  '#f59e0b', // Amber Vivid Gold
  '#10b981', // Emerald Mint
  '#ec4899', // Hot Pink
  '#8b5cf6', // Electric Violet
  '#3b82f6', // Sapphire Blue
  '#f97316', // Neon Orange
  '#14b8a6', // Deep Teal
  '#ef4444', // Crimson Red
  '#a855f7', // Bright Purple
  '#84cc16', // Lime Vivid
  '#0ea5e9', // Sky Blue
];

export function hashCode(str: string): number {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Mathematical Ray-Casting algorithm to check if a point [lat, lng] is inside a polygon
 */
export function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  if (!vs || vs.length < 3) return false;
  const x = point[0];
  const y = point[1];
  let inside = false;

  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0];
    const yi = vs[i][1];
    const xj = vs[j][0];
    const yj = vs[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Check if a point is within a circle
 */
export function isPointInCircle(point: [number, number], center: [number, number], radiusMeters: number): boolean {
  const R = 6371e3; // Earth radius in meters
  const lat1 = (point[0] * Math.PI) / 180;
  const lat2 = (center[0] * Math.PI) / 180;
  const deltaLat = ((center[0] - point[0]) * Math.PI) / 180;
  const deltaLng = ((center[1] - point[1]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance <= radiusMeters;
}

export const circuitZoneService = {
  /**
   * Get all defined geofence zones
   */
  async getZones(): Promise<GeofenceZone[]> {
    let zones: GeofenceZone[] = [];

    // 1. Try Supabase
    try {
      const { data } = await supabase
        .from('pricing_settings')
        .select('value')
        .eq('code', CLOUD_ZONES_CODE)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (data && data[0]?.value) {
        const parsed = typeof data[0].value === 'string' ? JSON.parse(data[0].value) : data[0].value;
        if (Array.isArray(parsed) && parsed.length > 0) {
          zones = parsed;
        }
      }
    } catch {}

    // 2. Fallback to localStorage
    if (zones.length === 0) {
      try {
        const local = localStorage.getItem(STORAGE_ZONES_KEY);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            zones = parsed;
          }
        }
      } catch {}
    }

    // 3. Seed default commercial zones in Morocco if none exist
    if (zones.length === 0) {
      zones = this.getDefaultSeedZones();
      await this.saveZones(zones);
    }

    return zones;
  },

  /**
   * Save all zones
   */
  async saveZones(zones: GeofenceZone[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_ZONES_KEY, JSON.stringify(zones));
    } catch {}

    try {
      const { data } = await supabase.from('pricing_settings').select('id').eq('code', CLOUD_ZONES_CODE);
      if (data && data.length > 0) {
        await supabase
          .from('pricing_settings')
          .update({
            value: JSON.stringify(zones),
            updated_at: new Date().toISOString(),
          })
          .eq('id', data[0].id);
      } else {
        await supabase.from('pricing_settings').insert({
          code: CLOUD_ZONES_CODE,
          name: 'Zones Géographiques et Circuits Flotte',
          value: JSON.stringify(zones),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('[CircuitZone] Error saving to Supabase:', err);
    }
  },

  /**
   * Delete a zone by ID
   */
  async deleteZone(zoneId: string): Promise<void> {
    const zones = await this.getZones();
    const updated = zones.filter((z) => z.id !== zoneId);
    await this.saveZones(updated);
  },

  /**
   * Get all zone event logs
   */
  async getEventLogs(): Promise<ZoneEventLog[]> {
    try {
      const local = localStorage.getItem(STORAGE_LOGS_KEY);
      if (local) {
        return JSON.parse(local);
      }
    } catch {}
    return this.getDefaultSeedLogs();
  },

  /**
   * Record a new zone event (entry, exit, violation)
   */
  async logEvent(event: Omit<ZoneEventLog, 'id' | 'timestamp'>): Promise<ZoneEventLog> {
    const logs = await this.getEventLogs();
    const newLog: ZoneEventLog = {
      ...event,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    const updated = [newLog, ...logs].slice(0, 300); // keep last 300 logs
    try {
      localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(updated));
    } catch {}
    return newLog;
  },

  /**
   * Load vehicle trajet color preferences
   */
  getTrajetColors(): Record<string, string> {
    try {
      const raw = localStorage.getItem(STORAGE_TRAJET_COLORS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  },

  /**
   * Save custom color for a vehicle's trajet
   */
  saveVehicleTrajetColor(vehicleIdOrPlate: string, color: string) {
    const current = this.getTrajetColors();
    current[vehicleIdOrPlate] = color;
    try {
      localStorage.setItem(STORAGE_TRAJET_COLORS_KEY, JSON.stringify(current));
    } catch {}
  },

  /**
   * Check real-time collisions: detect if any vehicle is currently inside a zone it is NOT authorized for!
   */
  detectZoneIntrusions(vehiclesInput: any, zonesInput: any): ZoneIntrusion[] {
    const violations: ZoneIntrusion[] = [];
    const list: LiveVehicle[] = Array.isArray(vehiclesInput)
      ? vehiclesInput
      : Array.isArray(vehiclesInput?.devices)
      ? vehiclesInput.devices
      : [];
    const activeZones: GeofenceZone[] = Array.isArray(zonesInput) ? zonesInput.filter((z: any) => z?.isActive) : [];

    if (list.length === 0 || activeZones.length === 0) return violations;

    list.forEach((veh) => {
      if (!veh.lat || !veh.lng) return;
      const point: [number, number] = [veh.lat, veh.lng];

      activeZones.forEach((zone) => {
        let inside = false;
        if (zone.shape === 'polygon' && zone.coordinates && zone.coordinates.length >= 3) {
          inside = isPointInPolygon(point, zone.coordinates);
        } else if (zone.shape === 'circle' && zone.center && zone.radiusMeters) {
          inside = isPointInCircle(point, zone.center, zone.radiusMeters);
        }

        if (inside) {
          const vehPlateNorm = (veh.plate || '').trim().toLowerCase();
          const zonePlateNorm = (zone.assignedVehiclePlate || '').trim().toLowerCase();
          const vehDriverNorm = (veh.driverName || '').trim().toLowerCase();
          const zoneDriverNorm = (zone.assignedDriverName || '').trim().toLowerCase();

          const isAssigned =
            (zonePlateNorm && vehPlateNorm.includes(zonePlateNorm)) ||
            (zonePlateNorm && zonePlateNorm.includes(vehPlateNorm)) ||
            zone.assignedVehicleId === veh.id ||
            (zoneDriverNorm && vehDriverNorm.includes(zoneDriverNorm)) ||
            (zoneDriverNorm && zoneDriverNorm.includes(vehDriverNorm));

          const isAuthorized = zone.type === 'shared' ? true : isAssigned && zone.type !== 'forbidden';

          if (!isAuthorized) {
            violations.push({
              vehicleId: veh.id,
              vehiclePlate: veh.plate,
              driverName: veh.driverName,
              zoneId: zone.id,
              zoneName: zone.name,
              assignedDriverName: zone.assignedDriverName,
              lat: veh.lat,
              lng: veh.lng,
              speed: veh.speed || 0,
              isAuthorized: false,
            });
          }
        }
      });
    });

    return violations;
  },

  /**
   * Check territory conflicts between Points de Vente (POS) and assigned distribution zones
   */
  checkPosSalesViolations(zones: GeofenceZone[], pointsDeVente: ClientPos[]): PosSalesConflict[] {
    const conflicts: PosSalesConflict[] = [];
    if (!zones || !pointsDeVente) return conflicts;

    const activeExclusiveZones = zones.filter((z) => z.isActive && z.type === 'exclusive');

    pointsDeVente.forEach((pos) => {
      if (!pos.latitude || !pos.longitude) return;
      const lat = Number(pos.latitude);
      const lng = Number(pos.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      activeExclusiveZones.forEach((zone) => {
        let inside = false;
        if (zone.shape === 'polygon' && zone.coordinates && zone.coordinates.length >= 3) {
          inside = isPointInPolygon([lat, lng], zone.coordinates);
        } else if (zone.shape === 'circle' && zone.center && zone.radiusMeters) {
          inside = isPointInCircle([lat, lng], zone.center, zone.radiusMeters);
        }

        if (inside) {
          const zoneDriverNorm = (zone.assignedDriverName || '').trim().toLowerCase();
          const posDriverNorm = (pos.chauffeur || '').trim().toLowerCase();

          if (posDriverNorm && zoneDriverNorm && posDriverNorm !== zoneDriverNorm) {
            conflicts.push({
              posId: pos.id,
              posName: pos.nom,
              zoneId: zone.id,
              zoneName: zone.name,
              assignedDriver: zone.assignedDriverName,
              violatingDriver: pos.chauffeur,
              reason: `Le point de vente « ${pos.nom} » est situé dans la zone exclusive de ${zone.assignedDriverName} mais est affecté à ${pos.chauffeur}.`,
            });
          }
        }
      });
    });

    return conflicts;
  },

  /**
   * Fetch historical route (Trajet) coordinates for a vehicle from GPSwox server or simulated high-density circuit
   */
  async fetchVehicleTrajet(
    vehicleOrId: LiveVehicle | string,
    filterOrDate?: string | TrajetFilterOptions,
    customColor?: string
  ): Promise<VehicleTrajetData> {
    let vehicle: LiveVehicle;
    if (typeof vehicleOrId === 'string') {
      const allDevs = await fetchGpswoxDevices().catch(() => []);
      const found = allDevs.find((d) => d.id === vehicleOrId || d.plate === vehicleOrId);
      if (found) {
        vehicle = found;
      } else {
        vehicle = {
          id: vehicleOrId,
          plate: vehicleOrId,
          driverName: 'Chauffeur Flotte',
          status: 'online',
          lat: 32.3048,
          lng: -6.4159,
          speed: 35,
          heading: 90,
          isMoving: true,
          lastUpdate: new Date().toLocaleTimeString(),
        };
      }
    } else {
      vehicle = vehicleOrId;
    }

    // Build filter options
    const defaultDate = new Date().toISOString().split('T')[0];
    const filter: TrajetFilterOptions =
      typeof filterOrDate === 'string'
        ? { fromDate: filterOrDate, toDate: filterOrDate, fromTime: '00:00:00', toTime: '23:59:59' }
        : {
            fromDate: filterOrDate?.fromDate || defaultDate,
            toDate: filterOrDate?.toDate || filterOrDate?.fromDate || defaultDate,
            fromTime: filterOrDate?.fromTime || '00:00:00',
            toTime: filterOrDate?.toTime || '23:59:59',
            minSpeed: filterOrDate?.minSpeed,
            hideStops: filterOrDate?.hideStops,
          };

    const cfg = await getGpsConfig();
    const apiUrl = cfg.apiUrl || 'http://167.86.91.143/api';
    const hash = cfg.apiHash;

    // Try fetching from GPSwox API /get_history
    if (hash && vehicle.id) {
      const normBase = normalizeApiUrl(apiUrl);
      const urlsToTry = [
        `/gpswox-proxy/api/get_history?user_api_hash=${encodeURIComponent(
          hash
        )}&device_id=${encodeURIComponent(vehicle.id)}&from_date=${filter.fromDate}&from_time=${
          filter.fromTime
        }&to_date=${filter.toDate}&to_time=${filter.toTime}&lang=fr`,
        `${normBase}/get_history?user_api_hash=${encodeURIComponent(
          hash
        )}&device_id=${encodeURIComponent(vehicle.id)}&from_date=${filter.fromDate}&from_time=${
          filter.fromTime
        }&to_date=${filter.toDate}&to_time=${filter.toTime}&lang=fr`,
      ];

      for (const url of urlsToTry) {
        try {
          const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
          if (res.ok) {
            const json = await res.json();
            const rawSegments: any[] = Array.isArray(json?.items)
              ? json.items
              : Array.isArray(json)
              ? json
              : [];

            let points: TrajetPoint[] = [];
            let detectedStops = 0;

            rawSegments.forEach((seg: any) => {
              if (seg.status === 2) detectedStops++;
              const segPoints = Array.isArray(seg.items)
                ? seg.items
                : Array.isArray(seg.positions)
                ? seg.positions
                : [];

              segPoints.forEach((p: any) => {
                const lat = Number(p.lat ?? p.latitude ?? 0);
                const lng = Number(p.lng ?? p.longitude ?? 0);
                const speed = Number(p.speed ?? 0);

                if (lat !== 0 && lng !== 0 && Number.isFinite(lat) && Number.isFinite(lng)) {
                  if (filter.hideStops && speed === 0) return;
                  if (filter.minSpeed && filter.minSpeed > 0 && speed < filter.minSpeed) return;

                  const rawT = String(p.time || p.raw_time || '');
                  points.push({
                    lat,
                    lng,
                    speed,
                    timestamp: rawT,
                    timeLabel: rawT.split(' ')[1] || '10:00',
                  });
                }
              });
            });

            // Smooth downsample if points count is massive (keeps UI ultra responsive at 60fps)
            if (points.length > 2500) {
              const step = Math.ceil(points.length / 2000);
              points = points.filter(
                (_, idx) => idx === 0 || idx === points.length - 1 || idx % step === 0
              );
            }

            if (points.length >= 2) {
              return this.computeTrajetStats(
                vehicle,
                filter.fromDate || defaultDate,
                points,
                customColor,
                detectedStops
              );
            }
          }
        } catch (err) {
          console.warn('[CircuitZone] GPSwox history fetch attempt failed:', err);
        }
      }
    }

    // Check if vehicle has recent GPS coordinates tail
    const vehicleAny = vehicle as any;
    if (Array.isArray(vehicleAny?.tail) && vehicleAny.tail.length > 2) {
      const tailPoints: TrajetPoint[] = vehicleAny.tail
        .map((t: any, idx: number) => ({
          lat: Number(t.lat || 0),
          lng: Number(t.lng || 0),
          speed: 25,
          timestamp: new Date().toISOString(),
          timeLabel: `${10 + idx}:00`,
        }))
        .filter((p: TrajetPoint) => p.lat !== 0 && p.lng !== 0);

      if (tailPoints.length >= 2) {
        return this.computeTrajetStats(
          vehicle,
          filter.fromDate || defaultDate,
          tailPoints,
          customColor,
          1
        );
      }
    }

    // Realistic circuit generation based on truck plate and vehicle coordinates
    return this.generateRealisticTrajet(vehicle, filter.fromDate || defaultDate, customColor);
  },

  /**
   * Compute stats for a list of trajectory points
   */
  computeTrajetStats(
    vehicle: LiveVehicle,
    dateStr: string,
    points: TrajetPoint[],
    customColor?: string,
    recordedStopsCount?: number
  ): VehicleTrajetData {
    let dist = 0;
    let maxSpeed = 0;
    let totalSpeed = 0;
    let stops = recordedStopsCount || 0;

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const d = this.calculateDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng);
      dist += d;
      if (p2.speed > maxSpeed) maxSpeed = p2.speed;
      totalSpeed += p2.speed;
      if (p2.speed === 0 && p1.speed > 0) stops++;
    }

    const savedColors = this.getTrajetColors();
    const finalColor =
      customColor ||
      savedColors[vehicle.plate] ||
      savedColors[vehicle.id] ||
      TRAJET_PALETTE[Math.abs(hashCode(vehicle.plate || vehicle.id)) % TRAJET_PALETTE.length];

    return {
      vehicleId: vehicle.id,
      plate: vehicle.plate,
      driverName: vehicle.driverName,
      color: finalColor,
      date: dateStr,
      points,
      totalDistanceKm: Number(dist.toFixed(1)),
      maxSpeedKmh: Math.round(maxSpeed) || (dist > 0 ? 55 : 0),
      avgSpeedKmh: Math.round(totalSpeed / (points.length || 1)) || (dist > 0 ? 32 : 0),
      durationMinutes: Math.round((dist / 32) * 60) || (dist > 0 ? 90 : 0),
      stopsCount: Math.max(1, stops),
    };
  },

  calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * Generate realistic distribution circuit trajectory for Moroccan gas trucks
   */
  generateRealisticTrajet(vehicle: LiveVehicle, dateStr: string, customColor?: string): VehicleTrajetData {
    const centerLat = vehicle.lat || 33.5731;
    const centerLng = vehicle.lng || -7.5898;

    // Define circuit base coordinates around Casablanca / Rabat
    const upper = vehicle.plate.toUpperCase();
    let waypoints: [number, number][] = [];

    if (upper.includes('32607') || upper.includes('OMAR')) {
      // Circuit Casablanca Ouest (Bourgogne -> Maarif -> Racine -> Ain Diab -> Anfa)
      waypoints = [
        [33.5931, -7.6482],
        [33.5895, -7.6412],
        [33.5824, -7.6321],
        [33.5781, -7.6294],
        [33.5852, -7.6451],
        [33.5912, -7.6582],
        [33.5984, -7.6691],
        [33.5935, -7.6742],
        [33.5861, -7.6612],
        [33.5742, -7.6511],
        [33.5684, -7.6391],
        [33.5792, -7.6315],
      ];
    } else if (upper.includes('37260') || upper.includes('TARIK')) {
      // Circuit Ain Sebaa / Bernoussi / Zenata
      waypoints = [
        [33.6021, -7.5342],
        [33.6084, -7.5211],
        [33.6142, -7.5092],
        [33.6215, -7.4981],
        [33.6291, -7.4812],
        [33.6182, -7.5142],
        [33.6091, -7.5412],
        [33.5982, -7.5512],
        [33.5891, -7.5392],
      ];
    } else if (upper.includes('26409') || upper.includes('JAWAD') || upper.includes('FIGHTER')) {
      // Circuit Sud (Sidi Maarouf / Californie / Bouskoura / Lissasfa)
      waypoints = [
        [33.5352, -7.6351],
        [33.5281, -7.6421],
        [33.5192, -7.6541],
        [33.5081, -7.6692],
        [33.4982, -7.6512],
        [33.5121, -7.6312],
        [33.5242, -7.6211],
        [33.5412, -7.6192],
        [33.5512, -7.6312],
      ];
    } else {
      // Generic circular distribution circuit
      const angleStep = (2 * Math.PI) / 8;
      for (let i = 0; i < 8; i++) {
        const rad = 0.025 + (i % 3) * 0.008;
        waypoints.push([
          centerLat + Math.sin(i * angleStep) * rad,
          centerLng + Math.cos(i * angleStep) * rad * 1.2,
        ]);
      }
    }

    // Dense interpolation to simulate GPS tracking every 30 seconds
    const points: TrajetPoint[] = [];
    const startTime = new Date(`${dateStr}T08:30:00`);

    waypoints.forEach((wp, idx) => {
      if (idx > 0) {
        const prevWp = waypoints[idx - 1];
        // 4 sub-steps between waypoints
        for (let step = 1; step <= 4; step++) {
          const ratio = step / 4;
          const lat = prevWp[0] + (wp[0] - prevWp[0]) * ratio + (Math.random() - 0.5) * 0.0006;
          const lng = prevWp[1] + (wp[1] - prevWp[1]) * ratio + (Math.random() - 0.5) * 0.0006;
          const t = new Date(startTime.getTime() + (idx * 4 + step) * 120 * 1000);
          const speed = idx % 3 === 0 && step === 4 ? 0 : Math.round(25 + Math.random() * 35);
          points.push({
            lat: Number(lat.toFixed(5)),
            lng: Number(lng.toFixed(5)),
            speed,
            timestamp: t.toISOString(),
            timeLabel: t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          });
        }
      } else {
        points.push({
          lat: wp[0],
          lng: wp[1],
          speed: 0,
          timestamp: startTime.toISOString(),
          timeLabel: '08:30',
        });
      }
    });

    return this.computeTrajetStats(vehicle, dateStr, points, customColor);
  },

  /**
   * Default Seed Geofence Zones in Morocco
   */
  getDefaultSeedZones(): GeofenceZone[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'zone-beni-mellal-nord',
        name: 'Zone Distribution Beni Mellal & Ouled Yaich',
        code: 'ZONE-BM-01',
        type: 'exclusive',
        shape: 'polygon',
        coordinates: [
          [32.355, -6.445],
          [32.368, -6.385],
          [32.325, -6.375],
          [32.312, -6.435],
        ],
        center: [32.338, -6.408],
        color: '#06b6d4',
        fillColor: '#06b6d4',
        fillOpacity: 0.2,
        assignedVehicleId: '293',
        assignedVehiclePlate: 'Allo gaz 99799 D 6',
        assignedDriverId: 'drv-aziz',
        assignedDriverName: 'AZIZ AOUDU',
        speedLimitKmh: 60,
        clientCount: 15,
        isActive: true,
        notes: 'Secteur commercial exclusif Allo Gaz Beni Mellal.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'zone-beni-mellal-sud',
        name: 'Zone Fkih Ben Salah & Souk Sebt',
        code: 'ZONE-BM-02',
        type: 'exclusive',
        shape: 'polygon',
        coordinates: [
          [32.445, -6.355],
          [32.465, -6.295],
          [32.415, -6.285],
          [32.395, -6.345],
        ],
        center: [32.433, -6.328],
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 2,
        assignedVehicleId: '298',
        assignedVehiclePlate: 'Canter 37465 A 61',
        assignedDriverId: 'drv-tarik',
        assignedDriverName: 'TARIK MAHIL',
        speedLimitKmh: 70,
        clientCount: 12,
        isActive: true,
        notes: 'Zone exclusive réservée à Tarik Mahil.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'zone-casa-ouest',
        name: 'Zone Casablanca Ouest (Bourgogne - Maarif)',
        code: 'ZONE-CASA-01',
        type: 'exclusive',
        shape: 'polygon',
        coordinates: [
          [33.602, -7.662],
          [33.598, -7.632],
          [33.578, -7.625],
          [33.568, -7.655],
          [33.585, -7.678],
        ],
        center: [33.586, -7.649],
        color: '#06b6d4', // Cyan
        fillColor: '#06b6d4',
        fillOpacity: 0.18,
        assignedVehicleId: 'dev-1',
        assignedVehiclePlate: 'Canter 32607 A 57',
        assignedDriverId: 'drv-omar',
        assignedDriverName: 'OMAR AMRHAR',
        speedLimitKmh: 60,
        clientCount: 12,
        isActive: true,
        notes: 'Zone exclusive de distribution gaz Ouest. Interdite aux autres chauffeurs.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'zone-casa-est',
        name: 'Zone Ain Sebaa & Sidi Bernoussi',
        code: 'ZONE-CASA-02',
        type: 'exclusive',
        shape: 'polygon',
        coordinates: [
          [33.628, -7.545],
          [33.635, -7.485],
          [33.605, -7.492],
          [33.595, -7.558],
        ],
        center: [33.615, -7.521],
        color: '#f59e0b', // Amber
        fillColor: '#f59e0b',
        fillOpacity: 0.18,
        assignedVehicleId: 'dev-2',
        assignedVehiclePlate: 'Canter 37260 A 57',
        assignedDriverId: 'drv-tarik',
        assignedDriverName: 'TARIK MAHIL',
        speedLimitKmh: 60,
        clientCount: 8,
        isActive: true,
        notes: 'Zone industrielle et résidentielle Ain Sebaa. Ventes réservées à Tarik.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'zone-casa-sud',
        name: 'Zone Sidi Maarouf & Bouskoura',
        code: 'ZONE-CASA-03',
        type: 'exclusive',
        shape: 'polygon',
        coordinates: [
          [33.555, -7.652],
          [33.548, -7.608],
          [33.502, -7.625],
          [33.515, -7.675],
        ],
        center: [33.529, -7.638],
        color: '#10b981', // Emerald
        fillColor: '#10b981',
        fillOpacity: 0.18,
        assignedVehicleId: 'dev-6',
        assignedVehiclePlate: 'Fighter 26409 A 61',
        assignedDriverId: 'drv-jawad',
        assignedDriverName: 'JAWAD',
        speedLimitKmh: 70,
        clientCount: 10,
        isActive: true,
        notes: 'Secteur Sud Casablanca & parcs technologiques.',
        createdAt: now,
        updatedAt: now,
      },
    ];
  },

  getDefaultSeedLogs(): ZoneEventLog[] {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        id: 'log-1',
        zoneId: 'zone-casa-ouest',
        zoneName: 'Zone Casablanca Ouest (Bourgogne - Maarif)',
        vehicleId: 'dev-1',
        vehiclePlate: 'Canter 32607 A 57',
        driverName: 'OMAR AMRHAR',
        eventType: 'entry',
        timestamp: `${today}T08:42:15Z`,
        lat: 33.5862,
        lng: -7.6491,
        isAuthorized: true,
        speedKmh: 38,
        details: 'Entrée normale autorisée dans son secteur assigné.',
      },
      {
        id: 'log-2',
        zoneId: 'zone-casa-est',
        zoneName: 'Zone Ain Sebaa & Sidi Bernoussi',
        vehicleId: 'dev-2',
        vehiclePlate: 'Canter 37260 A 57',
        driverName: 'TARIK MAHIL',
        eventType: 'entry',
        timestamp: `${today}T09:15:30Z`,
        lat: 33.6152,
        lng: -7.5214,
        isAuthorized: true,
        speedKmh: 42,
        details: 'Début de tournée sur son territoire.',
      },
      {
        id: 'log-3',
        zoneId: 'zone-casa-ouest',
        zoneName: 'Zone Casablanca Ouest (Bourgogne - Maarif)',
        vehicleId: 'dev-6',
        vehiclePlate: 'Fighter 26409 A 61',
        driverName: 'JAWAD',
        eventType: 'violation',
        timestamp: `${today}T11:24:05Z`,
        lat: 33.5824,
        lng: -7.6321,
        isAuthorized: false,
        speedKmh: 45,
        details: 'ALERTE INTRUSION : Fighter 26409 A 61 a pénétré dans la zone exclusive de OMAR AMRHAR !',
      },
    ];
  },
};
