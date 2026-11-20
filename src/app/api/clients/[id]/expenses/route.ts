import { getCurrentUser } from "@/features/auth/dal";
import { getClient } from "@/features/clients/data";
import { expenseCsv } from "@/features/spend/load";
import { MetaApiError } from "@/lib/meta/graph";

/** GET /api/clients/<id>/expenses → the candidate's daily Meta ad spend per campaign, as CSV. */
export async function GET(_req: Request, { params }: RouteContext<"/api/clients/[id]/expenses">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  const client = await getClient(user.id, Number((await params).id));
  if (!client) return new Response("Candidate not found.", { status: 404 });
  try {
    const csv = await expenseCsv(user.id, client);
    const name = (client.business_name ?? "candidate").replace(/[^\w-]+/g, "_").slice(0, 60);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-ad-expenses-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(e instanceof MetaApiError ? e.userMessage || e.message : e instanceof Error ? e.message : "Couldn't load spend.", { status: 400 });
  }
}
