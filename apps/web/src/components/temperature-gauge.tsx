"use client";

import { motion, useReducedMotion } from "motion/react";
import { Thermometer } from "@phosphor-icons/react";

export function TemperatureGauge({
  temperature = 80,
  size = "md",
  showLabel = true,
  className = "",
}: {
  temperature?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();

  const clampedTemp = Math.max(20, Math.min(100, temperature));
  const percentage = ((clampedTemp - 20) / 80) * 100;

  const getColor = () => {
    if (clampedTemp < 40) return "var(--sauna-temp-cold)";
    if (clampedTemp < 60) return "var(--sauna-temp-warm)";
    if (clampedTemp < 80) return "var(--sauna-temp-hot)";
    return "var(--sauna-temp-vhot)";
  };

  const sizeMap = {
    sm: { container: "h-8", icon: 16, text: "text-xs" },
    md: { container: "h-10", icon: 18, text: "text-sm" },
    lg: { container: "h-12", icon: 20, text: "text-base" },
  };

  const config = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div
        className={`relative overflow-hidden rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] px-3 ${config.container}`}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            backgroundColor: getColor(),
            opacity: 0.2,
          }}
          initial={{ width: "0%" }}
          animate={{ width: `${percentage}%` }}
          transition={reduce ? { duration: 0.01 } : { duration: 0.8, ease: "easeOut" }}
        />
        <div className="relative flex items-center gap-2">
          <Thermometer size={config.icon} weight="duotone" style={{ color: getColor() }} />
          {showLabel && (
            <motion.span
              className={`font-semibold tracking-tight ${config.text}`}
              style={{ color: getColor() }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {Math.round(clampedTemp)}°C
            </motion.span>
          )}
        </div>
      </div>
    </div>
  );
}
