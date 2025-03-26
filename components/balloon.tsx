'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface BalloonProps {
  onBurst: () => void;
  isWhite?: boolean;
}

export function Balloon({ onBurst, isWhite }: BalloonProps) {
  const [isPopped, setIsPopped] = useState(false);
  const balloonRef = useRef<HTMLDivElement>(null);
  
  const handlePop = useCallback(() => {
    if (isPopped) return;
    setIsPopped(true);
    // Delay onBurst callback until animation completes
    setTimeout(onBurst, 400);
  }, [isPopped, onBurst]);

  // Cleanup animation elements
  useEffect(() => {
    if (!isPopped) return;
    const timer = setTimeout(() => {
      if (balloonRef.current) {
        balloonRef.current.style.display = 'none';
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [isPopped]);

  return (
    <div 
      ref={balloonRef}
      className={`balloon-container ${isPopped ? 'popped' : ''}`}
      onClick={handlePop}
    >
      <div className="balloon">
        <div 
          className={cn(
            "balloon-body",
            isWhite && "balloon-body-white"
          )}
        />
        <div className="balloon-highlight" />
        <div className="balloon-highlight-secondary" />
        <div 
          className={cn(
            "balloon-tie",
            isWhite && "balloon-tie-white"
          )}
        />
      </div>
      
      {/* Burst particles - only created when popping */}
      {isPopped && (
        <>
          <div className="burst-ring" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div 
              key={i}
              className="burst-particle"
              style={{
                '--angle': `${i * 60}deg`,
                '--delay': `${i * 0.02}s`
              } as React.CSSProperties}
            />
          ))}
        </>
      )}
    </div>
  );
}