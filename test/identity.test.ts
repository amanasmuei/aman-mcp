import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aman_asmuei/acore-core", async () => {
  const actual = await vi.importActual<typeof import("@aman_asmuei/acore-core")>(
    "@aman_asmuei/acore-core",
  );
  return {
    ...actual,
    getIdentity: vi.fn(),
  };
});

import { identitySummary } from "../src/tools/identity.js";
import { getIdentity } from "@aman_asmuei/acore-core";

describe("identitySummary", () => {
  beforeEach(() => {
    vi.mocked(getIdentity).mockReset();
  });

  it("returns aiName, userName, personality, role — and does NOT expose trustLevel (Bug 6: cross-layer ownership belongs to evalStatus)", async () => {
    vi.mocked(getIdentity).mockResolvedValue({
      content: `# Arienz

## User
- Name: Aman
- Role: companion
- Personality: warm and curious
`,
      scope: "dev:plugin",
    } as any);

    const summary = await identitySummary();

    // Strict equality — extra fields (e.g. a stray trustLevel) would fail this.
    expect(summary).toEqual({
      aiName: "Arienz",
      userName: "Aman",
      personality: "warm and curious",
      role: "companion",
    });
  });

  it("returns 'unknown' for the four documented fields when no identity exists — and still has no trustLevel field", async () => {
    vi.mocked(getIdentity).mockResolvedValue(null);

    const summary = await identitySummary();

    expect(summary).toEqual({
      aiName: "unknown",
      userName: "unknown",
      personality: "unknown",
      role: "unknown",
    });
  });
});
