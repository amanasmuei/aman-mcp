import type { Project, ProjectList, ProjectStatus } from "./types.js";

const SECTION_TITLES = {
  ACTIVE_LIST: "Active List",
  OFF_LIST: "Off-List",
  PAUSED: "Paused",
  COMPLETE: "Complete",
  ABANDONED: "Abandoned",
} as const;

type SectionKey = keyof typeof SECTION_TITLES;

function sectionFor(p: Project): SectionKey {
  if (p.status === "paused") return "PAUSED";
  if (p.status === "complete") return "COMPLETE";
  if (p.status === "abandoned") return "ABANDONED";
  return p.inActiveList ? "ACTIVE_LIST" : "OFF_LIST";
}

const TITLE_TO_SECTION: Record<string, SectionKey> = {
  "Active List": "ACTIVE_LIST",
  "Off-List": "OFF_LIST",
  Paused: "PAUSED",
  Complete: "COMPLETE",
  Abandoned: "ABANDONED",
};

const SECTION_ORDER: readonly SectionKey[] = [
  "ACTIVE_LIST",
  "OFF_LIST",
  "PAUSED",
  "COMPLETE",
  "ABANDONED",
];

const TITLE_RE = /^### (.+?) \[project:([0-9A-HJKMNP-TV-Z]{26})\]\s*$/;
const FIELD_RE = /^- ([A-Za-z][A-Za-z\s-]*?): (.+)$/;
const SESSION_LOG_FENCE = "<!-- session-log -->";
const SESSION_LOG_END_FENCE = "<!-- /session-log -->";

function statusFromSection(section: SectionKey): ProjectStatus {
  switch (section) {
    case "PAUSED":
      return "paused";
    case "COMPLETE":
      return "complete";
    case "ABANDONED":
      return "abandoned";
    case "ACTIVE_LIST":
    case "OFF_LIST":
      return "active";
  }
}

export function serialize(list: ProjectList): string {
  const lines: string[] = ["# Projects", ""];
  const grouped: Record<SectionKey, Project[]> = {
    ACTIVE_LIST: [],
    OFF_LIST: [],
    PAUSED: [],
    COMPLETE: [],
    ABANDONED: [],
  };
  for (const p of list.projects) grouped[sectionFor(p)].push(p);
  // Active list — sort by position ascending so #1 first
  grouped.ACTIVE_LIST.sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

  for (const key of SECTION_ORDER) {
    const items = grouped[key];
    if (key === "ACTIVE_LIST") {
      const cap = items.length;
      lines.push(`## ${SECTION_TITLES[key]} (${cap}/10)`);
    } else {
      lines.push(`## ${SECTION_TITLES[key]}`);
    }
    lines.push("");
    if (items.length === 0) {
      lines.push("");
      continue;
    }
    for (const p of items) {
      lines.push(`### ${p.name} [project:${p.id}]`);
      if (p.position !== undefined) lines.push(`- Position: ${p.position}`);
      lines.push(`- Created: ${p.createdAt}`);
      lines.push(`- Last touched: ${p.lastTouchedAt}`);
      if (p.lruEvictedAt) lines.push(`- LRU evicted: ${p.lruEvictedAt}`);
      if (p.closedAt) lines.push(`- Closed: ${p.closedAt}`);
      if (p.closedReason) lines.push(`- Closed reason: ${p.closedReason}`);
      if (p.linkedIntentionId)
        lines.push(`- Linked intention: ${p.linkedIntentionId}`);
      if (p.workspaces && p.workspaces.length > 0)
        lines.push(`- Workspaces: ${p.workspaces.join(", ")}`);
      if (p.niyyah) lines.push(`- Niyyah: ${p.niyyah}`);
      lines.push(SESSION_LOG_FENCE);
      lines.push(p.sessionLog);
      lines.push(SESSION_LOG_END_FENCE);
      lines.push("");
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function deserialize(markdown: string): ProjectList {
  const projects: Project[] = [];
  const lines = markdown.split("\n");

  let currentSection: SectionKey | null = null;
  let current: Partial<Project> | null = null;
  let inLog = false;
  let logBuffer: string[] = [];

  const flush = () => {
    if (!current || !currentSection) return;
    const status = statusFromSection(currentSection);
    if (
      current.id &&
      current.name !== undefined &&
      current.createdAt !== undefined &&
      current.lastTouchedAt !== undefined
    ) {
      projects.push({
        id: current.id,
        name: current.name,
        status,
        inActiveList: currentSection === "ACTIVE_LIST",
        position: current.position,
        createdAt: current.createdAt,
        lastTouchedAt: current.lastTouchedAt,
        lruEvictedAt: current.lruEvictedAt,
        closedAt: current.closedAt,
        closedReason: current.closedReason,
        linkedIntentionId: current.linkedIntentionId,
        workspaces: current.workspaces,
        niyyah: current.niyyah,
        sessionLog: current.sessionLog ?? "",
      });
    }
    current = null;
    inLog = false;
    logBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    if (line === SESSION_LOG_END_FENCE) {
      if (current) current.sessionLog = logBuffer.join("\n");
      inLog = false;
      logBuffer = [];
      continue;
    }
    if (inLog) {
      logBuffer.push(raw);
      continue;
    }
    if (line === SESSION_LOG_FENCE) {
      inLog = true;
      logBuffer = [];
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      const heading = line.slice(3).replace(/\s+\(\d+\/10\)\s*$/, "").trim();
      currentSection = TITLE_TO_SECTION[heading] ?? null;
      continue;
    }
    if (line.startsWith("### ")) {
      flush();
      const m = line.match(TITLE_RE);
      if (m && currentSection) {
        current = { id: m[2], name: m[1] };
      }
      continue;
    }
    if (current && line.startsWith("- ")) {
      const m = line.match(FIELD_RE);
      if (!m) continue;
      const [, key, value] = m;
      switch (key) {
        case "Position":
          current.position = parseInt(value, 10);
          break;
        case "Created":
          current.createdAt = value;
          break;
        case "Last touched":
          current.lastTouchedAt = value;
          break;
        case "LRU evicted":
          current.lruEvictedAt = value;
          break;
        case "Closed":
          current.closedAt = value;
          break;
        case "Closed reason":
          current.closedReason = value;
          break;
        case "Linked intention":
          current.linkedIntentionId = value;
          break;
        case "Workspaces":
          current.workspaces = value.split(",").map((w) => w.trim());
          break;
        case "Niyyah":
          current.niyyah = value;
          break;
      }
    }
  }
  flush();
  return { projects };
}
