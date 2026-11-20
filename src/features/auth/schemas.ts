import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Enter a valid email address." }));

export const LoginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

/** Admin adds a team member with a temporary password they change later. */
export const MemberSchema = z.object({
  email,
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

/** Shape returned by auth server actions to `useActionState`. */
export type AuthFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
  values?: { email?: string };
};
