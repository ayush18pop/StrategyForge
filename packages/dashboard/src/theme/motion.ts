export const duration = {
  instant:   80,
  quick:     160,
  base:      240,
  smooth:    400,
  cinematic: 700,
  epic:      1200,
} as const;

export const ease = {
  out:   "cubic-bezier(0.22, 1, 0.36, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  spring: { type: "spring" as const, stiffness: 300, damping: 28 },
  gentle: { type: "spring" as const, stiffness: 180, damping: 24 },
} as const;
