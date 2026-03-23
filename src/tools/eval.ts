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

  return {
    totalSessions,
    trustLevel: extract(/- Trust Level:\s*(.+)/m, "unknown"),
    trajectory: extract(/- Trajectory:\s*(.+)/m, "unknown"),
    recentRatings: ratings.slice(-5),
    lastSession: extract(/- Last updated:\s*(.+)/m, "never"),
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
