import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Eye, EyeOff, ShieldCheck, AlertTriangle, Sparkles, Lock, Unlock } from 'lucide-react';

interface AnimatedGasCageProps {
  cageNumber: string;
  totalCapacity: number;
  pleines: number;
  vides: number;
  etrangeres: number;
  defectueuses?: number;
  brandName?: string;
  bottleType?: string;
  posName?: string;
  onOpenAudit?: () => void;
}

export const AnimatedGasCage: React.FC<AnimatedGasCageProps> = ({
  cageNumber,
  totalCapacity = 20,
  pleines = 0,
  vides = 0,
  etrangeres = 0,
  defectueuses = 0,
  brandName = 'Afriquia Gaz',
  bottleType = '12 Kg',
  posName,
  onOpenAudit,
}) => {
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const totalBottles = pleines + vides + etrangeres + defectueuses;
  const missing = Math.max(0, totalCapacity - totalBottles);
  const surplus = Math.max(0, totalBottles - totalCapacity);

  // Generate an array of slots for the 20-bottle grid (2 shelves of 10 bottles each, or 4 rows of 5)
  const slots: Array<{
    id: number;
    type: 'pleine' | 'vide' | 'etrangere' | 'defectueuse' | 'vide_slot';
    label: string;
    color: string;
    textColor: string;
  }> = [];

  let pCount = pleines;
  let vCount = vides;
  let eCount = etrangeres;
  let dCount = defectueuses;

  for (let i = 0; i < Math.max(totalCapacity, totalBottles); i++) {
    if (pCount > 0) {
      slots.push({
        id: i,
        type: 'pleine',
        label: `Pleine (${brandName} ${bottleType})`,
        color: brandName.toLowerCase().includes('tissir')
          ? 'from-rose-600 via-rose-500 to-rose-700'
          : 'from-blue-600 via-cyan-500 to-blue-700',
        textColor: 'text-white',
      });
      pCount--;
    } else if (vCount > 0) {
      slots.push({
        id: i,
        type: 'vide',
        label: `Bouteille Vide (${bottleType})`,
        color: 'from-slate-700 via-slate-600 to-slate-800 border-dashed',
        textColor: 'text-slate-300',
      });
      vCount--;
    } else if (eCount > 0) {
      slots.push({
        id: i,
        type: 'etrangere',
        label: `Bouteille Étrangère (${bottleType})`,
        color: 'from-amber-600 via-yellow-500 to-amber-700',
        textColor: 'text-amber-100',
      });
      eCount--;
    } else if (dCount > 0) {
      slots.push({
        id: i,
        type: 'defectueuse',
        label: `Bouteille Défectueuse`,
        color: 'from-red-600 via-red-500 to-red-800',
        textColor: 'text-white',
      });
      dCount--;
    } else {
      slots.push({
        id: i,
        type: 'vide_slot',
        label: 'Emplacement Libre / Manquant',
        color: 'from-slate-900/40 to-slate-900/60 border-slate-700/50',
        textColor: 'text-slate-600',
      });
    }
  }

  return (
    <div
      className="relative flex flex-col items-center select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 3D Rolling Cage Container */}
      <div className="relative w-64 md:w-72 h-[340px] transition-transform duration-500 ease-out perspective-1000">
        {/* Glow ambient background behind the cage */}
        <div
          className={`absolute -inset-2 bg-gradient-to-tr from-blue-600/20 via-cyan-500/10 to-indigo-600/20 rounded-3xl blur-xl transition-opacity duration-500 ${
            isHovered ? 'opacity-100' : 'opacity-40'
          }`}
        />

        {/* The Metal Cage Structure */}
        <div className="relative w-full h-[290px] rounded-2xl bg-gradient-to-b from-blue-900/30 via-slate-950/80 to-slate-950 border-[3px] border-blue-500 shadow-2xl shadow-blue-500/10 overflow-hidden flex flex-col justify-between">
          {/* Top Metal Roof Bar with Handle */}
          <div className="h-6 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 border-b-2 border-blue-400 flex items-center justify-between px-3 text-[10px] font-black text-white tracking-widest uppercase shadow-md">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {cageNumber}
            </span>
            <span className="font-mono text-blue-200">
              {totalBottles}/{totalCapacity} Btl
            </span>
          </div>

          {/* Left Side Push Handle Bar (matching the real rolling trolley) */}
          <div className="absolute -left-1 top-24 w-3.5 h-20 bg-slate-800 rounded-r-md border border-slate-600 flex flex-col justify-between p-0.5 z-20 shadow-md">
            <div className="w-full h-1 bg-slate-500 rounded" />
            <div className="w-full h-8 bg-slate-900 rounded" />
            <div className="w-full h-1 bg-slate-500 rounded" />
          </div>

          {/* Mesh Wire Background Grid Layer */}
          <div
            className="absolute inset-0 top-6 bottom-4 pointer-events-none opacity-25 z-0"
            style={{
              backgroundImage: `linear-gradient(to right, #60a5fa 1px, transparent 1px), linear-gradient(to bottom, #60a5fa 1px, transparent 1px)`,
              backgroundSize: '12px 12px',
            }}
          />

          {/* Internal Shelves & Gas Bottles Display */}
          <div className="relative z-10 flex-1 p-3 grid grid-cols-5 gap-1.5 content-center items-center overflow-hidden">
            <TooltipProvider delayDuration={150}>
              {slots.slice(0, 20).map((slot) => (
                <Tooltip key={slot.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={`relative aspect-[3/5] rounded-md transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-0.5 border ${
                        slot.type === 'vide_slot'
                          ? 'border-dashed border-slate-800 bg-slate-900/40 hover:border-slate-600'
                          : `bg-gradient-to-b ${slot.color} border-white/20 shadow-sm hover:scale-110 hover:z-20`
                      }`}
                    >
                      {/* Bottle Cap / Valve Handle */}
                      {slot.type !== 'vide_slot' && (
                        <>
                          <div className="w-2 h-1 bg-gradient-to-r from-slate-200 to-slate-400 rounded-t-sm shadow-xs" />
                          <div className="w-full h-1.5 rounded-sm bg-black/20 flex items-center justify-center">
                            <span className="text-[7px] font-bold text-white tracking-tighter">
                              {slot.type === 'pleine' ? '✓' : slot.type === 'vide' ? '○' : '★'}
                            </span>
                          </div>
                          {/* Bottle Belly */}
                          <div className="w-full flex-1 flex items-center justify-center">
                            <span className="text-[8px] font-extrabold text-white/90 drop-shadow-sm font-mono">
                              12k
                            </span>
                          </div>
                          {/* Bottle Base */}
                          <div className="w-3.5 h-1 bg-black/40 rounded-b-xs" />
                        </>
                      )}

                      {slot.type === 'vide_slot' && (
                        <div className="w-full h-full flex items-center justify-center text-slate-700 text-[9px] font-mono">
                          +
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-slate-900 border-slate-700 text-xs text-white">
                    <p className="font-bold">{slot.label}</p>
                    <p className="text-[10px] text-slate-400">Position casier #{slot.id + 1}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>

          {/* Bottom Perforated Steel Plate Floor */}
          <div className="h-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t-2 border-blue-500/60 flex items-center justify-around px-2">
            {[...Array(12)].map((_, idx) => (
              <span key={idx} className="w-1 h-1 rounded-full bg-slate-950" />
            ))}
          </div>

          {/* DOUBLE WIRE-MESH DOORS (Left & Right that animate open and close) */}
          {/* Left Door */}
          <div
            onClick={() => setDoorsOpen(!doorsOpen)}
            className={`absolute top-6 bottom-4 left-0 w-1/2 border-r border-blue-400 bg-blue-950/40 backdrop-blur-[1px] transition-transform duration-700 ease-in-out cursor-pointer z-30 origin-left border-y-2 border-l-2 border-blue-500 ${
              doorsOpen ? '-rotate-y-110 opacity-30 shadow-2xl' : 'rotate-y-0 opacity-95'
            }`}
            style={{
              backgroundImage: `linear-gradient(to right, rgba(96, 165, 250, 0.45) 1.5px, transparent 1.5px), linear-gradient(to bottom, rgba(96, 165, 250, 0.45) 1.5px, transparent 1.5px)`,
              backgroundSize: '10px 10px',
            }}
          >
            {/* Left Door Latch */}
            <div className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-6 bg-slate-900 border border-slate-400 rounded-sm shadow-md" />
          </div>

          {/* Right Door */}
          <div
            onClick={() => setDoorsOpen(!doorsOpen)}
            className={`absolute top-6 bottom-4 right-0 w-1/2 border-l border-blue-400 bg-blue-950/40 backdrop-blur-[1px] transition-transform duration-700 ease-in-out cursor-pointer z-30 origin-right border-y-2 border-r-2 border-blue-500 ${
              doorsOpen ? 'rotate-y-110 opacity-30 shadow-2xl' : 'rotate-y-0 opacity-95'
            }`}
            style={{
              backgroundImage: `linear-gradient(to right, rgba(96, 165, 250, 0.45) 1.5px, transparent 1.5px), linear-gradient(to bottom, rgba(96, 165, 250, 0.45) 1.5px, transparent 1.5px)`,
              backgroundSize: '10px 10px',
            }}
          >
            {/* Right Door Handle & Lock Latch */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2.5 h-10 bg-slate-900 border border-amber-400/80 rounded flex flex-col items-center justify-between py-1 shadow-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <div className="w-1 h-3 bg-slate-600 rounded" />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            </div>
          </div>
        </div>

        {/* 4 Heavy-Duty Caster Wheels with Swivel Brackets (matching user image) */}
        <div className="relative w-full h-10 flex justify-between px-3 pt-1">
          {/* Wheel 1 (Front Left with brake) */}
          <div className="flex flex-col items-center animate-bounce-short">
            <div className="w-4 h-3 bg-slate-400 border border-slate-300 rounded-t-xs" />
            <div className="w-6 h-6 rounded-full bg-slate-900 border-2 border-slate-500 flex items-center justify-center shadow-md">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            </div>
          </div>

          {/* Wheel 2 (Inner Left) */}
          <div className="flex flex-col items-center">
            <div className="w-3.5 h-2.5 bg-slate-500 rounded-t-xs" />
            <div className="w-5 h-5 rounded-full bg-slate-900 border-2 border-slate-600 flex items-center justify-center shadow-md">
              <div className="w-2 h-2 rounded-full bg-slate-500" />
            </div>
          </div>

          {/* Wheel 3 (Inner Right) */}
          <div className="flex flex-col items-center">
            <div className="w-3.5 h-2.5 bg-slate-500 rounded-t-xs" />
            <div className="w-5 h-5 rounded-full bg-slate-900 border-2 border-slate-600 flex items-center justify-center shadow-md">
              <div className="w-2 h-2 rounded-full bg-slate-500" />
            </div>
          </div>

          {/* Wheel 4 (Front Right with brake) */}
          <div className="flex flex-col items-center animate-bounce-short">
            <div className="w-4 h-3 bg-slate-400 border border-slate-300 rounded-t-xs" />
            <div className="w-6 h-6 rounded-full bg-slate-900 border-2 border-slate-500 flex items-center justify-center shadow-md">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Cage Interactive Controls & Status Pills */}
      <div className="w-full mt-2 flex flex-col gap-2">
        {/* Door Toggle Button */}
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDoorsOpen(!doorsOpen)}
            className={`h-7 px-2.5 text-xs rounded-xl gap-1.5 transition-all ${
              doorsOpen
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            {doorsOpen ? (
              <>
                <Unlock className="w-3 h-3 text-cyan-400" />
                <span>Portes Ouvertes</span>
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Ouvrir les Portes</span>
              </>
            )}
          </Button>

          {onOpenAudit && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenAudit}
              className="h-7 px-2.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-sm"
            >
              Recensement
            </Button>
          )}
        </div>

        {/* Real-Time Stock Breakdown Badges */}
        <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
          <div className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Pleines:</span>
            <span className="font-bold text-blue-400">{pleines}</span>
          </div>

          <div className="px-2 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-300 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Vides:</span>
            <span className="font-bold text-slate-300">{vides}</span>
          </div>

          <div className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Étrang.:</span>
            <span className="font-bold text-amber-400">{etrangeres}</span>
          </div>
        </div>

        {/* Discrepancy Alert */}
        {missing > 0 && (
          <div className="px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Manque {missing} bouteille(s) par rapport à la dotation ({totalCapacity})</span>
          </div>
        )}

        {surplus > 0 && (
          <div className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Surplus de +{surplus} bouteille(s) dans le casier</span>
          </div>
        )}
      </div>
    </div>
  );
};
