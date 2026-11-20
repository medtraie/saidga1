import { supabase } from '@/lib/supabaseClient';
import { kvGetShared, kvSetShared } from '@/lib/kv';

export interface DriverPosAccount {
  id: string;
  driverId: string;
  driverName: string;
  email: string;
  password?: string;
  isActive: boolean;
  lastLogin?: string;
  deviceInfo?: string;
  createdAt?: string;
}

export interface TourneeItem {
  bottleTypeId: string;
  bottleTypeName: string;
  quantity: number;
  unitPrice?: number;
}

export interface TourneeDeliveredItem {
  bottleTypeId: string;
  bottleTypeName: string;
  quantityFull: number;
  unitPrice: number;
  total: number;
}

export interface TourneeCollectedItem {
  bottleTypeId: string;
  bottleTypeName: string;
  quantityEmpty: number;
}

export interface TourneeStop {
  id: string;
  tourneeId: string;
  clientId: string;
  clientName: string;
  posName?: string;
  ice?: string;
  patente?: string;
  lat: number;
  lng: number;
  status: 'en_attente' | 'livre' | 'annule' | 'absent' | 'refuse';
  sequenceOrder: number;
  deliveredItems: TourneeDeliveredItem[];
  collectedEmpty: TourneeCollectedItem[];
  defectiveItems?: Array<{ bottleTypeId: string; bottleTypeName: string; quantity: number; code?: string }>;
  foreignItems?: Array<{ bottleTypeId: string; bottleTypeName: string; quantity: number; code?: string }>;
  purchasedItems?: Array<{ bottleTypeId: string; bottleTypeName: string; quantity: number; unitPrice?: number; code?: string }>;
  paymentMethod: 'cash' | 'credit' | 'cheque';
  amountPaid: number;
  amountDebt: number;
  deliveryTime?: string;
  deliveredAt?: string;
  notes?: string;
}

export interface Tournee {
  id: string;
  tourneeNumber: string;
  driverId: string;
  driverName: string;
  truckId?: string;
  supplyOrderId?: string;
  supplyOrderNumber?: string;
  status: 'en_cours' | 'cloturee' | 'validee_retour';
  startTime: string;
  endTime?: string;
  initialLoad: TourneeItem[];
  remainingLoad: TourneeItem[];
  totalDeliveredFull: number;
  totalCollectedEmpty: number;
  totalSalesAmount: number;
  totalCashCollected: number;
  totalCreditDebt: number;
  notes?: string;
  stops?: TourneeStop[];
  createdAt?: string;
}

export interface ClientPos {
  id: string;
  clientId: string;
  clientName: string;
  posName: string;
  address?: string;
  phone?: string;
  ice?: string;
  patente?: string;
  lat: number;
  lng: number;
  circuitName?: string;
  lastDeliveryTime?: string;
  lastDeliveryDriver?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
}

export interface Delivery48hAlert {
  posId: string;
  clientId: string;
  posName: string;
  clientName: string;
  phone?: string;
  address?: string;
  lat: number;
  lng: number;
  circuitName?: string;
  hoursSinceLastDelivery: number;
  lastDeliveryTime?: string;
  lastDeliveryDriver?: string;
}

// Storage keys for offline/fallback & Supabase Cloud Storage
const DRIVER_ACCOUNTS_KEY = 'driver_pos_accounts_v1';
const TOURNEES_KEY = 'tournees_v1';
const CLIENT_POS_KEY = 'client_pos_locations_v1';
const CLOUD_POS_CODE = 'SYS_CLIENT_POS_V2';
const CLOUD_TOURNEES_CODE = 'SYS_TOURNEES_V2';

const nowMs = Date.now();
const oneHourMs = 3600 * 1000;

// Seed default POS locations in Morocco if not set
const DEFAULT_CLIENT_POS: ClientPos[] = [
  { id: 'pos-1', clientId: 'c-1', clientName: 'Épicerie Al Amal', posName: 'Boutique Al Amal - Bourgogne', address: 'Bourgogne, Casablanca', phone: '0661123456', lat: 33.593, lng: -7.648, circuitName: 'Circuit Casablanca Ouest', lastDeliveryTime: new Date(nowMs - 14 * oneHourMs).toISOString(), lastDeliveryDriver: 'JAWAD' },
  { id: 'pos-2', clientId: 'c-2', clientName: 'Superette Salam', posName: 'Alimentation Salam - Maarif', address: 'Maarif, Casablanca', phone: '0662234567', lat: 33.582, lng: -7.632, circuitName: 'Circuit Casablanca Ouest', lastDeliveryTime: new Date(nowMs - 22 * oneHourMs).toISOString(), lastDeliveryDriver: 'JAWAD' },
  { id: 'pos-3', clientId: 'c-3', clientName: 'Café & Restaurant Rayan', posName: 'Point de Vente Rayan - Ain Diab', address: 'Ain Diab, Casablanca', phone: '0663345678', lat: 33.598, lng: -7.669, circuitName: 'Circuit Casablanca Ouest', lastDeliveryTime: new Date(nowMs - 36 * oneHourMs).toISOString(), lastDeliveryDriver: 'TARIK MAHIL' },
  { id: 'pos-4', clientId: 'c-4', clientName: 'Dépôt Gaz Sidi Maarouf', posName: 'Point Relais Gaz - Sidi Maarouf', address: 'Sidi Maarouf, Casablanca', phone: '0664456789', lat: 33.535, lng: -7.635, circuitName: 'Circuit Casablanca Sud', lastDeliveryTime: new Date(nowMs - 56 * oneHourMs).toISOString(), lastDeliveryDriver: 'JAWAD' },
  { id: 'pos-5', clientId: 'c-5', clientName: 'Boucherie Al Baraka', posName: 'Al Baraka Gaz - Hay Hassani', address: 'Hay Hassani, Casablanca', phone: '0665567890', lat: 33.564, lng: -7.671, circuitName: 'Circuit Casablanca Ouest', lastDeliveryTime: new Date(nowMs - 74 * oneHourMs).toISOString(), lastDeliveryDriver: 'MAGSINIER' },
  { id: 'pos-6', clientId: 'c-6', clientName: 'Épicerie Centrale Rabat', posName: 'Alimentation Hassan - Rabat', address: 'Hassan, Rabat', phone: '0666678901', lat: 34.021, lng: -6.836, circuitName: 'Circuit Rabat Centre', lastDeliveryTime: new Date(nowMs - 18 * oneHourMs).toISOString(), lastDeliveryDriver: 'TARIK MAHIL' },
  { id: 'pos-7', clientId: 'c-7', clientName: 'Mini Marché Agdal', posName: 'Agdal Gaz - Avenue Fal Ould Oumeir', address: 'Agdal, Rabat', phone: '0667789012', lat: 33.998, lng: -6.852, circuitName: 'Circuit Rabat Centre', lastDeliveryTime: new Date(nowMs - 82 * oneHourMs).toISOString(), lastDeliveryDriver: 'TARIK MAHIL' },
];

