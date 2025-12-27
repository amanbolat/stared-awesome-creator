export function createLimiter(limit: number): <T>(fn: () => Promise<T>) => Promise<T> {
  if (limit <= 0) {
    throw new Error("Concurrency limit must be greater than zero");
  }

  let active = 0;
  const queue: Array<() => void> = [];

  const next = (): void => {
    if (queue.length === 0 || active >= limit) {
      return;
    }
    active += 1;
    const run = queue.shift();
    if (run) {
      run();
    }
  };

  return async function limitFn<T>(fn: () => Promise<T>): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      const task = () => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            next();
          });
      };

      queue.push(task);
      next();
    });
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
