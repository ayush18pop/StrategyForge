import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Clock3, RadioTower } from 'lucide-react';
import { Badge } from './AppPrimitives';
import { currency, formatDateTime, percent, titleCaseFromSlug } from '../../lib/format';
import type { UseStrategyTelemetryResult } from './useStrategyTelemetry';

export function StrategyTelemetryPanel({
  telemetry,
  activeVersion,
}: {
  telemetry: UseStrategyTelemetryResult;
  activeVersion: number | null;
}) {
  const data = telemetry.data;
  const pinnedVersion = data?.telemetryPinnedVersion ?? null;
  const showPinnedNote =
    typeof activeVersion === 'number'
    && typeof pinnedVersion === 'number'
    && activeVersion !== pinnedVersion;
  const currentApy = data?.estimatedStrategyApyPct ?? null;
  const currentCumulativeYield = data?.estimatedCumulativeYieldPct ?? null;

  return (
    <>
      <div className="app-telemetry-header">
        <div style={{ display: 'grid', gap: '8px' }}>
          <div className="app-telemetry-header__title-row">
            <h2 className="app-section-card__title">Live strategy telemetry</h2>
            <Badge tone={badgeToneForConnection(telemetry.connectionState, telemetry.stale)}>
              {labelForConnection(telemetry.connectionState, telemetry.stale)}
            </Badge>
            {typeof pinnedVersion === 'number' ? (
              <Badge tone="accent">Pinned to live v{pinnedVersion}</Badge>
            ) : null}
          </div>
          <p className="app-section-card__caption">
            Estimated live yield from the deployed strategy’s active protocol exposure. This is not realized PnL.
          </p>
          {showPinnedNote ? (
            <p className="app-telemetry-note">Live telemetry stays pinned to v{pinnedVersion} while you inspect older workflow versions.</p>
          ) : null}
        </div>
      </div>

      <div className="app-telemetry-metrics">
        <TelemetryMetric
          icon={<RadioTower size={16} strokeWidth={1.8} />}
          label="Estimated live APY"
          value={currentApy !== null ? `${percent.format(currentApy)}%` : 'Waiting for market data'}
          tone="accent"
        />
        <TelemetryMetric
          icon={<Activity size={16} strokeWidth={1.8} />}
          label="Estimated cumulative yield"
          value={currentCumulativeYield !== null ? `${percent.format(currentCumulativeYield)}%` : 'Awaiting first samples'}
          tone="ok"
        />
        <TelemetryMetric
          icon={<Clock3 size={16} strokeWidth={1.8} />}
          label="Next automated review in"
          value={telemetry.nextReviewCountdown}
          tone="default"
        />
      </div>

      <div className="app-telemetry-chart-shell">
        {telemetry.isLoading ? (
          <div className="app-telemetry-empty">
            <strong>Loading telemetry…</strong>
            <span>Bootstrapping the live market view for this strategy family.</span>
          </div>
        ) : telemetry.error ? (
          <div className="app-telemetry-empty">
            <strong>Telemetry unavailable</strong>
            <span>{telemetry.error}</span>
          </div>
        ) : data && data.chartPoints.length > 0 ? (
          <>
            <div className="app-telemetry-chart__header">
              <div>
                <strong>Estimated cumulative yield vs target</strong>
                <p>Current cumulative yield is plotted against the strategy’s target path over the same elapsed window.</p>
              </div>
              <div className="app-telemetry-chart__legend">
                <span><i className="app-telemetry-dot app-telemetry-dot--primary" /> Estimated cumulative yield</span>
                <span><i className="app-telemetry-dot app-telemetry-dot--target" /> Target yield path</span>
              </div>
            </div>
            <div className="app-telemetry-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.chartPoints}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="timestamp"
                    minTickGap={32}
                    stroke="rgba(207,211,222,0.72)"
                    tickFormatter={(value) => formatChartTick(value)}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="rgba(207,211,222,0.72)"
                    tickFormatter={(value) => `${percent.format(value)}%`}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgba(129, 140, 248, 0.28)', strokeWidth: 1 }}
                    formatter={(value: number, name: string) => [
                      `${percent.format(value)}%`,
                      name === 'estimatedCumulativeYieldPct' ? 'Estimated cumulative yield' : 'Target yield path',
                    ]}
                    labelFormatter={(label) => formatDateTime(label)}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="estimatedCumulativeYieldPct"
                    stroke="rgba(129, 140, 248, 0.95)"
                    strokeWidth={2.4}
                    dot={false}
                    activeDot={{ r: 4, fill: 'rgba(129, 140, 248, 1)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="targetCumulativeYieldPct"
                    stroke="rgba(127, 183, 154, 0.95)"
                    strokeDasharray="6 6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="app-telemetry-empty">
            <strong>{data?.degradedState.message ?? 'Telemetry starts after deployment.'}</strong>
            <span>{supportingCopyForState(data?.degradedState.mode ?? 'no-live-version')}</span>
          </div>
        )}
      </div>

      <div className="app-telemetry-subhead">
        <div>
          <strong>Active protocol markets</strong>
          <p>Only protocols detected in the live strategy for {data?.protocols[0]?.asset ?? 'the selected asset'} are shown here.</p>
        </div>
        {data?.degradedState.notes.length ? (
          <div className="app-telemetry-notes">
            {data.degradedState.notes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        ) : null}
      </div>

      {data && data.protocols.length > 0 ? (
        <div className="app-protocol-grid">
          {data.protocols.map((protocol) => (
            <article key={`${protocol.protocolKey}:${protocol.chain}:${protocol.asset}`} className="app-protocol-card">
              <div className="app-protocol-card__header">
                <div>
                  <strong>{protocol.protocolName}</strong>
                  <p>{titleCaseFromSlug(protocol.chain)} · {protocol.asset}</p>
                </div>
                <Badge tone={protocol.stale ? 'warn' : protocol.marketAvailable ? 'ok' : 'default'}>
                  {protocol.stale ? 'stale' : protocol.marketAvailable ? 'live feed' : 'unmapped'}
                </Badge>
              </div>
              <div className="app-protocol-card__stats">
                <div>
                  <span>Live APY</span>
                  <strong>{protocol.currentApyPct !== null ? `${percent.format(protocol.currentApyPct)}%` : 'N/A'}</strong>
                </div>
                <div>
                  <span>TVL</span>
                  <strong>{protocol.currentTvlUsd !== null ? currency.format(protocol.currentTvlUsd) : 'N/A'}</strong>
                </div>
                <div>
                  <span>Weight</span>
                  <strong>{percent.format(protocol.allocationWeightPct)}%</strong>
                </div>
              </div>
              <div className="app-protocol-card__sparkline">
                {protocol.sparkline.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={protocol.sparkline}>
                      <defs>
                        <linearGradient id={`spark-${protocol.protocolKey}-${protocol.chain}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(129, 140, 248, 0.52)" />
                          <stop offset="100%" stopColor="rgba(129, 140, 248, 0.02)" />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="apyPct"
                        stroke="rgba(129, 140, 248, 0.95)"
                        fill={`url(#spark-${protocol.protocolKey}-${protocol.chain})`}
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="app-protocol-card__sparkline-empty">Historical APY seed not available yet.</div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="app-telemetry-empty app-telemetry-empty--compact">
          <strong>{data?.degradedState.message ?? 'Telemetry starts after deployment.'}</strong>
          <span>{supportingCopyForState(data?.degradedState.mode ?? 'no-live-version')}</span>
        </div>
      )}
    </>
  );
}

function TelemetryMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: 'accent' | 'ok' | 'default';
}) {
  return (
    <div className={`app-telemetry-metric app-telemetry-metric--${tone}`}>
      <div className="app-telemetry-metric__label">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function labelForConnection(connectionState: UseStrategyTelemetryResult['connectionState'], stale: boolean): string {
  if (stale && connectionState === 'reconnecting') return 'refreshing';
  if (stale) return 'stale';

  switch (connectionState) {
    case 'live': return 'live · 30s poll';
    case 'reconnecting': return 'refreshing';
    case 'offline': return 'offline';
    case 'connecting': return 'loading';
  }
}

function badgeToneForConnection(
  connectionState: UseStrategyTelemetryResult['connectionState'],
  stale: boolean,
): 'default' | 'accent' | 'ok' | 'attest' | 'warn' {
  if (stale && connectionState === 'reconnecting') return 'attest';
  if (stale) return 'warn';

  switch (connectionState) {
    case 'live': return 'ok';
    case 'reconnecting': return 'attest';
    case 'offline': return 'warn';
    case 'connecting': return 'default';
  }
}

function supportingCopyForState(mode: string): string {
  switch (mode) {
    case 'no-live-version':
      return 'Deploy the latest draft and the panel will begin seeding protocol history automatically.';
    case 'no-protocol-match':
      return 'The live workflow exists, but its protocol allocations could not be mapped to market feeds yet.';
    case 'market-unavailable':
      return 'Protocol cards stay on the page and will refresh automatically when upstream market data returns.';
    case 'partial-history':
      return 'The live feed is active, but the historical seed window is still filling in.';
    case 'stale-market-data':
      return 'The panel is holding the last known frame while the next market refresh is retried.';
    default:
      return 'Telemetry updates automatically as new market samples arrive.';
  }
}

function formatChartTick(value: number): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
  }).format(date);
}

const tooltipStyle = {
  background: 'rgba(13, 16, 25, 0.96)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '18px',
  boxShadow: '0 18px 42px -24px rgba(0, 0, 0, 0.48)',
};
