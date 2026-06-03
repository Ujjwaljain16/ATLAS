import { z } from 'zod';

export const ATLASConfigSchema = z.object({
  browser: z.object({
    headless: z.boolean().default(true),
    viewport: z.object({
      width: z.number().default(1280),
      height: z.number().default(720),
    }),
    launchTimeoutMs: z.number().default(30000),
  }),
  navigation: z.object({
    waitUntil: z.enum(['networkidle', 'domcontentloaded', 'load']).default('domcontentloaded'),
    timeoutMs: z.number().default(30000),
    maxRetries: z.number().default(3),
    allowedDomains: z.array(z.string()).default([]),
    strictDomainCheck: z.boolean().default(true),
  }),
  reasoning: z.object({
    minConfidenceThreshold: z.number().default(0.40),
    highConfidenceThreshold: z.number().default(0.80),
    maxScrollCycles: z.number().default(3),
    enableSelfHealing: z.boolean().default(true),
    enableCoordinateFallback: z.boolean().default(false),
  }),
  resilience: z.object({
    maxRecoveryAttempts: z.number().default(3),
    backoffBaseMs: z.number().default(500),
    backoffMultiplier: z.number().default(2.0),
    maxBackoffMs: z.number().default(8000),
  }),
  execution: z.object({
    maxSteps: z.number().default(50),
    globalTimeoutMs: z.number().default(120000),
  }),
  screenshots: z.object({
    enabled: z.boolean().default(true),
    outputDir: z.string().default('./screenshots'),
    onAction: z.boolean().default(true),
    onFailure: z.boolean().default(true),
  }),
  logging: z.object({
    level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
    format: z.enum(['json', 'pretty']).default('json'),
    redactFields: z.array(z.string()).default(['password', 'token', 'secret', 'key']),
  }),
  events: z.object({
    asyncDispatch: z.boolean().default(false),
  }).default({ asyncDispatch: false }),
});

export type ATLASConfig = z.infer<typeof ATLASConfigSchema>;
