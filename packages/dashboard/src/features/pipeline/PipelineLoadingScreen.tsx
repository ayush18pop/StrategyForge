import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { buildPipelineRunStreamUrl, type PipelineRunEvent } from '../../lib/api';

const PIPELINE_STAGES = [
    { id: 'discovery', label: 'Discovery', detail: 'Fetching action schemas', type: 'deterministic' as const },
    { id: 'researcher', label: 'Researcher', detail: 'Gathering market context', type: 'tee' as const },
    { id: 'strategist', label: 'Strategist', detail: 'Proposing candidate DAGs', type: 'tee' as const },
    { id: 'critic', label: 'Critic', detail: 'Selecting best candidate', type: 'tee' as const },
    { id: 'compiler', label: 'Compiler', detail: 'Compiling to workflow JSON', type: 'deterministic' as const },
    { id: 'risk_validator', label: 'Risk Validator', detail: 'Validating safety bounds', type: 'deterministic' as const },
] as const;

const STAGE_ORDER = new Map<string, number>([
    ['request_received', -1],
    ['pipeline_started', -1],
    ['discovery', 0],
    ['researcher', 1],
    ['strategist', 2],
    ['critic', 3],
    ['compiler', 4],
    ['risk_validator', 5],
    ['storage', 5],
    ['pipeline_completed', 5],
    ['deployment', 5],
    ['kv_save', 5],
    ['metadata_sync', 5],
    ['completed', 6],
    ['failed', 6],
]);

const STAGE_LABELS: Record<string, string> = {
    discovery: 'Fetching action schemas from KeeperHub...',
    researcher: 'Sealed TEE inference — analyzing market conditions...',
    strategist: 'Generating candidate workflow topologies...',
    critic: 'Evaluating robustness against prior version failures...',
    compiler: 'Compiling to KeeperHub WorkflowSpec JSON...',
    risk_validator: 'Validating safety bounds — deterministic check...',
    storage: 'Writing evidence bundle to 0G Storage...',
    deployment: 'Deploying workflow to KeeperHub...',
};

interface Props {
    runId: string | null;
    isRunning: boolean;
    onComplete?: () => void;
}

