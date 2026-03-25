import { Request } from "express";
import { ActorContext } from "./models.js";

export function getActorContext(req: Request): ActorContext {
  const actor = req.header("x-agent-id") ?? undefined;
  const tool_call_id = req.header("x-tool-call-id") ?? undefined;
  const prompt_hash = req.header("x-prompt-hash") ?? undefined;
  return { actor, tool_call_id, prompt_hash };
}

export function parseIdempotency(req: Request) {
  const key = req.header("idempotency-key") ?? undefined;
  return key;
}

