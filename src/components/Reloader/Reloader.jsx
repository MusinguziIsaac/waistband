import React from 'react'

export default function Reloader({ message = 'Loading WAISTBAND HUB...', fullScreen = true }) {
  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4'
    : 'w-full py-16 flex items-center justify-center bg-slate-950/80 rounded-2xl border border-emerald-900/40 p-4'

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center justify-center text-center space-y-6">
        {/* Animated Glowing 3D Logo Badge Container */}
        <div className="relative flex items-center justify-center p-2">
          {/* Outer Pulsing Green Aura */}
          <div className="absolute w-44 h-44 rounded-full bg-emerald-500/30 blur-2xl animate-pulse"></div>
          
          {/* Outer Rotating Radar Ring */}
          <div className="absolute w-40 h-40 rounded-full border-2 border-dashed border-emerald-400/50 animate-[spin_8s_linear_infinite]"></div>
          <div className="absolute w-36 h-36 rounded-full border-t-2 border-r-2 border-emerald-400 animate-spin"></div>

          {/* Glowing 3D Logo Emblem */}
          <div className="relative z-10 w-32 h-32 flex items-center justify-center filter drop-shadow-[0_0_25px_rgba(116,255,0,0.9)]">
            <img src="/reloader.png" alt="WAISTBAND HUB LTD Reloader Logo" className="w-full h-full object-contain animate-pulse" />
          </div>
        </div>

        {/* Status Loading Typography */}
        <div className="space-y-2">
          <h2 className="text-lg font-extrabold text-white tracking-wide drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
            WAISTBAND HUB LTD
          </h2>
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-400 tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>{message}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
