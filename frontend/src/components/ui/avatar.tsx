import { useState } from 'react'
import { cn } from '@/lib/utils'

type AvatarSize = 'sm' | 'md' | 'lg'

const SIZE: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-24 w-24 text-2xl',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

interface AvatarProps {
  name: string
  src?: string | null
  size?: AvatarSize
  className?: string
}

/** Runder Avatar mit Initialen als Fallback (auch bei fehlgeladenem Bild). */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  // Fehlgeschlagene URL merken, damit ein neues src (z. B. nach Upload) wieder versucht wird
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && failedSrc !== src

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-semibold text-secondary-foreground',
        SIZE[size],
        className,
      )}
      role={showImage ? undefined : 'img'}
      aria-label={showImage ? undefined : name}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={name}
          className="h-full w-full rounded-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        initials(name)
      )}
    </span>
  )
}
