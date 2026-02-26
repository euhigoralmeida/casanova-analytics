import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ca_session")?.value;

  if (token) {
    const payload = verifySessionToken(token);
    if (payload?.globalRole === "platform_admin" && !payload.activeTenantId) {
      redirect("/admin");
    }
  }

  redirect("/overview");
}
