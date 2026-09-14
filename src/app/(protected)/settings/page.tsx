import Link from "next/link";

import packageJson from "../../../../package.json";
import {
  checkDatabaseStatus,
  checkStorageConfiguration,
  statusBadgeTone,
} from "../../../server/settings/status";
import { requireSession } from "../../../server/auth/service";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSession();

  const [database, storage] = await Promise.all([
    checkDatabaseStatus(),
    checkStorageConfiguration(),
  ]);
  const environment = process.env.APP_ENV ?? "unknown";

  return (
    <div className="page">
      <header className="page-heading">
        <h1>Settings</h1>
        <p>Application information, system status, and account controls.</p>
      </header>

      <section className="dashboard-section">
        <h2>General</h2>
        <ul className="data-list">
          <li className="data-list__item">
            <div className="data-list__item-header">
              <span>Application</span>
              <span>{packageJson.name}</span>
            </div>
          </li>
          <li className="data-list__item">
            <div className="data-list__item-header">
              <span>Version</span>
              <span>{packageJson.version}</span>
            </div>
          </li>
          <li className="data-list__item">
            <div className="data-list__item-header">
              <span>Environment</span>
              <span>{environment}</span>
            </div>
          </li>
        </ul>
        <p className="content-state">
          More configuration options will appear here as the app grows.
        </p>
      </section>

      <section className="dashboard-section">
        <h2>System status</h2>
        <ul className="data-list">
          <li className="data-list__item">
            <div className="data-list__item-header">
              <span>Database</span>
              <span
                className={`status-badge status-badge--${statusBadgeTone(database.ok)}`}
              >
                {database.ok ? "Reachable" : "Unreachable"}
              </span>
            </div>
            <div className="data-list__item-meta">{database.detail}</div>
          </li>
          <li className="data-list__item">
            <div className="data-list__item-header">
              <span>Primary storage (R2)</span>
              <span
                className={`status-badge status-badge--${statusBadgeTone(storage.ok)}`}
              >
                {storage.ok ? "Configured" : "Not configured"}
              </span>
            </div>
            <div className="data-list__item-meta">{storage.detail}</div>
          </li>
          <li className="data-list__item">
            <div className="data-list__item-header">
              <span>Last successful backup</span>
              <span className="status-badge status-badge--neutral">
                Not available
              </span>
            </div>
            <div className="data-list__item-meta">
              Backup system not yet implemented.
            </div>
          </li>
        </ul>
      </section>

      <section className="dashboard-section">
        <h2>Categories</h2>
        <p>
          Manage the expense categories used across documents and reports.
        </p>
        <Link className="button button--secondary" href="/categories">
          Manage categories
        </Link>
      </section>

      <section className="dashboard-section">
        <h2>Security</h2>
        <form action={logoutAction}>
          <button className="button button--secondary" type="submit">
            Log out
          </button>
        </form>
        <p className="content-state">
          Password changes are managed via environment configuration; a
          self-service flow is planned for a future release.
        </p>
      </section>
    </div>
  );
}
