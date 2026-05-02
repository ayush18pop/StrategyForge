import mongoose from 'mongoose';

const ExecutionSchema = new mongoose.Schema({
    strategyId: { type: mongoose.Schema.Types.ObjectId, required: true },
    keeperhubExecutionId: { type: String, required: true },
    status: { type: String, enum: ['running', 'success', 'failed', 'partial'], required: true },

    stepLogs: [{
        stepId: String,
        actionType: String,
        status: { type: String, enum: ['success', 'failed', 'skipped'] },
        output: Object,
        txHash: String,
        error: String
    }],

    outcome: {
        suboptimal: Boolean,
        suboptimalReason: String,
        metrics: Object
    },

    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date }
});

export const Execution = mongoose.models.Execution || mongoose.model('Execution', ExecutionSchema);
