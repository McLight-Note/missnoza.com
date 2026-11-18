import { cn } from "@/lib/utils";

/*
 * Soft botanical line drawings (branches, leaves, blossoms, dew drops) that sit
 * behind the page content, so the cream background feels natural instead of
 * flat. They are decoration only: hidden from screen readers, never clickable,
 * and faint enough that text on top stays readable. Colours come from the
 * theme (sage green and the brand pink).
 */

type ArtProps = { className?: string };

function Art({ className, children }: ArtProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("absolute", className)}
    >
      {children}
    </svg>
  );
}

/** One leaf pointing right from the origin, with its centre vein. */
const LEAF = "M0 0C8 -11 28 -11 36 0C28 11 8 11 0 0Z";

/** A curved stem with leaves on both sides, like a sprig of green. */
function Branch({ className }: ArtProps) {
  // x, y, angle (degrees), scale: leaves placed along the stem.
  const leaves: [number, number, number, number][] = [
    [43, 160, -106, 1.05],
    [43, 160, 4, 0.95],
    [67, 129, -108, 0.95],
    [67, 129, 0, 0.9],
    [94, 96, -100, 0.85],
    [94, 96, 4, 0.8],
    [128, 60, -92, 0.75],
    [128, 60, 10, 0.7],
    [170, 20, -35, 0.7],
  ];
  return (
    <Art className={className}>
      <path d="M20 190C60 140 90 90 170 20" />
      {leaves.map(([x, y, angle, scale]) => (
        <g key={`${x}-${angle}`} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
          <path d={LEAF} fill="currentColor" fillOpacity="0.14" />
          <path d="M2 0H32" />
        </g>
      ))}
    </Art>
  );
}

/** A single broad leaf with veins. */
function Leaf({ className }: ArtProps) {
  return (
    <Art className={className}>
      <path d="M100 190C40 140 40 60 100 10C160 60 160 140 100 190Z" fill="currentColor" fillOpacity="0.12" />
      <path d="M100 190V30" />
      <path d="M100 150L68 124M100 150L132 124M100 112L72 88M100 112L128 88M100 76L80 58M100 76L120 58" />
    </Art>
  );
}

/** A five-petal blossom. */
function Blossom({ className }: ArtProps) {
  return (
    <Art className={className}>
      {[0, 72, 144, 216, 288].map((angle) => (
        <path
          key={angle}
          d="M0 0C-16 -12 -16 -42 -5 -48L0 -41L5 -48C16 -42 16 -12 0 0Z"
          transform={`translate(100 100) rotate(${angle}) scale(1.35)`}
          fill="currentColor"
          fillOpacity="0.13"
        />
      ))}
      <circle cx="100" cy="100" r="5" fill="currentColor" fillOpacity="0.3" />
      {[0, 72, 144, 216, 288].map((angle) => (
        <path key={angle} d="M0 -8L0 -20" transform={`translate(100 100) rotate(${angle + 36})`} />
      ))}
    </Art>
  );
}

/** A dew drop with a small highlight. */
function Droplet({ className }: ArtProps) {
  return (
    <Art className={className}>
      <path d="M100 20C100 20 55 80 55 120a45 45 0 0 0 90 0C145 80 100 20 100 20Z" fill="currentColor" fillOpacity="0.12" />
      <path d="M78 122a24 24 0 0 0 16 24" />
    </Art>
  );
}

export function BackgroundDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <Branch className="top-[5%] -left-10 w-32 rotate-6 text-sage opacity-45 md:w-52 xl:w-64" />
      <Blossom className="top-[13%] -right-8 w-28 rotate-12 text-brand-300 opacity-60 md:w-44 xl:w-56" />
      <Leaf className="top-[27%] -left-8 hidden w-36 -rotate-12 text-sage opacity-40 md:block md:w-44 xl:w-52" />
      <Droplet className="top-[38%] right-3 hidden w-16 text-brand-300 opacity-60 md:block xl:right-10 xl:w-20" />
      <Branch className="top-[48%] -right-12 w-32 -scale-x-100 -rotate-12 text-sage opacity-45 md:w-56 xl:w-72" />
      <Blossom className="top-[62%] -left-8 hidden w-32 -rotate-12 text-brand-300 opacity-60 md:block md:w-44 xl:w-56" />
      <Leaf className="top-[74%] -right-8 w-28 rotate-[24deg] text-sage opacity-40 md:w-40 xl:w-52" />
      <Droplet className="top-[82%] left-4 hidden w-14 text-brand-300 opacity-60 md:block xl:left-12 xl:w-20" />
      <Branch className="bottom-2 -left-10 hidden w-48 rotate-[200deg] text-sage opacity-40 md:block xl:w-64" />
      <Blossom className="bottom-6 -right-6 w-24 rotate-[20deg] text-brand-300 opacity-55 md:w-36 xl:w-48" />
    </div>
  );
}
