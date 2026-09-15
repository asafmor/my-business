import { formatMoney } from "../../lib/format";

/*
 * One hue, one series. Share is carried by bar length; the mono figure beside
 * it carries the exact value. A second series would need a second hue, and the
 * palette has no second hue that survives deuteranopia — so it gets its own
 * chart instead.
 */
export function ProportionBars({
  empty,
  rows,
}: {
  empty: string;
  rows: { label: string; value: string }[];
}) {
  if (rows.length === 0) {
    return <p className="content-state">{empty}</p>;
  }

  const largest = Math.max(...rows.map((row) => Number(row.value) || 0), 1);

  return (
    <ul className="category-bars">
      {rows.map((row) => (
        <li className="category-bar" key={row.label}>
          <span className="category-bar__label">{row.label}</span>
          <span className="category-bar__track">
            <span
              className="category-bar__fill"
              style={{
                width: `${Math.max(((Number(row.value) || 0) / largest) * 100, 2)}%`,
              }}
            />
          </span>
          <span className="category-bar__value num">
            {formatMoney(row.value, null)}
          </span>
        </li>
      ))}
    </ul>
  );
}
