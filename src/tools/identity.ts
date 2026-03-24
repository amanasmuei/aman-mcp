import { paths, readFileOr, writeFile } from "../lib/paths.js";

export function identityRead(): string {
  return readFileOr(
    paths.acore.core,
    "No identity configured. Run: npx @aman_asmuei/acore"
  );
}

export function identitySummary(): {
  aiName: string;
  userName: string;
  trustLevel: string;
  personality: string;
  role: string;
} {
  const content = identityRead();
  if (content.startsWith("No identity configured")) {
    return {
      aiName: "unknown",
      userName: "unknown",
      trustLevel: "unknown",
      personality: "unknown",
      role: "unknown",
    };
  }

  const extract = (pattern: RegExp, fallback: string): string => {
    const match = content.match(pattern);
    return match?.[1]?.trim() ?? fallback;
  };

  return {
    aiName: extract(/^#\s+(.+)/m, "unknown"),
    userName: extract(/- Name:\s*(.+)/m, "unknown"),
    trustLevel: extract(/- Level:\s*(.+)/m, "unknown"),
    personality: extract(/- Personality:\s*(.+)/m, "unknown"),
    role: extract(/- Role:\s*(.+)/m, "unknown"),
  };
}

export function identityUpdateSession(
  resume: string,
  topics: string,
  decisions: string
): string {
  const content = readFileOr(paths.acore.core, "");
  if (!content) {
    return "No identity configured. Run: npx @aman_asmuei/acore";
  }

  const now = new Date().toISOString().split("T")[0];

  const sessionPattern =
    /## Session\n([\s\S]*?)(?=\n---|\n## [A-Z]|$)/;
  const sessionMatch = content.match(sessionPattern);

  if (!sessionMatch) {
    return "Could not find Session section in core.md";
  }

  const newSession = `## Session
- Last updated: ${now}
- Resume: ${resume}
- Active topics: ${topics}
- Recent decisions: ${decisions}
- Temp notes: [cleared at session end]`;

  const updated = content.replace(sessionPattern, newSession);
  writeFile(paths.acore.core, updated);

  return `Session updated (${now}):\n- Resume: ${resume}\n- Topics: ${topics}\n- Decisions: ${decisions}`;
}

export function identityUpdateSection(
  section: string,
  content: string
): string {
  const existing = readFileOr(paths.acore.core, "");
  if (!existing) {
    return "No identity configured. Run: npx @aman_asmuei/acore";
  }

  const pattern = new RegExp(
    `(## ${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n)[\\s\\S]*?(?=\\n## |$)`
  );
  const match = existing.match(pattern);

  if (!match) {
    return `Section not found: ${section}`;
  }

  const updated = existing.replace(pattern, `## ${section}\n${content}`);
  writeFile(paths.acore.core, updated);

  return `Updated section: ${section}`;
}
