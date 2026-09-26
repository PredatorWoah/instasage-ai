import { cn } from '@/lib/utils';

// Sage: a living, morphing Prism blob with eyes. Pure CSS (see .sage in globals.css).
export function SageOrb({ size = 60, sleeping = false, className }: { size?: number; sleeping?: boolean; className?: string }) {
  return (
    <span className={cn('sage', sleeping && 'sage-sleeping', className)} style={{ width: size, height: size }} aria-hidden>
      <span className="sage-body" />
      <span className="sage-gloss" />
      <span className="sage-face">
        <span className="sage-eye" />
        <span className="sage-eye" />
      </span>
    </span>
  );
}
