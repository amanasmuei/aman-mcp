import { describe, it, expect } from "vitest";
import { serialize, deserialize } from "../src/lib/intentions/markdown.js";
import type { IntentionList } from "../src/lib/intentions/types.js";

describe("intentions markdown", () => {
  const sample: IntentionList = {
    intentions: [
      {
        id: "01HKQ7ABCDEFGHJKMNPQRSTVWXY",
        description: "Ship Simi Tracker v2",
        niyyah: "provide a tool that helps me and my team manage projects with adab",
        successCriteria: "v2 deployed to simi.aman.dev with mobile responsive + Linear sync",
        horizon: "this-month",
        status: "active",
        createdAt: "2026-04-25T07:30:00+08:00",
        lastTouchedAt: "2026-04-25T07:30:00+08:00",
        linkedProjectId: "simi-tracker-v2",
      },
      {
        id: "01HKQ8DONEXAMPLE0000000000",
        description: "Old goal that was completed",
        niyyah: "for ihsan",
        successCriteria: "shipped",
        horizon: "this-quarter",
        status: "complete",
        createdAt: "2026-03-01T09:00:00+08:00",
        lastTouchedAt: "2026-04-01T09:00:00+08:00",
        closedAt: "2026-04-01T09:00:00+08:00",
        closedReason: "shipped to production",
      },
    ],
  };

  it("serialize() produces sectioned markdown with all 4 status headers", () => {
    const md = serialize(sample);
    expect(md).toContain("# Intentions");
    expect(md).toContain("## Active");
    expect(md).toContain("## Paused");
    expect(md).toContain("## Complete");
    expect(md).toContain("## Abandoned");
  });

  it("serialize() places intentions under their status section", () => {
    const md = serialize(sample);
    const activeIdx = md.indexOf("## Active");
    const pausedIdx = md.indexOf("## Paused");
    const completeIdx = md.indexOf("## Complete");
    expect(md.slice(activeIdx, pausedIdx)).toContain("Ship Simi Tracker v2");
    expect(md.slice(completeIdx)).toContain("Old goal that was completed");
  });

  it("serialize() embeds id as [intention:ULID] suffix on the title line", () => {
    const md = serialize(sample);
    expect(md).toContain("### Ship Simi Tracker v2 [intention:01HKQ7ABCDEFGHJKMNPQRSTVWXY]");
  });

  it("serialize() emits all required fields as bullet lines", () => {
    const md = serialize(sample);
    expect(md).toContain("- Niyyah: provide a tool");
    expect(md).toContain("- Success: v2 deployed");
    expect(md).toContain("- Horizon: this-month");
    expect(md).toContain("- Created: 2026-04-25T07:30:00+08:00");
    expect(md).toContain("- Last touched: 2026-04-25T07:30:00+08:00");
  });

  it("serialize() includes optional linkedProjectId only when present", () => {
    const md = serialize(sample);
    expect(md).toContain("- Linked project: simi-tracker-v2");
    // The complete intention has no linkedProjectId — ensure no empty bullet
    const completeSection = md.slice(md.indexOf("## Complete"));
    expect(completeSection).not.toContain("- Linked project:");
  });

  it("serialize() includes closedAt and closedReason when present", () => {
    const md = serialize(sample);
    expect(md).toContain("- Closed: 2026-04-01T09:00:00+08:00");
    expect(md).toContain("- Closed reason: shipped to production");
  });

  it("deserialize(serialize(x)) round-trips losslessly", () => {
    const md = serialize(sample);
    const parsed = deserialize(md);
    expect(parsed).toEqual(sample);
  });

  it("deserialize() returns empty list when given the empty template", () => {
    const empty = "# Intentions\n\n## Active\n\n## Paused\n\n## Complete\n\n## Abandoned\n";
    const parsed = deserialize(empty);
    expect(parsed.intentions).toEqual([]);
  });

  it("deserialize() handles missing optional fields gracefully", () => {
    const minimalMd = `# Intentions

## Active

### Test [intention:01HKQ9MINIMAL00000000000000]
- Niyyah: test
- Success: tested
- Horizon: this-week
- Created: 2026-04-25T00:00:00+08:00
- Last touched: 2026-04-25T00:00:00+08:00

## Paused

## Complete

## Abandoned
`;
    const parsed = deserialize(minimalMd);
    expect(parsed.intentions).toHaveLength(1);
    expect(parsed.intentions[0].linkedProjectId).toBeUndefined();
    expect(parsed.intentions[0].closedAt).toBeUndefined();
  });
});
