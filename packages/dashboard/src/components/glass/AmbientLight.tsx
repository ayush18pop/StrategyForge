interface BlobSpec {
  color: string;
  opacity?: number;
  size?: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
}

interface AmbientLightProps {
  blobs: BlobSpec[];
  className?: string;
}

export function AmbientLight({ blobs, className = '' }: AmbientLightProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      {blobs.map((blob, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: blob.size ? `${blob.size}px` : '384px',
            height: blob.size ? `${blob.size}px` : '384px',
            background: blob.color,
            opacity: blob.opacity ?? 0.2,
            filter: 'blur(120px)',
            borderRadius: '50%',
            top: blob.top,
            left: blob.left,
            right: blob.right,
            bottom: blob.bottom,
          }}
        />
      ))}
    </div>
  );
}

// Preset blobs for common screen compositions
export const ambientPresets = {
  // Accent top-left + attest bottom-right — default for most screens
  standard: [
    { color: 'var(--accent-500)', opacity: 0.25, size: 384, top: '-80px', left: '-80px' },
    { color: 'var(--attest-500)', opacity: 0.15, size: 320, bottom: '-128px', right: '40px' },
  ],
  // Landing hero — stronger and centered
  hero: [
    { color: 'var(--accent-500)', opacity: 0.30, size: 600, top: '-100px', left: '-100px' },
    { color: 'var(--attest-500)', opacity: 0.18, size: 500, bottom: '-120px', right: '-60px' },
    { color: 'var(--ok-500)',     opacity: 0.10, size: 300, top: '40%',    left: '30%' },
  ],
  // Pipeline screen — blue accent only
  pipeline: [
    { color: 'var(--accent-500)', opacity: 0.20, size: 500, top: '-60px', left: '20%' },
  ],
} as const;
