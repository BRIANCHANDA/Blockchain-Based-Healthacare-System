import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Load the real service in isolation: test-preload mocks cannot replace it,
// credentials never come from .env, and the SDK never makes network requests.
function loadEmail(env: Record<string, string> = {}, providerError: { message: string } | null = null) {
  const calls: { from: string; to: string; subject: string; html: string }[] = [];
  const keys: string[] = [];
  class FakeResend {
    constructor(key: string) {
      if (!key) throw new Error("Missing API key");
      keys.push(key);
    }
    emails = { send: async (message: typeof calls[number]) => {
      calls.push(message);
      return { error: providerError };
    } };
  }
  const source = readFileSync(new URL("../src/services/email.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {} as { sendOTPEmail: (email: string, name: string, otp: string) => Promise<void> };
  runInNewContext(outputText, {
    exports, process: { env }, console: { log() {}, error() {} },
    require: (name: string) => {
      if (name !== "resend") throw new Error(`Unexpected dependency: ${name}`);
      return { Resend: FakeResend };
    },
  });
  return { send: exports.sendOTPEmail, calls, keys };
}

test("email module imports without a provider key or SDK construction", () => {
  const service = loadEmail();
  expect(service.keys).toEqual([]);
  expect(service.calls).toEqual([]);
});

test("actual email sends reject missing/blank configuration instead of pretending success", async () => {
  for (const env of [{}, { RESEND_API_KEY: "  " }]) {
    const service = loadEmail(env);
    await expect(service.send("test@example.com", "Test", "123456")).rejects.toThrow("RESEND_API_KEY is required");
    expect(service.calls).toEqual([]);
  }
});

test("configured delivery passes the OTP and recipient to Resend", async () => {
  const service = loadEmail({ RESEND_API_KEY: "test-only-key", RESEND_FROM_EMAIL: "sender@example.com" });
  await service.send("test@example.com", "Test", "123456");
  expect(service.keys).toEqual(["test-only-key"]);
  expect(service.calls).toHaveLength(1);
  expect(service.calls[0].to).toBe("test@example.com");
  expect(service.calls[0].from).toBe("sender@example.com");
  expect(service.calls[0].html).toContain("123456");
});

test("provider delivery errors remain failures", async () => {
  const service = loadEmail({ RESEND_API_KEY: "test-only-key" }, { message: "Rejected by provider" });
  await expect(service.send("test@example.com", "Test", "123456")).rejects.toThrow("Email delivery failed: Rejected by provider");
});
