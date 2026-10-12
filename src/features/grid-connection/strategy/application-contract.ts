export type CommandOutcome<T = undefined> = { ok: true; value: T } | { ok: false; message: string };

export async function runCommand<T>(operation: () => Promise<T>): Promise<CommandOutcome<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The command failed." };
  }
}
