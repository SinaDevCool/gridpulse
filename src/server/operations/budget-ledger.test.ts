import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { BudgetLedger, budgetFor, type SqlStorage } from "./budget-ledger";
function store() {
  const db = new DatabaseSync(":memory:");
  return {
    db,
    storage: {
      sql: {
        exec: (sql: string, ...args: (string | number)[]) => {
          const rows = db.prepare(sql).all(...args);
          return { toArray: () => rows };
        },
      },
      transactionSync: <T>(fn: () => T) => {
        db.exec("BEGIN");
        try {
          const result = fn();
          db.exec("COMMIT");
          return result;
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      },
    } as SqlStorage,
  };
}
describe("persistent AI admission ledger", () => {
  it("serializes competing reservations, rejects duplicates and retains unknown cost", () => {
    const { db, storage } = store();
    try {
      const ledger = new BudgetLedger(storage);
      expect(ledger.reserve("a", 60, 100)).toBe(true);
      expect(ledger.reserve("b", 60, 100)).toBe(false);
      expect(ledger.reserve("a", 1, 100)).toBe(false);
      const reloaded = new BudgetLedger(storage);
      expect(reloaded.reserve("c", 41, 100)).toBe(false);
      reloaded.settle("a", 20);
      expect(reloaded.reserve("c", 80, 100)).toBe(true);
      expect(reloaded.reserve("d", 1, 100)).toBe(false);
    } finally {
      db.close();
    }
  });
  it("never erases a known overrun or accepts invalid arithmetic", () => {
    const { db, storage } = store();
    try {
      const ledger = new BudgetLedger(storage);
      ledger.reserve("a", 20, 100);
      ledger.settle("a", 120);
      ledger.settle("a", 0);
      expect(ledger.reserve("b", 1, 100)).toBe(false);
      expect(() => ledger.reserve("bad", NaN, 100)).toThrow();
    } finally {
      db.close();
    }
  });
  it("fails closed when a required shared binding is absent", () => {
    expect(() => budgetFor({ COPILOT_BUDGET_REQUIRED: "true" })).toThrow();
    expect(budgetFor({})).toBeUndefined();
  });
});
