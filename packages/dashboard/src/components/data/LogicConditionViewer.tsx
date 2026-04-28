export interface LogicConditionViewerProps {
  conditionType: string;
  threshold: string | number;
  currentValue: string | number;
  passed: boolean;
}

export function LogicConditionViewer({ conditionType, threshold, currentValue, passed }: LogicConditionViewerProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr auto',
        gap: '14px',
        alignItems: 'center',
        padding: '14px',
        borderRadius: '18px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="eyebrow">{conditionType}</div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
        <span><span style={{ color: 'var(--text-tertiary)' }}>VAL</span> {currentValue}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>→</span>
        <span><span style={{ color: 'var(--text-tertiary)' }}>THR</span> {threshold}</span>
      </div>
      <span
        style={{
          minHeight: '30px',
          padding: '6px 10px',
          borderRadius: '999px',
          background: passed ? 'rgba(127,183,154,0.16)' : 'rgba(224,122,106,0.16)',
          color: passed ? 'var(--ok-500)' : 'var(--warn-500)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {passed ? 'Passed' : 'Failed'}
      </span>
    </div>
  );
}
