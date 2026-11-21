/** A push-then-iterate queue: producers `push`, one consumer reads with `for await`. `close` ends the loop. */
export interface AsyncQueue<T> extends AsyncIterable<T> {
  push(item: T): void;
  close(): void;
}

export const createAsyncQueue = <T>(): AsyncQueue<T> => {
  const items: T[] = [];
  const waiting: ((r: IteratorResult<T>) => void)[] = [];
  let closed = false;

  return {
    push(item) {
      if (closed) return;
      const w = waiting.shift();

      if (w) w({ value: item, done: false });
      else items.push(item);
    },
    close() {
      closed = true;

      for (const w of waiting.splice(0)) w({ value: undefined, done: true });
    },
    [Symbol.asyncIterator]: () => ({
      next: () => {
        const item = items.shift();

        if (item !== undefined) return Promise.resolve({ value: item, done: false });

        if (closed) return Promise.resolve({ value: undefined, done: true });

        return new Promise((resolve) => waiting.push(resolve));
      },
    }),
  };
};
