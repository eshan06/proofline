import { describe, it, expect, afterEach } from "vitest";
import { encryptSecret, decryptSecret, tokenEncryptionEnabled } from "@/server/crypto";

const KEY = "a".repeat(64); // 32 bytes as hex
const saved = process.env.TOKEN_ENC_KEY;

afterEach(() => {
  if (saved === undefined) delete process.env.TOKEN_ENC_KEY;
  else process.env.TOKEN_ENC_KEY = saved;
});

describe("token at-rest encryption", () => {
  it("round-trips a secret and never stores it in the clear", () => {
    process.env.TOKEN_ENC_KEY = KEY;
    const enc = encryptSecret("ya29.super-secret-refresh-token")!;
    expect(enc).toMatch(/^enc:v1:/);
    expect(enc).not.toContain("super-secret-refresh-token");
    expect(decryptSecret(enc)).toBe("ya29.super-secret-refresh-token");
  });

  it("uses a random IV (distinct ciphertexts) that both decrypt", () => {
    process.env.TOKEN_ENC_KEY = KEY;
    const a = encryptSecret("same-input")!;
    const b = encryptSecret("same-input")!;
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-input");
    expect(decryptSecret(b)).toBe("same-input");
  });

  it("passes plaintext through untouched when no key is configured", () => {
    delete process.env.TOKEN_ENC_KEY;
    expect(tokenEncryptionEnabled()).toBe(false);
    expect(encryptSecret("tok")).toBe("tok");
    expect(decryptSecret("tok")).toBe("tok");
  });

  it("still reads legacy plaintext after a key is added (migration-safe)", () => {
    process.env.TOKEN_ENC_KEY = KEY;
    expect(tokenEncryptionEnabled()).toBe(true);
    expect(decryptSecret("legacy-unprefixed-token")).toBe("legacy-unprefixed-token");
  });

  it("rejects tampered ciphertext via the GCM auth tag", () => {
    process.env.TOKEN_ENC_KEY = KEY;
    const enc = encryptSecret("authentic")!;
    const tampered = enc.slice(0, -2) + (enc.endsWith("AA") ? "BB" : "AA");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("handles null and undefined", () => {
    process.env.TOKEN_ENC_KEY = KEY;
    expect(encryptSecret(null)).toBeNull();
    expect(encryptSecret(undefined)).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });

  it("throws on a malformed key", () => {
    process.env.TOKEN_ENC_KEY = "too-short";
    expect(() => encryptSecret("x")).toThrow(/TOKEN_ENC_KEY/);
  });
});
