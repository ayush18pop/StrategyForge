import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { buildPipelineRunStreamUrl, type PipelineRunEvent } from '../../lib/api';

type PipelineRunAnimationProps = {
  runKey: number;
  isRunning: boolean;
  fullscreen?: boolean;
  runId?: string | null;
};

type StepStatus = 'idle' | 'running' | 'done';

type PipelineStep = {
  id: string;
  title: string;
  detail: string;
  accent: 'accent' | 'ok' | 'attest';
  liveLines: string[];
};

const PIPELINE_LOG_SEQUENCE: PipelineStep[] = [
  {
    id: 'compiler-init',
    title: 'STEP 4A - Compiler.init',
    detail: 'Compiler bootstraps KeeperHub schema translation and trigger normalization.',
    accent: 'accent',
    liveLines: [
      'Booting deterministic compiler',
      'Loading trigger adapters',
      'Preparing workflow serializer',
    ],
  },
  {
    id: 'schemas',
    title: 'KeeperHub - listActionSchemas',
    detail: 'Available actions are discovered before any strategy candidate is generated.',
    accent: 'accent',
    liveLines: [
      'Fetching KeeperHub schema registry',
      'Normalizing actionType fields',
      'Schema catalog hydrated',
    ],
  },
  {
    id: 'entrypoint',
    title: 'STEP 0 - CreateOrchestrator.create',
    detail: 'Pipeline run starts with normalized user goal payload from frontend.',
    accent: 'attest',
    liveLines: [
      'Goal payload accepted by server',
      'Allocating strategy family identifier',
      'Dispatching orchestrator pipeline',
    ],
  },
  {
    id: 'researcher',
    title: 'STEP 1 - Researcher',
    detail: 'Market context, protocol signals, and constraints are gathered.',
    accent: 'ok',
    liveLines: [
      'Querying market and yield intelligence',
      'Scoring protocol suitability',
      'Producing structured research snapshot',
    ],
  },
  {
    id: 'strategist',
    title: 'STEP 2 - Strategist',
    detail: 'Multiple candidate workflow DAGs are proposed for review.',
    accent: 'accent',
    liveLines: [
      'Generating candidate DAG variants',
      'Mapping policy constraints into nodes',
      'Publishing candidate set to critic',
    ],
  },
  {
    id: 'critic',
    title: 'STEP 3 - Critic',
    detail: 'Failure-aware scoring selects the most robust candidate strategy.',
    accent: 'attest',
    liveLines: [
      'Running safety and failure pattern critique',
      'Comparing candidate robustness scores',
      'Selecting highest confidence path',
    ],
  },
  {
    id: 'compiler',
    title: 'STEP 4B - Compiler.compile',
    detail: 'Selected strategy compiles into deterministic KeeperHub workflow JSON.',
    accent: 'accent',
    liveLines: [
      'Compiling selected candidate to WorkflowSpec',
      'Assigning node/edge wiring and handles',
      'Estimating execution footprint',
    ],
  },
  {
    id: 'risk',
    title: 'STEP 5 - Risk Validator',
    detail: 'Hard policy gates reject unsafe rebalances and drawdown violations.',
    accent: 'ok',
    liveLines: [
      'Checking drawdown and exposure limits',
      'Validating transaction safety constraints',
      'Risk gates passed',
    ],
  },
  {
    id: 'storage',
    title: 'STEP 6 - Evidence storage',
    detail: 'Evidence bundle is written and CID is produced (best effort if storage lags).',
    accent: 'attest',
    liveLines: [
      'Persisting evidence bundle to 0G storage',
      'Awaiting storage write confirmation',
      'CID reference linked to strategy version',
    ],
  },
  {
    id: 'keeperhub',
    title: 'STEP 7 - KeeperHub workflow create',
    detail: 'Workflow deployment request is submitted and workflow ID is returned.',
    accent: 'accent',
    liveLines: [
      'Submitting workflow payload to KeeperHub',
      'Awaiting workflow ID assignment',
      'Deployment handshake complete',
    ],
  },
];

