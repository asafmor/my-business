"use client";

import { useActionState } from "react";

import { login } from "./actions";

const initialState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction}>
      <label htmlFor="password">Password</label>
      <input
        autoComplete="current-password"
        id="password"
        name="password"
        required
        type="password"
      />
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button disabled={pending} type="submit">
        Sign in
      </button>
    </form>
  );
}
