"use client";

import { motion, useReducedMotion } from "motion/react";

interface SteamParticle {
  id: number;
  delay: number;
  duration: number;
  x: string;
  scale: number;
}

function generateParticles(count: number): SteamParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    delay: Math.random() * 2,
    duration: 2.5 + Math.random() * 1.5,
    x: `${20 + Math.random() * 60}%`,
    scale: 0.6 + Math.random() * 0.8,
  }));
}

export function SteamParticles({
  density = "medium",
  speed = "normal",
  className = "",
}: {
  density?: "light" | "medium" | "dense";
  speed?: "slow" | "normal" | "fast";
  className?: string;
}) {
  const reduce = useReducedMotion();

  const densityMap = { light: 3, medium: 5, dense: 8 };
  const speedMap = { slow: 1.4, normal: 1, fast: 0.7 };
  const particles = generateParticles(densityMap[density]);
  const speedMultiplier = speedMap[speed];

  if (reduce) {
    return (
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-full overflow-hidden ${className}`}>
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[var(--sauna-steam-light)] to-transparent opacity-60" />
      </div>
    );
  }

  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-full overflow-hidden ${className}`} aria-hidden="true">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute bottom-0 h-24 w-24 rounded-full bg-gradient-radial from-[var(--sauna-steam-medium)] to-transparent blur-xl"
          style={{
            left: particle.x,
            scale: particle.scale,
          }}
          animate={{
            y: [0, -120],
            opacity: [0, 0.7, 0.4, 0],
            scale: [particle.scale, particle.scale * 1.3, particle.scale * 1.6],
          }}
          transition={{
            duration: particle.duration * speedMultiplier,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
