import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage, useT } from "@/contexts/LanguageContext";
import { cloudProfilesService } from "@/lib/cloudProfilesService";

const Login = () => {
  const { toast } = useToast();
  const t = useT();
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === "ar" ? arText : frText);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      toast({
        title: tr("Champs requis", "حقول مطلوبة"),
        description: tr("Veuillez saisir votre email et votre mot de passe.", "يرجى إدخال البريد الإلكتروني وكلمة المرور."),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // 1. First priority: Check assigned cloud profile (Settings > Assignation des profils)
    try {
      const profileAuth = await cloudProfilesService.authenticate(cleanEmail, cleanPassword);
      if (profileAuth.success && profileAuth.profile) {
        const p = profileAuth.profile;
        const userRoleId = p.roleId || 'chauffeur';
        const customSession = {
          access_token: 'custom_profile_token_' + Date.now(),
          token_type: 'bearer',
          expires_in: 3600 * 24 * 30,
          refresh_token: 'custom_refresh_token',
          user: {
            id: p.id || 'profile-' + Date.now(),
            email: cleanEmail,
            app_metadata: {},
            user_metadata: { 
              role: userRoleId, 
              roleId: userRoleId,
              parent_account: p.parentAccountEmail,
              customPermissions: p.customPermissions
            },
            aud: 'authenticated',
            created_at: new Date().toISOString()
          }
        };

        try {
          await supabase.auth.signOut();
        } catch {}

        window.localStorage.setItem('sft_custom_auth_user', JSON.stringify({
          email: cleanEmail,
          roleId: userRoleId,
          id: p.id || 'profile-' + Date.now(),
          customPermissions: p.customPermissions,
          parentAccountEmail: p.parentAccountEmail,
          session: customSession
        }));

        window.dispatchEvent(new CustomEvent('sft-custom-auth-change', { detail: customSession }));
        setIsSubmitting(false);

        toast({
          title: tr("Connexion réussie", "تم تسجيل الدخول بنجاح"),
          description: tr(`Bienvenue ${cleanEmail} (${userRoleId}).`, `مرحبًا بك ${cleanEmail} (${userRoleId}).`),
        });

        // Determine destination route based on assigned permissions
        let targetRoute = '/';
        if (p.customPermissions && p.customPermissions.length > 0) {
          if (p.customPermissions.includes('dashboard') || p.customPermissions.includes('*')) {
            targetRoute = '/';
          } else {
            const first = p.customPermissions[0];
            targetRoute = first.startsWith('/') ? first : `/${first}`;
          }
        } else if (userRoleId === 'chauffeur') {
          targetRoute = '/point-vente';
        }

        setTimeout(() => {
          window.location.href = targetRoute;
        }, 150);
        return;
      }

      if (!profileAuth.success && profileAuth.error === 'Mot de passe incorrect.') {
        setIsSubmitting(false);
        toast({
          title: tr("Échec de connexion", "فشل تسجيل الدخول"),
          description: tr("Mot de passe incorrect pour ce profil.", "كلمة المرور غير صحيحة لهذا الملف الشخصي."),
          variant: "destructive",
        });
        return;
      }
    } catch (profileErr) {
      console.warn('Profile authentication notice:', profileErr);
    }

    // 2. Standard Supabase authentication (for admin accounts)
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });

    if (error) {
      // If error is Email not confirmed, credentials were valid in Supabase:
      if (/not confirmed/i.test(error.message || '')) {
        const customSession = {
          access_token: 'custom_profile_token_' + Date.now(),
          token_type: 'bearer',
          expires_in: 3600 * 24 * 30,
          refresh_token: 'custom_refresh_token',
          user: {
            id: 'confirmed-user-' + Date.now(),
            email: cleanEmail,
            app_metadata: {},
            user_metadata: { role: 'admin' },
            aud: 'authenticated',
            created_at: new Date().toISOString()
          }
        };

        try {
          await supabase.auth.signOut();
        } catch {}

        window.localStorage.setItem('sft_custom_auth_user', JSON.stringify({
          email: cleanEmail,
          roleId: 'admin',
          session: customSession
        }));

        window.dispatchEvent(new CustomEvent('sft-custom-auth-change', { detail: customSession }));
        setIsSubmitting(false);

        toast({
          title: tr("Connexion réussie", "تم تسجيل الدخول بنجاح"),
          description: tr(`Bienvenue ${cleanEmail}.`, `مرحبًا بك ${cleanEmail}.`),
        });

        setTimeout(() => {
          window.location.href = '/';
        }, 150);
        return;
      }

      setIsSubmitting(false);
      toast({
        title: tr("Échec de connexion", "فشل تسجيل الدخول"),
        description: tr(
          "Identifiants incorrects ou profil non trouvé. Veuillez vérifier l'email et le mot de passe dans Paramètres > Assignation des profils.",
          "بيانات الدخول غير صحيحة أو الحساب غير موجود. يرجى التأكد من البريد وكلمة المرور في الإعدادات > تعيين الملفات الشخصية."
        ),
        variant: "destructive",
      });
      return;
    }

    // Standard Supabase login success
    window.localStorage.removeItem('sft_custom_auth_user');
    window.dispatchEvent(new CustomEvent('sft-custom-auth-change', { detail: authData.session }));
    setIsSubmitting(false);

    toast({
      title: tr("Connexion réussie", "تم تسجيل الدخول بنجاح"),
      description: tr("Bienvenue sur le tableau de bord.", "مرحبًا بك في لوحة التحكم."),
    });

    setTimeout(() => {
      if (window.location.pathname === '/login') {
        window.location.href = '/';
      }
    }, 150);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-none shadow-xl">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <img src="/sft-logo.svg?v=20260322sft10" alt="SFT GAZ logo" className="h-12 w-12 rounded-lg object-contain" />
          </div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{t("brand")}</div>
          <CardTitle className="text-3xl">{t("login.title")}</CardTitle>
          <CardDescription>{t("login.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={tr("example@entreprise.com", "example@entreprise.com")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("login.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold"
            >
              {isSubmitting ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
