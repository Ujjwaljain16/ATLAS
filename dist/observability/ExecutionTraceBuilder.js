"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionTraceBuilder = void 0;
const fs = __importStar(require("fs"));
class ExecutionTraceBuilder {
    sessionId;
    goal;
    memory;
    startedAt = new Date().toISOString();
    constructor(sessionId, goal, memory) {
        this.sessionId = sessionId;
        this.goal = goal;
        this.memory = memory;
    }
    generateReport(result, metrics, verbose = false) {
        const entries = this.memory.getEntries();
        let exactMatches = 0;
        let semanticMatches = 0;
        let totalConfidence = 0;
        let confidenceCount = 0;
        let recoveries = 0; // simplistic metric for now
        // --- BUILD VERBOSE TRACE ---
        const vLines = [];
        vLines.push('════════════════════════════════════════════════════════════════');
        vLines.push(' ATLAS VERBOSE EXECUTION TRACE');
        vLines.push(` Session:   ${this.sessionId}`);
        vLines.push(` Goal:      ${this.goal}`);
        vLines.push('════════════════════════════════════════════════════════════════\n');
        for (const step of entries) {
            if (step.fsmState === 'RECOVER')
                recoveries++;
            const targetStr = this.cleanLabel(step.targetLabel || 'Unknown Element');
            const stepTitle = (step.activeSubObjective || step.fsmState || 'N/A').toUpperCase();
            vLines.push(`STEP ${(step.step || 0).toString().padStart(2, '0')} ─ ${stepTitle}`);
            vLines.push('');
            // --- FORM DISCOVERY ---
            if (step.formCandidates && step.formCandidates.length > 0) {
                vLines.push(`Form Discovery\nFound ${step.formCandidates.length} forms\n`);
                if (step.formCandidates.length > 1) {
                    vLines.push(`Candidates`);
                    step.formCandidates.forEach((fc, idx) => {
                        const formName = fc.formState.metadata.heading || fc.formState.metadata.legend || fc.formState.metadata.id || 'Unnamed Form';
                        vLines.push(`${idx + 1}. ${formName.substring(0, 20).padEnd(20)} ${fc.score.toFixed(2)}`);
                        vLines.push(`   Reason: ${fc.reason}\n`);
                    });
                }
                const activeFormName = step.formCandidates[0].formState.metadata.heading || step.formCandidates[0].formState.metadata.legend || step.formCandidates[0].formState.metadata.id || 'Unnamed Form';
                vLines.push(`Selected Form\n${activeFormName}\n`);
            }
            // --- ELEMENT DECISION ---
            vLines.push(`Field Decision\n✓ ${targetStr}\n`);
            if (step.confidence) {
                totalConfidence += step.confidence;
                confidenceCount++;
                if (step.discoveryTier <= 2)
                    exactMatches++;
                else
                    semanticMatches++;
                vLines.push(`Confidence\n${step.confidence.toFixed(2)} | Tier ${step.discoveryTier} | ${step.matchedSignal}\n`);
            }
            vLines.push(`Action\n${step.action?.name || 'N/A'}\n`);
            vLines.push(`Result\n${step.toolResult?.success ? 'SUCCESS' : 'FAILURE'}\n`);
            if (step.alternatives && step.alternatives.length > 0) {
                vLines.push(`Alternatives`);
                step.alternatives.forEach((alt) => {
                    const cleanAlt = this.cleanLabel(alt.label);
                    const conf = alt.confidence || 0;
                    vLines.push(`• ${cleanAlt.substring(0, 20).padEnd(22)} ${this.getProgressBar(conf)} ${conf.toFixed(2)}`);
                });
                vLines.push('');
            }
            if (step.confidence) {
                vLines.push(`Reasoning\nRequested: ${step.activeSubObjective || 'N/A'}\nSelected:  ${targetStr}\nWhy:       ${step.matchedSignal}\n`);
            }
            vLines.push('─'.repeat(64) + '\n');
        }
        const verboseReport = vLines.join('\n');
        fs.writeFileSync('./execution_trace.txt', verboseReport);
        // --- BUILD USER SUMMARY (THE DREAM OUTPUT) ---
        const avgConf = confidenceCount > 0 ? (totalConfidence / confidenceCount) : 0;
        const sLines = [];
        sLines.push('ATLAS EXECUTION REPORT\n');
        sLines.push(`Goal\n${this.goal}\n`);
        sLines.push(`Status\n${result.status === 'SUCCESS' ? 'SUCCESS' : 'FAILURE'}\n`);
        sLines.push(`Runtime\n${(result.durationMs / 1000).toFixed(1)}s\n`);
        sLines.push(`Confidence\n${avgConf.toFixed(2)}\n`);
        sLines.push(`Steps\n${entries.length}/${entries.length}\n`);
        sLines.push('Execution Timeline\n');
        entries.forEach((step, idx) => {
            const stepNum = (idx + 1).toString().padStart(2, '0');
            const target = this.cleanLabel(step.targetLabel || step.fsmState || 'Unknown');
            const conf = step.confidence ? step.confidence.toFixed(2) : 'N/A ';
            const mark = step.toolResult?.success ? '✓' : '✗';
            sLines.push(`[${stepNum}] ${target.substring(0, 20).padEnd(20)} ${mark} ${conf}`);
        });
        sLines.push('\nInsights\n');
        sLines.push(`• Exact Matches: ${exactMatches}`);
        sLines.push(`• Semantic Matches: ${semanticMatches}`);
        sLines.push(`• Recoveries: ${recoveries}`);
        sLines.push(`• Avg Confidence: ${avgConf.toFixed(2)}\n`);
        if (metrics && metrics.phaseTimings) {
            sLines.push('Performance\n');
            sLines.push(`Navigation      ${(metrics.phaseTimings.navigationMs / 1000).toFixed(1)}s`);
            sLines.push(`Observation     ${(metrics.phaseTimings.observationMs / 1000).toFixed(1)}s`);
            sLines.push(`Reasoning       ${(metrics.phaseTimings.reasoningMs / 1000).toFixed(1)}s`);
            sLines.push(`Actions         ${(metrics.phaseTimings.actionMs / 1000).toFixed(1)}s`);
            sLines.push(`Validation      ${(metrics.phaseTimings.validationMs / 1000).toFixed(1)}s\n`);
        }
        sLines.push(result.status === 'SUCCESS' ? 'CERTIFIED SUCCESS' : 'EXECUTION FAILED');
        const summaryReport = sLines.join('\n');
        return verbose ? verboseReport + '\n' + summaryReport : summaryReport;
    }
    getProgressBar(score) {
        const filled = Math.round(score * 10);
        return '█'.repeat(filled) + '░'.repeat(10 - filled);
    }
    cleanLabel(label) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(label)) {
            return 'Unnamed Input';
        }
        return label;
    }
}
exports.ExecutionTraceBuilder = ExecutionTraceBuilder;
