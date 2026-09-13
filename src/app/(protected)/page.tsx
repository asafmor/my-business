import { requireSession } from "../../server/auth/service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireSession();

  return (
    <main>
      <h1>My Business</h1>
      <p>You are signed in.</p>
    </main>
  );
}
