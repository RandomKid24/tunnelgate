import appIcon from '../../../resources/icons/256x256.png';
import { cn } from '@/lib/utils';

/**
 * The TunnelGate app icon.
 *
 * The artwork is a dark navy mark with bright blue accents on a transparent background, so it is
 * always drawn on a white tile: on the light theme's sidebar that tile blends into the surface,
 * and on the dark theme it reads as an app-icon chip instead of a mark that disappears into the
 * background. Size it with `className` (e.g. `size-8`).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-black/5',
        className,
      )}
    >
      <img src={appIcon} alt="" className="size-full object-contain" />
    </div>
  );
}
