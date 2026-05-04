import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';
import { Check, ShieldCheck } from 'lucide-react';

export default function BotCheckSlider({ onVerify }: { onVerify: () => void }) {
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isVerified) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isVerified || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const handleWidth = 48; // width of the handle
    const maxDrag = rect.width - handleWidth;
    let newProgress = ((e.clientX - rect.left - (handleWidth / 2)) / maxDrag) * 100;
    
    newProgress = Math.max(0, Math.min(100, newProgress));
    setProgress(newProgress);
    controls.set({ x: `${newProgress}%` });

    if (newProgress >= 98) {
      setIsVerified(true);
      setIsDragging(false);
      setProgress(100);
      controls.start({ x: '100%' });
      onVerify();
    }
  };

  const handlePointerUp = () => {
    if (isVerified) return;
    setIsDragging(false);
    if (progress < 98) {
      setProgress(0);
      controls.start({ x: '0%', transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  return (
    <div className="w-full flex-col flex items-center justify-center space-y-2 mt-4">
      <div 
        ref={sliderRef}
        className="w-full h-12 bg-slate-100 rounded-full cursor-pointer relative overflow-hidden flex items-center shadow-inner border border-slate-200 select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Current progress background */}
        <motion.div 
          className="absolute left-0 top-0 bottom-0 bg-blue-100" 
          style={{ width: `calc(${progress}% + 48px/2)` }}
        />

        {/* Success Background overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: isVerified ? 1 : 0 }}
          className="absolute inset-0 bg-emerald-500 z-10 flex items-center justify-center text-white font-medium"
        >
          Verified Human
        </motion.div>

        {/* Text Prompt */}
        {!isVerified && (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-500 pointer-events-none z-0">
            Slide to verify
          </div>
        )}

        {/* Handle */}
        {!isVerified && (
          <motion.div
            animate={controls}
            className="absolute left-0 h-10 w-12 bg-white rounded-full shadow border border-slate-300 flex items-center justify-center z-10 ml-1 touch-none"
            style={{ 
              left: `calc(${progress}% * (1 - 48px / 100%))` 
            }}
          >
            <ArrowRight className="w-5 h-5 text-slate-400" />
          </motion.div>
        )}
      </div>
      <p className="text-xs text-slate-400 flex items-center gap-1.5 justify-center">
        <ShieldCheck className="w-3.5 h-3.5" />
        Secured by BotCheck
      </p>
    </div>
  );
}

// Temporary ArrowRight until imported
function ArrowRight({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
