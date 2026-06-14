import type { Ticket } from "@/lib/schemas";
import { repo } from "@/server/repository";
import { logger } from "@/server/logger";
import { gmail } from "./gmail";

/**
 * Send an agent's reply on an email-channel ticket back to the customer via the
 * workspace's connected Gmail account, threaded into the original conversation.
 *
 * Safe to call unconditionally after a reply: a no-op (instant return) when the
 * Gmail channel is unconfigured or the workspace hasn't connected an account, so
 * the common dormant case adds zero latency. Never throws — the reply is already
 * persisted; a delivery failure is reported, not surfaced to the agent.
 */
export async function dispatchEmailReply(workspaceId: string, ticket: Ticket, text: string): Promise<void> {
  try {
    const g = gmail();
    if (!g.enabled) return;
    const account = await repo().getGmailAccount(workspaceId);
    if (!account) return; // channel not connected for this workspace
    const thread = await repo().getEmailThread(workspaceId, ticket.id);
    const to = thread?.customerEmail || ticket.customer.company;
    if (!to || !to.includes("@")) {
      logger.warn("gmail.reply_no_recipient", { ticketId: ticket.id });
      return;
    }
    const subject = /^re:/i.test(ticket.subject) ? ticket.subject : `Re: ${ticket.subject}`;
    await g.sendReply({
      refreshToken: account.refreshToken,
      fromAddress: account.address,
      to,
      subject,
      body: text,
      threadId: thread?.gmailThreadId,
      inReplyTo: thread?.lastInboundMessageId ?? undefined,
    });
  } catch (err) {
    logger.reportError("gmail.reply_failed", err, { ticketId: ticket.id });
  }
}
