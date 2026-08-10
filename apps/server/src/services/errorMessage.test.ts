import { describe, expect, it } from "bun:test";
import { getErrorMessage } from "./errorMessage";

describe("getErrorMessage", () => {
  it("returns an Error or string message", () => {
    expect(getErrorMessage(new Error("AccessDenied"), "Fallback")).toBe("AccessDenied");
    expect(getErrorMessage("Bucket tidak ditemukan", "Fallback")).toBe("Bucket tidak ditemukan");
  });

  it("extracts messages from nested service errors without stringifying objects", () => {
    expect(getErrorMessage({ error: { message: "SignatureDoesNotMatch" } }, "Fallback")).toBe("SignatureDoesNotMatch");
    expect(getErrorMessage({ code: "Unknown" }, "Fallback")).toBe("Fallback");
  });
});
