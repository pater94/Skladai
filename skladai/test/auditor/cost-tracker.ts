/**
 * Cost tracker dla auditora — hard cap $20/mc poprzez $0.70/dzień.
 *
 * `wouldExceed()` zwraca true gdy zostało <10% budgetu (safety margin
 * przed kolejnym API call który mógłby przebić cap).
 */

export class CostTracker {
  totalCost = 0;

  constructor(private dailyBudgetUsd: number) {}

  add(usdAmount: number): void {
    this.totalCost += usdAmount;
  }

  wouldExceed(): boolean {
    return this.totalCost >= this.dailyBudgetUsd * 0.9;
  }

  remaining(): number {
    return Math.max(0, this.dailyBudgetUsd - this.totalCost);
  }

  summary(): string {
    return `$${this.totalCost.toFixed(3)} / $${this.dailyBudgetUsd.toFixed(2)}`;
  }
}
