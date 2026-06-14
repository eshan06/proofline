import type { Ticket } from "@/lib/schemas";
import { repo } from "@/server/repository";
import { logger } from "@/server/logger";
import { slack } from "./slack";

/**
 * Post an agent's reply on a Slack-channel ticket back into the originating
 * Slack thread via chat.postMessage. A no-op (instant return) when the Slack
 * channel is unconfigured or the workspace hasn't installed the app, so the
 * common dormant case adds zero latency. Never throws — the reply is already
 * persisted; a delivery failure is reported, not surfaced to the agent.
 */
export async function dispatchSlackReply(workspaceId: string, ticket: Ticket, text: string): Promise<void> {
  try {
    const s = slack();
    if (!s.enabled) return;
    const account = await repo().getSlackAccount(workspaceId);
    if (!account) return; // app not installed for this workspace
    const thread = await repo().getSlackThread(workspaceId, ticket.id);
    if (!thread) {
      logger.warn("slack.reply_no_thread", { ticketId: ticket.id });
      return;
    }
    await s.postReply({ botToken: account.botToken, channel: thread.channel, threadTs: thread.threadTs, text });
  } catch (err) {
    logger.reportError("slack.reply_failed", err, { ticketId: ticket.id });
  }
}