export const pointVenteService = {
  // ==========================================
  // 1. DRIVER POS ACCOUNTS MANAGEMENT
  // ==========================================
  async getDriverAccounts(): Promise<DriverPosAccount[]> {
    // 1. Sync from drivers table in Supabase
    try {
      const { data: realDrivers } = await supabase
        .from('drivers')
        .select('id, name, telephone');

      if (realDrivers && realDrivers.length > 0) {
        const mapped: DriverPosAccount[] = realDrivers.map((d: any) => {
          const cleanName = String(d.name || 'Chauffeur').trim();
          const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.');
          return {
            id: `acc-${d.id}`,
            driverId: String(d.id),
            driverName: cleanName,
            email: `${slug}@sftgaz.ma`,
            password: 'sft1234',
            isActive: true,
            createdAt: new Date().toISOString(),
          };
        });
        return mapped;
      }
    } catch {}

    // Fallback to local / KV
    const local = localStorage.getItem(DRIVER_ACCOUNTS_KEY);
    if (local) {
      try { return JSON.parse(local); } catch {}
    }
    const cloud = await kvGetShared<DriverPosAccount[]>(DRIVER_ACCOUNTS_KEY);
    if (cloud && cloud.length > 0) return cloud;

    const defaultAccounts: DriverPosAccount[] = [
      {
        id: 'acc-magsinier',
        driverId: '8e0c99be-0237-4d8b-8f8c-1fa4463712fc',
        driverName: 'MAGSINIER',
        email: 'magsinier@sftgaz.ma',
        password: 'sft1234',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'acc-tarik',
        driverId: 'f7db40fd-6e25-41e8-b79b-038276e470ff',
        driverName: 'TARIK MAHIL',
        email: 'tarik.mahil@sftgaz.ma',
        password: 'sft1234',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'acc-jawad',
        driverId: 'bd1f92e4-8521-48d4-ac59-793ecc77b5d5',
        driverName: 'JAWAD',
        email: 'jawad@sftgaz.ma',
        password: 'sft1234',
        isActive: true,
        createdAt: new Date().toISOString(),
      }
    ];
    try {
      localStorage.setItem(DRIVER_ACCOUNTS_KEY, JSON.stringify(defaultAccounts));
    } catch {}
    return defaultAccounts;
  },

  async saveDriverAccount(account: Partial<DriverPosAccount>): Promise<{ success: boolean; account?: DriverPosAccount; error?: string }> {
    const id = account.id || crypto.randomUUID();
    const clean: DriverPosAccount = {
      id,
      driverId: String(account.driverId || ''),
      driverName: String(account.driverName || ''),
      email: String(account.email || '').trim().toLowerCase(),
      password: String(account.password || ''),
      isActive: account.isActive !== false,
      createdAt: account.createdAt || new Date().toISOString(),
    };

    let savedDb = false;
    try {
      const { error } = await supabase.from('driver_pos_accounts').upsert({
        id: clean.id,
        driver_id: clean.driverId,
        driver_name: clean.driverName,
        email: clean.email,
        password: clean.password,
        is_active: clean.isActive,
        updated_at: new Date().toISOString(),
      });
      if (!error) savedDb = true;
    } catch {}

    // Save locally
    const current = await this.getDriverAccounts();
    const index = current.findIndex(a => a.id === clean.id || a.email === clean.email);
    const updated = index >= 0 ? current.map((a, i) => i === index ? clean : a) : [clean, ...current];
    try {
      localStorage.setItem(DRIVER_ACCOUNTS_KEY, JSON.stringify(updated));
      await kvSetShared(DRIVER_ACCOUNTS_KEY, updated);
    } catch {}

    return { success: true, account: clean };
  },

  async deleteDriverAccount(id: string): Promise<boolean> {
    try {
      await supabase.from('driver_pos_accounts').delete().eq('id', id);
    } catch {}
    const current = await this.getDriverAccounts();
    const filtered = current.filter(a => a.id !== id);
    try {
      localStorage.setItem(DRIVER_ACCOUNTS_KEY, JSON.stringify(filtered));
      await kvSetShared(DRIVER_ACCOUNTS_KEY, filtered);
    } catch {}
    return true;
  },

  async authenticateDriver(email: string, password: string): Promise<{ success: boolean; driverAccount?: DriverPosAccount; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPw = password.trim();

    const accounts = await this.getDriverAccounts();
    const account = accounts.find(a => a.email.toLowerCase() === cleanEmail);

    if (!account) {
      return { success: false, error: 'Compte chauffeur introuvable avec cet email.' };
    }
    if (!account.isActive) {
      return { success: false, error: 'Ce compte chauffeur est désactivé par l\'administrateur.' };
    }
    if (account.password && account.password !== cleanPw) {
      return { success: false, error: 'Mot de passe incorrect.' };
    }

    // Update last login
    account.lastLogin = new Date().toISOString();
    this.saveDriverAccount(account).catch(() => {});

    return { success: true, driverAccount: account };
  },

  // ==========================================
  // 2. CLIENT POINTS DE VENTE & CIRCUITS
  // ==========================================

  /**
   * Save the entire Client POS list to Supabase Cloud (pricing_settings SYS_CLIENT_POS_V2)
   * with synchronization to app_state and localStorage.
   */
  async saveAllClientPos(list: ClientPos[]): Promise<ClientPos[]> {
    const sanitized = this.sanitizeClientPos(list);

    // 1. Save locally for instant offline performance (both keys)
    try {
      localStorage.setItem(CLIENT_POS_KEY, JSON.stringify(sanitized));
      localStorage.setItem('sft_saved_client_pos_backup', JSON.stringify(sanitized));
      localStorage.removeItem('sft_pos_deliberately_cleared');
    } catch {}

    // 2. Persist to Supabase Cloud (pricing_settings -> SYS_CLIENT_POS_V2)
    try {
      const { data: existingRows } = await supabase
        .from('pricing_settings')
        .select('id')
        .eq('code', CLOUD_POS_CODE)
        .order('updated_at', { ascending: false });

      const payload = {
        code: CLOUD_POS_CODE,
        designation: 'SFT Points de Vente Cloud Storage',
        prix_unitaire: 0,
        prix_achat: 0,
        zone: 0,
        pricing_data: sanitized,
        updated_at: new Date().toISOString()
      };

      if (existingRows && existingRows.length > 0) {
        const primaryId = existingRows[0].id;
        const { error: upErr } = await supabase
          .from('pricing_settings')
          .update(payload)
          .eq('id', primaryId);

        if (upErr) {
          console.warn('[POS] Supabase update notice:', upErr);
        }

        // Delete any duplicate rows if they exist
        if (existingRows.length > 1) {
          const duplicateIds = existingRows.slice(1).map(r => r.id);
          await supabase.from('pricing_settings').delete().in('id', duplicateIds);
        }
      } else {
        const { error: inErr } = await supabase
          .from('pricing_settings')
          .insert(payload);

        if (inErr) {
          console.warn('[POS] Supabase insert notice:', inErr);
        }
      }
    } catch (err) {
      console.warn('[POS] Failed to persist POS to Supabase pricing_settings:', err);
    }

    // 3. Secondary cloud backup to app_state
    try {
      await kvSetShared(CLIENT_POS_KEY, sanitized);
    } catch {}

    // 4. Dispatch real-time live event so all UI components update immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sft-client-pos-changed', { detail: sanitized }));
    }

    return sanitized;
  },

  /**
   * Load all Client Points of Sale from Supabase Cloud (SYS_CLIENT_POS_V2).
   * Guaranteed to persist across page reloads (actualiser la page).
   */
  async getClientPosList(): Promise<ClientPos[]> {
    let cloudList: ClientPos[] = [];

    // 1. Primary: Load directly from Supabase Cloud table pricing_settings
    try {
      const { data, error } = await supabase
        .from('pricing_settings')
        .select('pricing_data')
        .eq('code', CLOUD_POS_CODE)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        let raw = data[0].pricing_data;
        if (typeof raw === 'string') {
          try {
            raw = JSON.parse(raw);
          } catch {}
        }
        if (Array.isArray(raw) && raw.length > 0) {
          cloudList = raw as ClientPos[];
        }
      }
    } catch (err) {
      console.warn('[POS] Supabase POS load notice:', err);
    }

    // 2. Secondary fallback: app_state
    if (cloudList.length === 0) {
      try {
        const kvCloud = await kvGetShared<ClientPos[]>(CLIENT_POS_KEY);
        if (kvCloud && Array.isArray(kvCloud) && kvCloud.length > 0) {
          cloudList = kvCloud;
        }
      } catch {}
    }

    // 3. Tertiary fallback: localStorage
    let localList: ClientPos[] = [];
    try {
      const local = localStorage.getItem(CLIENT_POS_KEY) || localStorage.getItem('sft_saved_client_pos_backup');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localList = parsed;
        }
      }
    } catch {}

    // Merge cloud and local so no created point is ever lost
    const map = new Map<string, ClientPos>();
    for (const c of cloudList) {
      const k = String(c?.id || c?.clientId || (c as any)?._id || '').toLowerCase();
      if (k) map.set(k, c);
    }
    for (const l of localList) {
      const key = String(l?.id || l?.clientId || (l as any)?._id || '').toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, l);
      }
    }

    let merged = Array.from(map.values());

    // If completely empty on fresh install, seed default Moroccan points
    if (merged.length === 0) {
      merged = [...DEFAULT_CLIENT_POS];
      // Save them immediately to cloud and local
      this.saveAllClientPos(merged).catch(() => {});
    } else {
      try {
        localStorage.setItem(CLIENT_POS_KEY, JSON.stringify(merged));
        localStorage.setItem('sft_saved_client_pos_backup', JSON.stringify(merged));
        localStorage.removeItem('sft_pos_deliberately_cleared');
      } catch {}

      // If local had new items not yet in cloud, sync cloud in background
      if (merged.length > cloudList.length) {
        this.saveAllClientPos(merged).catch(() => {});
      }
    }

    return this.sanitizeClientPos(merged);
  },

  sanitizeClientPos(list: ClientPos[]): ClientPos[] {
    return (list || []).map((p, idx) => {
      let rawClientName = p.clientName;
      if (typeof rawClientName === 'object') {
        rawClientName = (rawClientName as any)?.name || (rawClientName as any)?.clientName || '';
      }
      let clientNameStr = String(rawClientName || '').trim();
      if (!clientNameStr || clientNameStr.includes('[object') || clientNameStr.includes('undefined')) {
        clientNameStr = `Client #${idx + 1}`;
      }

      let rawPosName = p.posName;
      if (typeof rawPosName === 'object') {
        rawPosName = (rawPosName as any)?.posName || (rawPosName as any)?.name || '';
      }
      let posNameStr = String(rawPosName || '').trim();
      if (!posNameStr || posNameStr.includes('[object') || posNameStr.includes('undefined')) {
        posNameStr = `Point de Vente #${idx + 1}`;
      }

      const cleanClientId = typeof p.clientId === 'string' && !p.clientId.includes('[object')
        ? p.clientId
        : `client-${idx + 1}`;

      return {
        ...p,
        clientId: cleanClientId,
        clientName: clientNameStr,
        posName: posNameStr,
        lat: typeof p.lat === 'number' && !isNaN(p.lat) && isFinite(p.lat) ? p.lat : 33.593 + (idx * 0.005),
        lng: typeof p.lng === 'number' && !isNaN(p.lng) && isFinite(p.lng) ? p.lng : -7.648 + (idx * 0.005),
      };
    });
  },

  async addClientPos(pos: Omit<ClientPos, 'id'>): Promise<ClientPos> {
    const list = await this.getClientPosList();
    const newPos: ClientPos = {
      id: crypto.randomUUID(),
      clientId: pos.clientId || `client-${Date.now().toString(36)}`,
      clientName: pos.clientName || 'Nouveau Client',
      posName: pos.posName || 'Nouveau Point de Vente',
      address: pos.address || '',
      phone: pos.phone || '',
      ice: pos.ice || '',
      patente: pos.patente || '',
      lat: typeof pos.lat === 'number' && !isNaN(pos.lat) && isFinite(pos.lat) ? pos.lat : 33.593,
      lng: typeof pos.lng === 'number' && !isNaN(pos.lng) && isFinite(pos.lng) ? pos.lng : -7.648,
      circuitName: pos.circuitName || 'Circuit Principal',
      assignedDriverId: pos.assignedDriverId ? String(pos.assignedDriverId) : undefined,
      assignedDriverName: pos.assignedDriverName ? String(pos.assignedDriverName) : undefined,
      lastDeliveryDriver: pos.lastDeliveryDriver || pos.assignedDriverName || undefined,
    };
    list.push(newPos);
    await this.saveAllClientPos(list);

    // If an assigned driver was specified, link this new POS to any active tournée for this driver
    if (newPos.assignedDriverName || newPos.assignedDriverId) {
      try {
        const tournees = await this.getTournees();
        const targetName = (newPos.assignedDriverName || '').trim().toLowerCase();
        const targetId = (newPos.assignedDriverId || '').trim().toLowerCase();

        let modified = false;
        const updatedTournees = tournees.map(t => {
          if (t.status !== 'en_cours') return t;
          const tDriverId = String(t.driverId || '').trim().toLowerCase();
          const tDriverName = String(t.driverName || '').trim().toLowerCase();

          const matches = (targetId && (tDriverId === targetId || tDriverName === targetId)) ||
                          (targetName && (tDriverName === targetName || tDriverName.includes(targetName) || targetName.includes(tDriverName)));

          if (!matches) return t;

          // Check if already in stops
          const already = (t.stops || []).some(s => s.clientId === newPos.clientId || s.id === newPos.id);
          if (already) return t;

          modified = true;
          const newStop: TourneeStop = {
            id: crypto.randomUUID(),
            tourneeId: t.id,
            clientId: newPos.clientId,
            clientName: newPos.clientName,
            posName: newPos.posName,
            ice: newPos.ice,
            patente: newPos.patente,
            lat: newPos.lat,
            lng: newPos.lng,
            status: 'en_attente',
            sequenceOrder: (t.stops || []).length + 1,
            deliveredItems: [],
            collectedEmpty: [],
            paymentMethod: 'cash',
            amountPaid: 0,
            amountDebt: 0,
          };

          return {
            ...t,
            stops: [...(t.stops || []), newStop],
          };
        });

        if (modified) {
          await this.saveAllTournees(updatedTournees);
        }
      } catch (e) {
        console.warn('Auto add new POS to active tournee notice:', e);
      }
    }

    return newPos;
  },

  async updateClientPosGps(clientId: any, lat: number, lng: number, posName?: string): Promise<ClientPos> {
    const list = await this.getClientPosList();
    const cleanClientId = typeof clientId === 'string'
      ? (clientId.includes('[object') ? `client-${Math.random().toString(36).slice(2, 7)}` : clientId)
      : (clientId && typeof clientId === 'object' && ('id' in clientId || 'clientId' in clientId)
          ? String((clientId as any).id || (clientId as any).clientId)
          : `client-${Date.now().toString(36)}`);

    const index = list.findIndex(p => p.clientId === cleanClientId || p.id === cleanClientId);
    const safeLat = typeof lat === 'number' && !isNaN(lat) && isFinite(lat) ? lat : 33.593;
    const safeLng = typeof lng === 'number' && !isNaN(lng) && isFinite(lng) ? lng : -7.648;
    let updatedPos: ClientPos;

    if (index >= 0) {
      updatedPos = {
        ...list[index],
        lat: safeLat,
        lng: safeLng,
        posName: posName || list[index].posName,
      };
      list[index] = updatedPos;
    } else {
      updatedPos = {
        id: crypto.randomUUID(),
        clientId: cleanClientId,
        clientName: `Client #${cleanClientId}`,
        posName: (typeof posName === 'string' && posName.trim()) ? posName : `Point de Vente #${cleanClientId}`,
        lat: safeLat,
        lng: safeLng,
      };
      list.push(updatedPos);
    }

    await this.saveAllClientPos(list);
    return updatedPos;
  },

  async deleteClientPos(posId: string): Promise<boolean> {
    const list = await this.getClientPosList();
    const targetPos = list.find(p => p.id === posId || p.clientId === posId);
    const filtered = list.filter(p => p.id !== posId && p.clientId !== posId);
    await this.saveAllClientPos(filtered);

    // ALSO immediately purge all occurrences of this POS from ALL tournees!
    try {
      const tournees = await this.getTournees();
      let modified = false;
      const updatedTournees = tournees.map(t => {
        const originalLen = (t.stops || []).length;
        const remainingStops = (t.stops || []).filter(s => {
          if (s.id === posId) return false;
          if (targetPos) {
            if (s.clientId && (s.clientId === targetPos.clientId || s.clientId === targetPos.id)) return false;
            if (s.posName && targetPos.posName && s.posName.trim().toLowerCase() === targetPos.posName.trim().toLowerCase()) return false;
            if (typeof s.lat === 'number' && typeof targetPos.lat === 'number' && typeof s.lng === 'number' && typeof targetPos.lng === 'number') {
              if (Math.abs(s.lat - targetPos.lat) < 0.0005 && Math.abs(s.lng - targetPos.lng) < 0.0005) return false;
            }
          }
          return true;
        });

        if (remainingStops.length !== originalLen) {
          modified = true;
          return {
            ...t,
            stops: remainingStops.map((st, idx) => ({ ...st, sequenceOrder: idx + 1 })),
          };
        }
        return t;
      });

      if (modified) {
        await this.saveAllTournees(updatedTournees);
      }
    } catch (e) {
      console.warn('Error purging deleted POS from tournees:', e);
    }

    return true;
  },

  async deleteAllClientPos(): Promise<boolean> {
    try {
      await this.saveAllClientPos([]);

      // Also purge all stops from all active tournees
      const tournees = await this.getTournees();
      let modified = false;
      const updatedTournees = tournees.map(t => {
        const remainingStops = (t.stops || []).filter(s => s.status === 'livre');
        if (remainingStops.length !== (t.stops || []).length) {
          modified = true;
          return {
            ...t,
            stops: remainingStops.map((st, idx) => ({ ...st, sequenceOrder: idx + 1 })),
          };
        }
        return t;
      });

      if (modified) {
        await this.saveAllTournees(updatedTournees);
      }
    } catch (e) {
      console.warn('Error deleting all client POS:', e);
    }
    return true;
  },

  async syncTourneesWithClientPos(): Promise<void> {
    try {
      const posList = await this.getClientPosList();
      const tournees = await this.getTournees();
      if (!posList) return;

      const validIds = new Set<string>();
      const validNames = new Set<string>();

      posList.forEach(p => {
        if (p.id) validIds.add(String(p.id).toLowerCase());
        if (p.clientId) validIds.add(String(p.clientId).toLowerCase());
        if (p.posName) validNames.add(String(p.posName).trim().toLowerCase());
      });

      let modified = false;
      const updatedTournees = tournees.map(t => {
        if (t.status !== 'en_cours') return t;
        const originalLen = (t.stops || []).length;
        const remainingStops = (t.stops || []).filter(s => {
          if (s.status === 'livre') return true; // Keep already delivered stops in history
          const sId = String(s.id || '').toLowerCase();
          const sClientId = String(s.clientId || '').toLowerCase();
          const sPosName = String(s.posName || '').trim().toLowerCase();
          const sLat = Number(s.lat);
          const sLng = Number(s.lng);

          const exists = validIds.has(sId) || 
                         validIds.has(sClientId) || 
                         validNames.has(sPosName) ||
                         posList.some(p => Math.abs(p.lat - sLat) < 0.0005 && Math.abs(p.lng - sLng) < 0.0005);
          return exists;
        });

        if (remainingStops.length !== originalLen) {
          modified = true;
          return {
            ...t,
            stops: remainingStops.map((st, idx) => ({ ...st, sequenceOrder: idx + 1 })),
          };
        }
        return t;
      });

      if (modified) {
        await this.saveAllTournees(updatedTournees);
      }
    } catch (e) {
      console.warn('Sync tournees with clientPos notice:', e);
    }
  },

  async get48hDeliveryAlerts(driverId?: string): Promise<Delivery48hAlert[]> {
    const posList = await this.getClientPosList();
    const tournees = await this.getTournees();
    const now = Date.now();
    const FORTY_EIGHT_HOURS_MS = 48 * 3600 * 1000;

    const alerts: Delivery48hAlert[] = [];

    for (const pos of posList) {
      let lastTime = pos.lastDeliveryTime ? new Date(pos.lastDeliveryTime).getTime() : 0;
      let lastDriver = pos.lastDeliveryDriver || '';

      // Fallback check against tournees
      if (!lastTime) {
        tournees.forEach(t => {
          (t.stops || []).forEach(s => {
            if ((s.clientId === pos.clientId || s.posName === pos.posName) && s.status === 'livre' && s.deliveryTime) {
              const dt = new Date(s.deliveryTime).getTime();
              if (dt > lastTime) {
                lastTime = dt;
                lastDriver = t.driverName;
              }
            }
          });
        });
      }

      // Default baseline for unsupplied legacy points
      if (!lastTime) {
        lastTime = now - (54 * 3600 * 1000);
      }

      const diffMs = now - lastTime;
      if (diffMs >= FORTY_EIGHT_HOURS_MS) {
        const hours = Math.floor(diffMs / (3600 * 1000));
        alerts.push({
          posId: pos.id,
          clientId: pos.clientId,
          posName: pos.posName,
          clientName: pos.clientName,
          phone: pos.phone,
          address: pos.address,
          lat: pos.lat,
          lng: pos.lng,
          circuitName: pos.circuitName,
          hoursSinceLastDelivery: hours,
          lastDeliveryTime: new Date(lastTime).toISOString(),
          lastDeliveryDriver: lastDriver,
        });
      }
    }

    alerts.sort((a, b) => b.hoursSinceLastDelivery - a.hoursSinceLastDelivery);
    return alerts;
  },

  // ==========================================
  // 3. TOURNÉES & BONS DE SORTIE WORKFLOW
  // ==========================================
  sanitizeTournees(list: Tournee[]): Tournee[] {
    if (!Array.isArray(list)) return [];
    return list.map(t => ({
      ...t,
      id: String(t.id || ''),
      driverId: String(t.driverId || ''),
      driverName: String(t.driverName || 'Chauffeur'),
      supplyOrderNumber: String(t.supplyOrderNumber || t.tourneeNumber || ''),
      tourneeNumber: String(t.tourneeNumber || ''),
      status: (t.status || 'en_cours') as any,
      initialLoad: Array.isArray(t.initialLoad) ? t.initialLoad : [],
      remainingLoad: Array.isArray(t.remainingLoad) ? t.remainingLoad : [],
      totalDeliveredFull: Number(t.totalDeliveredFull || 0),
      totalCollectedEmpty: Number(t.totalCollectedEmpty || 0),
      totalSalesAmount: Number(t.totalSalesAmount || 0),
      totalCashCollected: Number(t.totalCashCollected || 0),
      totalCreditDebt: Number(t.totalCreditDebt || 0),
      stops: (t.stops || []).map((s, idx) => ({
        ...s,
        id: String(s.id || `stop-${idx}`),
        tourneeId: String(t.id),
        clientId: String(s.clientId || `client-${idx}`),
        clientName: typeof s.clientName === 'string' && !s.clientName.includes('[object') ? s.clientName : `Client #${idx + 1}`,
        posName: typeof s.posName === 'string' && !s.posName.includes('[object') ? s.posName : `Point de Vente #${idx + 1}`,
        lat: typeof s.lat === 'number' && !isNaN(s.lat) && isFinite(s.lat) ? s.lat : 33.593 + (idx * 0.005),
        lng: typeof s.lng === 'number' && !isNaN(s.lng) && isFinite(s.lng) ? s.lng : -7.648 + (idx * 0.005),
        status: (s.status || 'en_attente') as any,
        sequenceOrder: Number(s.sequenceOrder || idx + 1),
        deliveredItems: Array.isArray(s.deliveredItems) ? s.deliveredItems : [],
        collectedEmpty: Array.isArray(s.collectedEmpty) ? s.collectedEmpty : [],
        amountPaid: Number(s.amountPaid || 0),
        amountDebt: Number(s.amountDebt || 0),
      })),
    }));
  },

  async saveAllTournees(list: Tournee[]): Promise<Tournee[]> {
    const sanitized = this.sanitizeTournees(list);

    // 1. Local cache
    try {
      localStorage.setItem(TOURNEES_KEY, JSON.stringify(sanitized));
    } catch {}

    // 2. Persist to Supabase Cloud (pricing_settings -> SYS_TOURNEES_V2)
    try {
      const { data: existingRows } = await supabase
        .from('pricing_settings')
        .select('id')
        .eq('code', CLOUD_TOURNEES_CODE)
        .order('updated_at', { ascending: false });

      const payload = {
        code: CLOUD_TOURNEES_CODE,
        designation: 'SFT Tournées Cloud Storage',
        prix_unitaire: 0,
        prix_achat: 0,
        zone: 0,
        pricing_data: sanitized,
        updated_at: new Date().toISOString()
      };

      if (existingRows && existingRows.length > 0) {
        await supabase
          .from('pricing_settings')
          .update(payload)
          .eq('id', existingRows[0].id);

        if (existingRows.length > 1) {
          const toRemove = existingRows.slice(1).map(r => r.id);
          await supabase.from('pricing_settings').delete().in('id', toRemove);
        }
      } else {
        await supabase
          .from('pricing_settings')
          .insert(payload);
      }
    } catch (err) {
      console.warn('[POS] Failed to save tournees to Supabase pricing_settings:', err);
    }

    // 3. Backup to app_state
    try {
      await kvSetShared(TOURNEES_KEY, sanitized);
    } catch {}

    // 4. Dispatch live update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sft-tournees-changed', { detail: sanitized }));
    }

    return sanitized;
  },

  async getTournees(): Promise<Tournee[]> {
    let cloudList: Tournee[] = [];

    // 1. Primary: Load directly from Supabase Cloud table pricing_settings
    try {
      const { data, error } = await supabase
        .from('pricing_settings')
        .select('pricing_data')
        .eq('code', CLOUD_TOURNEES_CODE)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        let raw = data[0].pricing_data;
        if (typeof raw === 'string') {
          try { raw = JSON.parse(raw); } catch {}
        }
        if (Array.isArray(raw)) {
          cloudList = raw as Tournee[];
        }
      }
    } catch (err) {
      console.warn('[POS] Supabase tournees load notice:', err);
    }

    // 2. Fallback: app_state
    if (cloudList.length === 0) {
      try {
        const cloud = await kvGetShared<Tournee[]>(TOURNEES_KEY);
        if (cloud && Array.isArray(cloud) && cloud.length > 0) {
          cloudList = cloud;
        }
      } catch {}
    }

    // 3. Fallback: localStorage
    let localList: Tournee[] = [];
    try {
      const local = localStorage.getItem(TOURNEES_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localList = parsed;
        }
      }
    } catch {}

    // Merge cloud and local
    const map = new Map<string, Tournee>();
    for (const c of cloudList) {
      if (c?.id) map.set(c.id, c);
    }
    for (const l of localList) {
      if (l?.id && !map.has(l.id)) {
        map.set(l.id, l);
      }
    }

    const merged = Array.from(map.values());
    if (merged.length > 0) {
      try { localStorage.setItem(TOURNEES_KEY, JSON.stringify(merged)); } catch {}
      if (merged.length > cloudList.length) {
        this.saveAllTournees(merged).catch(() => {});
      }
      return this.sanitizeTournees(merged);
    }

    return [];
  },

  async updateDriverLiveGps(driverId: string, coords: [number, number]): Promise<void> {
    if (!driverId || !Array.isArray(coords)) return;
    try {
      const current = (await kvGetShared<Record<string, { lat: number; lng: number; updatedAt: string }>>('sft_driver_live_gps')) || {};
      current[driverId] = {
        lat: coords[0],
        lng: coords[1],
        updatedAt: new Date().toISOString(),
      };
      await kvSetShared('sft_driver_live_gps', current);
      localStorage.setItem('sft_driver_live_gps', JSON.stringify(current));
    } catch {}
  },

  async getAllDriverLiveGps(): Promise<Record<string, { lat: number; lng: number; updatedAt: string }>> {
    try {
      const cloud = await kvGetShared<Record<string, { lat: number; lng: number; updatedAt: string }>>('sft_driver_live_gps');
      if (cloud && typeof cloud === 'object') return cloud;
    } catch {}
    try {
      const local = localStorage.getItem('sft_driver_live_gps');
      if (local) return JSON.parse(local);
    } catch {}
    return {};
  },

  async getTourneeById(id: string): Promise<Tournee | null> {
    const list = await this.getTournees();
    const tour = list.find(t => t.id === id || t.tourneeNumber === id) || null;
    if (tour && (!tour.stops || tour.stops.length === 0)) {
      tour.stops = await this.getStopsForTournee(tour.id);
    }
    return tour;
  },

  async getStopsForTournee(tourneeId: string): Promise<TourneeStop[]> {
    try {
      const { data, error } = await supabase
        .from('tournee_stops')
        .select('*')
        .eq('tournee_id', tourneeId)
        .order('sequence_order', { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((s: any) => ({
          id: String(s.id),
          tourneeId: String(s.tournee_id || tourneeId),
          clientId: String(s.client_id || ''),
          clientName: s.client_name || 'Client',
          posName: s.pos_name,
          lat: typeof s.lat === 'number' && !isNaN(s.lat) && isFinite(s.lat) ? s.lat : (Number(s.lat) || 33.593),
          lng: typeof s.lng === 'number' && !isNaN(s.lng) && isFinite(s.lng) ? s.lng : (Number(s.lng) || -7.648),
          status: s.status || 'en_attente',
          sequenceOrder: Number(s.sequence_order || 1),
          deliveredItems: Array.isArray(s.delivered_items) ? s.delivered_items : [],
          collectedEmpty: Array.isArray(s.collected_empty) ? s.collected_empty : [],
          defectiveItems: Array.isArray(s.defective_items) ? s.defective_items : [],
          foreignItems: Array.isArray(s.foreign_items) ? s.foreign_items : [],
          purchasedItems: Array.isArray(s.purchased_items) ? s.purchased_items : [],
          paymentMethod: s.payment_method || 'cash',
          amountPaid: Number(s.amount_paid || 0),
          amountDebt: Number(s.amount_debt || 0),
          deliveredAt: s.delivered_at || s.delivery_time,
          deliveryTime: s.delivery_time || s.delivered_at,
          notes: s.notes,
        }));
      }
    } catch {}

    // Fallback to local storage
    try {
      const list = await this.getTournees();
      const tour = list.find(t => t.id === tourneeId);
      if (tour?.stops && tour.stops.length > 0) {
        return tour.stops.map((s, idx) => ({
          ...s,
          lat: typeof s.lat === 'number' && !isNaN(s.lat) && isFinite(s.lat) ? s.lat : 33.593 + (idx * 0.005),
          lng: typeof s.lng === 'number' && !isNaN(s.lng) && isFinite(s.lng) ? s.lng : -7.648 + (idx * 0.005),
        }));
      }
    } catch {}

    return [];
  },

  async getActiveBonsDeSortie(driverId?: string): Promise<any[]> {
    try {
      // 1. Fetch from Supabase supply_orders
      const { data, error } = await supabase
        .from('supply_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      let list: any[] = [];
      if (!error && data && data.length > 0) {
        list = data.map((row: any) => ({
          ...row,
          id: String(row.id || ''),
          order_number: row.order_number || row.ordernumber || row.orderNumber || row.id,
          orderNumber: row.order_number || row.ordernumber || row.orderNumber || row.id,
          driver_id: row.driver_id || row.driverid || row.driverId || '',
          driverId: row.driver_id || row.driverid || row.driverId || '',
          driver_name: row.driver_name || row.drivername || row.driverName || 'Chauffeur',
          driverName: row.driver_name || row.drivername || row.driverName || 'Chauffeur',
          truck_id: row.truck_id || row.truckid || row.truckId,
          items: Array.isArray(row.items)
            ? row.items
            : (typeof row.items === 'string' ? JSON.parse(row.items) : []),
          created_at: row.created_at || row.date || new Date().toISOString(),
        }));
      }

      // 2. Fetch from shared cloud storage (app_state KV) - ensures instant sync across Web and Android
      try {
        const sharedOrders = await kvGetShared<any[]>('shared_supply_orders');
        if (Array.isArray(sharedOrders) && sharedOrders.length > 0) {
          for (const order of sharedOrders) {
            const ordNum = order.orderNumber || order.order_number || order.ordernumber || order.id;
            if (!list.some(existing => (existing.order_number || existing.id) === ordNum)) {
              list.push({
                ...order,
                id: String(order.id || ordNum),
                order_number: ordNum,
                orderNumber: ordNum,
                driver_id: order.driverId || order.driver_id || '',
                driverId: order.driverId || order.driver_id || '',
                driver_name: order.driverName || order.driver_name || 'Chauffeur',
                driverName: order.driverName || order.driver_name || 'Chauffeur',
                truck_id: order.truckId || order.truck_id,
                items: Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items) : []),
                created_at: order.createdAt || order.date || new Date().toISOString(),
              });
            }
          }
        }
      } catch (sharedErr) {
        console.warn('[POS] Shared supply orders read notice:', sharedErr);
      }

      // 3. Fallback / Merge with local storage
      try {
        const localKeys = ['sft_supply_orders', 'supply_orders', 'sft_gaz_supply_orders'];
        for (const k of localKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const p of parsed) {
                const pNum = p.order_number || p.ordernumber || p.orderNumber || p.id;
                if (!list.some(existing => (existing.order_number || existing.id) === pNum)) {
                  list.push({
                    ...p,
                    order_number: pNum,
                    orderNumber: pNum,
                    driver_id: p.driver_id || p.driverId || '',
                    driver_name: p.driver_name || p.driverName || 'Chauffeur',
                    items: Array.isArray(p.items) ? p.items : (typeof p.items === 'string' ? JSON.parse(p.items) : []),
                  });
                }
              }
            }
          }
        }
      } catch (localErr) {
        console.warn('[POS] Local supply orders read notice:', localErr);
      }

      if (driverId) {
        return list.filter((b) => String(b.driver_id || b.driverId || '') === String(driverId));
      }
      return list;
    } catch (e) {
      console.warn('[POS] Error getting active bons de sortie:', e);
      return [];
    }
  },

  async addStopToTournee(
    tourneeId: string,
    stopData: {
      clientId: any;
      clientName: any;
      posName?: any;
      ice?: string;
      patente?: string;
      lat: number;
      lng: number;
    }
  ): Promise<TourneeStop> {
    const tournee = await this.getTourneeById(tourneeId);
    if (!tournee) throw new Error('Tournée introuvable');

    let cleanClientId = stopData.clientId;
    if (typeof cleanClientId === 'object') {
      cleanClientId = cleanClientId?.id || cleanClientId?.clientId || `client-${Date.now().toString(36)}`;
    }
    cleanClientId = String(cleanClientId || `client-${Date.now().toString(36)}`);
    if (cleanClientId.includes('[object')) cleanClientId = `client-${Math.random().toString(36).slice(2, 7)}`;

    let cleanClientName = stopData.clientName;
    if (typeof cleanClientName === 'object') {
      cleanClientName = cleanClientName?.name || cleanClientName?.clientName || '';
    }
    cleanClientName = String(cleanClientName || '').trim();
    if (!cleanClientName || cleanClientName.includes('[object') || cleanClientName.includes('undefined')) {
      cleanClientName = `Client #${(tournee.stops?.length || 0) + 1}`;
    }

    let cleanPosName = stopData.posName;
    if (typeof cleanPosName === 'object') {
      cleanPosName = cleanPosName?.posName || cleanPosName?.name || '';
    }
    cleanPosName = String(cleanPosName || '').trim();
    if (!cleanPosName || cleanPosName.includes('[object') || cleanPosName.includes('undefined')) {
      cleanPosName = `Point de Vente #${(tournee.stops?.length || 0) + 1}`;
    }

    const safeLat = typeof stopData.lat === 'number' && !isNaN(stopData.lat) && isFinite(stopData.lat) ? stopData.lat : 33.593;
    const safeLng = typeof stopData.lng === 'number' && !isNaN(stopData.lng) && isFinite(stopData.lng) ? stopData.lng : -7.648;

    const newStop: TourneeStop = {
      id: crypto.randomUUID(),
      tourneeId,
      clientId: cleanClientId,
      clientName: cleanClientName,
      posName: cleanPosName,
      ice: stopData.ice || '',
      patente: stopData.patente || '',
      lat: safeLat,
      lng: safeLng,
      status: 'en_attente',
      sequenceOrder: (tournee.stops?.length || 0) + 1,
      deliveredItems: [],
      collectedEmpty: [],
      paymentMethod: 'cash',
      amountPaid: 0,
      amountDebt: 0,
    };

    tournee.stops = [...(tournee.stops || []), newStop];

    try {
      await supabase.from('tournee_stops').insert({
        id: newStop.id,
        tournee_id: newStop.tourneeId,
        client_id: newStop.clientId,
        client_name: newStop.clientName,
        pos_name: newStop.posName,
        lat: newStop.lat,
        lng: newStop.lng,
        status: newStop.status,
        sequence_order: newStop.sequenceOrder,
      });
    } catch (e) {
      console.warn('[POS] Supabase save stop notice:', e);
    }

    const existing = await this.getTournees();
    const updated = existing.map(t => t.id === tourneeId ? tournee : t);
    await this.saveAllTournees(updated);

    return newStop;
  },

  async getActiveTourneeForDriver(driverId: string): Promise<Tournee | null> {
    const list = await this.getTournees();
    let tour = list.find(t => (t.driverId === driverId || !driverId) && t.status === 'en_cours') || null;
    if (tour) {
      if (!tour.stops || tour.stops.length === 0) {
        tour.stops = await this.getStopsForTournee(tour.id);
      }
      return tour;
    }

    // Auto-discover active Supply Order (Bon de Sortie) strictly for this driver from Supabase
    try {
      if (driverId) {
        const { data: supplyOrders } = await supabase
          .from('supply_orders')
          .select('*')
          .eq('driver_id', driverId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (supplyOrders && supplyOrders.length > 0) {
          const match = supplyOrders.find((so: any) => {
            const raw = Array.isArray(so.items) ? so.items : (typeof so.items === 'string' ? JSON.parse(so.items) : []);
            return Array.isArray(raw) && raw.length > 0;
          });

          if (match) {
            const createdTour = await this.createTourneeFromSupplyOrder(match);
            return createdTour;
          }
        }
      }
    } catch (e) {
      console.warn('[POS] Auto-discover supply order notice:', e);
    }

    return null;
  },

  async getClosedTourneeForSupplyOrder(supplyOrderIdOrNumber: string): Promise<Tournee | null> {
    const list = await this.getTournees();
    let match = list.find(t => 
      (t.supplyOrderId === supplyOrderIdOrNumber || t.supplyOrderNumber === supplyOrderIdOrNumber) &&
      (t.status === 'cloturee' || t.status === 'validee_retour')
    );
    if (!match) {
      match = list.find(t => 
        (t.supplyOrderId === supplyOrderIdOrNumber || t.supplyOrderNumber === supplyOrderIdOrNumber)
      );
    }
    if (match) {
      if (!match.stops || match.stops.length === 0) {
        match.stops = await this.getStopsForTournee(match.id);
      }
      return match;
    }
    return null;
  },

  async createTourneeFromSupplyOrder(
    supplyOrder: any,
    clientPosList?: ClientPos[]
  ): Promise<Tournee> {
    const tourneeId = crypto.randomUUID();
    const orderNum = supplyOrder.orderNumber || supplyOrder.order_number || Date.now();
    const tourneeNum = `TRN-${orderNum}`;

    // Extract initial load from Bon de Sortie items
    const rawItems = Array.isArray(supplyOrder.items)
      ? supplyOrder.items
      : (typeof supplyOrder.items === 'string' ? JSON.parse(supplyOrder.items) : []);

    const initialLoad: TourneeItem[] = rawItems.map((item: any) => ({
      bottleTypeId: item.bottleTypeId || item.id || `btle-${Math.random().toString(36).slice(2)}`,
      bottleTypeName: item.bottleTypeName || item.name || item.type || 'Bouteille Gaz',
      quantity: Number(item.fullQuantity ?? item.quantity ?? item.quantityFull ?? item.qte ?? 0),
      unitPrice: Number(item.unitPrice ?? item.price ?? 0),
    })).filter((it: any) => it.quantity > 0 || rawItems.length <= 1);

    // Generate initial stops based on assigned client points of sale
    const defaultStops = (clientPosList || await this.getClientPosList()).map((pos, idx) => {
      const cleanClientId = typeof pos.clientId === 'string' && !pos.clientId.includes('[object')
        ? pos.clientId
        : `client-${idx + 1}`;
      const cleanClientName = typeof pos.clientName === 'string' && !pos.clientName.includes('[object')
        ? pos.clientName
        : `Client #${idx + 1}`;
      const cleanPosName = typeof pos.posName === 'string' && !pos.posName.includes('[object')
        ? pos.posName
        : `Point de Vente #${idx + 1}`;
      return {
        id: crypto.randomUUID(),
        tourneeId,
        clientId: cleanClientId,
        clientName: cleanClientName,
        posName: cleanPosName,
        lat: typeof pos.lat === 'number' && !isNaN(pos.lat) && isFinite(pos.lat) ? pos.lat : 33.593 + (idx * 0.005),
        lng: typeof pos.lng === 'number' && !isNaN(pos.lng) && isFinite(pos.lng) ? pos.lng : -7.648 + (idx * 0.005),
        status: 'en_attente' as const,
        sequenceOrder: idx + 1,
        deliveredItems: [],
        collectedEmpty: [],
        paymentMethod: 'cash' as const,
        amountPaid: 0,
        amountDebt: 0,
      };
    });

    const newTournee: Tournee = {
      id: tourneeId,
      tourneeNumber: tourneeNum,
      driverId: String(supplyOrder.driverId || supplyOrder.driver_id || ''),
      driverName: String(supplyOrder.driverName || supplyOrder.driver_name || 'Chauffeur'),
      truckId: supplyOrder.truckId || supplyOrder.truck_id,
      supplyOrderId: String(supplyOrder.id || ''),
      supplyOrderNumber: String(orderNum),
      status: 'en_cours',
      startTime: new Date().toISOString(),
      initialLoad,
      remainingLoad: JSON.parse(JSON.stringify(initialLoad)),
      totalDeliveredFull: 0,
      totalCollectedEmpty: 0,
      totalSalesAmount: 0,
      totalCashCollected: 0,
      totalCreditDebt: 0,
      stops: defaultStops,
      createdAt: new Date().toISOString(),
    };

    // Save to Supabase
    try {
      await supabase.from('tournees').insert({
        id: newTournee.id,
        tournee_number: newTournee.tourneeNumber,
        driver_id: newTournee.driverId,
        driver_name: newTournee.driverName,
        truck_id: newTournee.truckId,
        supply_order_id: newTournee.supplyOrderId,
        supply_order_number: newTournee.supplyOrderNumber,
        status: newTournee.status,
        start_time: newTournee.startTime,
        initial_load: newTournee.initialLoad,
        remaining_load: newTournee.remainingLoad,
      });

      // Insert initial stops
      if (defaultStops.length > 0) {
        await supabase.from('tournee_stops').insert(
          defaultStops.map(s => ({
            id: s.id,
            tournee_id: s.tourneeId,
            client_id: s.clientId,
            client_name: s.clientName,
            pos_name: s.posName,
            lat: s.lat,
            lng: s.lng,
            status: s.status,
            sequence_order: s.sequenceOrder,
          }))
        );
      }
    } catch {}

    // Save to Supabase Cloud & cache
    const existing = await this.getTournees();
    const updated = [newTournee, ...existing];
    await this.saveAllTournees(updated);

    return newTournee;
  },

  async recordDeliveryStop(
    tourneeId: string,
    stopData: {
      stopId?: string;
      clientId: string;
      clientName: string;
      posName?: string;
      lat: number;
      lng: number;
      deliveredItems: TourneeDeliveredItem[];
      collectedEmpty: TourneeCollectedItem[];
      defectiveItems?: Array<{ bottleTypeId: string; bottleTypeName: string; quantity: number; code?: string }>;
      foreignItems?: Array<{ bottleTypeId: string; bottleTypeName: string; quantity: number; code?: string }>;
      purchasedItems?: Array<{ bottleTypeId: string; bottleTypeName: string; quantity: number; unitPrice?: number; code?: string }>;
      paymentMethod: 'cash' | 'credit' | 'cheque';
      amountPaid: number;
      amountDebt: number;
      notes?: string;
    }
  ): Promise<Tournee> {
    const tournee = await this.getTourneeById(tourneeId);
    if (!tournee) throw new Error('Tournée introuvable');

    const totalDeliveredInStop = stopData.deliveredItems.reduce((acc, it) => acc + it.quantityFull, 0);
    const totalCollectedInStop = stopData.collectedEmpty.reduce((acc, it) => acc + it.quantityEmpty, 0);
    const totalStopAmount = stopData.deliveredItems.reduce((acc, it) => acc + it.total, 0);

    // Update remaining truck stock
    const nextRemaining = tournee.remainingLoad.map(loadItem => {
      const delivered = stopData.deliveredItems.find(d => d.bottleTypeId === loadItem.bottleTypeId);
      if (delivered) {
        return {
          ...loadItem,
          quantity: Math.max(0, loadItem.quantity - delivered.quantityFull),
        };
      }
      return loadItem;
    });

    const stopId = stopData.stopId || crypto.randomUUID();
    const completedStop: TourneeStop = {
      id: stopId,
      tourneeId,
      clientId: stopData.clientId,
      clientName: stopData.clientName,
      posName: stopData.posName,
      lat: stopData.lat,
      lng: stopData.lng,
      status: 'livre',
      sequenceOrder: (tournee.stops?.length || 0) + 1,
      deliveredItems: stopData.deliveredItems,
      collectedEmpty: stopData.collectedEmpty,
      defectiveItems: stopData.defectiveItems || [],
      foreignItems: stopData.foreignItems || [],
      purchasedItems: stopData.purchasedItems || [],
      paymentMethod: stopData.paymentMethod,
      amountPaid: stopData.amountPaid,
      amountDebt: stopData.amountDebt,
      deliveryTime: new Date().toISOString(),
      notes: stopData.notes,
    };

    // Update stops array
    const existingStops = tournee.stops || [];
    const stopIdx = existingStops.findIndex(s => s.id === stopId || s.clientId === stopData.clientId);
    const nextStops = stopIdx >= 0 
      ? existingStops.map((s, i) => i === stopIdx ? completedStop : s)
      : [...existingStops, completedStop];

    const updatedTournee: Tournee = {
      ...tournee,
      remainingLoad: nextRemaining,
      totalDeliveredFull: tournee.totalDeliveredFull + totalDeliveredInStop,
      totalCollectedEmpty: tournee.totalCollectedEmpty + totalCollectedInStop,
      totalSalesAmount: tournee.totalSalesAmount + totalStopAmount,
      totalCashCollected: tournee.totalCashCollected + (stopData.amountPaid || 0),
      totalCreditDebt: tournee.totalCreditDebt + (stopData.amountDebt || 0),
      stops: nextStops,
    };

    // Update Supabase
    try {
      await supabase.from('tournees').update({
        remaining_load: updatedTournee.remainingLoad,
        total_delivered_full: updatedTournee.totalDeliveredFull,
        total_collected_empty: updatedTournee.totalCollectedEmpty,
        total_sales_amount: updatedTournee.totalSalesAmount,
        total_cash_collected: updatedTournee.totalCashCollected,
        total_credit_debt: updatedTournee.totalCreditDebt,
        updated_at: new Date().toISOString(),
      }).eq('id', tourneeId);

      await supabase.from('tournee_stops').upsert({
        id: completedStop.id,
        tournee_id: completedStop.tourneeId,
        client_id: completedStop.clientId,
        client_name: completedStop.clientName,
        pos_name: completedStop.posName,
        lat: completedStop.lat,
        lng: completedStop.lng,
        status: completedStop.status,
        delivered_items: completedStop.deliveredItems,
        collected_empty: completedStop.collectedEmpty,
        payment_method: completedStop.paymentMethod,
        amount_paid: completedStop.amountPaid,
        amount_debt: completedStop.amountDebt,
        delivery_time: completedStop.deliveryTime,
        notes: completedStop.notes,
      });
    } catch {}

    // Update locally
    const all = await this.getTournees();
    const nextAll = all.map(t => t.id === tourneeId ? updatedTournee : t);
    await this.saveAllTournees(nextAll);

    // Update client last delivery timestamp to clear 48h alert
    try {
      const posList = await this.getClientPosList();
      const pIdx = posList.findIndex(p => p.clientId === stopData.clientId || p.id === stopData.clientId || p.posName === stopData.posName);
      if (pIdx >= 0) {
        posList[pIdx].lastDeliveryTime = completedStop.deliveryTime;
        posList[pIdx].lastDeliveryDriver = tournee.driverName;
        await this.saveAllClientPos(posList);
      }
    } catch {}

    return updatedTournee;
  },

  async closeTournee(tourneeId: string, notes?: string): Promise<Tournee> {
    const tournee = await this.getTourneeById(tourneeId);
    if (!tournee) throw new Error('Tournée introuvable');

    const closedTournee: Tournee = {
      ...tournee,
      status: 'cloturee',
      endTime: new Date().toISOString(),
      notes: notes || tournee.notes,
    };

    try {
      await supabase.from('tournees').update({
        status: 'cloturee',
        end_time: closedTournee.endTime,
        notes: closedTournee.notes,
        updated_at: new Date().toISOString(),
      }).eq('id', tourneeId);
    } catch {}

    const all = await this.getTournees();
    const nextAll = all.map(t => t.id === tourneeId ? closedTournee : t);
    await this.saveAllTournees(nextAll);

    // Broadcast event for Web App (SupplyReturn auto-fill)
    try {
      window.dispatchEvent(new CustomEvent('tournee_cloturee', { detail: closedTournee }));
    } catch {}

    return closedTournee;
  },

  async markTourneeAsValidatedReturn(tourneeId: string): Promise<void> {
    try {
      await supabase.from('tournees').update({
        status: 'validee_retour',
        updated_at: new Date().toISOString(),
      }).eq('id', tourneeId);
    } catch {}

    const all = await this.getTournees();
    const nextAll = all.map(t => t.id === tourneeId ? { ...t, status: 'validee_retour' as const } : t);
    await this.saveAllTournees(nextAll);
  }
};
