import { describe, expect, it } from "bun:test";
import { checkLearningResourceLink } from "./linkAudit";

describe("checkLearningResourceLink", () => {
  it("marks successful and failed HTTP responses", async () => {
    const ok = await checkLearningResourceLink("https://example.test/resource", async () => new Response(null, { status: 200 }));
    const failed = await checkLearningResourceLink("https://example.test/missing", async () => new Response(null, { status: 404 }));
    expect(ok.status).toBe("ok");
    expect(failed.status).toBe("broken");
    expect(failed.error).toBe("HTTP 404");
  });

  it("rejects invalid or unsupported URLs without fetching", async () => {
    const invalid = await checkLearningResourceLink("not-a-url");
    const unsupported = await checkLearningResourceLink("file:///etc/passwd");
    expect(invalid.status).toBe("broken");
    expect(unsupported.status).toBe("broken");
  });
});
