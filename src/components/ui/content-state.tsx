import type { ReactNode } from "react";

type ContentStateProps = {
  action?: ReactNode;
  description: string;
  title: string;
  tone?: "empty" | "error" | "loading";
};

export function ContentState({
  action,
  description,
  title,
  tone = "empty",
}: ContentStateProps) {
  const statusProps: {
    "aria-live"?: "polite";
    role?: "alert" | "status";
  } =
    tone === "error"
      ? { role: "alert" }
      : tone === "loading"
        ? { "aria-live": "polite", role: "status" }
        : {};

  return (
    <section
      className={`content-state content-state--${tone}`}
      {...statusProps}
    >
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action ? <div className="content-state__action">{action}</div> : null}
    </section>
  );
}
