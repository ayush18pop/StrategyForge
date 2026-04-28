export const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const percent = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const number = new Intl.NumberFormat('en-US');

export function formatAddress(value: string, visible = 6): string {
  if (value.length <= visible * 2 + 2) {
    return value;
  }

  return `${value.slice(0, visible + 2)}…${value.slice(-visible)}`;
}

export function formatDateTime(timestamp: number | string): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function relativeTime(timestamp: number): string {
  const deltaMs = timestamp - Date.now();
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const minutes = Math.round(deltaMs / 60_000);

  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, 'minute');
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, 'hour');
  }

  const days = Math.round(hours / 24);
  return formatter.format(days, 'day');
}

export function titleCaseFromSlug(value: string): string {
  return value
    .split(/[-_]/g)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

export function workflowHeadline(value: string | undefined): string {
  if (!value) {
    return 'Workflow pending deployment';
  }

  return value;
}
