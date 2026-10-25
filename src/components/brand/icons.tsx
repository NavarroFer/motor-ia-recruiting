import { cn } from "@/lib/utils";

// Versión ícono (24 px) de los 8 objetos de la marca (02_Illustrations): mismas formas,
// trazo más grueso para que se lean chicos y color por currentColor.
export type BrandIconName = "computer" | "windows" | "cursor" | "document" | "disk" | "keys" | "hourglass" | "globe";

const S = { fill: "none", stroke: "currentColor", strokeLinejoin: "round", strokeLinecap: "round" } as const;

const PATHS: Record<BrandIconName, React.ReactNode> = {
  computer: (
    <>
      <path fillRule="evenodd" d="M1.5 4.5h5v13h-5z M2.6 6v1.6h2.8V6z" fill="currentColor" />
      <path fillRule="evenodd" d="M8 3h14.5v11H8z M10 5v7h10.5V5z" fill="currentColor" />
      <path {...S} strokeWidth={1} d="M17.8 6.2l-1.7 2.6 M19.3 6.6l-2.6 4" />
      <path d="M13.5 14h3.5v1.8h-3.5z" fill="currentColor" />
      <path {...S} strokeWidth={1.3} d="M9.2 17.2h11.6l1.6 2.3H7.6z M1 21.6h22" />
    </>
  ),
  windows: (
    <>
      <path d="M1.5 2h13v3h-13z M5 5.5h13v3H5z M9.5 11h13v3h-13z" fill="currentColor" />
      <path {...S} strokeWidth={1.3} d="M2.15 5v7H5 M5.65 8.5v7h3.8 M17.35 8.5V11 M10.15 14v6.85h11.7V14" />
      <path {...S} strokeWidth={1} d="M12 16.6h7.8v2h-7.8z" />
      <path d="M12.6 17.2h4.4v.8h-4.4z" fill="currentColor" />
    </>
  ),
  cursor: <path {...S} strokeWidth={1.7} d="M5.4 2.3v17l4.2-3.8 2.6 6.1 3.3-1.6-2.9-5.9h6.1z" />,
  document: (
    <>
      <path {...S} strokeWidth={1.5} d="M4.9 2.2h9.9l4.3 4.4v15.2H4.9z" />
      <path d="M14.8 2.2v4.4h4.3z" fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />
      <path fillRule="evenodd" d="M6.8 8.7h4.2v4.7H6.8z M7.7 9.6v2.9h2.4V9.6z" fill="currentColor" />
      <circle cx="8.9" cy="10.6" r="0.9" fill="currentColor" />
      <path {...S} strokeWidth={1.2} d="M12.6 9.3h4.2 M12.6 11.1h3.2 M6.9 15.5h10 M6.9 17.3h8.6 M6.9 19.1h10" />
    </>
  ),
  disk: (
    <>
      <path fillRule="evenodd" d="M3 2.5h14.6L21 5.9v15.6H3z M6.6 2.5v6.6h9.9V2.5z M5.6 12.1v7.3h12.8v-7.3z" fill="currentColor" />
      <path d="M12.7 3.6h2.4v4.4h-2.4z" fill="currentColor" />
      <path {...S} strokeWidth={0.9} d="M7.2 14.3h9.4 M7.2 15.9h7.4 M7.2 17.6h8.4" />
    </>
  ),
  keys: (
    <>
      {[1, 8.7, 16.4].map((x) => (
        <g key={x}>
          <path fillRule="evenodd" d={`M${x} 6.5h6.6v10.2H${x}z M${x + 1} 7.5v6.2h4.6V7.5z`} fill="currentColor" />
          <path d={`M${x + 1.8} 9.2h3v1.2h-3z`} fill="currentColor" />
        </g>
      ))}
    </>
  ),
  hourglass: (
    <>
      <path d="M5 2h14v2.2H5z M5 19.8h14V22H5z" fill="currentColor" />
      <path {...S} strokeWidth={1.2} d="M6.3 4.2v15.6 M17.7 4.2v15.6 M8 5.2h8v2.1l-2.7 4v1.4l2.7 4v2.1H8v-2.1l2.7-4v-1.4L8 7.3z" />
      <path d="M9.4 6.7h5.2L12 10.4z M9 18.3h6L12 14.6z M11.55 11.5h.9v.9h-.9z" fill="currentColor" />
    </>
  ),
  globe: (
    <>
      <circle {...S} cx="12" cy="12" r="10" strokeWidth={1.6} />
      <path {...S} strokeWidth={1} d="M12 2c-3 2.6-4.5 6-4.5 10s1.5 7.4 4.5 10 M12 2c3 2.6 4.5 6 4.5 10s-1.5 7.4-4.5 10 M2.4 9h19.2 M2.4 15h19.2 M12 2v20" />
    </>
  ),
};

/** Ícono de marca. Toma el color del texto (crema en el sidebar, verde sobre papel). */
export function BrandIcon({ name, className, label }: { name: BrandIconName; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      className={cn("size-5 shrink-0", className)}>
      {PATHS[name]}
    </svg>
  );
}