export function PipelineLoadingScreen({ runId, isRunning, onComplete }: Props) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [liveFeed, setLiveFeed] = useState<string[]>([]);
    const [events, setEvents] = useState<PipelineRunEvent[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isExiting, setIsExiting] = useState(false);
    const [attestations, setAttestations] = useState<string[]>([]);
    const reduceMotion = useReducedMotion();

    // Reset on new run
    useEffect(() => {
        setElapsedSeconds(0);
        setLiveFeed([]);
        setEvents([]);
        setActiveIndex(-1);
        setIsExiting(false);
        setAttestations([]);
    }, [runId]);

    // SSE subscription
    useEffect(() => {
        if (!isRunning || !runId) return;
        const streamUrl = buildPipelineRunStreamUrl(runId);
        const source = new EventSource(streamUrl);
        source.onmessage = (event) => {
            try {
                const next = JSON.parse(event.data) as PipelineRunEvent;
                setEvents((prev) => [...prev, next]);
            } catch {
                // noop
            }
        };
        return () => source.close();
    }, [isRunning, runId]);

    // Elapsed timer
    useEffect(() => {
        if (!isRunning) return;
        const timer = window.setInterval(() => {
            setElapsedSeconds((s) => s + 1);
        }, 1000);
        return () => window.clearInterval(timer);
    }, [isRunning]);

    // Process events
    useEffect(() => {
        if (events.length === 0) return;
        const latest = events[events.length - 1];
        const idx = STAGE_ORDER.get(latest.stage);
        if (typeof idx === 'number') {
            setActiveIndex(idx);
        }
        const stamp = new Date(latest.timestamp).toLocaleTimeString([], { hour12: false });
        setLiveFeed((prev) => [...prev, `${stamp}  ${latest.message}`].slice(-8));

        // Collect attestation hashes (TEE steps completing)
        if (latest.status === 'done' && ['researcher', 'strategist', 'critic'].includes(latest.stage)) {
            setAttestations((prev) => [...prev, `TEE #${prev.length + 1} — ${latest.stage}`]);
        }

        // Handle completion
        if (latest.stage === 'completed' || latest.stage === 'failed') {
            setIsExiting(true);
            setTimeout(() => onComplete?.(), 600);
        }
    }, [events, onComplete]);

    const stageStatuses = useMemo(
        () =>
            PIPELINE_STAGES.map((_, i) => {
                if (activeIndex < 0) return 'idle' as const;
                if (i < activeIndex) return 'complete' as const;
                if (i === activeIndex) return 'active' as const;
                return 'idle' as const;
            }),
        [activeIndex],
    );

    const currentLabel = activeIndex >= 0 && activeIndex < PIPELINE_STAGES.length
        ? STAGE_LABELS[PIPELINE_STAGES[activeIndex].id] ?? PIPELINE_STAGES[activeIndex].detail
        : 'Initializing pipeline...';

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    };

    if (!isRunning && !isExiting) return null;

    return (
        <div className={`loading-screen ${isExiting ? 'loading-screen--exiting' : ''}`}>
            {/* Timer */}
            <div className="loading-screen__timer">{formatTime(elapsedSeconds)} elapsed</div>

            {/* Center content */}
            <div className="loading-screen__center">
                {/* Reactor orb */}
                <motion.div
                    className="loading-screen__orb-container"
                    initial={reduceMotion ? undefined : { scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                    <div className="loading-screen__ring" />
                    <div className="loading-screen__ring" />
                    <div className="loading-screen__ring" />
                    <div className="loading-screen__orb" />
                </motion.div>

                {/* Stage label */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentLabel}
                        className="loading-screen__stage"
                        initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                        transition={{ duration: reduceMotion ? 0 : 0.25 }}
                    >
                        {currentLabel}
                    </motion.div>
                </AnimatePresence>

                {/* Progress bar */}
                <div className="loading-screen__progress">
                    {PIPELINE_STAGES.map((stage, i) => (
                        <div
                            key={stage.id}
                            className={`loading-screen__progress-segment ${stageStatuses[i] === 'complete'
                                ? 'loading-screen__progress-segment--complete'
                                : stageStatuses[i] === 'active'
                                    ? 'loading-screen__progress-segment--active'
                                    : ''
                                }`}
                        />
                    ))}
                </div>

                {/* Steps list */}
                <div className="loading-screen__steps">
                    {PIPELINE_STAGES.map((stage, i) => {
                        const status = stageStatuses[i];
                        return (
                            <motion.div
                                key={stage.id}
                                className={`loading-screen__step loading-screen__step--${status}`}
                                initial={reduceMotion ? undefined : { opacity: 0, x: -12 }}
                                animate={{ opacity: status === 'idle' ? 0.4 : 1, x: 0 }}
                                transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : i * 0.04 }}
                            >
                                <div className="loading-screen__step-number">
                                    {status === 'complete' ? '✓' : i + 1}
                                </div>
                                <span className="loading-screen__step-label">{stage.label}</span>
                                <span className="loading-screen__step-status">
                                    {status === 'idle' ? 'IDLE' : status === 'active' ? 'RUNNING' : 'DONE'}
                                </span>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Live console */}
                <div className="loading-screen__console">
                    <div className="loading-screen__console-header">Live console</div>
                    <div className="loading-screen__console-lines">
                        {liveFeed.length === 0 ? (
                            <span style={{ color: 'var(--text-tertiary)' }}>Waiting for pipeline events...</span>
                        ) : (
                            <AnimatePresence initial={false}>
                                {liveFeed.map((entry, i) => (
                                    <motion.span
                                        key={`${entry}-${i}`}
                                        className="loading-screen__console-line"
                                        initial={reduceMotion ? undefined : { opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: reduceMotion ? 0 : 0.22 }}
                                    >
                                        {entry}
                                    </motion.span>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </div>

                {/* Attestation chips */}
                {attestations.length > 0 && (
                    <div className="loading-screen__attestations">
                        {attestations.map((attest) => (
                            <span key={attest} className="loading-screen__attestation-chip">
                                ◆ {attest}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
