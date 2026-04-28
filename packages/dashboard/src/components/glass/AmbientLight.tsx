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
  blobs: readonly BlobSpec[];
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
