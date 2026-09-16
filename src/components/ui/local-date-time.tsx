"use client";

import { useEffect, useState } from "react";

import { formatDateTimeLong } from "../../lib/format";

/**
 * A timestamp in the reader's own time zone. The server renders it in UTC (the
 * only zone it can be sure of), then the browser re-renders it locally after
 * hydration - the same text almost everywhere, and never a hydration mismatch.
 */
export function LocalDateTime({
  className,
  value,
}: {
  className?: string;
  value: Date;
}) {
  const iso = value.toISOString();
  const [local, setLocal] = useState<{ text: string; title: string } | null>(
    null,
  );

  useEffect(() => {
    const date = new Date(iso);
    setLocal({
      text: formatDateTimeLong(date),
      title: date.toLocaleString("en-GB", {
        dateStyle: "full",
        timeStyle: "long",
      }),
    });
  }, [iso]);

  return (
    <time className={className} dateTime={iso} title={local?.title}>
      {local?.text ?? formatDateTimeLong(value, "UTC")}
    </time>
  );
}
