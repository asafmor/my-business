import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LoginForm } from "../src/app/(public)/login/login-form";

describe("login page", () => {
  it("only requests a password", () => {
    const markup = renderToStaticMarkup(<LoginForm />);

    expect(markup).toContain('name="password"');
    expect(markup).not.toContain('name="username"');
  });
});
