import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import type { PermissionKey, RoleAssignment } from '@/contexts/AppContext';
import { 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  ShieldAlert, 
  Database,
  History,
  Info,
  LogOut,
  Users,
  Sparkles,
  ShieldCheck,
  Gauge,
  Layers,
  Palette,
  Eye,
  EyeOff,
  Filter,
  Plus,
  Radio,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Key,
  Copy,
  Check,
  Search,
  Sliders,
  UserCheck,
  Edit2,
  X,
  Shield,
  Layers3,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Save
} from 'lucide-react';
import { getGpsConfig, saveGpsConfig, testGpsConnection } from '@/lib/gpswoxService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { cloudProfilesService } from '@/lib/cloudProfilesService';

type NavTheme = 'indigo' | 'emerald' | 'sunset' | 'violet';

const navThemeOptions: { value: NavTheme; preview: string }[] = [
  { value: 'indigo', preview: 'from-slate-900 via-indigo-900 to-blue-700' },
  { value: 'emerald', preview: 'from-slate-900 via-emerald-800 to-cyan-700' },
  { value: 'sunset', preview: 'from-slate-900 via-orange-700 to-rose-700' },
  { value: 'violet', preview: 'from-slate-900 via-violet-800 to-fuchsia-700' },
];

interface PermissionCategory {
  id: string;
  nameFr: string;
  nameAr: string;
  icon: React.ElementType;
  badgeColor: string;
  keys: PermissionKey[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'operations',
    nameFr: 'Opérations & Distribution',
    nameAr: 'العمليات والتوزيع',
    icon: Sliders,
    badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    keys: ['supply-return', 'petit-camion', 'point-vente', 'transfer', 'exchanges']
  },
  {
    id: 'fleet',
    nameFr: 'Flotte & Ressources',
    nameAr: 'الأسطول والموارد',
    icon: Users,
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    keys: ['trucks', 'drivers', 'repairs', 'fuel-management']
  },
  {
    id: 'stock',
    nameFr: 'Stock & Fournisseurs',
    nameAr: 'المخزون والموردين',
    icon: Database,
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    keys: ['inventory', 'factory', 'defective-stock']
  },
  {
    id: 'finance',
    nameFr: 'Finance & Comptabilité',
    nameAr: 'المالية والمحاسبة',
    icon: ShieldCheck,
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    keys: ['revenue', 'expenses', 'depenses-copt', 'accounting']
  },
  {
    id: 'analysis',
    nameFr: 'Analyse & Suivi',
    nameAr: 'التحليلات والمتابعة',
    icon: Gauge,
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
    keys: ['dashboard', 'reports', 'live-map', 'clients']
  },
  {
    id: 'admin',
    nameFr: 'Administration & Système',
    nameAr: 'الإدارة والنظام',
    icon: Lock,
    badgeColor: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
    keys: ['parametrage', 'work-methods', 'settings']
  }
];

