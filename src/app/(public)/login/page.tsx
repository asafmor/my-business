import { redirect } from "next/navigation";

import { appName } from "../../../lib/labels";
import { getSession } from "../../../server/auth/service";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) {
    redirect("/");
  }

  return (
    <main className="login-page">
      <section aria-labelledby="login-title" className="login-panel">
        <h1 id="login-title">{appName}</h1>
        <p>יש להתחבר כדי להמשיך.</p>
        <LoginForm />
      </section>
    </main>
  );
}
