import "server-only";

import bcrypt from "bcryptjs";

const maximumPasswordBytes = 72;

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (
    password.length === 0 ||
    new TextEncoder().encode(password).length > maximumPasswordBytes
  ) {
    return false;
  }

  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}
