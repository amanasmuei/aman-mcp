import { paths, readFileOr, writeFile } from "../lib/paths.js";

interface EvalStatus {
  totalSessions: number;
  trustLevel: string;
  trajectory: string;
  recentRatings: string[];
  lastSession: string;
}

export function evalStatus(): EvalStatus {
  const content = readFileOr(paths.aeval.eval, "");
  if (!content) {
    return {
      totalSessions: 0,
      trustLevel: "unknown",
      trajectory: "unknown",
      recentRatings: [],
      lastSession: "never",
    };
  }

  const extract = (pattern: RegExp, fallback: string): string => {
    const match = content.match(pattern);
    return match?.[1]?.trim() ?? fallback;
  };

  // Count session log entries
  const sessionEntries = content.match(/^### Session/gm);
  const totalSessions = sessionEntries?.length ?? 0;

  // Extract recent ratings
  const ratings: string[] = [];
  const ratingMatches = content.matchAll(/- Rating:\s*(.+)/g);
  for (const m of ratingMatches) {
    ratings.push(m[1].trim());
  }

  // Trust level / trajectory: case-insensitive on the "Level"/"Trajectory" word
  // so we accept both Format A ("Trust Level: 4", written by evalLog) and
  // Format B ("Trust level: 3/5", written by /eval skill bootstrap).
  const trustLevel = extract(/- Trust [Ll]evel:\s*(.+)/m, "unknown");
  const trajectory = extract(/- [Tt]rajectory:\s*(.+)/m, "unknown");

  // lastSession: prefer the "Last updated:" field (Format A) when present.
  // Fall back to the most recent "### Session YYYY-MM-DD" header date —
  // that always exists when at least one session has been logged, and gives
  // a meaningful value for Format B files that have no Last updated field.
  let lastSession = extract(/- Last updated:\s*(.+)/m, "");
  if (!lastSession) {
    const sessionDates = [
      ...content.matchAll(/^### Session\s+(\d{4}-\d{2}-\d{2})/gm),
    ].map((m) => m[1]);
    lastSession = sessionDates.length > 0
      ? sessionDates[sessionDates.length - 1]
      : "never";
  }

  return {
    totalSessions,
    trustLevel,
    trajectory,
    recentRatings: ratings.slice(-5),
    lastSession,
  };
}

export function evalLog(
  rating: string,
  highlights: string,
  improvements: string
): string {
  const now = new Date().toISOString().split("T")[0];
  const existing = readFileOr(paths.aeval.eval, "");

  const entry = `\n### Session ${now}
- Rating: ${rating}
- Highlights: ${highlights}
- Improvements: ${improvements}
`;

  if (!existing) {
    const content = `# Evaluation Log\n\n- Last updated: ${now}\n${entry}`;
    writeFile(paths.aeval.eval, content);
  } else {
    // Update last updated date
    let updated = existing.replace(
      /- Last updated:\s*.+/,
      `- Last updated: ${now}`
    );
    // Append entry
    updated += entry;
    writeFile(paths.aeval.eval, updated);
  }

  return `Session logged (${now}): ${rating}`;
}

export function evalMilestone(text: string): string {
  const now = new Date().toISOString().split("T")[0];
  const content = readFileOr(paths.aeval.eval, "");

  const entry = `- **${now}** — ${text}`;

  if (!content) {
    writeFile(
      paths.aeval.eval,
      `# Evaluation Log\n\n## Milestones\n${entry}\n`
    );
    return `Milestone added: ${text}`;
  }

  const milestonePattern = /(## Milestones\n)([\s\S]*?)(?=\n## |$)/;
  const match = content.match(milestonePattern);

  if (match) {
    const updated = content.replace(
      milestonePattern,
      `${match[1]}${match[2].trimEnd()}\n${entry}`
    );
    writeFile(paths.aeval.eval, updated);
  } else {
    const updated = content.trimEnd() + `\n\n## Milestones\n${entry}\n`;
    writeFile(paths.aeval.eval, updated);
  }

  return `Milestone added: ${text}`;
}

export function evalReport(): {
  status: EvalStatus;
  milestones: string[];
  summary: string;
} {
  const status = evalStatus();
  const content = readFileOr(paths.aeval.eval, "");

  const milestones: string[] = [];
  const milestoneMatch = content.match(
    /## Milestones\n([\s\S]*?)(?=\n## |$)/
  );
  if (milestoneMatch) {
    const lines = milestoneMatch[1].split("\n");
    for (const line of lines) {
      if (line.match(/^- /)) {
        milestones.push(line.slice(2).trim());
      }
    }
  }

  const summary =
    status.totalSessions === 0
      ? "No sessions recorded yet."
      : `${status.totalSessions} sessions logged. Trust level: ${status.trustLevel}. Trajectory: ${status.trajectory}. ${milestones.length} milestones recorded.`;

  return { status, milestones, summary };
}
