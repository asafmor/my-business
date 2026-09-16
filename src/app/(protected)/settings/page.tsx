import {
  Archive,
  Cloud,
  Database,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import packageJson from "../../../../package.json";
import { formatDateTime } from "../../../lib/format";
import {
  backupBadgeTone,
  checkDatabaseStatus,
  checkLastBackupStatus,
  checkStorageConfiguration,
  statusBadgeTone,
  type BackupStatus,
} from "../../../server/settings/status";
import { requireSession } from "../../../server/auth/service";
import { logoutAction } from "../actions";
import { RecheckButton } from "./recheck-button";

export const dynamic = "force-dynamic";

/*
 * Settings is not a dashboard, so it does not use the dashboard grid. Three
 * shapes, in the order they matter: diagnostics that can be wrong, the things
 * a person can do, then facts that never change.
 */
export default async function SettingsPage() {
  await requireSession();

  const [database, storage, backup] = await Promise.all([
    checkDatabaseStatus(),
    checkStorageConfiguration(),
    checkLastBackupStatus(),
  ]);

  return (
    <div className="settings">
      <section className="settings-card">
        <div className="settings-card__header">
          <div>
            <h2 className="settings-card__title">System status</h2>
            <p className="settings-card__note">
              Checked when this page loaded.
            </p>
          </div>
          <RecheckButton />
        </div>
        <StatusRow
          icon={Database}
          label="Database"
          tone={statusBadgeTone(database.ok)}
          value={database.ok ? "Reachable" : "Unreachable"}
        >
          <p>{database.detail}</p>
        </StatusRow>
        <StatusRow
          icon={Cloud}
          label="Primary storage"
          tone={statusBadgeTone(storage.ok)}
          value={storage.ok ? "Configured" : "Not configured"}
        >
          <p>
            {storage.ok
              ? "R2 credentials and bucket are present. This checks configuration, not a live round trip."
              : storage.detail}
          </p>
        </StatusRow>
        <StatusRow
          icon={Archive}
          label="Last verified backup"
          tone={backupBadgeTone(backup)}
          value={backupStatusWord(backup)}
        >
          <BackupLine label="Database dump" run={backup.database} />
          <BackupLine label="Object storage" run={backup.objects} />
        </StatusRow>
      </section>

      <section className="settings-card">
        <div className="settings-card__header">
          <div>
            <h2 className="settings-card__title">Manage</h2>
            <p className="settings-card__note">
              Categories live on their own page; the session ends here.
            </p>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row__text">
            <span className="settings-row__label">Expense categories</span>
            <p className="settings-row__note">
              The categories used across documents and reports.
            </p>
          </div>
          <Link
            className="button button--secondary button--small"
            href="/categories"
          >
            Manage
          </Link>
        </div>
        <div className="settings-row">
          <div className="settings-row__text">
            <span className="settings-row__label">This session</span>
            <p className="settings-row__note">
              The password is set in environment configuration; there is no
              self-service change yet.
            </p>
          </div>
          <form action={logoutAction}>
            <button
              className="button button--secondary button--small"
              type="submit"
            >
              <LogOut aria-hidden size={13} strokeWidth={1.8} />
              Log out
            </button>
          </form>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__header">
          <div>
            <h2 className="settings-card__title">About</h2>
            <p className="settings-card__note">
              Read only — these come from the build and the environment.
            </p>
          </div>
        </div>
        <dl className="spec-list">
          <div className="spec-list__row">
            <dt>Application</dt>
            <dd>{packageJson.name}</dd>
          </div>
          <div className="spec-list__row">
            <dt>Version</dt>
            <dd className="num">{packageJson.version}</dd>
          </div>
          <div className="spec-list__row">
            <dt>Environment</dt>
            <dd>{process.env.APP_ENV ?? "unknown"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function backupStatusWord(backup: BackupStatus): string {
  if (!backup.database && !backup.objects) return "Never run";
  return backup.stale ? "Stale" : "Verified";
}

function StatusRow({
  children,
  icon: Icon,
  label,
  tone,
  value,
}: {
  children: ReactNode;
  icon: LucideIcon;
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <div className="settings-status__row">
      <span className="settings-status__tile">
        <Icon aria-hidden size={15} strokeWidth={1.7} />
      </span>
      <span className="settings-status__label">{label}</span>
      <span
        className={`settings-status__badge status-badge status-badge--${tone}`}
      >
        {value}
      </span>
      <div className="settings-status__detail">{children}</div>
    </div>
  );
}

function BackupLine({
  label,
  run,
}: {
  label: string;
  run: { ranAt: Date } | null;
}) {
  return (
    <p>
      {label}{" "}
      {run ? (
        <span className="num">{formatDateTime(run.ranAt)}</span>
      ) : (
        <span className="settings-empty">—</span>
      )}
    </p>
  );
}
