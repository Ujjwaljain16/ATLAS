"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATLASConfigSchema = void 0;
const zod_1 = require("zod");
exports.ATLASConfigSchema = zod_1.z.object({
    browser: zod_1.z.object({
        headless: zod_1.z.boolean().default(true),
        viewport: zod_1.z.object({
            width: zod_1.z.number().default(1280),
            height: zod_1.z.number().default(720),
        }),
        launchTimeoutMs: zod_1.z.number().default(30000),
    }),
    navigation: zod_1.z.object({
        waitUntil: zod_1.z.enum(['networkidle', 'domcontentloaded', 'load']).default('domcontentloaded'),
        timeoutMs: zod_1.z.number().default(30000),
        maxRetries: zod_1.z.number().default(3),
        allowedDomains: zod_1.z.array(zod_1.z.string()).default([]),
        strictDomainCheck: zod_1.z.boolean().default(true),
    }),
    reasoning: zod_1.z.object({
        minConfidenceThreshold: zod_1.z.number().default(0.40),
        highConfidenceThreshold: zod_1.z.number().default(0.80),
        maxScrollCycles: zod_1.z.number().default(3),
        enableSelfHealing: zod_1.z.boolean().default(true),
        enableCoordinateFallback: zod_1.z.boolean().default(false),
    }),
    resilience: zod_1.z.object({
        maxRecoveryAttempts: zod_1.z.number().default(3),
        backoffBaseMs: zod_1.z.number().default(500),
        backoffMultiplier: zod_1.z.number().default(2.0),
        maxBackoffMs: zod_1.z.number().default(8000),
    }),
    execution: zod_1.z.object({
        maxSteps: zod_1.z.number().default(50),
        globalTimeoutMs: zod_1.z.number().default(120000),
    }),
    screenshots: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        outputDir: zod_1.z.string().default('./screenshots'),
        onAction: zod_1.z.boolean().default(true),
        onFailure: zod_1.z.boolean().default(true),
    }),
    logging: zod_1.z.object({
        level: zod_1.z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
        format: zod_1.z.enum(['json', 'pretty']).default('json'),
        redactFields: zod_1.z.array(zod_1.z.string()).default(['password', 'token', 'secret', 'key']),
    }),
    events: zod_1.z.object({
        asyncDispatch: zod_1.z.boolean().default(false),
    }).default({ asyncDispatch: false }),
});
