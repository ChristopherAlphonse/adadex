import type { AgentRuntimeState } from "@adadex/core";

export type { AgentRuntimeState };

const PROCESSING_PATTERN = /esc to interrupt/i;

const DEFAULT_MAX_BUFFER_LENGTH = 256;
const DEFAULT_IDLE_AFTER_MS = 1_600;

const ESCAPE_CODE = 27;
const BEL_CODE = 7;
const CSI_MARKER = 91;
const OSC_MARKER = 93;
const ST_MARKER = 92;

const stripAnsiAndControlSequences = (value: string) => {
  let cleaned = "";

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code !== ESCAPE_CODE) {
      cleaned += value[index] ?? "";
      continue;
    }

    const marker = value.charCodeAt(index + 1);
    if (marker === CSI_MARKER) {
      index += 2;
      while (index < value.length) {
        const csiCode = value.charCodeAt(index);
        if (csiCode >= 64 && csiCode <= 126) {
          break;
        }
        index += 1;
      }
      continue;
    }

    if (marker === OSC_MARKER) {
      index += 2;
      while (index < value.length) {
        const oscCode = value.charCodeAt(index);
        if (oscCode === BEL_CODE) {
          break;
        }
        if (oscCode === ESCAPE_CODE && value.charCodeAt(index + 1) === ST_MARKER) {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    // Consume one-byte escape sequences like ESC c.
    index += 1;
  }

  return cleaned;
};

const normalizeOutput = (chunk: string) => {
  return stripAnsiAndControlSequences(chunk).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
};

const findLastRelevantMatchIndex = (text: string, pattern: RegExp, chunkStartIndex: number) => {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  let latest = -1;

  for (const match of text.matchAll(matcher)) {
    if (typeof match.index !== "number") {
      continue;
    }

    const matchStartIndex = match.index;
    const matchEndIndex = matchStartIndex + match[0].length;
    const touchesNewChunk = matchEndIndex > chunkStartIndex;
    if (!touchesNewChunk) {
      continue;
    }

    latest = matchStartIndex;
  }

  return latest;
};

const hasProcessingSignal = (text: string, chunkStartIndex: number): boolean =>
  findLastRelevantMatchIndex(text, PROCESSING_PATTERN, chunkStartIndex) !== -1;

export class AgentStateTracker {
  private readonly maxBufferLength: number;
  private readonly idleAfterMs: number;
  private carry = "";
  private state: AgentRuntimeState;
  private idleDeadlineAt: number | null = null;

  constructor({
    initialState = "idle",
    maxBufferLength = DEFAULT_MAX_BUFFER_LENGTH,
    idleAfterMs = DEFAULT_IDLE_AFTER_MS,
  }: { initialState?: AgentRuntimeState; maxBufferLength?: number; idleAfterMs?: number } = {}) {
    this.state = initialState;
    this.maxBufferLength = Math.max(256, Math.floor(maxBufferLength));
    this.idleAfterMs = Math.max(250, Math.floor(idleAfterMs));
    if (this.state === "processing") {
      this.idleDeadlineAt = Date.now() + this.idleAfterMs;
    }
  }

  get currentState(): AgentRuntimeState {
    return this.state;
  }

  private enterProcessing(now: number): AgentRuntimeState | null {
    this.idleDeadlineAt = now + this.idleAfterMs;
    if (this.state === "processing") {
      return null;
    }

    this.state = "processing";
    return "processing";
  }

  forceState(nextState: AgentRuntimeState, now = Date.now()): boolean {
    if (nextState === this.state) {
      if (nextState === "processing") {
        this.idleDeadlineAt = now + this.idleAfterMs;
      }
      return false;
    }

    this.state = nextState;
    this.idleDeadlineAt = nextState === "processing" ? now + this.idleAfterMs : null;
    return true;
  }

  observeSubmit(now = Date.now()): AgentRuntimeState | null {
    return this.enterProcessing(now);
  }

  observeChunk(chunk: string, now = Date.now()): AgentRuntimeState | null {
    if (!chunk) {
      return null;
    }

    const normalized = normalizeOutput(chunk);
    if (!normalized) {
      return null;
    }

    const combined = `${this.carry}${normalized}`;
    const chunkStartIndex = this.carry.length;
    this.carry = combined.slice(-this.maxBufferLength);

    if (this.state === "processing" && normalized.trim().length > 0) {
      this.idleDeadlineAt = now + this.idleAfterMs;
    }

    if (!hasProcessingSignal(combined, chunkStartIndex)) {
      return null;
    }

    return this.enterProcessing(now);
  }

  poll(now = Date.now()): AgentRuntimeState | null {
    if (this.state !== "processing" || this.idleDeadlineAt === null) {
      return null;
    }

    if (now < this.idleDeadlineAt) {
      return null;
    }

    this.state = "idle";
    this.idleDeadlineAt = null;
    return "idle";
  }
}
