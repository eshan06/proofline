import { inviteMemberSchema, type Member } from "@/lib/schemas";
import { handleApi, parseBody, requireSession } from "@/server/api";

export async function POST(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    const body = await parseBody(req, inviteMemberSchema);
    const local = body.email.split("@")[0] ?? "teammate";
    const member: Member = {
      name: local.charAt(0).toUpperCase() + local.slice(1),
      email: body.email,
      role: body.role,
      init: local.charAt(0).toUpperCase(),
      status: "Invited",
    };
    session.workspace.members.push(member);
    return member;
  });
}
