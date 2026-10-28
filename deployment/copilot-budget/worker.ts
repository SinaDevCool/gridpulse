import { DurableObject } from "cloudflare:workers";
import { BudgetLedger } from "../../src/server/operations/budget-ledger";
/** Separate, unprovisioned coordinator; no public management endpoint. */
export class CopilotBudget extends DurableObject<unknown> {
  private ledger: BudgetLedger;
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.ledger = new BudgetLedger(ctx.storage);
  }
  reserve(id: string, amount: number, limit: number) {
    return this.ledger.reserve(id, amount, limit);
  }
  settle(id: string, actual: number) {
    this.ledger.settle(id, actual);
  }
}
export default {
  fetch() {
    return new Response("Not found", { status: 404 });
  },
};
