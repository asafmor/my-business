import {
  Archive,
  Cloud,
  Database,
  DatabaseBackup,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import packageJson from "../../../../package.json";
import { formatBytes } from "../../../lib/format";
import {
  backupBadgeTone,
  checkDatabaseStatus,
  checkLastBackupStatus,
  checkStorageConfiguration,
  statusBadgeTone,
  type BackupRun,
} from "../../../server/settings/status";
import {
  checkFreeTierUsage,
  freeTierAllowances,
  meterPercent,
  meterTone,
  type UsageMeter,
} from "../../../server/settings/usage";
import { LocalDateTime } from "../../../components/ui/local-date-time";
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
            <h2 className="settings-card__title">תקינות המערכת</h2>
            <p className="settings-card__note">נבדק בעת טעינת העמוד.</p>
          </div>
          <RecheckButton />
        </div>
        <ul className="health-strip">
          <HealthTile
            icon={Database}
            label="מסד נתונים"
            state={database.ok ? "מחובר" : "לא זמין"}
            tone={statusBadgeTone(database.ok)}
          >
            <p>{database.ok ? "Neon Postgres" : database.detail}</p>
          </HealthTile>
          <HealthTile
            icon={Cloud}
            label="אחסון קבצים"
            state={storage.ok ? "מוגדר" : "לא מוגדר"}
            tone={statusBadgeTone(storage.ok)}
          >
            <p>{storage.ok ? "Cloudflare R2" : storage.detail}</p>
          </HealthTile>
          <HealthTile
            icon={DatabaseBackup}
            label="גיבוי מסד הנתונים"
            state={backupWord(backup.database)}
            tone={backupBadgeTone(backup.database)}
          >
            <BackupTime run={backup.database} />
          </HealthTile>
          <HealthTile
            icon={Archive}
            label="גיבוי קבצים"
            state={backupWord(backup.objects)}
            tone={backupBadgeTone(backup.objects)}
          >
            <BackupTime run={backup.objects} />
          </HealthTile>
        </ul>
      </section>

      <section className="settings-card">
        <div className="settings-card__header">
          <div>
            <h2 className="settings-card__title">מגבלות אחסון</h2>
            <p className="settings-card__note">
              האחסון בשימוש מול התוכנית החינמית של כל ספק
              {usage.ok ? (
                <>
                  {", על פני "}
                  <span className="num">{usage.objectCount}</span>
                  {" קבצים."}
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
          <summary>מגבלות נוספות של התוכניות החינמיות</summary>
          <div className="settings-details__body">
            <p className="settings-card__note">
              הנתונים העדכניים לאלה נמצאים בלוח הבקרה של כל ספק.
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
            <h2 className="settings-card__title">ניהול</h2>
            <p className="settings-card__note">
              לקטגוריות יש עמוד משלהן; ההתנתקות מכאן.
            </p>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row__text">
            <span className="settings-row__label">קטגוריות הוצאה</span>
            <p className="settings-row__note">
              הקטגוריות שבשימוש במסמכים ובדוחות.
            </p>
          </div>
          <Link
            className="button button--secondary button--small"
            href="/categories"
          >
            ניהול
          </Link>
        </div>
        <div className="settings-row">
          <div className="settings-row__text">
            <span className="settings-row__label">ההתחברות הנוכחית</span>
            <p className="settings-row__note">
              הסיסמה מוגדרת בהגדרות הסביבה; עדיין אין אפשרות לשנות אותה מכאן.
            </p>
          </div>
          <form action={logoutAction}>
            <button
              className="button button--secondary button--small"
              type="submit"
            >
              <LogOut aria-hidden size={13} strokeWidth={1.8} />
              התנתקות
            </button>
          </form>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__header">
          <div>
            <h2 className="settings-card__title">אודות</h2>
            <p className="settings-card__note">
              לקריאה בלבד — הנתונים מגיעים מהבנייה ומהסביבה.
            </p>
          </div>
        </div>
        <dl className="spec-list">
          <div className="spec-list__row">
            <dt>יישום</dt>
            <dd>{packageJson.name}</dd>
          </div>
          <div className="spec-list__row">
            <dt>גרסה</dt>
            <dd className="num">{packageJson.version}</dd>
          </div>
          <div className="spec-list__row">
            <dt>סביבה</dt>
            <dd>{process.env.APP_ENV ?? "לא ידוע"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function backupWord(run: BackupRun | null): string {
  if (!run) return "לא רץ מעולם";
  return run.stale ? "באיחור" : "אומת";
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
          {/* bdi: "13.4 MB" is a number then Latin, which the RTL line would
              otherwise flip to "MB 13.4". */}
          <bdi>{formatBytes(meter.usedBytes)}</bdi> מתוך{" "}
          <bdi>{formatBytes(meter.limitBytes)}</bdi>
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
        <span className="num">{percent}%</span> בשימוש · {meter.caveat}
      </p>
    </div>
  );
}

/* The date is the whole detail line here, so it gets the reader's own time
 * zone rather than a sentence about itself. */
function BackupTime({ run }: { run: BackupRun | null }) {
  if (!run) return <p className="settings-empty">לא נרשמה הרצה</p>;
  return (
    <p>
      <LocalDateTime value={run.ranAt} />
    </p>
  );
}
