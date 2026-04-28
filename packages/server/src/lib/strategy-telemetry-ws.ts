import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  StrategyTelemetryBootstrap,
  StrategyTelemetrySnapshot,
} from './strategy-telemetry.js';
import { StrategyTelemetryService } from './strategy-telemetry.js';

const SAMPLE_INTERVAL_MS = 30_000;
const TELEMETRY_STREAM_PATH = /^\/api\/strategies\/([^/]+)\/telemetry\/stream$/;

interface FamilyTelemetryStream {
  clients: Set<WebSocket>;
  timer: ReturnType<typeof setInterval> | null;
  refreshPromise: Promise<void> | null;
  state: StrategyTelemetryBootstrap | null;
}

export class StrategyTelemetryHub {
  private readonly server = new WebSocketServer({ noServer: true });
  private readonly familyStreams = new Map<string, FamilyTelemetryStream>();

  constructor(private readonly telemetry: StrategyTelemetryService) {}

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    const familyId = familyIdFromRequest(request);
    if (!familyId) {
      return false;
    }

    this.server.handleUpgrade(request, socket, head, (client) => {
      this.attachClient(familyId, client);
    });
    return true;
  }

  private attachClient(familyId: string, client: WebSocket): void {
    const stream = this.getOrCreateStream(familyId);
    stream.clients.add(client);

    if (!stream.timer) {
      stream.timer = setInterval(() => {
        void this.refreshFamily(familyId);
      }, SAMPLE_INTERVAL_MS);
    }

    client.on('close', () => {
      const nextStream = this.familyStreams.get(familyId);
      if (!nextStream) {
        return;
      }

      nextStream.clients.delete(client);
      if (nextStream.clients.size === 0) {
        if (nextStream.timer) {
          clearInterval(nextStream.timer);
        }
        this.familyStreams.delete(familyId);
      }
    });

    client.on('error', (error) => {
      console.warn(`[Telemetry] WebSocket error for ${familyId}: ${error.message}`);
    });

    void this.refreshFamily(familyId);
  }

  private async refreshFamily(familyId: string): Promise<void> {
    const stream = this.familyStreams.get(familyId);
    if (!stream || stream.refreshPromise) {
      return;
    }

    stream.refreshPromise = this.refreshFamilyInternal(familyId, stream)
      .finally(() => {
        const latestStream = this.familyStreams.get(familyId);
        if (latestStream) {
          latestStream.refreshPromise = null;
        }
      });

    await stream.refreshPromise;
  }

  private async refreshFamilyInternal(
    familyId: string,
    stream: FamilyTelemetryStream,
  ): Promise<void> {
    try {
      const result = await this.telemetry.getSnapshot(familyId, stream.state);
      stream.state = result.state;
      this.broadcast(stream, result.snapshot);
    } catch (error) {
      console.warn(`[Telemetry] Failed to refresh ${familyId}:`, error);

      const snapshot = staleErrorSnapshot(familyId, stream.state, error);
      if (snapshot) {
        this.broadcast(stream, snapshot);
      } else {
        this.broadcast(stream, {
          familyId,
          liveVersion: null,
          telemetryPinnedVersion: null,
          sampledAt: Date.now(),
          estimatedStrategyApyPct: null,
          estimatedCumulativeYieldPct: null,
          targetYieldPct: 0,
          weightingMode: 'equal-fallback',
          reviewWindow: {
            nextReviewAt: Date.now(),
            monitorIntervalMs: 0,
            source: 'created-at-fallback',
          },
          protocols: [],
          chartPoint: null,
          stale: true,
          degradedState: {
            mode: 'market-unavailable',
            message: 'Telemetry is unavailable right now.',
            notes: [error instanceof Error ? error.message : String(error)],
          },
        });
      }
    }
  }

  private broadcast(stream: FamilyTelemetryStream, snapshot: StrategyTelemetrySnapshot): void {
    const payload = JSON.stringify(snapshot);
    for (const client of stream.clients) {
      if (client.readyState !== WebSocket.OPEN) {
        continue;
      }
      client.send(payload);
    }
  }

  private getOrCreateStream(familyId: string): FamilyTelemetryStream {
    const existing = this.familyStreams.get(familyId);
    if (existing) {
      return existing;
    }

    const created: FamilyTelemetryStream = {
      clients: new Set<WebSocket>(),
      timer: null,
      refreshPromise: null,
      state: null,
    };
    this.familyStreams.set(familyId, created);
    return created;
  }
}

function familyIdFromRequest(request: IncomingMessage): string | null {
  const rawUrl = request.url;
  if (!rawUrl) {
    return null;
  }

  const url = new URL(rawUrl, 'http://localhost');
  const match = TELEMETRY_STREAM_PATH.exec(url.pathname);
  if (!match?.[1]) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

function staleErrorSnapshot(
  familyId: string,
  state: StrategyTelemetryBootstrap | null,
  error: unknown,
): StrategyTelemetrySnapshot | null {
  if (!state) {
    return null;
  }

  return {
    familyId,
    liveVersion: state.liveVersion,
    telemetryPinnedVersion: state.telemetryPinnedVersion,
    sampledAt: Date.now(),
    estimatedStrategyApyPct: state.estimatedStrategyApyPct,
    estimatedCumulativeYieldPct: state.estimatedCumulativeYieldPct,
    targetYieldPct: state.targetYieldPct,
    weightingMode: state.weightingMode,
    reviewWindow: state.reviewWindow,
    protocols: state.protocols.map((protocol) => ({
      ...protocol,
      stale: true,
    })),
    chartPoint: state.chartPoints.at(-1) ?? null,
    stale: true,
    degradedState: {
      mode: 'stale-market-data',
      message: 'Showing the last known live telemetry while market feeds recover.',
      notes: [error instanceof Error ? error.message : String(error)],
    },
  };
}