export function PipelineRunAnimation({ runKey, isRunning, fullscreen = false, runId }: PipelineRunAnimationProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveFeed, setLiveFeed] = useState<string[]>([]);
  const [events, setEvents] = useState<PipelineRunEvent[]>([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setActiveIndex(0);
    setElapsedSeconds(0);
    setLiveFeed([]);
    setEvents([]);
  }, [runKey]);

  useEffect(() => {
    if (!isRunning || !runId) {
      return;
    }
    const streamUrl = buildPipelineRunStreamUrl(runId);
    const source = new EventSource(streamUrl);
    source.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data) as PipelineRunEvent;
        setEvents((current) => [...current, next]);
      } catch {
        // noop
      }
    };
    return () => source.close();
  }, [isRunning, runId]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (events.length === 0) {
      return;
    }
    const stageToIndex = new Map<string, number>([
      ['request_received', 0],
      ['pipeline_started', 0],
      ['discovery', 1],
      ['researcher', 3],
      ['strategist', 4],
      ['critic', 5],
      ['compiler', 6],
      ['risk_validator', 7],
      ['storage', 8],
      ['pipeline_completed', 8],
      ['deployment', 9],
      ['kv_save', 9],
      ['metadata_sync', 9],
      ['completed', 9],
      ['failed', 9],
    ]);
    const latest = events[events.length - 1];
    const nextIndex = stageToIndex.get(latest.stage);
    if (typeof nextIndex === 'number') {
      setActiveIndex(nextIndex);
    }
    const stamp = new Date(latest.timestamp).toLocaleTimeString([], { hour12: false });
    setLiveFeed((current) => [...current, `${stamp}  ${latest.message}`].slice(-10));
  }, [events]);

  const statuses = useMemo(
    () =>
      PIPELINE_LOG_SEQUENCE.map<StepStatus>((_, index) => {
        if (!isRunning) {
          return 'idle';
        }
        if (index < activeIndex) {
          return 'done';
        }
        if (index === activeIndex) {
          return 'running';
        }
        return 'idle';
      }),
    [activeIndex, isRunning],
  );

  return (
    <motion.div
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'grid',
        gap: '12px',
        ...(fullscreen
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 9,
              padding: '26px',
              overflow: 'auto',
              background:
                'radial-gradient(ellipse 880px 620px at 18% 12%, rgba(91,108,255,0.23) 0%, transparent 64%), radial-gradient(ellipse 760px 560px at 84% 88%, rgba(227,169,74,0.18) 0%, transparent 62%), rgba(7,8,11,0.86)',
              backdropFilter: 'blur(14px) saturate(130%)',
              WebkitBackdropFilter: 'blur(14px) saturate(130%)',
            }
          : {}),
      }}
    >
      <motion.div
        className="glass-thick liquid-glass-panel"
        style={{
          display: 'grid',
          gap: '10px',
          padding: '14px 16px',
          borderRadius: '20px',
          boxShadow: '0 24px 64px -20px rgba(0,0,0,0.54)',
        }}
        animate={
          reduceMotion
            ? undefined
            : {
                boxShadow: [
                  '0 24px 64px -20px rgba(0,0,0,0.54)',
                  '0 28px 74px -20px rgba(91,108,255,0.24)',
                  '0 24px 64px -20px rgba(0,0,0,0.54)',
                ],
              }
        }
        transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <strong style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-md)', letterSpacing: '-0.01em' }}>
            StrategyForge pipeline running
          </strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)' }}>
            {elapsedSeconds}s elapsed
          </span>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
          {liveFeed[liveFeed.length - 1] ? liveFeed[liveFeed.length - 1] : PIPELINE_LOG_SEQUENCE[activeIndex]?.detail}
        </div>
      </motion.div>

      <motion.div
        className="glass-regular liquid-glass-soft"
        style={{
          display: 'grid',
          gap: '8px',
          padding: '12px 14px',
          borderRadius: '20px',
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="eyebrow">Live console</span>
        <div style={{ display: 'grid', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          {liveFeed.length === 0 ? (
            <span style={{ color: 'var(--text-tertiary)' }}>Waiting for first pipeline events...</span>
          ) : (
            <AnimatePresence initial={false}>
              {liveFeed.map((entry) => (
                <motion.span
                  key={entry}
                  initial={reduceMotion ? undefined : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.22 }}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {entry}
                </motion.span>
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: fullscreen ? 'repeat(2, minmax(0, 1fr))' : '1fr',
          gap: '12px',
        }}
      >
        {PIPELINE_LOG_SEQUENCE.map((step, index) => {
        const status = statuses[index];
        const dotColor =
          step.accent === 'ok'
            ? 'var(--ok-500)'
            : step.accent === 'attest'
              ? 'var(--attest-500)'
              : 'var(--accent-200)';
        return (
          <motion.div
            key={step.id}
            className={status === 'running' ? 'glass-thick liquid-glass-panel' : 'glass-thin'}
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr auto',
              alignItems: 'start',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '20px',
              transition: 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={{
              opacity: status === 'idle' ? 0.75 : 1,
              y: 0,
              scale: status === 'running' ? 1.01 : 1,
            }}
            transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              aria-hidden
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '999px',
                border: `1px solid ${status === 'running' ? dotColor : 'rgba(255,255,255,0.14)'}`,
                display: 'grid',
                placeItems: 'center',
                color: status === 'done' ? 'var(--ok-500)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}
            >
              {status === 'done' ? '✓' : index + 1}
            </div>

            <div style={{ display: 'grid', gap: '4px' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }}>{step.title}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>{step.detail}</span>
            </div>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color:
                  status === 'done'
                    ? 'var(--ok-500)'
                    : status === 'running'
                      ? dotColor
                      : 'var(--text-tertiary)',
                minWidth: '70px',
                textAlign: 'right',
              }}
            >
              {status}
            </span>
          </motion.div>
        );
      })}
      </div>
    </motion.div>
  );
}

