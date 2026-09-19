export function advanceSpawnTime(nextAt: number, now: number, interval: number): number {
  if (interval <= 0) {
    throw new Error(`spawn interval must be positive: ${interval}`);
  }

  const next = nextAt + interval;
  return next < now - interval * 2 ? now + interval : next;
}
