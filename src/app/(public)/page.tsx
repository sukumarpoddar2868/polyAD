import { redirect } from "next/navigation";

/** Internal tool: no public landing page. The proxy/DAL send signed-out people to /login. */
export default function Home() {
  redirect("/dashboard");
}
