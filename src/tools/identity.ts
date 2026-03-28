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

export function identityUpdateDynamics(
  currentRead: string,
  energy?: string,
  activeMode?: string,
): string {
  const content = readFileOr(paths.acore.core, "");
  if (!content) {
    return "No identity configured. Run: npx @aman_asmuei/acore";
  }

  // Update Emotional Patterns → Current read
  let updated = content;
  const currentReadPattern = /- Current read: .*/;
  if (currentReadPattern.test(updated)) {
    updated = updated.replace(currentReadPattern, `- Current read: ${currentRead}`);
  }

  // Update Emotional Patterns → Baseline energy (if provided)
  if (energy) {
    const energyPattern = /- Baseline energy: .*/;
    if (energyPattern.test(updated)) {
      updated = updated.replace(energyPattern, `- Baseline energy: ${energy}`);
    }
  }

  // Update active Context Mode hint (if provided)
  if (activeMode) {
    const modeMarker = /- Active: .*/;
    if (modeMarker.test(updated)) {
      updated = updated.replace(modeMarker, `- Active: ${activeMode}`);
    } else {
      // Insert active mode marker after "## Context Modes" header line + description
      const modeHeader = /## Context Modes\n\n>[^\n]+/;
      if (modeHeader.test(updated)) {
        updated = updated.replace(modeHeader, (match) => `${match}\n- Active: ${activeMode}`);
      }
    }
  }

  if (updated === content) {
    return "No matching fields found in Dynamics section";
  }

  writeFile(paths.acore.core, updated);

  const parts = [`Current read: ${currentRead}`];
  if (energy) parts.push(`Energy: ${energy}`);
  if (activeMode) parts.push(`Active mode: ${activeMode}`);
  return `Dynamics updated: ${parts.join(", ")}`;
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

export function avatarPrompt(
  date?: string,
  period?: string,
): string {
  const content = readFileOr(paths.acore.core, "");
  if (!content) {
    return "No identity configured. Run: npx @aman_asmuei/acore";
  }

  // Extract appearance fields
  const baseMatch = content.match(/### Appearance[\s\S]*?- Base:\s*(.+)/);
  const styleMatch = content.match(/### Appearance[\s\S]*?- Style:\s*(.+)/);
  const paletteMatch = content.match(/### Appearance[\s\S]*?- Palette:\s*(.+)/);
  const aiNameMatch = content.match(/^#\s+(.+)/m);

  const base = baseMatch?.[1]?.trim();
  const style = styleMatch?.[1]?.trim();
  const palette = paletteMatch?.[1]?.trim();
  const aiName = aiNameMatch?.[1]?.trim() || "AI";

  if (!base || base.startsWith("[")) {
    return "No appearance configured. Update the Appearance section in core.md first.";
  }

  // Deterministic seed from date for appearance persistence
  const today = date || new Date().toISOString().split("T")[0];
  const timePeriod = period || "default";

  // Generate a simple numeric seed from date string
  let seed = 0;
  for (const ch of today + timePeriod) {
    seed = ((seed << 5) - seed + ch.charCodeAt(0)) | 0;
  }
  seed = Math.abs(seed);

  // Build the image generation prompt
  const parts: string[] = [];
  parts.push(`Portrait of ${aiName}`);
  parts.push(base);

  // Period-aware adjustments
  if (timePeriod === "morning") {
    parts.push("bright natural morning light, warm tones");
  } else if (timePeriod === "afternoon") {
    parts.push("soft afternoon light, clear atmosphere");
  } else if (timePeriod === "evening") {
    parts.push("warm golden hour lighting, cozy atmosphere");
  } else if (timePeriod === "night" || timePeriod === "late-night") {
    parts.push("soft ambient night lighting, calm atmosphere");
  }

  if (palette && !palette.startsWith("[")) {
    parts.push(`color palette: ${palette}`);
  }

  if (style && !style.startsWith("[")) {
    parts.push(`${style} style`);
  }

  parts.push("high quality, consistent character design");

  const prompt = parts.join(", ");

  return JSON.stringify({
    prompt,
    seed,
    date: today,
    period: timePeriod,
    appearance: { base, style, palette },
  }, null, 2);
}
