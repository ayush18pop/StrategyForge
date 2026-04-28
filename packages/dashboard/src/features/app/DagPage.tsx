import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import ReactFlow, { Background, Controls, MarkerType, MiniMap, type Edge, type Node } from 'reactflow';
import { useFamilyQuery } from './query';
import { EmptyState, LoadingBlock, PageIntro, SectionCard } from './AppPrimitives';
import { buildVersionViews } from '../../lib/strategy-view';
import { formatDateTime, titleCaseFromSlug } from '../../lib/format';

export function DagPage() {
  const { familyId = '' } = useParams();
  const familyQuery = useFamilyQuery(familyId);

  const { nodes, edges } = useMemo(() => {
    if (!familyQuery.data) {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }

    const versions = buildVersionViews(familyQuery.data.versions).slice().reverse();
    const indexByCid = new Map(versions.map((version) => [version.cid, version]));

    return {
      nodes: versions.map((version, index) => ({
        id: version.cid,
        position: { x: index * 280, y: version.lifecycle === 'live' ? 0 : version.lifecycle === 'draft' ? 140 : 260 },
        data: {
          label: (
            <div style={{ display: 'grid', gap: '10px' }}>
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: '28px' }}>
                v{version.version}
              </strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>{version.lifecycle}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>{formatDateTime(version.createdAt)}</span>
            </div>
          ),
        },
        style: {
          width: 190,
          borderRadius: 24,
          padding: 18,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(12,16,22,0.72)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 24px 44px -28px rgba(0,0,0,0.5)',
        },
      })),
      edges: versions.flatMap((version) =>
        version.priorCids
          .filter((cid) => indexByCid.has(cid))
          .map((cid) => ({
            id: `${cid}-${version.cid}`,
            source: cid,
            target: version.cid,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#7b8aff' },
            style: { stroke: '#7b8aff', strokeOpacity: 0.8, strokeWidth: 2 },
          })),
      ),
    };
  }, [familyQuery.data]);

  if (familyQuery.isLoading) {
    return <LoadingBlock label="Loading version DAG…" />;
  }

  if (familyQuery.isError || !familyQuery.data) {
    return <EmptyState title="DAG unavailable" description={familyQuery.error?.message ?? 'The version graph could not be loaded.'} />;
  }

  const versions = buildVersionViews(familyQuery.data.versions);

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <PageIntro
        eyebrow="Evidence DAG"
        title={`${titleCaseFromSlug(familyQuery.data.familyId)} memory chain`}
        description="Each node is an immutable version. Edges show which prior CIDs were loaded before the next version was generated."
      />

      <SectionCard title="priorCid graph" caption="Update means lineage, not mutation. Users can inspect the exact ancestry behind every live candidate.">
        <div style={{ height: '520px', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ReactFlow fitView nodes={nodes} edges={edges}>
            <MiniMap style={{ background: 'rgba(12,16,22,0.9)' }} />
            <Controls />
            <Background gap={24} color="rgba(255,255,255,0.08)" />
          </ReactFlow>
        </div>
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
        {versions.map((version) => (
          <SectionCard
            key={version.cid}
            title={`v${version.version}`}
            caption={`${version.lifecycle} · ${version.priorCids.length} prior reference${version.priorCids.length === 1 ? '' : 's'}`}
          >
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>{version.workflowDescription}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>Protocols: {version.protocols.join(', ')}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>CID: {version.cid}</p>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
