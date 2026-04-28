import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import { formatDateTime, formatAddress, number } from '../../lib/format';
import { useExecutionQuery } from './query';
import { Badge, EmptyState, LoadingBlock, PageIntro, SectionCard, StatCard } from './AppPrimitives';

export function ExecutionPage() {
  const { workflowId = '' } = useParams();
  const executionQuery = useExecutionQuery(workflowId);

  const stats = useMemo(() => {
    const logs = executionQuery.data?.logs ?? [];
    const success = logs.filter((log) => log.status === 'success').length;
    const failed = logs.filter((log) => log.status === 'failed').length;
    const gas = logs.reduce((sum, log) => sum + Number(log.gasUsed ?? 0), 0);

    return { success, failed, gas };
  }, [executionQuery.data?.logs]);

  if (executionQuery.isLoading) {
    return <LoadingBlock label="Loading execution logs…" />;
  }

  if (executionQuery.isError || !executionQuery.data) {
    return <EmptyState title="Execution unavailable" description={executionQuery.error?.message ?? 'Execution data could not be loaded from KeeperHub.'} />;
  }

  const { status, logs, executionId, workflowStatusError } = executionQuery.data;

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <PageIntro
        eyebrow="Execution monitoring"
        title={`Workflow ${workflowId}`}
        description="This route is wired to the server’s `/api/executions/:workflowId` endpoint so the dashboard can monitor KeeperHub execution state and step-by-step logs."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <StatCard label="Status" value={status?.status ?? 'Unknown'} tone={status?.status === 'active' ? 'ok' : 'attest'} meta={workflowStatusError ?? `Execution ID ${executionId}`} />
        <StatCard label="Total runs" value={`${status?.totalRuns ?? logs.length}`} tone="accent" />
        <StatCard label="Successful steps" value={`${stats.success}`} tone="ok" />
        <StatCard label="Gas used" value={number.format(stats.gas)} tone="attest" meta="Sum of step-reported gas values." />
      </div>

      <SectionCard title="Live log stream" caption="Each row below comes from KeeperHub execution logs as returned by the server.">
        <div style={{ display: 'grid', gap: '10px' }}>
          {logs.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No logs have been recorded for this workflow yet.</p>
          ) : (
            logs.map((log) => (
              <div
                key={`${log.executionId}-${log.stepId}-${log.timestamp}`}
                style={{
                  padding: '16px',
                  borderRadius: '20px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'grid',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{log.stepId}</strong>
                  <Badge tone={log.status === 'success' ? 'ok' : log.status === 'failed' ? 'warn' : 'default'}>
                    {log.status === 'success' ? <CheckCircle2 size={14} strokeWidth={1.8} /> : log.status === 'failed' ? <AlertTriangle size={14} strokeWidth={1.8} /> : <Clock3 size={14} strokeWidth={1.8} />}
                    {log.status}
                  </Badge>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
                  <span>{formatDateTime(log.timestamp)}</span>
                  {log.gasUsed ? <span>{number.format(Number(log.gasUsed))} gas</span> : null}
                  {log.txHash ? <span>{formatAddress(log.txHash)}</span> : null}
                </div>
                {log.error ? <p style={{ color: 'var(--warn-500)', fontSize: 'var(--fs-sm)' }}>{log.error}</p> : null}
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="Operational reading" caption="How to interpret the current execution surface.">
        <div style={{ display: 'grid', gap: '10px' }}>
          <Badge tone="accent"><Activity size={14} strokeWidth={1.8} /> Status comes from KeeperHub workflow state when available.</Badge>
          <Badge tone="attest"><Clock3 size={14} strokeWidth={1.8} /> Logs are polled every 15 seconds through React Query.</Badge>
          <Badge tone="warn"><AlertTriangle size={14} strokeWidth={1.8} /> A workflow can still show logs even if workflow status lookup errors.</Badge>
        </div>
      </SectionCard>
    </div>
  );
}
