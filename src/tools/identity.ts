/**
 * Identity tool implementations — wraps @aman_asmuei/acore-core for the
 * aman-mcp aggregator.
 *
 * Phase 4 of the aman engine v1 build sequence: this file used to read
 * ~/.acore/core.md directly via fs + regex parsing. Now it delegates to
 * acore-core's library API, which means:
 *
 *   - Multi-tenant by default (each scope has its own identity)
 *   - Backward-compatible with hand-edited ~/.acore/core.md (acore-core's
 *     MarkdownFileStorage uses the same file location for `dev:default`)
 *   - The aman-mcp tools are now thin wrappers, not parallel implementations
 *
 * Default scope = `dev:plugin` because aman-mcp is consumed primarily by
 * Claude Code through aman-plugin. Override at runtime with $AMAN_MCP_SCOPE.
 */

import {
  getIdentity,
  getOrCreateIdentity,
  updateSection,
  updateDynamics,
  getBulletField,
  getSection,
} from "@aman_asmuei/acore-core";

/**
 * Default scope for all aman-mcp identity operations. Override with
 * $AMAN_MCP_SCOPE to point at a different identity (e.g. when running
 * aman-mcp from a context other than the Claude Code plugin).
 */
function getScope(): string {
  return process.env.AMAN_MCP_SCOPE ?? "dev:plugin";
}

const NO_IDENTITY_MSG =
  "No identity configured. Run: npx @aman_asmuei/acore";

export async function identityRead(): Promise<string> {
  const identity = await getIdentity(getScope());
  if (!identity) return NO_IDENTITY_MSG;
  return identity.content;
}

export async function identitySummary(): Promise<{
  aiName: string;
  userName: string;
  trustLevel: string;
  personality: string;
  role: string;
}> {
  const identity = await getIdentity(getScope());
  if (!identity) {
    return {
      aiName: "unknown",
      userName: "unknown",
      trustLevel: "unknown",
      personality: "unknown",
      role: "unknown",
    };
  }

  // The h1 heading is the AI name (e.g. "# Aman" → "Aman").
  // acore-core doesn't expose an h1 reader, so we parse it directly here.
  const h1Match = identity.content.match(/^#\s+(.+)/m);

  // Some templates use "## Personality" as a section body (freeform text);
  // others have "- Personality:" as a bullet under "## User". Try the bullet
  // first (legacy shape), then fall back to the section body.
  const personalityBullet = getBulletField(identity, "Personality");
  const personalitySection = getSection(identity, "Personality");

  return {
    aiName: h1Match?.[1]?.trim() ?? "unknown",
    userName: getBulletField(identity, "Name") ?? "unknown",
    trustLevel: getBulletField(identity, "Level") ?? "unknown",
    personality:
      personalityBullet ??
      (personalitySection ? personalitySection.split("\n")[0] : "unknown"),
    role: getBulletField(identity, "Role") ?? "unknown",
  };
}

export async function identityUpdateSession(
  resume: string,
  topics: string,
  decisions: string,
): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const body = `- Last updated: ${today}
- Resume: ${resume}
- Active topics: ${topics}
- Recent decisions: ${decisions}
- Temp notes: [cleared at session end]`;

  await updateSection("Session", body, getScope());

  return `Session updated (${today}):\n- Resume: ${resume}\n- Topics: ${topics}\n- Decisions: ${decisions}`;
}

export async function identityUpdateSection(
  section: string,
  content: string,
): Promise<string> {
  await updateSection(section, content, getScope());
  return `Updated section: ${section}`;
}

export async function identityUpdateDynamics(
  currentRead: string,
  energy?: string,
  activeMode?: string,
): Promise<string> {
  await updateDynamics(
    {
      currentRead,
      ...(energy !== undefined ? { energy } : {}),
      ...(activeMode !== undefined ? { activeMode } : {}),
    },
    getScope(),
  );

  const parts = [`Current read: ${currentRead}`];
  if (energy) parts.push(`Energy: ${energy}`);
  if (activeMode) parts.push(`Active mode: ${activeMode}`);
  return `Dynamics updated: ${parts.join(", ")}`;
}

/**
 * Build an image-generation prompt from the Appearance section of the
 * current identity. The Appearance subsection lives at h3 (`### Appearance`)
 * inside another section, so this function does its own surgical regex
 * parsing rather than going through acore-core's section helpers (which
 * only handle h2). The data still comes from acore-core via getIdentity.
 *
 * Same deterministic-seed logic as the legacy implementation: same date +
 * period always produces the same numeric seed for consistent character
 * appearance across image generations.
 */
export async function avatarPrompt(
  date?: string,
  period?: string,
): Promise<string> {
  // bootstrap an identity if needed so the user gets a useful error message
  // instead of "no identity" when the Appearance section is the only thing
  // that's missing
  const identity = await getOrCreateIdentity(getScope());
  const content = identity.content;

  // Extract appearance fields from the ### Appearance subsection
  const baseMatch = content.match(/### Appearance[\s\S]*?- Base:\s*(.+)/);
  const styleMatch = content.match(/### Appearance[\s\S]*?- Style:\s*(.+)/);
  const paletteMatch = content.match(
    /### Appearance[\s\S]*?- Palette:\s*(.+)/,
  );
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

  let seed = 0;
  for (const ch of today + timePeriod) {
    seed = ((seed << 5) - seed + ch.charCodeAt(0)) | 0;
  }
  seed = Math.abs(seed);

  // Build the image generation prompt
  const parts: string[] = [];
  parts.push(`Portrait of ${aiName}`);
  parts.push(base);

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

  return JSON.stringify(
    {
      prompt,
      seed,
      date: today,
      period: timePeriod,
      appearance: { base, style, palette },
    },
    null,
    2,
  );
}
