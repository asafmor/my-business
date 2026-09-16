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
import { formatBytes, formatDateTime } from "../../../lib/format";
import {
  backupBadgeTone,
  checkDatabaseStatus,
  checkLastBackupStatus,
  checkStorageConfiguration,
  statusBadgeTone,
  type BackupStatus,
} from "../../../server/settings/status";
import {
  checkFreeTierUsage,
  freeTierAllowances,
  meterPercent,
  meterTone,
  type UsageMeter,
} from "../../../server/settings/usage";
import { requireSession } from "../../../server/auth/service";
import { logoutAction } from "../actions";
import { RecheckButton } from "./recheck-button";

export const dynamic = "force-dynamic";

/*
 * Settings is not a dashboard, so it does not use the dashboard grid. Four
 * shapes, in the order they matter: diagnostics that can be wrong, the free
 * tiers this whole app rests on, the things a person can do, then facts that
 * never change.
 */
export default async function SettingsPage() {
  await requireSession();

  const [database, storage, backup, usage] = await Promise.all([
    checkDatabaseStatus(),
    checkStorageConfiguration(),
    checkLastBackupStatus(),
    checkFreeTierUsage(),
  ]);

  return (
    <div className="settings">
      <section className="settings-card">
        <div className="settings-card__header">
          <div>
            <h2 className="settings-card__title">System health</h2>
            <p className="settings-card__note">
              Checked when this page loaded.
            </p>
          </div>
          <RecheckButton />
        </div>
        <ul className="health-strip">
          <HealthTile
            icon={Database}
            label="Database"
            state={database.ok ? "Reachable" : "Unreachable"}
            tone={statusBadgeTone(database.ok)}
          >
            <p>{database.detail}</p>
          </HealthTile>
          <HealthTile
            icon={Cloud}
            label="Primary storage"
            state={storage.ok ? "Configured" : "Not configured"}
            tone={statusBadgeTone(storage.ok)}
          >
            <p>
              {storage.ok
                ? "R2 credentials and bucket are present. This checks configuration, not a live round trip."
                : storage.detail}
            </p>
          </HealthTile>
          <HealthTile
            icon={Archive}
            label="Verified backup"
            state={backupStatusWord(backup)}
            tone={backupBadgeTone(backup)}
          >
            <BackupLine label="Database dump" run={backup.database} />
            <BackupLine label="Object storage" run={backup.objects} />
          </HealthTile>
        </ul>
      </section>

      <section className="settings-card">
        <div className="settings-card__header">
          <div>
            <h2 className="settings-card__title">Free tier headroom</h2>
            <p className="settings-card__note">
              Every provider under this app is on its free plan. These three
              caps can be measured from in here
              {usage.ok ? (
                <>
                  {" — across "}
                  <span className="num">{usage.objectCount}</span>
                  {" stored files."}
                </>
              ) : (
                "."
              )}
            </p>
          </div>
        </div>
        {usage.ok ? (
          usage.meters.map((meter) => (
            <UsageMeterRow key={meter.id} meter={meter} />
          ))
        ) : (
          <p className="settings-status__detail">{usage.detail}</p>
        )}
        <details className="settings-details">
          <summary>Caps this page does not measure</summary>
          <div className="settings-details__body">
            <p className="settings-card__note">
              Reading these live would mean handing the app another provider
              credential, which is the one thing the backup design refuses. The
              allowances are listed instead; the dashboards hold the counters.
            </p>
            {freeTierAllowances.map((allowance) => (
              <div className="allowance" key={allowance.provider}>
                <a
                  className="allowance__provider"
                  href={allowance.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  {allowance.provider}
                </a>
                <ul className="allowance__items">
                  {allowance.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
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

/*
 * One health tile: a lit glyph, the name, the one word that matters, and the
 * granular detail underneath. The colour is a second voice on top of the
 * word, never the only one carrying the state.
 */
function HealthTile({
  children,
  icon: Icon,
  label,
  state,
  tone,
}: {
  children: ReactNode;
  icon: LucideIcon;
  label: string;
  state: string;
  tone: string;
}) {
  return (
    <li className="health-tile" data-tone={tone}>
      <span className="health-tile__glyph">
        <Icon aria-hidden size={22} strokeWidth={1.6} />
      </span>
      <span className="health-tile__label">{label}</span>
      <span className="health-tile__state">{state}</span>
      <div className="health-tile__detail">{children}</div>
    </li>
  );
}

/*
 * <meter> rather than a styled div: the element already means "a measurement
 * inside a known range" to a screen reader, and the fill is the only thing
 * the CSS has to take over.
 */
function UsageMeterRow({ meter }: { meter: UsageMeter }) {
  const percent = meterPercent(meter.usedBytes, meter.limitBytes);

  return (
    <div className="usage-meter" data-tone={meterTone(percent)}>
      <div className="usage-meter__head">
        <span className="usage-meter__provider">{meter.provider}</span>
        <span className="usage-meter__figure num">
          {formatBytes(meter.usedBytes)} of {formatBytes(meter.limitBytes)}
        </span>
      </div>
      <meter
        aria-label={`${meter.provider}: ${meter.measure}`}
        className="usage-meter__bar"
        max={meter.limitBytes}
        value={meter.usedBytes}
      >
        {percent}%
      </meter>
      <p className="usage-meter__note">
        <span className="usage-meter__measure">{meter.measure}</span>
        {" · "}
        <span className="num">{percent}%</span> used. {meter.caveat}
      </p>
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
