import mongoose from 'mongoose';

const StrategySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    familyId: { type: String, required: true },
    version: { type: Number, required: true },
    lifecycle: { type: String, enum: ['draft', 'live', 'deprecated'], default: 'draft' },
    goal: { type: String, required: true },

    evidenceBundle: {
        step1_researcher: {
            input: Object,
            output: Object,
            attestationId: String,
            timestamp: Date
        },
        step2_strategist: {
            input: Object,
            output: Object,
            attestationId: String,
            timestamp: Date
        },
        step3_critic: {
            input: Object,
            output: Object,
            attestationId: String,
            timestamp: Date
        }
    },

    priorVersionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    keeperhubWorkflowId: { type: String },
    workflowJson: { type: Object },

    agentRegistryCid: { type: String },
    reputationLedgerTxHash: { type: String },
    onChainAgentId: { type: Number, default: null },
    registryTxHash: { type: String },

    createdAt: { type: Date, default: Date.now },
    deployedAt: { type: Date }
});

export const Strategy = mongoose.models.Strategy || mongoose.model('Strategy', StrategySchema);
