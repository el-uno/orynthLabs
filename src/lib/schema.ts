import { z } from "zod";
import { PARTNER_PATH_ERROR, isSafePartnerPath } from "./partner-path";

export const signalKindSchema = z.enum([
  "github",
  "social",
  "market",
  "onchain",
  "partner"
]);

export const severitySchema = z.enum(["low", "medium", "high"]);

export const launchStatusSchema = z.enum(["draft", "watching", "ready", "launched"]);

export const launchSnapshotInputSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  partnerPath: z.string().min(1).refine(isSafePartnerPath, PARTNER_PATH_ERROR)
});

export const scoreLaunchInputSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  partnerPath: z.string().min(1).refine(isSafePartnerPath, PARTNER_PATH_ERROR)
});

export const scoredSignalSchema = z.object({
  source: z.string().min(1),
  kind: signalKindSchema,
  severity: severitySchema,
  title: z.string().min(1),
  detail: z.string().min(1),
  value: z.string().optional(),
  scoreDelta: z.number().int()
});

export const launchScoreSchema = z.object({
  score: z.number().min(0).max(100),
  status: launchStatusSchema,
  rationale: z.string().min(1),
  signals: z.array(scoredSignalSchema)
});
