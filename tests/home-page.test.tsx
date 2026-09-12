import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "../src/app/(public)/page";

describe("public home page", () => {
  it("identifies the application and its purpose", () => {
    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain("<h1>My Business</h1>");
    expect(markup).toContain("Private document and expense management.");
  });
});
