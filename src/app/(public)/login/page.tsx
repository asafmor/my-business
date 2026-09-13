import { redirect } from "next/navigation";

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
        <h1 id="login-title">My Business</h1>
        <p>Sign in to continue.</p>
        <LoginForm />
      </section>
    </main>
  );
}
