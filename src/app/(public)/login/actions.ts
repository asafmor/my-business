"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  authenticateLogin,
  setSessionCookie,
} from "../../../server/auth/service";

export type LoginFormState = {
  error: string | null;
};

export async function login(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const password = formData.get("password");
  const result = await authenticateLogin(
    typeof password === "string" ? password : "",
    await headers(),
  );

  if (!result.success) {
    return { error: "Invalid login." };
  }

  setSessionCookie(await cookies(), result.session);
  redirect("/");
}
