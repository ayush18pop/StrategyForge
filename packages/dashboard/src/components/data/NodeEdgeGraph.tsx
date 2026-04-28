export interface NodeEdgeGraphProps {
  nodes: { id: string; type: string; label?: string }[];
  edges: { source: string; target: string; sourceHandle?: string; condition?: string }[];
}

export function NodeEdgeGraph({ nodes, edges }: NodeEdgeGraphProps) {
  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {nodes.map((node, index) => (
          <div
            key={node.id}
            style={{
              padding: '16px',
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.05)',
              display: 'grid',
              gap: '10px',
            }}
          >
            <div className="step-index">{index + 1}</div>
            <strong style={{ color: 'var(--text-primary)' }}>{node.label ?? node.type}</strong>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>
              {node.id}
            </span>
            <span style={{ color: 'var(--accent-200)', fontSize: 'var(--fs-sm)' }}>{node.type}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        <span className="eyebrow">Execution edges</span>
        {edges.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>No explicit edges were published with this workflow.</p>
        ) : (
          edges.map((edge) => (
            <div
              key={`${edge.source}-${edge.target}-${edge.sourceHandle ?? 'default'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                padding: '12px 14px',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-sm)',
              }}
            >
              <span>{edge.source}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>→</span>
              <span>{edge.target}</span>
              {edge.sourceHandle ? (
                <span style={{ color: 'var(--accent-200)' }}>via {edge.sourceHandle}</span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
