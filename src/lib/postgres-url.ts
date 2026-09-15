/*
 * pg treats sslmode=prefer/require/verify-ca as verify-full today and warns
 * that pg 9 will weaken them to libpq semantics. Say verify-full outright: no
 * behaviour change now, no silent downgrade later. Every pg consumer that
 * builds a Pool from DATABASE_URL gets the same warning, so this lives here
 * rather than in the server-only database client.
 */
export function pinStrictSslMode(connectionString: string): string {
  return connectionString.replace(
    /([?&]sslmode=)(?:prefer|require|verify-ca)(?=&|$)/i,
    "$1verify-full",
  );
}
