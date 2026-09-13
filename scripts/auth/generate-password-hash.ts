import bcrypt from "bcryptjs";

function promptForPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    return Promise.reject(
      new Error("Run this command in an interactive terminal."),
    );
  }

  return new Promise((resolve, reject) => {
    let password = "";
    process.stdout.write("Password: ");
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
    };
    const onData = (chunk: Buffer) => {
      const value = chunk.toString("utf8");
      if (value === "\u0003") {
        cleanup();
        reject(new Error("Password hashing cancelled."));
      } else if (value === "\r" || value === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(password);
      } else if (value === "\u007f") {
        password = password.slice(0, -1);
      } else {
        password += value;
      }
    };

    process.stdin.on("data", onData);
  });
}

const password = await promptForPassword();
if (new TextEncoder().encode(password).length < 16) {
  throw new Error("Use a password with at least 16 bytes.");
}
if (new TextEncoder().encode(password).length > 72) {
  throw new Error("bcrypt accepts passwords up to 72 bytes.");
}

console.log(await bcrypt.hash(password, 12));
