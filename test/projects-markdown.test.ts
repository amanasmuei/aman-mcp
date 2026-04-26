import { describe, it, expect } from "vitest";
import { serialize, deserialize } from "../src/lib/projects/markdown.js";
import type { ProjectList } from "../src/lib/projects/types.js";

describe("projects markdown — round-trip", () => {
  it("preserves all fields including optional linkedIntentionId, workspaces, sessionLog", () => {
    const list: ProjectList = {
      projects: [
        {
          id: "01KS3F29B92X3TFNDG30HJR4D1",
          name: "Phase 1.5 substrate",
          status: "active",
          inActiveList: true,
          position: 1,
          createdAt: "2026-04-22T08:00:00.000Z",
          lastTouchedAt: "2026-04-26T14:30:00.000Z",
          linkedIntentionId: "01KQ3F29B92X3TFNDG30HJR4D1",
          workspaces: ["~/aman-mcp", "~/arules-core"],
          niyyah: "substrate that endures",
          sessionLog: "### 2026-04-26 evening\n- closed Bug 4\n- filed Bug 6\n",
        },
        {
          id: "01KR3F29B92X3TFNDG30HJR4D2",
          name: "old-experiment",
          status: "active",
          inActiveList: false,
          lruEvictedAt: "2026-04-20T10:00:00.000Z",
          createdAt: "2026-04-01T08:00:00.000Z",
          lastTouchedAt: "2026-04-19T12:00:00.000Z",
          sessionLog: "",
        },
        {
          id: "01KQ3F29B92X3TFNDG30HJR4D3",
          name: "morning-brief-bootstrap",
          status: "complete",
          inActiveList: false,
          createdAt: "2026-04-15T08:00:00.000Z",
          lastTouchedAt: "2026-04-25T18:00:00.000Z",
          closedAt: "2026-04-25T18:00:00.000Z",
          closedReason: "intention fulfilled, bootstrap done",
          sessionLog: "### setup\n- tasks done\n",
        },
      ],
    };
    const md = serialize(list);
    const parsed = deserialize(md);
    expect(parsed).toEqual(list);
  });

  it("deserialize() returns empty list for empty/missing markdown", () => {
    expect(deserialize("")).toEqual({ projects: [] });
    expect(deserialize("# Projects\n")).toEqual({ projects: [] });
  });

  it("serialize() groups projects under section headers (Active List / Off-List / Paused / Closed)", () => {
    const list: ProjectList = {
      projects: [
        {
          id: "01KS00000000000000000000A1",
          name: "live-thread",
          status: "active",
          inActiveList: true,
          position: 1,
          createdAt: "2026-04-22T08:00:00.000Z",
          lastTouchedAt: "2026-04-22T08:00:00.000Z",
          sessionLog: "",
        },
        {
          id: "01KS00000000000000000000A2",
          name: "paused-thread",
          status: "paused",
          inActiveList: false,
          createdAt: "2026-04-21T08:00:00.000Z",
          lastTouchedAt: "2026-04-21T08:00:00.000Z",
          closedAt: "2026-04-22T08:00:00.000Z",
          closedReason: "stepping away for now",
          sessionLog: "",
        },
      ],
    };
    const md = serialize(list);
    expect(md).toContain("## Active List");
    expect(md).toContain("## Paused");
  });
});