const Settings = () => {
  const { 
    exportData, 
    importData, 
    clearAllData, 
    roles, 
    roleAssignments, 
    availablePermissions, 
    addRole, 
    updateRolePermissions, 
    assignRoleToEmail, 
    removeRoleAssignment,
    currentUserEmail,
    currentRole
  } = useApp();

  const { toast } = useToast();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);

  const navThemeLabel = (value: NavTheme) => {
    if (value === 'indigo') return tr('Bleu Indigo', 'أزرق نيلي');
    if (value === 'emerald') return tr('Vert Émeraude', 'أخضر زمردي');
    if (value === 'sunset') return tr('Sunset Orange', 'برتقالي الغروب');
    return tr('Violet Néon', 'بنفسجي نيون');
  };

  // State: Tab navigation (Focus strictly on actual settings)
  const [activeTab, setActiveTab] = useState<'security' | 'operations' | 'system'>('security');

  // State: New Role creation
  const [newRoleName, setNewRoleName] = useState("");

  // State: Profile Assignment form
  const [assignmentEmail, setAssignmentEmail] = useState("");
  const [assignmentPassword, setAssignmentPassword] = useState("");
  const [showAssignmentPassword, setShowAssignmentPassword] = useState(false);
  const [assignmentRoleId, setAssignmentRoleId] = useState("");
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [permissionOverrideMode, setPermissionOverrideMode] = useState<'role' | 'custom'>('role');
  const [profileCustomPermissions, setProfileCustomPermissions] = useState<PermissionKey[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);

  // State: Profiles List search & filters
  const [profileSearchQuery, setProfileSearchQuery] = useState("");
  const [profileRoleFilter, setProfileRoleFilter] = useState("all");
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // State: GPSWOX Telematics
  const [gpsApiUrl, setGpsApiUrl] = useState('');
  const [gpsEmail, setGpsEmail] = useState('');
  const [gpsPassword, setGpsPassword] = useState('');
  const [gpsApiHash, setGpsApiHash] = useState('');
  const [showGpsPassword, setShowGpsPassword] = useState(false);
  const [gpsSaving, setGpsSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsTesting, setGpsTesting] = useState(false);
  const [gpsTestResult, setGpsTestResult] = useState<{ success: boolean; message: string; deviceCount?: number } | null>(null);

  // State: Return Entry Mode config
  const [enableStandardReturnMode, setEnableStandardReturnMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('supplyReturn.enableStandardMode') === 'true';
  });

  // State: System & Theme
  const [navTheme, setNavTheme] = useState<NavTheme>(() => {
    if (typeof window === 'undefined') return 'indigo';
    const stored = window.localStorage.getItem('app-nav-theme');
    if (stored === 'emerald' || stored === 'sunset' || stored === 'violet' || stored === 'indigo') return stored;
    return 'indigo';
  });

  // State: Backup & Restore
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgressText, setImportProgressText] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Initialize GPS config on mount
  useEffect(() => {
    const loadGpsSettings = async () => {
      setGpsLoading(true);
      const config = await getGpsConfig();
      if (config) {
        setGpsApiUrl(config.apiUrl || '');
        setGpsEmail(config.email || '');
        setGpsPassword(config.password || '');
        if (config.apiHash) setGpsApiHash(config.apiHash);
      }
      setGpsLoading(false);
    };
    loadGpsSettings();
  }, []);

  // Default role ID
  useEffect(() => {
    if (!assignmentRoleId && roles.length > 0) {
      setAssignmentRoleId(roles[0].id);
    }
  }, [assignmentRoleId, roles]);

  // Return mode toggle handler
  const handleToggleStandardReturnMode = (checked: boolean) => {
    setEnableStandardReturnMode(checked);
    window.localStorage.setItem('supplyReturn.enableStandardMode', checked ? 'true' : 'false');
    if (!checked) {
      window.localStorage.setItem('supplyReturn.returnEntryMode', 'par-code');
    }
    window.dispatchEvent(new CustomEvent('supply-return-mode-config-change', {
      detail: { enableStandardMode: checked }
    }));
    toast({
      title: checked 
        ? tr("Mode Standard activé", "تم تفعيل الوضع العادي") 
        : tr("Mode 'Par code' exclusif activé", "تم حصر الوضع على 'حسب الكود'"),
      description: checked 
        ? tr("Les modes 'Standard' et 'Par code' sont désormais disponibles dans Bon de Sortie & Retours.", "أصبح الوضع العادي ووضع حسب الكود متاحين في صفحة الخروج والرجوع.") 
        : tr("Le mode Standard est désormais masqué. Seul le mode 'Par code' est actif.", "تم إخفاء الوضع العادي. فقط وضع 'حسب الكود' هو النشط في صفحة الخروج والرجوع."),
    });
  };

  // GPS handlers
  const saveGpsSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const api = gpsApiUrl.trim();
    const email = gpsEmail.trim();
    const password = gpsPassword.trim();
    if (!api || (!email && !gpsApiHash.trim()) || (!password && !gpsApiHash.trim())) {
      toast({
        title: tr('Données manquantes', 'بيانات ناقصة'),
        description: tr('Veuillez renseigner API URL, Email et Password (ou la clé API Hash).', 'يرجى إدخال رابط API والبريد وكلمة المرور أو مفتاح API.'),
        variant: 'destructive',
      });
      return;
    }
    setGpsSaving(true);
    const result = await saveGpsConfig({
      apiUrl: api,
      email,
      password,
      apiHash: gpsApiHash.trim() || undefined,
    });
    setGpsSaving(false);
    if (!result.success) {
      toast({
        title: tr('Échec de sauvegarde', 'فشل الحفظ'),
        description: result.error,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: tr('Paramètres GPS enregistrés', 'تم حفظ إعدادات GPS'),
      description: tr('Les identifiants sont synchronisés avec la Carte Live.', 'تمت مزامنة البيانات مع الخريطة المباشرة بنجاح.'),
    });
  };

  const handleTestGps = async () => {
    const api = gpsApiUrl.trim();
    const email = gpsEmail.trim();
    const password = gpsPassword.trim();
    if (!api || (!email && !gpsApiHash.trim()) || (!password && !gpsApiHash.trim())) {
      toast({
        title: tr('Données manquantes', 'بيانات ناقصة'),
        description: tr('Veuillez saisir les coordonnées du serveur avant de tester.', 'يرجى إدخال معلومات الخادم أولاً.'),
        variant: 'destructive',
      });
      return;
    }
    setGpsTesting(true);
    setGpsTestResult(null);
    try {
      const res = await testGpsConnection({
        apiUrl: api,
        email,
        password,
        apiHash: gpsApiHash.trim() || undefined,
      });
      setGpsTestResult(res);
      if (res.success) {
        toast({
          title: tr('Test GPS réussi !', 'نجح اختبار GPS!'),
          description: res.message,
        });
      } else {
        toast({
          title: tr('Échec du test GPS', 'فشل اختبار GPS'),
          description: res.message,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setGpsTestResult({ success: false, message: err?.message || 'Erreur réseau' });
    } finally {
      setGpsTesting(false);
    }
  };

  // Nav Theme Handler
  const applyNavTheme = (theme: NavTheme) => {
    setNavTheme(theme);
    document.documentElement.setAttribute('data-nav-theme', theme);
    window.localStorage.setItem('app-nav-theme', theme);
    window.dispatchEvent(new CustomEvent('app-nav-theme-change', { detail: theme }));
    toast({ title: tr("Navigation mise à jour", "تم تحديث التنقل"), description: tr("Nouveau dégradé appliqué.", "تم تطبيق تدرج جديد.") });
  };

  // Backup & Restore Handlers
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setIsImporting(true);
    setImportProgressText(tr("Lecture du fichier JSON...", "قراءة ملف JSON..."));
    try {
      const text = await importFile.text();
      const res = await importData(text, (step) => setImportProgressText(step));
      if (!res.success) {
        toast({
          title: tr("Erreur de restauration", "خطأ في الاسترجاع"),
          description: res.error || tr("Échec de l'importation.", "فشل الاستيراد."),
          variant: "destructive",
        });
      } else {
        toast({
          title: tr("Restauration réussie !", "تم الاسترجاع بنجاح!"),
          description: tr("Toutes vos données et configurations ont été restaurées.", "تمت استعادة كافة البيانات والإعدادات."),
        });
        setImportFile(null);
      }
    } catch (err: any) {
      toast({
        title: tr("Erreur critique", "خطأ غير متوقع"),
        description: err?.message || tr("Format de fichier non valide.", "صيغة الملف غير صحيحة."),
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportProgressText("");
    }
  };

  // Role Handlers
  const handleAddRole = async () => {
    const name = newRoleName.trim();
    if (!name) {
      toast({
        title: tr("Nom requis", "الاسم مطلوب"),
        description: tr("Veuillez saisir le nom du rôle.", "يرجى إدخال اسم الدور."),
        variant: "destructive",
      });
      return;
    }
    await addRole(name);
    setNewRoleName("");
    toast({ title: tr("Rôle ajouté", "تمت إضافة الدور"), description: name });
  };

  // Role Selection & Custom Permission synchronization
  const handleRoleSelectChange = (roleId: string) => {
    setAssignmentRoleId(roleId);
    const selected = roles.find(r => r.id === roleId);
    if (selected) {
      if (selected.permissions.includes('*')) {
        setProfileCustomPermissions(availablePermissions.map(p => p.key));
      } else {
        setProfileCustomPermissions(selected.permissions.filter((p): p is PermissionKey => p !== '*'));
      }
    }
  };

  // Toggle specific custom permission for profile
  const handleToggleProfilePermission = (permKey: PermissionKey) => {
    setProfileCustomPermissions(prev => {
      if (prev.includes(permKey)) {
        return prev.filter(k => k !== permKey);
      } else {
        return [...prev, permKey];
      }
    });
  };

  // Check / Uncheck all permissions
  const handleCheckAllPermissions = () => {
    setProfileCustomPermissions(availablePermissions.map(p => p.key));
  };
  const handleUncheckAllPermissions = () => {
    setProfileCustomPermissions([]);
  };
  const handleResetToRolePermissions = () => {
    const selected = roles.find(r => r.id === assignmentRoleId);
    if (selected) {
      if (selected.permissions.includes('*')) {
        setProfileCustomPermissions(availablePermissions.map(p => p.key));
      } else {
        setProfileCustomPermissions(selected.permissions.filter((p): p is PermissionKey => p !== '*'));
      }
      toast({
        title: tr("Permissions réinitialisées", "تمت إعادة ضبط الصلاحيات"),
        description: tr(`Les permissions sont calquées sur le rôle ${selected.name}.`, `تمت مطابقة الصلاحيات مع دور ${selected.name}.`)
      });
    }
  };

  // Generate strong temporary password
  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = 'Sft@';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAssignmentPassword(pwd);
    setShowAssignmentPassword(true);
    toast({
      title: tr("Mot de passe généré", "تم توليد كلمة المرور"),
      description: tr("Un mot de passe sécurisé a été généré.", "تم إنشاء كلمة مرور قوية وجاهزة للحفظ.")
    });
  };

  // Save / Update Profile Assignment
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = assignmentEmail.trim().toLowerCase();
    if (!email || !assignmentRoleId) {
      toast({
        title: tr("Données requises", "بيانات مطلوبة"),
        description: tr("Veuillez saisir un email valide et sélectionner un rôle.", "يرجى إدخال بريد إلكتروني صالح واختيار دور."),
        variant: "destructive"
      });
      return;
    }

    if (!assignmentPassword && !editingAssignmentId) {
      toast({
        title: tr("Mot de passe requis", "كلمة المرور مطلوبة"),
        description: tr("Veuillez saisir ou générer un mot de passe pour ce profil.", "يرجى إدخال أو توليد كلمة مرور لهذا الحساب."),
        variant: "destructive"
      });
      return;
    }

    setProfileSaving(true);
    const parentAccount = currentUserEmail || 'admin@sftgaz.ma';
    const customPerms = permissionOverrideMode === 'custom' ? profileCustomPermissions : undefined;
    const profileId = editingAssignmentId || (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

    const existingProf = (roleAssignments || []).find(a => String(a?.email || (a as any)?.userId || '').trim().toLowerCase() === email);
    const finalPassword = (assignmentPassword && assignmentPassword.trim()) 
      ? assignmentPassword.trim() 
      : (existingProf?.password || undefined);

    try {
      // 1. Direct cloud persistence across all browsers & devices
      await cloudProfilesService.saveProfile({
        id: profileId,
        email,
        roleId: assignmentRoleId,
        password: finalPassword,
        customPermissions: customPerms,
        parentAccountEmail: parentAccount
      });

      // 2. Direct local storage sync for instant availability
      try {
        const stored = JSON.parse(window.localStorage.getItem('sft_role_assignments_v2') || '[]');
        const updated = [
          ...stored.filter((a: any) => String(a?.email || a?.userId || '').trim().toLowerCase() !== email),
          {
            id: profileId,
            email,
            roleId: assignmentRoleId,
            password: finalPassword,
            customPermissions: customPerms,
            parentAccountEmail: parentAccount,
            updatedAt: new Date().toISOString()
          }
        ];
        window.localStorage.setItem('sft_role_assignments_v2', JSON.stringify(updated));
      } catch {}

      // 3. Sync into AppContext
      await assignRoleToEmail(email, assignmentRoleId, {
        password: finalPassword,
        customPermissions: customPerms,
        parentAccountEmail: parentAccount
      });

      toast({
        title: editingAssignmentId 
          ? tr("Profil mis à jour !", "تم تحديث الملف الشخصي!") 
          : tr("Profil créé & lié avec succès !", "تم إنشاء وربط الملف الشخصي بنجاح!"),
        description: tr(
          `Le profil ${email} est rattaché au compte original (${parentAccount}).`,
          `تم ربط الحساب ${email} بنجاح بالحساب الأصلي (${parentAccount}).`
        )
      });

      // Reset form
      setAssignmentEmail('');
      setAssignmentPassword('');
      setAssignmentRoleId(roles[0]?.id || '');
      setEditingAssignmentId(null);
      setPermissionOverrideMode('role');
      setProfileCustomPermissions([]);
      setShowAssignmentPassword(false);
    } catch (err: any) {
      toast({
        title: tr("Échec de l'enregistrement", "فشل الحفظ"),
        description: err?.message || tr("Erreur lors de l'enregistrement du profil.", "حدث خطأ أثناء حفظ الملف الشخصي."),
        variant: "destructive"
      });
    } finally {
      setProfileSaving(false);
    }
  };

  // Edit existing profile
  const handleStartEditProfile = (assignment: RoleAssignment) => {
    setEditingAssignmentId(assignment.id);
    setAssignmentEmail(assignment.email);
    setAssignmentRoleId(assignment.roleId);
    setAssignmentPassword(assignment.password || '');
    
    if (assignment.customPermissions && assignment.customPermissions.length > 0) {
      setPermissionOverrideMode('custom');
      setProfileCustomPermissions(assignment.customPermissions.filter((p): p is PermissionKey => p !== '*'));
    } else {
      setPermissionOverrideMode('role');
      const found = roles.find(r => r.id === assignment.roleId);
      if (found) {
        if (found.permissions.includes('*')) {
          setProfileCustomPermissions(availablePermissions.map(p => p.key));
        } else {
          setProfileCustomPermissions(found.permissions.filter((p): p is PermissionKey => p !== '*'));
        }
      }
    }

    window.scrollTo({ top: 380, behavior: 'smooth' });
    toast({
      title: tr("Mode Édition activé", "تم تفعيل وضع التعديل"),
      description: tr(`Modification des accès et mot de passe pour ${assignment.email}.`, `تعديل صلاحيات وكلمة مرور ${assignment.email}.`)
    });
  };

  const handleCancelEditProfile = () => {
    setEditingAssignmentId(null);
    setAssignmentEmail('');
    setAssignmentPassword('');
    setAssignmentRoleId(roles[0]?.id || '');
    setPermissionOverrideMode('role');
    setProfileCustomPermissions([]);
    setShowAssignmentPassword(false);
  };

  // Delete Profile Assignment
  const handleDeleteAssignmentProfile = async (assignment: RoleAssignment) => {
    const targetId = assignment.id;
    const targetEmail = assignment.email || (assignment as any).userId || (assignment as any).user_id || '';
    try {
      await cloudProfilesService.deleteProfile(targetEmail || targetId);
      await removeRoleAssignment(targetId);
      toast({
        title: tr("Profil supprimé", "تم حذف الملف"),
        description: tr(`Le profil ${targetEmail} a été supprimé.`, `تم حذف الملف ${targetEmail} بنجاح.`)
      });
    } catch (err: any) {
      toast({
        title: tr("Erreur", "خطأ"),
        description: err?.message || tr("Impossible de supprimer le profil.", "تعذر حذف الملف."),
        variant: "destructive"
      });
    }
  };

  // Copy password helper
  const handleCopyPassword = (id: string, pwd?: string) => {
    if (!pwd) return;
    navigator.clipboard.writeText(pwd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
    toast({
      title: tr("Copié !", "تم النسخ!"),
      description: tr("Mot de passe copié dans le presse-papiers.", "تم نسخ كلمة المرور إلى الحافظة.")
    });
  };

  // Toggle revealed password
  const toggleRevealPassword = (id: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleLogout = async () => {
    try {
      window.localStorage.removeItem('sft_custom_auth_user');
      window.dispatchEvent(new CustomEvent('sft-custom-auth-change', { detail: null }));
    } catch {}
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: tr("Erreur", "خطأ"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: tr("Déconnecté", "تم تسجيل الخروج"),
      description: tr("À bientôt.", "إلى اللقاء."),
    });
    navigate('/login');
  };

  const handleUpdate = () => {
    setIsUpdating(true);
    setTimeout(() => {
      setIsUpdating(false);
      toast({
        title: tr("Système à jour", "النظام محدث"),
        description: tr("Vous utilisez la dernière version optimisée de l'application.", "أنت تستخدم أحدث إصدار مُحسّن من التطبيق."),
      });
    }, 1200);
  };

  // Filtered profiles
  const filteredRoleAssignments = useMemo(() => {
    const q = profileSearchQuery.trim().toLowerCase();
    return roleAssignments.filter(assignment => {
      const email = (assignment?.email || (assignment as any)?.userId || (assignment as any)?.user_id || '').toLowerCase();
      const matchQuery = !q || email.includes(q);
      const matchRole = profileRoleFilter === 'all' || assignment.roleId === profileRoleFilter;
      return matchQuery && matchRole;
    });
  }, [roleAssignments, profileSearchQuery, profileRoleFilter]);

  // Master account indicator
  const masterAccountEmail = currentUserEmail || 'admin@sftgaz.ma';

  return (
    <div className="app-page-shell min-h-screen bg-slate-950 p-4 md:p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* =========================================================================
            EXECUTIVE HEADER COMMAND RIBBON
            ========================================================================= */}
        <Card className="border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <CardContent className="p-5 md:p-7 relative z-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-xs font-bold" variant="outline">
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                    {tr('Centre de Contrôle & Paramètres', 'مركز التحكم والإعدادات')}
                  </Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-bold" variant="outline">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    {tr('Sécurité Active', 'الأمان نشط')}
                  </Badge>
                  <Badge variant="outline" className="bg-slate-800/80 text-cyan-300 border-cyan-500/30 text-xs">
                    <Radio className="w-3 h-3 mr-1 text-cyan-400 animate-pulse" />
                    {tr('Télématique GPS Connectée', 'نظام التتبع مرتبط')}
                  </Badge>
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                    <Shield className="w-7 h-7 text-indigo-400" />
                    {tr('Paramètres Système & Accès', 'إعدادات النظام والصلاحيات')}
                  </h1>
                  <p className="mt-1 text-xs md:text-sm text-slate-300 max-w-2xl">
                    {tr(
                      'Gestion précise des profils, assignation de rôles et mots de passe rattachés au compte original, configuration télématique et sauvegardes.',
                      'إدارة دقيقة للملفات الشخصية، ربط الصلاحيات وكلمات المرور بالحساب الأصلي، وتكوين نظام التتبع والنسخ الاحتياطي.'
                    )}
                  </p>
                </div>
                
                {/* Master Account Ribbon */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-xs">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-slate-400">{tr('Compte Maître (Original) :', 'الحساب الأصلي (الرئيسي):')}</span>
                    <span className="font-mono font-bold text-slate-100">{masterAccountEmail}</span>
                  </div>
                  {currentRole && (
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30 text-xs font-semibold">
                      {tr('Rôle Actuel :', 'الدور الحالي:')} {currentRole.name}
                    </Badge>
                  )}
                </div>
              </div>

              {/* 4 Compact Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2.5 w-full lg:w-auto">
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-3 shadow-sm min-w-[125px]">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{tr('Profils Assignés', 'الملفات المسندة')}</p>
                  <p className="text-2xl font-black text-indigo-300 mt-0.5">{roleAssignments.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-3 shadow-sm min-w-[125px]">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{tr('Rôles Définis', 'الأدوار المعرفة')}</p>
                  <p className="text-2xl font-black text-emerald-300 mt-0.5">{roles.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-3 shadow-sm min-w-[125px]">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{tr('Permissions', 'الصلاحيات')}</p>
                  <p className="text-2xl font-black text-cyan-300 mt-0.5">{availablePermissions.length}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="h-auto py-3 rounded-2xl border-rose-500/40 bg-rose-950/20 text-rose-300 hover:bg-rose-900/40 hover:text-white font-bold flex flex-col items-center justify-center gap-1"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span className="text-[11px]">{tr('Déconnexion', 'تسجيل الخروج')}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* =========================================================================
            STUDIO SEGMENTED TABS (Sleek, Clean 3-Tab Hub)
            ========================================================================= */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 border border-slate-800 bg-slate-900/95 p-1 rounded-2xl h-14 shadow-lg backdrop-blur-md">
            <TabsTrigger 
              value="security" 
              className="rounded-xl text-xs md:text-sm font-bold text-slate-300 hover:text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-indigo-700 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Key className="w-4 h-4 text-indigo-300" />
              <span>{tr('Sécurité, Rôles & Profils', 'الأمان، الأدوار والملفات')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="operations" 
              className="rounded-xl text-xs md:text-sm font-bold text-slate-300 hover:text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-indigo-700 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center justify-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4 text-cyan-300" />
              <span>{tr('Opérations & Télématique', 'العمليات والتتبع GPS')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="system" 
              className="rounded-xl text-xs md:text-sm font-bold text-slate-300 hover:text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-indigo-700 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Database className="w-4 h-4 text-emerald-300" />
              <span>{tr('Système & Sauvegardes', 'النظام والنسخ الاحتياطي')}</span>
            </TabsTrigger>
          </TabsList>

          {/* =========================================================================
              TAB 1: SECURITY, ROLES & PROFILES (Requirement 1: Assignation des Profils + Rôles)
              ========================================================================= */}
          <TabsContent value="security" className="space-y-6 m-0">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

              {/* FORM: Assignation des Profils (Left / Main Column: 7 Cols) */}
              <div className="xl:col-span-7 space-y-6">
                <Card className={cn(
                  "border shadow-xl backdrop-blur-md transition-all",
                  editingAssignmentId 
                    ? "border-amber-500/50 bg-gradient-to-b from-amber-950/20 via-slate-900/90 to-slate-900/90" 
                    : "border-slate-800 bg-slate-900/70"
                )}>
                  <CardHeader className="border-b border-slate-800 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2.5 rounded-2xl",
                          editingAssignmentId ? "bg-amber-500/20 text-amber-300" : "bg-indigo-500/20 text-indigo-300"
                        )}>
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-slate-100 text-lg font-bold">
                              {editingAssignmentId 
                                ? tr('Modifier le Profil Assigné', 'تعديل الملف الشخصي المسند')
                                : tr('Assignation des Profils & Identifiants', 'إسناد الملفات الشخصية وبيانات الدخول')}
                            </CardTitle>
                            {editingAssignmentId && (
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                                {tr('Mode Édition', 'وضع التعديل')}
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-slate-300 text-xs mt-0.5">
                            {tr(
                              'Email, Mot de Passe, Rôle & Gestion précise des permissions (Lié au compte original).',
                              'البريد، كلمة المرور، الدور وإدارة الصلاحيات الدقيقة (مرتبط بالحساب الأصلي).'
                            )}
                          </CardDescription>
                        </div>
                      </div>

                      {editingAssignmentId && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleCancelEditProfile}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4 mr-1" />
                          {tr('Annuler', 'إلغاء')}
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-6 space-y-5">
                    {/* Master Account Attachment Notice */}
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3.5 flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-300 space-y-1">
                        <div className="font-bold text-indigo-300 flex items-center gap-2">
                          <span>{tr('Liaison Hiérarchique au Compte Original', 'الارتباط الهيكلي بالحساب الأصلي')}</span>
                          <Badge variant="outline" className="text-[10px] border-indigo-400/40 text-indigo-300 bg-indigo-500/10">
                            {tr('Compte Maître', 'الحساب الرئيسي')}
                          </Badge>
                        </div>
                        <p className="leading-relaxed">
                          {tr(
                            `Ce profil sera automatiquement rattaché au compte original (${masterAccountEmail}). Ses accès et son mot de passe sont gouvernés sous cette tutelle.`,
                            `سيتم ربط هذا الملف تلقائياً بالحساب الأصلي (${masterAccountEmail}). يتم التحكم في صلاحياته وكلمة مروره تحت هذا الإشراف.`
                          )}
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      {/* Email Input */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                          <span>{tr('Email de l\'utilisateur / chauffeur', 'البريد الإلكتروني للمستخدم / السائق')} <span className="text-rose-400">*</span></span>
                          <span className="text-[11px] font-normal text-slate-400">{tr('Identifiant de connexion', 'معرف تسجيل الدخول')}</span>
                        </Label>
                        <Input
                          type="email"
                          placeholder="chauffeur@sftgaz.ma ou utilisateur@entreprise.com"
                          value={assignmentEmail}
                          onChange={(e) => setAssignmentEmail(e.target.value)}
                          disabled={editingAssignmentId !== null}
                          className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 rounded-xl h-11 text-xs sm:text-sm font-mono"
                        />
                      </div>

                      {/* Password (mdps) with Generator & Show/Hide */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{tr('Mot de passe (mdps)', 'كلمة المرور (mdps)')}</span>
                            {!editingAssignmentId && <span className="text-rose-400">*</span>}
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={generateStrongPassword}
                            className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 h-7 px-2 hover:bg-cyan-500/10"
                          >
                            <Key className="w-3 h-3 mr-1" />
                            {tr('Générer un mot de passe', 'توليد كلمة مرور قوية')}
                          </Button>
                        </div>
                        <div className="relative">
                          <Input
                            type={showAssignmentPassword ? 'text' : 'password'}
                            placeholder={editingAssignmentId ? tr('(Laisser vide pour conserver l\'actuel)', '(اتركه فارغاً للاحتفاظ بالقديم)') : '••••••••'}
                            value={assignmentPassword}
                            onChange={(e) => setAssignmentPassword(e.target.value)}
                            className="border-slate-700 bg-slate-950 pr-10 text-slate-100 placeholder:text-slate-500 rounded-xl h-11 text-xs sm:text-sm font-mono"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            tabIndex={-1}
                            onClick={() => setShowAssignmentPassword(!showAssignmentPassword)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-white"
                          >
                            {showAssignmentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Role Selector */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-200">
                          {tr('Rôle Assigné', 'الدور المسند')} <span className="text-rose-400">*</span>
                        </Label>
                        <Select value={assignmentRoleId} onValueChange={handleRoleSelectChange}>
                          <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100 h-11 rounded-xl">
                            <SelectValue placeholder={tr('Choisir un rôle', 'اختر دوراً')} />
                          </SelectTrigger>
                          <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id} className="focus:bg-slate-800">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{role.name}</span>
                                  {role.permissions.includes('*') && (
                                    <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px] ml-1">
                                      {tr('Accès Total', 'صلاحية كاملة')}
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Granular Permissions Controls (Gestion précise des permissions) */}
                      <div className="pt-2 border-t border-slate-800 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <Label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              <span>{tr('Gestion précise des permissions pour ce profil', 'إدارة دقيقة للصلاحيات لهذا الملف')}</span>
                            </Label>
                            <p className="text-[11px] text-slate-400">
                              {permissionOverrideMode === 'role'
                                ? tr('Le profil hérite directement des permissions du rôle sélectionné.', 'يرث الملف الصلاحيات مباشرة من الدور المحدد.')
                                : tr('Personnalisation avancée activée : cochez ou décochez chaque module.', 'التخصيص المتقدم مفعّل: حدد أو ألغِ تحديد كل قسم.')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={permissionOverrideMode === 'role' ? 'default' : 'outline'}
                              onClick={() => {
                                setPermissionOverrideMode('role');
                                handleResetToRolePermissions();
                              }}
                              className={cn(
                                "text-xs h-8 rounded-lg",
                                permissionOverrideMode === 'role' ? "bg-indigo-600 text-white" : "border-slate-700 text-slate-300"
                              )}
                            >
                              {tr('Hériter du rôle', 'وراثة الدور')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={permissionOverrideMode === 'custom' ? 'default' : 'outline'}
                              onClick={() => {
                                setPermissionOverrideMode('custom');
                                if (profileCustomPermissions.length === 0) {
                                  handleResetToRolePermissions();
                                }
                              }}
                              className={cn(
                                "text-xs h-8 rounded-lg",
                                permissionOverrideMode === 'custom' ? "bg-emerald-600 text-white" : "border-slate-700 text-slate-300"
                              )}
                            >
                              {tr('Personnaliser', 'تخصيص دقيق')}
                            </Button>
                          </div>
                        </div>

                        {/* Interactive Permission Matrix when Custom Mode is Active */}
                        {permissionOverrideMode === 'custom' && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 rounded-2xl border border-slate-700/80 bg-slate-950/70 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                              <span className="text-xs font-bold text-slate-300">
                                {tr('Permissions sélectionnées :', 'الصلاحيات المحددة:')} <span className="text-emerald-400 font-mono font-bold">{profileCustomPermissions.length} / {availablePermissions.length}</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCheckAllPermissions}
                                  className="h-7 px-2 text-[11px] text-indigo-300 hover:bg-indigo-500/10"
                                >
                                  {tr('Tout cocher', 'تحديد الكل')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleUncheckAllPermissions}
                                  className="h-7 px-2 text-[11px] text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
                                >
                                  {tr('Tout décocher', 'إلغاء الكل')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleResetToRolePermissions}
                                  className="h-7 px-2 text-[11px] text-amber-300 hover:bg-amber-500/10"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  {tr('Réinitialiser au rôle', 'إعادة ضبط')}
                                </Button>
                              </div>
                            </div>

                            {/* Grouped Permissions by Category */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
                              {PERMISSION_CATEGORIES.map(category => {
                                const categoryPerms = availablePermissions.filter(p => category.keys.includes(p.key));
                                const IconComponent = category.icon;
                                const activeCount = categoryPerms.filter(p => profileCustomPermissions.includes(p.key)).length;

                                return (
                                  <div key={category.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                                      <span className="flex items-center gap-1.5">
                                        <IconComponent className="w-3.5 h-3.5 text-slate-400" />
                                        {language === 'ar' ? category.nameAr : category.nameFr}
                                      </span>
                                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", category.badgeColor)}>
                                        {activeCount} / {categoryPerms.length}
                                      </Badge>
                                    </div>
                                    <div className="space-y-1.5 pt-1">
                                      {categoryPerms.map(perm => {
                                        const isChecked = profileCustomPermissions.includes(perm.key);
                                        return (
                                          <label
                                            key={perm.key}
                                            className={cn(
                                              "flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                                              isChecked ? "bg-indigo-950/40 text-slate-100" : "text-slate-400 hover:bg-slate-800/40"
                                            )}
                                          >
                                            <Checkbox
                                              checked={isChecked}
                                              onCheckedChange={() => handleToggleProfilePermission(perm.key)}
                                              className="border-slate-600 data-[state=checked]:bg-indigo-600"
                                            />
                                            <span className="truncate">{perm.label}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        disabled={profileSaving}
                        className={cn(
                          "w-full h-11 font-bold text-white rounded-xl shadow-lg transition-all",
                          editingAssignmentId 
                            ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/25" 
                            : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25"
                        )}
                      >
                        {profileSaving ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : editingAssignmentId ? (
                          <Save className="w-4 h-4 mr-2" />
                        ) : (
                          <UserCheck className="w-4 h-4 mr-2" />
                        )}
                        {profileSaving 
                          ? tr('Enregistrement...', 'جارٍ الحفظ...') 
                          : editingAssignmentId 
                            ? tr('Mettre à jour le Profil', 'تحديث الملف الشخصي') 
                            : tr('Enregistrer & Lier le Profil', 'حفظ وربط الملف الشخصي')}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* LIST: Profils Assignés Actifs (Right Column: 5 Cols) */}
              <div className="xl:col-span-5 space-y-4">
                <Card className="border-slate-800 bg-slate-900/70 shadow-xl backdrop-blur-md">
                  <CardHeader className="border-b border-slate-800 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-slate-100 text-base font-bold">
                            {tr('Profils Assignés', 'الملفات الشخصية المسندة')}
                          </CardTitle>
                          <CardDescription className="text-slate-400 text-xs">
                            {filteredRoleAssignments.length} {tr('profil(s) enregistrés', 'ملف مسجل')}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-xs">
                        {roleAssignments.length} {tr('total', 'إجمالي')}
                      </Badge>
                    </div>

                    {/* Filter & Search */}
                    <div className="pt-3 flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          placeholder={tr('Rechercher un email...', 'بحث عن بريد...')}
                          value={profileSearchQuery}
                          onChange={(e) => setProfileSearchQuery(e.target.value)}
                          className="h-8 pl-8 text-xs border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 rounded-lg"
                        />
                      </div>
                      <Select value={profileRoleFilter} onValueChange={setProfileRoleFilter}>
                        <SelectTrigger className="h-8 w-full sm:w-[130px] text-xs border-slate-700 bg-slate-950 text-slate-100 rounded-lg">
                          <SelectValue placeholder={tr('Tous rôles', 'كل الأدوار')} />
                        </SelectTrigger>
                        <SelectContent className="border-slate-700 bg-slate-900 text-slate-100 text-xs">
                          <SelectItem value="all">{tr('Tous les rôles', 'كل الأدوار')}</SelectItem>
                          {roles.map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 p-4 space-y-3 max-h-[640px] overflow-y-auto">
                    {filteredRoleAssignments.length === 0 ? (
                      <div className="p-8 text-center rounded-2xl border border-dashed border-slate-800 text-slate-400 text-xs">
                        {tr('Aucun profil trouvé.', 'لم يتم العثور على أي ملف شخصي.')}
                      </div>
                    ) : (
                      filteredRoleAssignments.map((assignment) => {
                        const role = roles.find(r => r.id === assignment.roleId);
                        const assignedEmail = assignment.email || (assignment as any).userId || (assignment as any).user_id || 'utilisateur@sftgaz.ma';
                        const isRawUuid = !assignedEmail.includes('@');
                        const displayEmail = isRawUuid ? tr(`Profil Système (${assignedEmail.slice(0, 8)}...)`, `حساب نظام (${assignedEmail.slice(0, 8)}...)`) : assignedEmail;
                        const isCurrent = (currentUserEmail || '').toLowerCase() === assignedEmail.toLowerCase();
                        const isRevealed = revealedPasswords[assignment.id];
                        const isCustom = assignment.customPermissions && assignment.customPermissions.length > 0;
                        const parent = assignment.parentAccountEmail || masterAccountEmail;
                        const initialLetter = isRawUuid ? '#' : (assignedEmail.charAt(0) || 'U').toUpperCase();

                        return (
                          <div 
                            key={assignment.id} 
                            className={cn(
                              "rounded-2xl border p-3.5 space-y-2.5 transition-all",
                              isCurrent ? "border-emerald-500/40 bg-emerald-950/20" : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
                                  {initialLetter}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-xs sm:text-sm text-slate-100 truncate">
                                      {displayEmail}
                                    </span>
                                    {isCurrent && (
                                      <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] py-0 px-1.5">
                                        {tr('Vous', 'أنت')}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                    <span className="font-medium text-indigo-400">{role?.name || tr('Rôle indéfini', 'غير محدد')}</span>
                                    <span>•</span>
                                    <span className="text-[10px] text-slate-500">
                                      {tr('Lié à :', 'مرتبط بـ:')} <span className="text-slate-300">{parent}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleStartEditProfile(assignment)}
                                  className="h-7 w-7 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                                  title={tr('Modifier ce profil', 'تعديل هذا الملف')}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteAssignmentProfile(assignment)}
                                  className="h-7 w-7 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                                  title={tr('Supprimer ce profil', 'حذف هذا الملف')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Password Preview Bar */}
                            <div className="flex items-center justify-between bg-slate-900/90 rounded-xl px-2.5 py-1.5 border border-slate-800/80 text-xs">
                              <div className="flex items-center gap-2">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span className="text-[11px] text-slate-400">{tr('mdps :', 'كلمة المرور:')}</span>
                                <span className="font-mono text-xs text-slate-200">
                                  {assignment.password ? (
                                    isRevealed ? assignment.password : '••••••••'
                                  ) : (
                                    <span className="text-slate-500 italic text-[11px]">{tr('Non renseigné', 'غير محدد')}</span>
                                  )}
                                </span>
                              </div>

                              {assignment.password && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealPassword(assignment.id)}
                                    className="p-1 text-slate-400 hover:text-white rounded"
                                    title={isRevealed ? tr('Masquer', 'إخفاء') : tr('Afficher', 'إظهار')}
                                  >
                                    {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPassword(assignment.id, assignment.password)}
                                    className="p-1 text-slate-400 hover:text-cyan-400 rounded"
                                    title={tr('Copier le mot de passe', 'نسخ كلمة المرور')}
                                  >
                                    {copiedId === assignment.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Permissions Badge */}
                            <div className="flex items-center justify-between text-[11px]">
                              {isCustom ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                                  {tr('Permissions Précises :', 'صلاحيات دقيقة:')} {assignment.customPermissions?.length} {tr('actives', 'نشطة')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30 text-[10px]">
                                  {tr('Hérité du rôle', 'موروثة من الدور')}
                                </Badge>
                              )}
                              <span className="text-[10px] text-slate-500">
                                {new Date(assignment.createdAt || Date.now()).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR')}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* =========================================================================
                ROLES DEFINITIONS & GRANULAR AUTHORIZATIONS
                ========================================================================= */}
            <Card className="border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-md">
              <CardHeader className="border-b border-slate-800 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-2xl">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-100 text-lg font-bold">
                        {tr('Rôles & Autorisations Globales', 'الأدوار والصلاحيات العامة')}
                      </CardTitle>
                      <CardDescription className="text-slate-300 text-xs">
                        {tr('Définissez les modèles de rôles standards pour l\'entreprise.', 'قم بتعريف نماذج الأدوار الموحدة للشركة.')}
                      </CardDescription>
                    </div>
                  </div>

                  {/* Add Role Input */}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={tr('Nouveau rôle (ex: Comptable)...', 'اسم الدور الجديد...')}
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 h-9 text-xs rounded-xl w-48 sm:w-60"
                    />
                    <Button onClick={handleAddRole} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-9 rounded-xl">
                      <Plus className="w-4 h-4 mr-1" />
                      {tr('Créer Rôle', 'إضافة')}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {roles.map((role) => {
                    const isAll = role.permissions.includes("*");
                    const rolePermissions = isAll
                      ? []
                      : role.permissions.filter((perm): perm is PermissionKey => perm !== "*");

                    return (
                      <div key={role.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100 text-sm">{role.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">({role.id})</span>
                          </div>
                          {isAll ? (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]" variant="outline">
                              {tr('Accès Total (*)', 'صلاحية شاملة (*)')}
                            </Badge>
                          ) : (
                            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px]" variant="outline">
                              {rolePermissions.length} {tr('permissions', 'صلاحيات')}
                            </Badge>
                          )}
                        </div>

                        {/* Quick Checklist for this Role */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 max-h-[220px] overflow-y-auto pr-1">
                          {availablePermissions.map((perm) => (
                            <label key={perm.key} className={cn(
                              "flex items-center gap-2 p-1 rounded-lg transition-colors cursor-pointer",
                              isAll || rolePermissions.includes(perm.key) ? "text-slate-200" : "text-slate-500 hover:text-slate-300"
                            )}>
                              <Checkbox
                                checked={isAll ? true : rolePermissions.includes(perm.key)}
                                disabled={isAll}
                                onCheckedChange={(checked) => {
                                  if (isAll) return;
                                  const next = checked
                                    ? [...rolePermissions, perm.key]
                                    : rolePermissions.filter((p: string) => p !== perm.key);
                                  updateRolePermissions(role.id, next);
                                }}
                                className="border-slate-700 data-[state=checked]:bg-indigo-600"
                              />
                              <span className="truncate">{perm.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =========================================================================
              TAB 2: OPERATIONS & TELEMATICS (GPSwox + Return Code Mode)
              ========================================================================= */}
          <TabsContent value="operations" className="space-y-6 m-0">
            {/* Configuration Mode d'entrée retour */}
            <Card className="border-indigo-950/80 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-indigo-950/30 border shadow-lg">
              <CardHeader className="border-b border-slate-800 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-slate-100 text-lg font-bold">
                          {tr("Mode d'Entrée Retour (Bons de Sortie & Retours)", "وضع إدخال الرجوع (وصولات الخروج والرجوع)")}
                        </CardTitle>
                        <Badge variant="outline" className={enableStandardReturnMode ? "bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs"}>
                          {enableStandardReturnMode ? tr("Standard & Par Code", "عادي وحسب الكود") : tr("Par Code Exclusif", "حسب الكود حصرياً")}
                        </Badge>
                      </div>
                      <CardDescription className="text-slate-400 text-sm mt-1">
                        {tr("Contrôler la visibilité et l'accès au mode 'Standard' dans la page Bons de Sortie & Retours (/supply-return).", "التحكم في إظهار أو إخفاء الوضع 'العادي' في صفحة وصولات الخروج والرجوع.")}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-950/70 px-4 py-2.5 rounded-xl border border-slate-800">
                    <Label htmlFor="toggle-standard-return-mode" className="text-sm font-semibold cursor-pointer text-slate-200">
                      {enableStandardReturnMode ? tr("Mode Standard Activé", "الوضع العادي مفعّل") : tr("Mode Standard Désactivé", "الوضع العادي معطّل")}
                    </Label>
                    <Switch
                      id="toggle-standard-return-mode"
                      checked={enableStandardReturnMode}
                      onCheckedChange={handleToggleStandardReturnMode}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-300 text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        {tr("Mode 'Par Code' (Actif & Recommandé)", "وضع 'حسب الكود' (نشط ومُوصى به)")}
                      </span>
                      <Badge className="bg-indigo-600/60 text-white text-[11px]">{tr("Permanent", "دائم")}</Badge>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {tr(
                        "Formulaire grand format type document officiel avec colonnes analytiques complètes (Sor, RtG pleins, RtR vides, Vte auto, Dépenses détaillées, Synthèse financière, et Arrêté en lettres).",
                        "نموذج محاسبي كبير بنمط وثيقة رسمية يضم أعمدة تحليلية كاملة (الخروج Sor، المرتجع الممتلئ RtG، المرتجع الفارغ RtR، المبيعات التلقائية Vte، المصاريف المفصلة، خلاصة الحساب، والمبلغ بالحروف)."
                      )}
                    </p>
                  </div>

                  <div className={`rounded-xl border p-4 space-y-2 transition-all ${
                    enableStandardReturnMode 
                      ? "border-amber-500/30 bg-amber-950/20" 
                      : "border-slate-800 bg-slate-950/40 opacity-70"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-sm flex items-center gap-2 ${enableStandardReturnMode ? "text-amber-300" : "text-slate-400"}`}>
                        {enableStandardReturnMode ? <CheckCircle2 className="w-4 h-4 text-amber-400" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
                        {tr("Mode 'Standard' (Formulaire Simple)", "الوضع 'العادي' (نموذج مبسط)")}
                      </span>
                      <Badge variant="outline" className={enableStandardReturnMode ? "border-amber-500/40 text-amber-400 text-[11px]" : "border-slate-700 text-slate-500 text-[11px]"}>
                        {enableStandardReturnMode ? tr("Visible dans /supply-return", "ظاهر في صفحة الرجوع") : tr("Masqué dans /supply-return", "مخفي في صفحة الرجوع")}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {enableStandardReturnMode 
                        ? tr("Le mode standard est activé et s'affiche comme option dans l'interface de retour.", "الوضع العادي مفعّل الآن ويظهر كخيار في واجهة تسجيل الرجوع.")
                        : tr("Le mode standard est désactivé et masqué. Seul le mode 'Par code' est proposé lors de l'enregistrement d'un retour.", "الوضع العادي معطل ومخفي. فقط وضع 'حسب الكود' هو الذي يظهر ويعمل عند تسجيل الرجوع.")
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* GPSWOX Telematics Server Config */}
            <Card className="border-slate-800 bg-slate-900/80 shadow-xl backdrop-blur-md">
              <CardHeader className="border-b border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 p-2.5 text-white shadow-md shadow-cyan-500/20">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-slate-100 text-lg">{tr('Compte GPS Tracking (GPSwox)', 'حساب تتبع GPS (GPSwox)')}</CardTitle>
                        <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          LIVE SAT
                        </span>
                      </div>
                      <CardDescription className="text-slate-300 text-xs">
                        {tr('Liaison satellite en temps réel avec votre serveur de géolocalisation', 'ربط الأقمار الصناعية المباشر مع خادم التتبع الخاص بك')}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/live-map')}
                    className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-xs font-bold h-9 shadow-sm rounded-xl"
                  >
                    <MapPin className="w-3.5 h-3.5 mr-1.5" />
                    {tr('Ouvrir la Carte Live', 'فتح الخريطة المباشرة')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={saveGpsSettings} className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-100 text-xs font-bold">{tr('URL API du serveur GPSwox', 'رابط API خادم GPS')}</Label>
                      <button
                        type="button"
                        onClick={() => setGpsApiUrl('http://167.86.91.143/')}
                        className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline"
                      >
                        {tr('Défaut: 167.86.91.143', 'الافتراضي: 167.86.91.143')}
                      </button>
                    </div>
                    <Input
                      value={gpsApiUrl}
                      onChange={(e) => setGpsApiUrl(e.target.value)}
                      placeholder="http://167.86.91.143/ ou https://gps.domaine.com/api"
                      className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 font-mono text-sm rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-100 text-xs font-bold">{tr('Email / Nom d\'utilisateur', 'البريد / اسم المستخدم')}</Label>
                      <Input
                        type="text"
                        value={gpsEmail}
                        onChange={(e) => setGpsEmail(e.target.value)}
                        placeholder="baalsaid2411@gmail.com"
                        className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 text-sm rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-100 text-xs font-bold">{tr('Mot de passe', 'كلمة المرور')}</Label>
                      <div className="relative">
                        <Input
                          type={showGpsPassword ? 'text' : 'password'}
                          value={gpsPassword}
                          onChange={(e) => setGpsPassword(e.target.value)}
                          placeholder="••••••••"
                          className="border-slate-700 bg-slate-950 pr-11 text-slate-100 placeholder:text-slate-500 text-sm rounded-xl"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-400 hover:bg-slate-800 hover:text-white"
                          onClick={() => setShowGpsPassword((v) => !v)}
                        >
                          {showGpsPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-200 text-xs font-medium">
                        {tr('Clé API / Hash Utilisateur (Optionnel)', 'مفتاح API / رمز المستخدم (اختياري)')}
                      </Label>
                      <span className="text-[11px] text-slate-400">user_api_hash</span>
                    </div>
                    <Input
                      value={gpsApiHash}
                      onChange={(e) => setGpsApiHash(e.target.value)}
                      placeholder="laisser vide pour connexion automatique par mot de passe"
                      className="border-slate-800 bg-slate-950 text-slate-300 placeholder:text-slate-600 font-mono text-xs rounded-xl"
                    />
                  </div>

                  {/* Test Result Feedback Alert */}
                  {gpsTestResult && (
                    <div
                      className={`rounded-xl border p-3.5 text-xs font-medium flex items-start gap-3 ${
                        gpsTestResult.success
                          ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                          : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
                      }`}
                    >
                      {gpsTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="font-bold">
                          {gpsTestResult.success
                            ? tr('Connectivité GPS Validée', 'تم تأكيد الاتصال بنجاح')
                            : tr('Erreur de Connexion GPS', 'خطأ في الاتصال بخادم GPS')}
                        </div>
                        <div className="mt-1 text-slate-300">{gpsTestResult.message}</div>
                        {gpsTestResult.deviceCount !== undefined && (
                          <div className="mt-1.5 font-mono text-emerald-300">
                            📡 {gpsTestResult.deviceCount} {tr('véhicules actifs prêts à être affichés sur la carte', 'مركبة نشطة جاهزة للعرض على الخريطة')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400 flex items-center gap-2">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>
                      {tr(
                        'Dès l\'enregistrement, la Carte Live bascule automatiquement sur les balises de ce serveur.',
                        'بمجرد الحفظ، تنتقل الخريطة المباشرة تلقائيًا لتتبع المركبات الحية من هذا الخادم.'
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={gpsTesting || gpsLoading}
                      onClick={handleTestGps}
                      className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold h-11 flex-1 shadow-sm rounded-xl"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 text-cyan-400 ${gpsTesting ? 'animate-spin' : ''}`} />
                      {gpsTesting
                        ? tr('Test en cours...', 'جارٍ الاختبار...')
                        : tr('Tester la connexion GPS', 'اختبار الاتصال بخادم GPS')}
                    </Button>

                    <Button
                      disabled={gpsSaving || gpsLoading}
                      type="submit"
                      className="h-11 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold flex-1 shadow-lg shadow-cyan-600/25 rounded-xl"
                    >
                      <Database className="w-4 h-4 mr-2" />
                      {gpsSaving ? tr('Sauvegarde...', 'جارٍ الحفظ...') : tr('Enregistrer les paramètres GPS', 'حفظ إعدادات GPS')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =========================================================================
              TAB 3: SYSTEM, BACKUPS & DATA
              ========================================================================= */}
          <TabsContent value="system" className="space-y-6 m-0">
            {/* Backup & Restore Cards */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
                <CardHeader className="border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/20 rounded-2xl text-blue-300">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-100 text-base">{tr('Sauvegarde & Export Intégral', 'النسخ الاحتياطي والتصدير الكامل')}</CardTitle>
                      <CardDescription className="text-slate-400 text-xs">{tr('Téléchargez une copie JSON complète de toutes les tables', 'حمّل نسخة JSON كاملة من جميع الجداول')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-300 leading-relaxed">
                    {tr('Sauvegarde recommandée avant toute opération majeure. Inclut clients, chauffeurs, stock, réparations et profils.', 'يُنصح بالنسخ الاحتياطي قبل أي عملية كبرى. يشمل العملاء والسائقين والمخزون والإصلاحات.')}
                  </div>
                  <Button onClick={exportData} className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md">
                    <Download className="w-4 h-4 mr-2" />
                    {tr('Télécharger le Backup JSON', 'تنزيل ملف النسخة الاحتياطية (JSON)')}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
                <CardHeader className="border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/20 rounded-2xl text-indigo-300">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-100 text-base">{tr('Restauration des Données', 'استرجاع البيانات')}</CardTitle>
                      <CardDescription className="text-slate-400 text-xs">{tr('Importez vos données depuis un backup JSON officiel', 'استورد بياناتك من نسخة JSON سابقة')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleImport} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="backup-file" className="text-slate-200 text-xs font-bold">{tr('Fichier Backup (.json)', 'ملف النسخة الاحتياطية (.json)')}</Label>
                      <Input
                        id="backup-file"
                        type="file"
                        accept=".json"
                        disabled={isImporting}
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        className="cursor-pointer border-slate-700 bg-slate-950 text-slate-100 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-slate-100 disabled:opacity-50 text-xs h-11 rounded-xl"
                      />
                    </div>
                    {isImporting && (
                      <div className="rounded-xl bg-indigo-950/60 border border-indigo-700/50 p-3 text-xs text-indigo-200 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping inline-block" />
                        <span className="font-medium">{importProgressText || tr("Synchronisation avec Supabase en cours...", "جاري المزامنة مع Supabase...")}</span>
                      </div>
                    )}
                    <Button
                      type="submit"
                      disabled={!importFile || isImporting}
                      className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {isImporting ? tr('Restauration en cours...', 'جاري الاسترجاع...') : tr('Restaurer les données', 'استرجاع البيانات')}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Navigation Theme Selector */}
            <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
              <CardHeader className="border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-violet-500/20 p-2.5 text-violet-300">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-100 text-base">{tr('Thème Navigation & Dégradé', 'سمة التنقل والتدرج')}</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">{tr('Choisissez la couleur dégradée de la barre latérale', 'اختر لون التدرج للشريط الجانبي')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label className="text-slate-200 text-xs font-bold">{tr('Couleur du thème', 'لون السمة')}</Label>
                  <Select value={navTheme} onValueChange={(value) => applyNavTheme(value as NavTheme)}>
                    <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100 h-11 rounded-xl">
                      <SelectValue placeholder={tr('Choisir un thème', 'اختر سمة')} />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                      {navThemeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {navThemeLabel(option.value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={`h-12 w-full rounded-xl border border-slate-700 bg-gradient-to-r shadow-inner ${navThemeOptions.find(option => option.value === navTheme)?.preview ?? navThemeOptions[0].preview}`} />
              </CardContent>
            </Card>

            {/* System Health, Build Version & Update Check */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase">
                    <Gauge className="w-4 h-4 text-cyan-400" />
                    {tr('Santé système', 'صحة النظام')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300 font-medium">
                    {tr('Services critiques opérationnels', 'جميع الخدمات الحرجة تعمل بشكل طبيعي')}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    {tr('Version active', 'الإصدار النشط')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
                    <span className="text-xs text-slate-400">{tr('Build Production', 'البنية الحالية')}</span>
                    <Badge variant="outline" className="bg-slate-800 text-slate-200 border-slate-600 text-[10px]">v3.5.0 Pro</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase">
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                    {tr('Contrôle Mises à jour', 'التحقق من التحديث')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleUpdate} 
                    disabled={isUpdating} 
                    variant="outline" 
                    size="sm" 
                    className="w-full h-8 text-xs border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 rounded-lg"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isUpdating ? 'animate-spin text-cyan-400' : ''}`} />
                    {isUpdating ? tr('Vérification...', 'جارٍ الفحص...') : tr('Vérifier', 'فحص التحديث')}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Danger Zone */}
            <Card className="border-rose-900/50 bg-rose-950/20 shadow-xl">
              <CardHeader className="border-b border-rose-900/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-500/20 rounded-2xl text-rose-300">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-rose-100 text-base">{tr('Zone de Danger', 'منطقة الخطر')}</CardTitle>
                    <CardDescription className="text-rose-300/80 text-xs">{tr('Action irréversible sur le stockage local', 'إجراء غير قابل للتراجع على التخزين المحلي')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-3 text-xs text-rose-200 leading-relaxed">
                  {tr('La suppression complète efface définitivement toutes les données locales en cache.', 'الحذف الكامل يمسح كل البيانات المحلية نهائياً.')}
                </div>
                <Button onClick={clearAllData} variant="destructive" className="w-full h-11 font-bold rounded-xl shadow-md">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {tr('Tout supprimer (Réinitialiser)', 'حذف الكل (إعادة تهيئة)')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer timestamp */}
        <div className="flex justify-center pt-2">
          <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            {tr('Dernière synchronisation :', 'آخر مزامنة:')} {new Date().toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR')} • SFT GAZ v3.5
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
