type LoginRateLimit = {
  admit(clientId: string, now?: number): boolean;
  reset(clientId: string): void;
};

type LoginRateLimitOptions = {
  lockoutMilliseconds?: number;
  maximumAttempts?: number;
  maximumClients?: number;
  windowMilliseconds?: number;
};

type LoginAttempt = {
  admissions: number[];
  lockedUntil: number;
};

const defaultOptions = {
  lockoutMilliseconds: 15 * 60 * 1_000,
  maximumAttempts: 5,
  maximumClients: 10_000,
  windowMilliseconds: 10 * 60 * 1_000,
} as const;

export function createLoginRateLimit(
  options: LoginRateLimitOptions = {},
): LoginRateLimit {
  const configuration = { ...defaultOptions, ...options };
  const attempts = new Map<string, LoginAttempt>();

  function prune(now: number): void {
    for (const [clientId, attempt] of attempts) {
      attempt.admissions = attempt.admissions.filter(
        (admission) => admission > now - configuration.windowMilliseconds,
      );
      if (attempt.admissions.length === 0 && attempt.lockedUntil <= now) {
        attempts.delete(clientId);
      }
    }

    while (attempts.size >= configuration.maximumClients) {
      const oldestClientId = attempts.keys().next().value;
      if (!oldestClientId) {
        break;
      }
      attempts.delete(oldestClientId);
    }
  }

  return {
    admit(clientId, now = Date.now()) {
      prune(now);
      const attempt = attempts.get(clientId) ?? {
        admissions: [],
        lockedUntil: 0,
      };

      if (attempt.lockedUntil > now) {
        return false;
      }

      if (attempt.lockedUntil !== 0) {
        attempt.admissions = [];
        attempt.lockedUntil = 0;
      }

      attempt.admissions.push(now);

      if (attempt.admissions.length >= configuration.maximumAttempts) {
        attempt.lockedUntil = now + configuration.lockoutMilliseconds;
      }

      attempts.set(clientId, attempt);
      return true;
    },
    reset(clientId) {
      attempts.delete(clientId);
    },
  };
}

export const loginRateLimit = createLoginRateLimit();
