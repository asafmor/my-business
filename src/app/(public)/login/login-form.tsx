"use client";

import { useActionState } from "react";

import { login } from "./actions";

const initialState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="auth-form">
      <label htmlFor="password">סיסמה</label>
      <input
        autoComplete="current-password"
        id="password"
        name="password"
        required
        type="password"
      />
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button
        className="button button--primary"
        disabled={pending}
        type="submit"
      >
        התחברות
      </button>
    </form>
  );
}
