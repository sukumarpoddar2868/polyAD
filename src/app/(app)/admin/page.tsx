import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, Chip } from "@/components/ui/surface";
import { removeMemberAction } from "@/features/admin/actions";
import { AddMemberForm, ResetPasswordForm } from "@/features/admin/components/team-forms";
import { loadTeam } from "@/features/admin/load";
import { requireAdmin } from "@/features/auth/dal";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const admin = await requireAdmin();
  const team = await loadTeam(admin.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-[13px] font-bold uppercase tracking-wide text-ink-muted">Admin</p>
        <h1 className="mt-1 text-[32px] font-extrabold leading-tight">team</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">Everyone here works on the same candidates, parties and campaigns.</p>
      </header>

      <Card className="flex flex-col gap-4">
        <h2 className="text-[19px] font-extrabold">Add a team member</h2>
        <AddMemberForm />
      </Card>

      <ul className="flex flex-col gap-3">
        {team.map((m) => (
          <li key={m.id}>
            <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[15px] font-extrabold">{m.email}</p>
                  <Chip tone={m.isAdmin ? "active" : "neutral"}>{m.isAdmin ? "Admin" : "Member"}</Chip>
                </div>
                <p className="mt-1 text-[13px] text-ink-muted">Added {m.createdAt.slice(0, 10)}</p>
              </div>
              {m.id !== admin.loginId && !m.isAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <ResetPasswordForm userId={m.id} email={m.email} />
                  <form action={removeMemberAction}>
                    <input type="hidden" name="userId" value={m.id} />
                    <Button size="sm" variant="danger" type="submit">
                      Remove
                    </Button>
                  </form>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
