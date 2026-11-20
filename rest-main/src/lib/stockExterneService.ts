import { supabase } from '@/lib/supabaseClient';
import { pointVenteService, ClientPos } from '@/lib/pointVenteService';

export interface ExternalStockInspection {
  id: string;
  date: string; // ISO or YYYY-MM-DD
  driverId: string;
  driverName: string;
  truckPlate?: string;
  pleines: number;
  vides: number;
  etrangeres: number;
  defectueuses: number;
  totalReleve: number;
  ecart: number; // totalReleve - totalInitial
  status: 'conforme' | 'alerte_manquant' | 'surplus';
  notes?: string;
}

export interface ClientExternalStock {
  id: string;
  posId: string;
  clientId: string;
  clientName: string;
  posName: string;
  address?: string;
  phone?: string;
  circuitName?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  truckPlate?: string;
  
  // Storage cage specifications
  cageNumber: string; // e.g., 'CASIER-014'
  cageModel: string; // 'Chariot Grillagé Mobile Bleu 2 Portes'
  cageCapacity: number; // e.g. 20
  
  // Initial allocation (Dotation initiale contractuelle)
  initialAllocation: {
    totalBottles: number; // e.g. 20
    brandName: string; // e.g. 'Afriquia Gaz'
    bottleType: string; // e.g. '12 Kg'
    allocationDate: string;
    depositAmountDh?: number;
  };
  
  // Current live stock state
  currentStock: {
    pleines: number;
    vides: number;
    etrangeres: number;
    defectueuses: number;
    derniereInspectionDate: string;
    dernierInspecteur: string;
  };
  
  // Inspection audit history
  inspections: ExternalStockInspection[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'sft_stock_externe_v1';
const CLOUD_CODE = 'SYS_STOCK_EXTERNE_V1';

export const stockExterneService = {
  /**
   * Load all external stocks.
   * If not found, initializes from existing Client POS list with default allocations.
   */
  async getAllStocks(): Promise<ClientExternalStock[]> {
    let list: ClientExternalStock[] = [];

    // 1. Try Supabase pricing_settings
    try {
      const { data } = await supabase
        .from('pricing_settings')
        .select('value')
        .eq('code', CLOUD_CODE)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (data && data[0]?.value) {
        const parsed = typeof data[0].value === 'string' ? JSON.parse(data[0].value) : data[0].value;
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      }
    } catch (err) {
      console.warn('[StockExterne] Supabase fetch error:', err);
    }

    // 2. Fallback to localStorage
    if (list.length === 0) {
      try {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
          }
        }
      } catch {}
    }

    // 3. Sync with current POS list to ensure every POS has an external stock cage
    const posList = await pointVenteService.getClientPosList();
    let hasChanges = false;

    if (list.length === 0) {
      // Seed initial from POS
      list = this.generateSeedStocks(posList);
      hasChanges = true;
    } else {
      // Add any new POS not yet in external stocks
      posList.forEach((pos, idx) => {
        const exists = list.some((s) => s.posId === pos.id || s.clientId === pos.clientId);
        if (!exists) {
          list.push(this.createSingleStock(pos, idx + 1));
          hasChanges = true;
        }
      });

      // Update driver names or pos names if changed in POS
      list = list.map((s) => {
        const matchingPos = posList.find((p) => p.id === s.posId || p.clientId === s.clientId);
        if (matchingPos) {
          return {
            ...s,
            posName: matchingPos.posName || s.posName,
            clientName: matchingPos.clientName || s.clientName,
            address: matchingPos.address || s.address,
            phone: matchingPos.phone || s.phone,
            assignedDriverId: matchingPos.assignedDriverId || s.assignedDriverId,
            assignedDriverName: matchingPos.assignedDriverName || matchingPos.lastDeliveryDriver || s.assignedDriverName,
          };
        }
        return s;
      });
    }

    if (hasChanges) {
      await this.saveAllStocks(list);
    }

    return list;
  },

