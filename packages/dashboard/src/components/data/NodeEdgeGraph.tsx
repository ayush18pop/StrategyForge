import React from 'react';

export interface NodeEdgeGraphProps {
    nodes: { id: string; type: string }[];
    edges: { source: string; target: string; condition?: string }[];
}

export function NodeEdgeGraph({ nodes, edges }: NodeEdgeGraphProps) {
    return (
        <div className="flex flex-col gap-4 p-4 border border-white/10 rounded-lg bg-black/40">
            <h3 className="text-sm font-semibold text-white/80">Workflow Topology</h3>
            <div className="flex flex-wrap gap-6 items-center">
                {nodes.map(node => (
                    <div key={node.id} className="px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-md font-mono text-xs">
                        {node.type}: {node.id}
                    </div>
                ))}
            </div>
            <div className="flex flex-col gap-2 mt-2">
                <h4 className="text-xs text-white/50">Execution Edges</h4>
                {edges.map((edge, i) => (
                    <div key={i} className="text-xs flex gap-2 items-center text-white/60 font-mono">
                        <span>{edge.source}</span>
                        <span className="text-white/40">→</span>
                        <span>{edge.target}</span>
                        {edge.condition && <span className="bg-white/10 px-1 rounded">if {edge.condition}</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}
