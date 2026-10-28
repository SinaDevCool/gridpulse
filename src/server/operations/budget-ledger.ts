/** Integer micro-USD reservations. One persistent coordinator per billing team/window. */
export interface SqlStorage {
  sql: {
    exec(
      query: string,
      ...values: (string | number)[]
    ): { toArray(): Record<string, unknown>[] };
  };
  transactionSync<T>(fn: () => T): T;
}
export class BudgetLedger {
  constructor(private storage: SqlStorage) {
    storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, amount INTEGER NOT NULL, settled INTEGER NOT NULL DEFAULT 0)",
    );
  }
  reserve(id: string, amount: number, limit: number) {
    if (
      !/^[a-zA-Z0-9:_-]{1,160}$/.test(id) ||
      ![amount, limit].every((v) => Number.isSafeInteger(v) && v > 0)
    )
      throw new Error("Invalid budget reservation");
    return this.storage.transactionSync(() => {
      if (
        this.storage.sql
          .exec("SELECT id FROM reservations WHERE id=?", id)
          .toArray().length
      )
        return false;
      const total = this.storage.sql
        .exec("SELECT COALESCE(SUM(amount),0) AS total FROM reservations")
        .toArray()[0].total;
      if (typeof total !== "number" || total + amount > limit) return false;
      this.storage.sql.exec(
        "INSERT INTO reservations (id,amount) VALUES (?,?)",
        id,
        amount,
      );
      return true;
    });
  }
  settle(id: string, actual: number) {
    if (!Number.isSafeInteger(actual) || actual < 0)
      throw new Error("Invalid actual cost");
    return this.storage.transactionSync(() => {
      const row = this.storage.sql
        .exec("SELECT amount,settled FROM reservations WHERE id=?", id)
        .toArray()[0];
      if (!row) throw new Error("Unknown reservation");
      if (row.settled) return;
      // Unknown calls retain their full reservation; known overruns remain charged.
      this.storage.sql.exec(
        "UPDATE reservations SET amount=?,settled=1 WHERE id=?",
        actual,
        id,
      );
    });
  }
}
export type PaidStageBudget = {
  reserve: (id: string, amount: number) => Promise<boolean>;
  settle: (id: string, actual: number) => Promise<void>;
};
export type BudgetNamespace = {
  getByName: (name: string) => {
    reserve: (id: string, amount: number, limit: number) => Promise<boolean>;
    settle: (id: string, actual: number) => Promise<void>;
  };
};
export type BudgetConfig = {
  COPILOT_BUDGET_REQUIRED?: string;
  COPILOT_BUDGET?: BudgetNamespace;
  COPILOT_BUDGET_TEAM?: string;
  COPILOT_BUDGET_MICRO_USD?: string;
};
export function budgetFor(
  config: BudgetConfig,
  now = new Date(),
): PaidStageBudget | undefined {
  if (config.COPILOT_BUDGET_REQUIRED !== "true") return undefined;
  const limit = Number(config.COPILOT_BUDGET_MICRO_USD);
  if (
    !config.COPILOT_BUDGET ||
    !config.COPILOT_BUDGET_TEAM ||
    !Number.isSafeInteger(limit) ||
    limit <= 0
  )
    throw new Error("Shared AI budget is not configured");
  const stub = config.COPILOT_BUDGET.getByName(
    `${config.COPILOT_BUDGET_TEAM}:${now.toISOString().slice(0, 7)}`,
  );
  return {
    reserve: (id, amount) => stub.reserve(id, amount, limit),
    settle: (id, actual) => stub.settle(id, actual),
  };
}