  /**
   * Save all external stocks to localStorage and Supabase Cloud
   */
  async saveAllStocks(list: ClientExternalStock[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}

    try {
      const { data: existingRows } = await supabase
        .from('pricing_settings')
        .select('id')
        .eq('code', CLOUD_CODE);

      if (existingRows && existingRows.length > 0) {
        await supabase
          .from('pricing_settings')
          .update({
            value: JSON.stringify(list),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRows[0].id);
      } else {
        await supabase.from('pricing_settings').insert({
          code: CLOUD_CODE,
          name: 'Gestion Stock Externe Sièges POS',
          value: JSON.stringify(list),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('[StockExterne] Supabase save error:', err);
    }
  },

  /**
   * Update or record a monthly inspection for a specific point de vente
   */
  async recordInspection(
    stockId: string,
    data: {
      pleines: number;
      vides: number;
      etrangeres: number;
      defectueuses: number;
      driverId: string;
      driverName: string;
      truckPlate?: string;
      notes?: string;
    }
  ): Promise<ClientExternalStock> {
    const list = await this.getAllStocks();
    const idx = list.findIndex((s) => s.id === stockId);
    if (idx === -1) throw new Error('Stock externe introuvable');

    const stock = list[idx];
    const totalReleve = data.pleines + data.vides + data.etrangeres;
    const initialTotal = stock.initialAllocation.totalBottles;
    const ecart = totalReleve - initialTotal;

    let status: 'conforme' | 'alerte_manquant' | 'surplus' = 'conforme';
    if (ecart < 0) status = 'alerte_manquant';
    else if (ecart > 0) status = 'surplus';

    const nowIso = new Date().toISOString();
    const newInspection: ExternalStockInspection = {
      id: `insp-${Date.now()}`,
      date: nowIso.split('T')[0],
      driverId: data.driverId,
      driverName: data.driverName,
      truckPlate: data.truckPlate,
      pleines: data.pleines,
      vides: data.vides,
      etrangeres: data.etrangeres,
      defectueuses: data.defectueuses,
      totalReleve,
      ecart,
      status,
      notes: data.notes,
    };

    const updatedStock: ClientExternalStock = {
      ...stock,
      currentStock: {
        pleines: data.pleines,
        vides: data.vides,
        etrangeres: data.etrangeres,
        defectueuses: data.defectueuses,
        derniereInspectionDate: nowIso,
        dernierInspecteur: data.driverName,
      },
      inspections: [newInspection, ...(stock.inspections || [])],
      updatedAt: nowIso,
    };

    list[idx] = updatedStock;
    await this.saveAllStocks(list);
    return updatedStock;
  },

  /**
   * Update initial allocation settings for a client's cage
   */
  async updateAllocation(
    stockId: string,
    allocation: {
      totalBottles: number;
      brandName: string;
      bottleType: string;
      cageNumber?: string;
      cageCapacity?: number;
      depositAmountDh?: number;
    }
  ): Promise<ClientExternalStock> {
    const list = await this.getAllStocks();
    const idx = list.findIndex((s) => s.id === stockId);
    if (idx === -1) throw new Error('Stock externe introuvable');

    const stock = list[idx];
    const updatedStock: ClientExternalStock = {
      ...stock,
      cageNumber: allocation.cageNumber || stock.cageNumber,
      cageCapacity: allocation.cageCapacity || allocation.totalBottles || stock.cageCapacity,
      initialAllocation: {
        ...stock.initialAllocation,
        totalBottles: allocation.totalBottles,
        brandName: allocation.brandName,
        bottleType: allocation.bottleType,
        depositAmountDh: allocation.depositAmountDh ?? stock.initialAllocation.depositAmountDh,
      },
      updatedAt: new Date().toISOString(),
    };

    list[idx] = updatedStock;
    await this.saveAllStocks(list);
    return updatedStock;
  },

  /**
   * Helper to seed stock records from ClientPos
   */
  generateSeedStocks(posList: ClientPos[]): ClientExternalStock[] {
    return posList.map((pos, idx) => this.createSingleStock(pos, idx + 1));
  },

  createSingleStock(pos: ClientPos, num: number): ClientExternalStock {
    const defaultTotal = 20;
    const defaultPleines = Math.round(defaultTotal * 0.65);
    const defaultVides = Math.round(defaultTotal * 0.30);
    const defaultEtrangeres = defaultTotal - defaultPleines - defaultVides;

    const brand = num % 2 === 0 ? 'Afriquia Gaz' : 'Tissir Gaz';
    const bottleType = '12 Kg';
    const nowIso = new Date().toISOString();

    return {
      id: `ext-stock-${pos.id || num}`,
      posId: pos.id,
      clientId: pos.clientId,
      clientName: pos.clientName,
      posName: pos.posName,
      address: pos.address,
      phone: pos.phone,
      circuitName: pos.circuitName || 'Circuit Casablanca',
      assignedDriverId: pos.assignedDriverId,
      assignedDriverName: pos.assignedDriverName || pos.lastDeliveryDriver || 'OMAR AMRHAR',
      truckPlate: 'Canter 32607 A 57',
      cageNumber: `SIÈGE-${String(num).padStart(3, '0')}`,
      cageModel: 'Chariot Grillagé Mobile Bleu 2 Portes',
      cageCapacity: 20,
      initialAllocation: {
        totalBottles: defaultTotal,
        brandName: brand,
        bottleType,
        allocationDate: '2026-01-15',
        depositAmountDh: defaultTotal * 290,
      },
      currentStock: {
        pleines: defaultPleines,
        vides: defaultVides,
        etrangeres: defaultEtrangeres,
        defectueuses: 0,
        derniereInspectionDate: nowIso,
        dernierInspecteur: pos.assignedDriverName || pos.lastDeliveryDriver || 'OMAR AMRHAR',
      },
      inspections: [
        {
          id: `insp-seed-${num}`,
          date: '2026-10-28',
          driverId: pos.assignedDriverId || 'drv-1',
          driverName: pos.assignedDriverName || pos.lastDeliveryDriver || 'OMAR AMRHAR',
          pleines: defaultPleines,
          vides: defaultVides,
          etrangeres: defaultEtrangeres,
          defectueuses: 0,
          totalReleve: defaultTotal,
          ecart: 0,
          status: 'conforme',
          notes: 'Inventaire mensuel régulier - Casier en parfait état.',
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  },
};
