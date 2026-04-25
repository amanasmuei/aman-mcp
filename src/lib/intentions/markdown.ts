import type {
  Intention,
  IntentionList,
  IntentionStatus,
  IntentionHorizon,
} from "./types.js";
import { INTENTION_STATUSES, INTENTION_HORIZONS } from "./types.js";

const STATUS_TITLES: Record<IntentionStatus, string> = {
  active: "Active",
  paused: "Paused",
  complete: "Complete",
  abandoned: "Abandoned",
};

const TITLE_TO_STATUS: Record<string, IntentionStatus> = {
  Active: "active",
  Paused: "paused",
  Complete: "complete",
  Abandoned: "abandoned",
};

export function serialize(list: IntentionList): string {
  const lines: string[] = ["# Intentions", ""];

  for (const status of INTENTION_STATUSES) {
    lines.push(`## ${STATUS_TITLES[status]}`);
    lines.push("");
    const items = list.intentions.filter((i) => i.status === status);
    if (items.length === 0) {
      lines.push("");
      continue;
    }
    for (const intent of items) {
      lines.push(`### ${intent.description} [intention:${intent.id}]`);
      lines.push(`- Niyyah: ${intent.niyyah}`);
      lines.push(`- Success: ${intent.successCriteria}`);
      lines.push(`- Horizon: ${intent.horizon}`);
      lines.push(`- Created: ${intent.createdAt}`);
      lines.push(`- Last touched: ${intent.lastTouchedAt}`);
      if (intent.linkedProjectId) {
        lines.push(`- Linked project: ${intent.linkedProjectId}`);
      }
      if (intent.closedAt) {
        lines.push(`- Closed: ${intent.closedAt}`);
      }
      if (intent.closedReason) {
        lines.push(`- Closed reason: ${intent.closedReason}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

const TITLE_RE = /^### (.+?) \[intention:([0-9A-HJKMNP-TV-Z]{26})\]\s*$/;
const FIELD_RE = /^- ([A-Z][a-z][a-z\s]*?): (.+)$/;

function isHorizon(s: string): s is IntentionHorizon {
  return (INTENTION_HORIZONS as readonly string[]).includes(s);
}

export function deserialize(markdown: string): IntentionList {
  const intentions: Intention[] = [];
  const lines = markdown.split("\n");

  let currentStatus: IntentionStatus | null = null;
  let currentIntent: Partial<Intention> | null = null;

  const flushCurrent = () => {
    if (!currentIntent || !currentStatus) return;
    if (
      currentIntent.id &&
      currentIntent.description !== undefined &&
      currentIntent.niyyah !== undefined &&
      currentIntent.successCriteria !== undefined &&
      currentIntent.horizon !== undefined &&
      currentIntent.createdAt !== undefined &&
      currentIntent.lastTouchedAt !== undefined
    ) {
      intentions.push({ ...currentIntent, status: currentStatus } as Intention);
    }
    currentIntent = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushCurrent();
      const heading = line.slice(3).trim();
      currentStatus = TITLE_TO_STATUS[heading] ?? null;
      continue;
    }
    if (line.startsWith("### ")) {
      flushCurrent();
      const m = line.match(TITLE_RE);
      if (m && currentStatus) {
        currentIntent = { id: m[2], description: m[1] };
      }
      continue;
    }
    if (currentIntent && line.startsWith("- ")) {
      const m = line.match(FIELD_RE);
      if (!m) continue;
      const [, key, value] = m;
      switch (key) {
        case "Niyyah":
          currentIntent.niyyah = value;
          break;
        case "Success":
          currentIntent.successCriteria = value;
          break;
        case "Horizon":
          if (isHorizon(value)) currentIntent.horizon = value;
          break;
        case "Created":
          currentIntent.createdAt = value;
          break;
        case "Last touched":
          currentIntent.lastTouchedAt = value;
          break;
        case "Linked project":
          currentIntent.linkedProjectId = value;
          break;
        case "Closed":
          currentIntent.closedAt = value;
          break;
        case "Closed reason":
          currentIntent.closedReason = value;
          break;
      }
    }
  }
  flushCurrent();

  return { intentions };
}
