export const ambientPresets = {
  standard: [
    { color: 'var(--accent-500)', opacity: 0.25, size: 384, top: '-80px', left: '-80px' },
    { color: 'var(--attest-500)', opacity: 0.15, size: 320, bottom: '-128px', right: '40px' },
  ],
  hero: [
    { color: 'var(--accent-500)', opacity: 0.30, size: 600, top: '-100px', left: '-100px' },
    { color: 'var(--attest-500)', opacity: 0.18, size: 500, bottom: '-120px', right: '-60px' },
    { color: 'var(--ok-500)', opacity: 0.10, size: 300, top: '40%', left: '30%' },
  ],
  pipeline: [
    { color: 'var(--accent-500)', opacity: 0.20, size: 500, top: '-60px', left: '20%' },
  ],
} as const;
