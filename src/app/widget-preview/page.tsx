import Script from "next/script";
import Link from "next/link";
import { currentSession } from "@/server/session";
import { repo } from "@/server/repository";

/**
 * A live preview of your website chat widget on a sample page. Open this signed
 * in, click the launcher bottom-right, send a message — it lands in your inbox
 * as a real ticket, and your approved replies stream back here. This is the
 * actual embed; the snippet in Integrations → Website Chat is the same thing for
 * your own site.
 */
export const dynamic = "force-dynamic";

export default async function WidgetPreviewPage() {
  const session = await currentSession();
  const siteKey = session ? (await repo().getWorkspace(session.workspaceId)).widget.siteKey : "";

  return (
    <div style={{ minHeight: "100vh", background: "#0B0D11", color: "#E6E9EF", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "64px 24px" }}>
        <div style={{ fontSize: 12, color: "#8A93A6", letterSpacing: ".04em", textTransform: "uppercase" }}>
          Proofline · live widget preview
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 700, margin: "10px 0 14px", letterSpacing: "-0.02em" }}>
          Your website, with Proofline chat
        </h1>
        {siteKey ? (
          <>
            <p style={{ color: "#AEB6C5", lineHeight: 1.6, maxWidth: 560 }}>
              This page is a stand-in for your marketing site. The chat launcher in the bottom-right
              is your real widget. Send a message — it opens a ticket in your inbox, your copilot can
              draft a grounded reply, and once you approve it, the reply appears right here.
            </p>
            <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/inbox" style={{ background: "#5B8DEF", color: "#fff", padding: "9px 16px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
                Open your inbox →
              </Link>
              <Link href="/integrations" style={{ border: "1px solid rgba(255,255,255,.14)", color: "#E6E9EF", padding: "9px 16px", borderRadius: 8, textDecoration: "none", fontSize: 14 }}>
                Get the embed snippet
              </Link>
            </div>
            <p style={{ marginTop: 28, fontSize: 12, color: "#6B7280", fontFamily: "monospace" }}>
              site key: {siteKey.slice(0, 8)}… · channel: web
            </p>
            <Script src={`/api/widget/embed?key=${siteKey}`} strategy="afterInteractive" />
          </>
        ) : (
          <p style={{ color: "#AEB6C5", lineHeight: 1.6 }}>
            <Link href="/signin" style={{ color: "#7AA7FF" }}>Sign in</Link> to preview your workspace&apos;s
            live chat widget here.
          </p>
        )}
      </div>
    </div>
  );
}
