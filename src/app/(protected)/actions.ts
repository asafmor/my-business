"use server";

import { redirect } from "next/navigation";

import { logout } from "../../server/auth/service";

export async function logoutAction(): Promise<never> {
  await logout();
  redirect("/login");
}
