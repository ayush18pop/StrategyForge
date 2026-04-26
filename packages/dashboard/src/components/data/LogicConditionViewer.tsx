import React from 'react';

export interface LogicConditionViewerProps {
    conditionType: string;
    threshold: string | number;
    currentValue: string | number;
    passed: boolean;
}

export function LogicConditionViewer({ conditionType, threshold, currentValue, passed }: LogicConditionViewerProps) {
    return (
        <div className="flex items-center gap-4 p-3 bg-black/40 border border-white/10 rounded-md">
            <div className="text-xs font-semibold uppercase text-white/50 tracking-wider w-24">
                {conditionType}
            </div>
            <div className="flex-1 flex gap-4 items-center text-sm font-mono text-white/80">
                <div>
                    <span className="text-white/40 text-xs mr-2">VAL</span>
                    {currentValue}
                </div>
                <div className="text-white/30">&raquo;</div>
                <div>
                    <span className="text-white/40 text-xs mr-2">THR</span>
                    {threshold}
                </div>
            </div>
            <div className={`px-2 py-1 rounded text-xs font-semibold uppercase ${passed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {passed ? 'Passed' : 'Failed'}
            </div>
        </div>
    );
}
