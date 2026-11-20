import type { Metadata } from "next";
import { Card, Chip } from "@/components/ui/surface";
import { PasswordForm } from "@/features/account/components/account-forms";
import { requireUser } from "@/features/auth/dal";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-[13px] font-bold uppercase tracking-wide text-ink-muted">Settings</p>
        <h1 className="mt-1 text-[32px] font-extrabold leading-tight">account</h1>
      </header>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[19px] font-extrabold">Profile</h2>
          <Chip tone={user.isAdmin ? "active" : "neutral"}>{user.isAdmin ? "Admin" : "Team member"}</Chip>
        </div>
        <dl className="text-[14px]">
          <dt className="text-ink-muted">Email</dt>
          <dd className="mt-1 break-all font-bold">{user.email}</dd>
        </dl>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-[19px] font-extrabold">Password</h2>
        <PasswordForm />
      </Card>
    </div>
  );
}
