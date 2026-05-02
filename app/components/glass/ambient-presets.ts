export const ambientPresets = {
  standard: [
    { color: 'var(--accent-verify)', opacity: 0.08, size: 420, top: '-80px', left: '-80px' },
    { color: 'var(--accent-forge)', opacity: 0.04, size: 300, bottom: '-128px', right: '40px' },
  ],
  hero: [
    { color: 'var(--accent-verify)', opacity: 0.09, size: 640, top: '-100px', left: '-120px' },
    { color: 'var(--accent-forge)', opacity: 0.04, size: 480, bottom: '-120px', right: '-60px' },
  ],
  pipeline: [
    { color: 'var(--accent-verify)', opacity: 0.10, size: 520, top: '-60px', left: '20%' },
  ],
} as const;
