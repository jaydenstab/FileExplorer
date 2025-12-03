"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const themeIcons = {
  light: Sun,
  dark: Moon,
}

export type ThemeToggleVariant = "button"
export type ThemeToggleSize = "sm" | "md" | "lg"

type Theme = "light" | "dark"

interface ThemeToggleProps {
  variant?: ThemeToggleVariant
  size?: ThemeToggleSize
  themes?: Theme[]
  className?: string
}

export function Theme({
  size = "md",
  themes = ["light", "dark"],
  className,
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const sizeClasses = {
    sm: "h-8 px-2 text-xs",
    md: "h-10 px-3 text-sm",
    lg: "h-12 px-4 text-base",
  }

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20,
  }

  if (!isMounted) return null

  function isTheme(value: unknown): value is Theme {
    return (
      typeof value === "string" && ["light", "dark"].includes(value)
    )
  }

  const safeTheme: Theme =
    isTheme(theme) && themes.includes(theme) ? theme : "dark"

  const nextTheme = safeTheme === "light" ? "dark" : "light"

  const Icon = themeIcons[safeTheme]

  return (
    <motion.button
      onClick={() => setTheme(nextTheme)}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border transition-all duration-200",
        "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)]",
        "hover:scale-105 hover:bg-[var(--color-muted)] hover:border-[var(--color-primary)] active:scale-95",
        "shadow-sm hover:shadow-md",
        sizeClasses[size],
        className
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        key={safeTheme}
        initial={{ rotate: -180, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Icon size={iconSizes[size]} />
      </motion.div>
    </motion.button>
  )
}

