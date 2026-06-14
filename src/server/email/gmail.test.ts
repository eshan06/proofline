import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  gmail,
  resetGmailProvider,
  base64Url,
  buildRawMessage,
  parseFromHeader,
  parseGmailMessage,
  GMAIL_SCOPES,
  type GmailApiMessage,
} from "@/server/email/gmail";

function decode(b64url: string): string {
  return Buffer.from(b64url.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

describe("base64Url", () => {
  it("is URL-safe and unpadded", () => {
    const out = base64Url("subjects??>>"); // contains chars that map to + / =
    expect(out).not.toMatch(/[+/=]/);
    expect(decode(out)).toBe("subjects??>>");
  });
});

describe("buildRawMessage", () => {
  it("encodes a threadable RFC2822 message with base64 body", () => {
    const raw = buildRawMessage({
      from: "support@acme.com",
      to: "ada@customer.com",
      subject: "Re: Refund",
      body: "Here is your refund.",
      inReplyTo: "<abc@mail.gmail.com>",
    });
    const mime = decode(raw);
    expect(mime).toContain("From: support@acme.com");
    expect(mime).toContain("To: ada@customer.com");
    expect(mime).toContain("Subject: Re: Refund");
    expect(mime).toContain("In-Reply-To: <abc@mail.gmail.com>");
    expect(mime).toContain("References: <abc@mail.gmail.com>");
    expect(mime).toContain("Content-Transfer-Encoding: base64");
    // Body is base64-encoded after the blank line.
    const body = mime.split("\r\n\r\n")[1]!.replace(/\r\n/g, "");
    expect(Buffer.from(body, "base64").toString("utf8")).toBe("Here is your refund.");
  });

  it("omits threading headers when there is no inReplyTo", () => {
    const mime = decode(buildRawMessage({ from: "a@b.com", to: "c@d.com", subject: "Hi", body: "x" }));
    expect(mime).not.toContain("In-Reply-To:");
  });

  it("MIME-encodes a non-ASCII subject", () => {
    const mime = decode(buildRawMessage({ from: "a@b.com", to: "c@d.com", subject: "Résumé café", body: "x" }));
    expect(mime).toContain("Subject: =?UTF-8?B?");
  });
});

describe("parseFromHeader", () => {
  it("splits display name and address, lowercasing the address", () => {
    expect(parseFromHeader('"Ada Lovelace" <Ada@Customer.com>')).toEqual({ name: "Ada Lovelace", email: "ada@customer.com" });
    expect(parseFromHeader("Ada Lovelace <ada@customer.com>")).toEqual({ name: "Ada Lovelace", email: "ada@customer.com" });
  });
  it("handles a bare address", () => {
    expect(parseFromHeader("ada@customer.com")).toEqual({ name: "ada", email: "ada@customer.com" });
  });
});

describe("parseGmailMessage", () => {
  it("extracts headers + nested text/plain body", () => {
    const msg: GmailApiMessage = {
      id: "gid1",
      threadId: "t1",
      payload: {
        mimeType: "multipart/alternative",
        headers: [
          { name: "From", value: "Ada <ada@customer.com>" },
          { name: "Subject", value: "Need help" },
          { name: "Message-ID", value: "<m1@mail>" },
        ],
        parts: [
          { mimeType: "text/html", body: { data: base64Url("<p>ignored</p>") } },
          { mimeType: "text/plain", body: { data: base64Url("Plain body here") } },
        ],
      },
    };
    expect(parseGmailMessage(msg)).toEqual({
      messageId: "<m1@mail>",
      threadId: "t1",
      from: "ada@customer.com",
      fromName: "Ada",
      subject: "Need help",
      body: "Plain body here",
    });
  });

  it("falls back to the gmail id + snippet when headers/body are missing", () => {
    const msg: GmailApiMessage = {
      id: "gid2",
      threadId: "t2",
      snippet: "snippet text",
      payload: { headers: [{ name: "From", value: "x@y.com" }] },
    };
    const parsed = parseGmailMessage(msg)!;
    expect(parsed.messageId).toBe("gid2");
    expect(parsed.subject).toBe("(no subject)");
    expect(parsed.body).toBe("snippet text");
  });

  it("returns null when there is no sender", () => {
    expect(parseGmailMessage({ id: "g", threadId: "t", payload: { headers: [] } })).toBeNull();
  });
});

describe("gmail() provider selection", () => {
  const saved = { id: process.env.GMAIL_CLIENT_ID, secret: process.env.GMAIL_CLIENT_SECRET };
  beforeEach(() => resetGmailProvider());
  afterEach(() => {
    process.env.GMAIL_CLIENT_ID = saved.id;
    process.env.GMAIL_CLIENT_SECRET = saved.secret;
    resetGmailProvider();
  });

  it("is disabled with no credentials (channel dormant, app still runs)", async () => {
    delete process.env.GMAIL_CLIENT_ID;
    delete process.env.GMAIL_CLIENT_SECRET;
    resetGmailProvider();
    const g = gmail();
    expect(g.enabled).toBe(false);
    expect(() => g.getAuthUrl("s")).toThrow();
    await expect(g.listInbound({ refreshToken: "x" })).resolves.toEqual([]);
  });

  it("is enabled and builds a consent URL when credentials are set", () => {
    process.env.GMAIL_CLIENT_ID = "client-123";
    process.env.GMAIL_CLIENT_SECRET = "secret-xyz";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    resetGmailProvider();
    const g = gmail();
    expect(g.enabled).toBe(true);
    const url = g.getAuthUrl("state-abc");
    expect(url).toContain("client_id=client-123");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain("state=state-abc");
    for (const scope of GMAIL_SCOPES) expect(decodeURIComponent(url)).toContain(scope);
  });
});
