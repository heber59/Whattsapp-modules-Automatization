export class FixtureCleanup {
  private readonly callbacks: (() => void | Promise<void>)[] = [];

  add(callback: () => void | Promise<void>): void {
    this.callbacks.push(callback);
  }

  async close(): Promise<void> {
    const failures: unknown[] = [];
    for (const callback of this.callbacks.splice(0).reverse()) {
      try { await callback(); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, 'Fixture cleanup failed');
  }

  async failed(error: unknown): Promise<never> {
    try { await this.close(); } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Fixture initialization and cleanup failed');
    }
    throw error;
  }
}
