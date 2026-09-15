import Link from "next/link";

import packageJson from "../../../../package.json";
import {
  checkDatabaseStatus,
  checkLastBackupStatus,
  checkStorageConfiguration,
  statusBadgeTone,
} from "../../../server/settings/status";
import { requireSession } from "../../../server/auth/service";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSession();

  const [database, storage, backup] = await Promise.all([
    checkDatabaseStatus(),
    checkStorageConfiguration(),
    checkLastBackupStatus(),
  ]);
  const environment = process.env.APP_ENV ?? "unknown";
  const lastBackupAt = [backup.database?.ranAt, backup.objects?.ranAt]
    .filter((d): d is Date => d != null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const backupOk = lastBackupAt !== undefined && !backup.stale;

  return (
    <div className="page">
      <header className="page-heading">
        <h1>Settings</h1>
        <p>Application information, system status, and account controls.</p>
      </header>

      <div className="dashboard-grid">
        {/* Status first: it is the only thing on this page that can be wrong. */}
        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>System status</h2>
          </div>
          <ul className="data-list">
            <StatusRow
              detail={database.detail}
              label="Database"
              tone={statusBadgeTone(database.ok)}
              value={database.ok ? "Reachable" : "Unreachable"}
            />
            <StatusRow
              detail={storage.detail}
              label="Primary storage (R2)"
              tone={statusBadgeTone(storage.ok)}
              value={storage.ok ? "Configured" : "Not configured"}
            />
            <StatusRow
              detail={
                lastBackupAt
                  ? `Database: ${backup.database ? backup.database.ranAt.toLocaleString() : "none recorded"} · Objects: ${backup.objects ? backup.objects.ranAt.toLocaleString() : "none recorded"}${backup.stale ? " (stale)" : ""}`
                  : "No verified backup recorded yet."
              }
              label="Last successful backup"
              tone={lastBackupAt ? statusBadgeTone(backupOk) : "neutral"}
              value={
                lastBackupAt
                  ? lastBackupAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "Not available"
              }
            />
          </ul>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>General</h2>
            <span className="dashboard-section__note">read only</span>
          </div>
          <dl className="spec-list">
            <SpecRow label="Application" value={packageJson.name} />
            <SpecRow label="Version" value={packageJson.version} />
            <SpecRow label="Environment" value={environment} />
          </dl>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>Categories</h2>
          </div>
          <div className="dashboard-section__body">
            <p className="dashboard-section__prose">
              The expense categories used across documents and reports.
            </p>
            <Link className="button button--secondary" href="/categories">
              Manage categories
            </Link>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>Security</h2>
          </div>
          <div className="dashboard-section__body">
            <p className="dashboard-section__prose">
              Password changes are managed via environment configuration; a
              self-service flow is planned for a future release.
            </p>
            <form action={logoutAction}>
              <button className="button button--secondary" type="submit">
                Log out
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusRow({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <li className="data-list__item">
      <div className="data-list__item-header">
        <span className="data-list__item-title">{label}</span>
        <span className={`status-badge status-badge--${tone}`}>{value}</span>
      </div>
      <div className="data-list__item-meta">{detail}</div>
    </li>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="spec-list__row">
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
