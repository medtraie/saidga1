import { supabase } from '@/lib/supabaseClient';
import type { PermissionKey } from '@/contexts/AppContext';

export interface CloudProfile {
  id: string;
  email: string;
  roleId: string;
  password?: string;
  customPermissions?: Array<PermissionKey | "*">;
  parentAccountEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'sft_role_assignments_v2';
const CLOUD_SETTING_CODE = 'SYS_ASSIGNED_PROFILES';

export const cloudProfilesService = {
  /**
   * Fetch all assigned profiles from Supabase cloud (with fallback to localStorage).
   */
  async getAllProfiles(): Promise<CloudProfile[]> {
    let cloudList: CloudProfile[] = [];
    try {
      const { data, error } = await supabase
        .from('pricing_settings')
        .select('pricing_data')
        .eq('code', CLOUD_SETTING_CODE)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        let raw = data[0].pricing_data;
        if (typeof raw === 'string') {
          try {
            raw = JSON.parse(raw);
          } catch {}
        }
        if (Array.isArray(raw)) {
          cloudList = raw as CloudProfile[];
        }
      }
    } catch (err) {
      console.warn('Failed to load profiles from cloud:', err);
    }

    // Merge with localStorage
    let localList: CloudProfile[] = [];
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          localList = parsed;
        }
      }
    } catch {}

    const map = new Map<string, CloudProfile>();

    // 1. Primary: Cloud list
    for (const c of cloudList) {
      if (c?.email) {
        const key = String(c.email).trim().toLowerCase();
        map.set(key, { ...c, email: String(c.email).trim() });
      }
    }

    // 2. Secondary: Local list (enrich missing items, but do NOT override valid cloud passwords with empty ones)
    for (const l of localList) {
      if (l?.email) {
        const key = String(l.email).trim().toLowerCase();
        const existing = map.get(key);
        if (existing) {
          map.set(key, {
            ...existing,
            ...l,
            password: (l.password && String(l.password).trim()) ? String(l.password).trim() : existing.password,
            customPermissions: (l.customPermissions && l.customPermissions.length > 0) ? l.customPermissions : existing.customPermissions,
            parentAccountEmail: l.parentAccountEmail || existing.parentAccountEmail,
            roleId: l.roleId || existing.roleId,
          });
        } else {
          map.set(key, { ...l, email: String(l.email).trim() });
        }
      }
    }

    const merged = Array.from(map.values());

    // Update localStorage for offline resiliency
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {}

    return merged;
  },

  /**
   * Save or update an assigned profile in Supabase cloud & local storage.
   */
  async saveProfile(profile: CloudProfile): Promise<CloudProfile[]> {
    const currentList = await this.getAllProfiles();
    const cleanEmail = String(profile.email || '').trim().toLowerCase();
    
    const existingIndex = currentList.findIndex(
      p => String(p.email || '').trim().toLowerCase() === cleanEmail
    );
    const existing = existingIndex >= 0 ? currentList[existingIndex] : null;

    const now = new Date().toISOString();
    // Preserve existing password if new one is empty
    const finalPassword = (profile.password && String(profile.password).trim())
      ? String(profile.password).trim()
      : (existing?.password || '');

    const fullProfile: CloudProfile = {
      ...existing,
      ...profile,
      email: cleanEmail,
      password: finalPassword,
      updatedAt: now,
      createdAt: existing?.createdAt || now
    };

    let updatedList: CloudProfile[];
    if (existingIndex >= 0) {
      updatedList = [...currentList];
      updatedList[existingIndex] = fullProfile;
    } else {
      updatedList = [...currentList, fullProfile];
    }

    // 1. Save locally
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    } catch {}

    // 2. Persist in cloud (pricing_settings -> SYS_ASSIGNED_PROFILES)
    try {
      const { data: existingRows } = await supabase
        .from('pricing_settings')
        .select('id')
        .eq('code', CLOUD_SETTING_CODE);

      const payload = {
        code: CLOUD_SETTING_CODE,
        designation: 'SFT System Profiles Cloud Storage',
        zone: 0,
        prix_unitaire: 0,
        prix_achat: 0,
        pricing_data: updatedList,
        updated_at: now
      };

      if (existingRows && existingRows.length > 0) {
        await supabase
          .from('pricing_settings')
          .update(payload)
          .eq('id', existingRows[0].id);
      } else {
        await supabase
          .from('pricing_settings')
          .insert(payload);
      }
    } catch (err) {
      console.warn('Failed to persist profile to cloud:', err);
    }

    try {
      window.dispatchEvent(new CustomEvent('sft-role-assignments-changed', { detail: updatedList }));
    } catch {}

    return updatedList;
  },

  /**
   * Delete a profile from cloud and local storage.
   */
  async deleteProfile(profileIdOrEmail: string): Promise<CloudProfile[]> {
    const currentList = await this.getAllProfiles();
    const cleanId = String(profileIdOrEmail || '').trim().toLowerCase();

    const updatedList = currentList.filter(
      p => p.id !== profileIdOrEmail && String(p.email || '').trim().toLowerCase() !== cleanId
    );

    // Save locally
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    } catch {}

    // Persist in cloud
    try {
      const { data: existingRows } = await supabase
        .from('pricing_settings')
        .select('id')
        .eq('code', CLOUD_SETTING_CODE);

      if (existingRows && existingRows.length > 0) {
        await supabase
          .from('pricing_settings')
          .update({ pricing_data: updatedList, updated_at: new Date().toISOString() })
          .eq('id', existingRows[0].id);
      }
    } catch (err) {
      console.warn('Failed to delete profile from cloud:', err);
    }

    try {
      window.dispatchEvent(new CustomEvent('sft-role-assignments-changed', { detail: updatedList }));
    } catch {}

    return updatedList;
  },

  /**
   * Authenticate an assigned profile across any browser / device.
   */
  async authenticate(email: string, passwordInput: string): Promise<{ success: boolean; profile?: CloudProfile; error?: string }> {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(passwordInput || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return { success: false, error: 'Champs requis.' };
    }

    const profiles = await this.getAllProfiles();
    const matched = profiles.find(p => String(p.email || '').trim().toLowerCase() === cleanEmail);

    if (!matched) {
      return { success: false, error: 'Identifiant non trouvé.' };
    }

    // Verify password matches
    const storedPassword = String(matched.password || '').trim();
    if (!storedPassword || storedPassword !== cleanPassword) {
      return { success: false, error: 'Mot de passe incorrect.' };
    }

    return { success: true, profile: matched };
  }
};
