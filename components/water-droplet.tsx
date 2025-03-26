'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useState, useMemo } from 'react';

interface WaterDropletProps {
  onBurst: () => void;
}

interface Particle {
  angle: number;
  speed: number;
  scale: number;
  opacity: number;
}

export function WaterDroplet({ onBurst }: WaterDropletProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Generate random particles for the burst effect
  const particles = useMemo(() => {
    return Array.from({ length: 12 }).map(() => ({
      angle: Math.random() * Math.PI * 2,
      speed: 20 + Math.random() * 30,
      scale: 0.5 + Math.random() * 0.5,
      opacity: 0.6 + Math.random() * 0.4
    }));
  }, []);

  const handleClick = useCallback(() => {
    setIsVisible(false);
    setTimeout(onBurst, 600);
  }, [onBurst]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="relative w-8 h-8"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{
            scale: 2.5,
            opacity: 0,
            filter: "blur(8px)",
          }}
          transition={{
            exit: { 
              duration: 0.3,
              ease: [0.32, 0, 0.67, 0]
            },
          }}
        >
          {/* Main droplet */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-b from-blue-100/90 via-blue-300/80 to-blue-400/70 backdrop-blur-sm"
            style={{
              boxShadow: `
                inset 0 4px 8px rgba(255,255,255,0.9),
                inset 0 -4px 8px rgba(0,0,0,0.2),
                0 4px 12px -2px rgba(0,0,0,0.3)
              `,
            }}
            animate={{
              y: [0, -2, 0],
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            onClick={handleClick}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          />
          
          {/* Highlight effect */}
          <motion.div
            className="absolute top-1.5 left-1.5 w-3 h-3 rounded-full bg-white/60"
            animate={{
              opacity: [0.4, 0.6, 0.4],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Shockwave ring */}
          <AnimatePresence>
            {!isVisible && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-blue-200/40"
                initial={{ scale: 1 }}
                exit={{
                  scale: 4,
                  opacity: 0,
                }}
                transition={{
                  duration: 0.5,
                  ease: "easeOut"
                }}
              />
            )}
          </AnimatePresence>
          
          {/* Burst particles */}
          <AnimatePresence>
            {!isVisible && (
              <>
                {particles.map((particle, i) => (
                  <motion.div
                    key={i}
                    className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
                    style={{
                      background: `radial-gradient(circle at center, 
                        rgba(147, 197, 253, ${particle.opacity}),
                        rgba(147, 197, 253, 0)
                      )`,
                      boxShadow: '0 0 4px rgba(147, 197, 253, 0.4)',
                    }}
                    initial={{ 
                      x: 0,
                      y: 0,
                      scale: 0,
                      opacity: particle.opacity 
                    }}
                    exit={{
                      x: Math.cos(particle.angle) * particle.speed,
                      y: Math.sin(particle.angle) * particle.speed,
                      scale: 0,
                      opacity: 0,
                    }}
                    transition={{
                      duration: 0.5,
                      ease: [0.32, 0, 0.67, 0],
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>
          
        </motion.div>
      )}
    </AnimatePresence>
  );
}