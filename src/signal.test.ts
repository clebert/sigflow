import { deepEqual, equal, throws } from "node:assert/strict";
import { describe, test } from "node:test";
import { Signal } from "./signal.js";

describe("Signal", () => {
  test("creates source signal with initial value", () => {
    const a = Signal.createSource(5);

    equal(a.peek(), 5);
  });

  test("executes track() callback immediately", () => {
    let executed = false;

    Signal.track(() => {
      executed = true;
    });

    equal(executed, true);
  });

  test("re-executes track() callback when source signal changes", () => {
    const a = Signal.createSource(5);
    const results: number[] = [];

    Signal.track(() => results.push(a.subscribe()));
    deepEqual(results, [5]);
    Signal.batch(() => a.publish(10));
    deepEqual(results, [5, 10]);
  });

  test("defers signal value changes until batch completion", () => {
    const a = Signal.createSource(5);

    Signal.batch(() => {
      a.publish(10);
      equal(a.peek(), 5);
    });

    equal(a.peek(), 10);
  });

  test("creates computation signal with computed value", () => {
    const a = Signal.createSource(5);
    const b = Signal.createComputation(() => a.subscribe() * 10);

    equal(b.peek(), 50);
    Signal.batch(() => a.publish(10));
    equal(b.peek(), 100);
  });

  test("re-executes track() callback when computation signal changes", () => {
    const a = Signal.createSource(5);
    const b = Signal.createComputation(() => a.subscribe() * 10);
    const results: number[] = [];

    Signal.track(() => results.push(b.subscribe()));
    deepEqual(results, [50]);
    Signal.batch(() => a.publish(10));
    deepEqual(results, [50, 100]);
  });

  test("re-executes track() callback when any dependency changes", () => {
    const a = Signal.createSource(5);
    const b = Signal.createSource(10);
    const results: number[] = [];

    Signal.track(() => results.push(a.subscribe() + b.subscribe()));
    deepEqual(results, [15]);
    Signal.batch(() => a.publish(10));
    deepEqual(results, [15, 20]);
    Signal.batch(() => b.publish(20));
    deepEqual(results, [15, 20, 30]);
  });

  test("re-executes multiple track() callbacks when source signal changes", () => {
    const a = Signal.createSource(5);
    const results1: number[] = [];
    const results2: number[] = [];

    Signal.track(() => results1.push(a.subscribe() * 2));
    Signal.track(() => results2.push(a.subscribe() * 3));
    deepEqual(results1, [10]);
    deepEqual(results2, [15]);
    Signal.batch(() => a.publish(10));
    deepEqual(results1, [10, 20]);
    deepEqual(results2, [15, 30]);
  });

  test("allows nested batch calls", () => {
    const a = Signal.createSource(5);
    const b = Signal.createSource(10);

    Signal.batch(() => {
      a.publish(10);
      Signal.batch(() => b.publish(20));
    });

    equal(a.peek(), 10);
    equal(b.peek(), 20);
  });

  test("defers signal value changes until outermost batch completion", () => {
    const a = Signal.createSource(5);
    const b = Signal.createSource(10);

    Signal.batch(() => {
      a.publish(10);
      Signal.batch(() => b.publish(20));
      equal(a.peek(), 5);
      equal(b.peek(), 10);
    });

    equal(a.peek(), 10);
    equal(b.peek(), 20);
  });

  test("ignores changes to non-dependency signals", () => {
    const a = Signal.createSource(5);
    const b = Signal.createSource(10);
    const results: number[] = [];

    Signal.track(() => results.push(a.subscribe()));
    deepEqual(results, [5]);
    Signal.batch(() => b.publish(20));
    deepEqual(results, [5]);
  });

  test("ignores multiple subscriptions to same signal in track() callback", () => {
    const a = Signal.createSource(5);
    const results: number[] = [];

    Signal.track(() => results.push(a.subscribe() + a.subscribe()));
    deepEqual(results, [10]);
    Signal.batch(() => a.publish(10));
    deepEqual(results, [10, 20]);
  });

  test("ignores peeked values in track() callback", () => {
    const a = Signal.createSource(5);
    const b = Signal.createSource(10);
    const results: number[] = [];

    Signal.track(() => results.push(a.subscribe() + b.peek()));
    deepEqual(results, [15]);
    Signal.batch(() => b.publish(20));
    deepEqual(results, [15]);
    Signal.batch(() => a.publish(10));
    deepEqual(results, [15, 30]);
  });

  test("stops re-executing track() callback after cleanup", () => {
    const a = Signal.createSource(5);
    const results: number[] = [];
    const cleanup = Signal.track(() => results.push(a.subscribe()));

    deepEqual(results, [5]);
    Signal.batch(() => a.publish(10));
    deepEqual(results, [5, 10]);
    cleanup();
    Signal.batch(() => a.publish(20));
    deepEqual(results, [5, 10]);
  });

  test("ignores publish() when source signal value unchanged", () => {
    const a = Signal.createSource(5);
    const results: number[] = [];

    Signal.track(() => results.push(a.subscribe()));
    deepEqual(results, [5]);

    Signal.batch(() => {
      a.publish(10);
      a.publish(5);
    });

    deepEqual(results, [5]);
  });

  test("resets source signal to initial value when publish() called without argument", () => {
    const a = Signal.createSource(5);
    const results: number[] = [];

    Signal.track(() => results.push(a.subscribe()));
    deepEqual(results, [5]);
    Signal.batch(() => a.publish(10));
    deepEqual(results, [5, 10]);
    Signal.batch(() => a.publish());
    deepEqual(results, [5, 10, 5]);
  });

  test("ignores publish() without argument that would not change value", () => {
    const a = Signal.createSource(5);
    const results: number[] = [];

    Signal.track(() => results.push(a.subscribe()));
    deepEqual(results, [5]);

    Signal.batch(() => {
      a.publish(10);
      a.publish();
    });

    deepEqual(results, [5]);
  });

  test("chains multiple computation signals", () => {
    const a = Signal.createSource(5);
    const b = Signal.createComputation(() => a.subscribe() * 10);
    const c = Signal.createComputation(() => b.subscribe() * 10);
    const results: number[] = [];

    Signal.track(() => results.push(c.subscribe()));
    deepEqual(results, [500]);
    Signal.batch(() => a.publish(10));
    deepEqual(results, [500, 1000]);
  });

  test("updates track() callback dependencies based on conditional logic", () => {
    const condition = Signal.createSource(true);
    const a = Signal.createSource(5);
    const b = Signal.createSource(10);
    const results: number[] = [];

    Signal.track(() => {
      if (condition.subscribe()) {
        results.push(a.subscribe());
      } else {
        results.push(b.subscribe());
      }
    });

    deepEqual(results, [5]);
    Signal.batch(() => b.publish(20));
    deepEqual(results, [5]);
    Signal.batch(() => condition.publish(false));
    deepEqual(results, [5, 20]);
    Signal.batch(() => a.publish(10));
    deepEqual(results, [5, 20]);
  });

  test("propagates errors from track() callback", () => {
    throws(() => {
      Signal.track(() => {
        throw new Error("Callback error");
      });
    }, /Callback error/);
  });

  test("propagates errors from batch() callback", () => {
    throws(() => {
      Signal.batch(() => {
        throw new Error("Callback error");
      });
    }, /Callback error/);
  });

  test("propagates errors from computation() callback on peek", () => {
    const a = Signal.createComputation(() => {
      throw new Error("Callback error");
    });

    throws(() => a.peek(), /Callback error/);
  });

  test("propagates errors from computation() callback on subscribe", () => {
    const a = Signal.createComputation(() => {
      throw new Error("Callback error");
    });

    throws(() => {
      Signal.track(() => a.subscribe());
    }, /Callback error/);
  });

  test("throws when creating source signal while batching", () => {
    throws(() => Signal.batch(() => Signal.createSource(5)), /Cannot create signal while batching/);
  });

  test("throws when creating source signal while computing", () => {
    const a = Signal.createComputation(() => Signal.createSource(5));

    throws(() => a.peek(), /Cannot create signal while computing/);
  });

  test("throws when creating source signal while tracking", () => {
    throws(() => Signal.track(() => Signal.createSource(5)), /Cannot create signal while tracking/);
  });

  test("throws when creating computation signal while batching", () => {
    const a = Signal.createSource(5);

    throws(
      () => Signal.batch(() => Signal.createComputation(() => a.subscribe() * 10)),
      /Cannot create signal while batching/,
    );
  });

  test("throws when creating computation signal while computing", () => {
    const a = Signal.createSource(5);
    const b = Signal.createComputation(() => Signal.createComputation(() => a.subscribe() * 10));

    throws(() => b.peek(), /Cannot create signal while computing/);
  });

  test("throws when creating computation signal while tracking", () => {
    const a = Signal.createSource(5);

    throws(
      () => Signal.track(() => Signal.createComputation(() => a.subscribe() * 10)),
      /Cannot create signal while tracking/,
    );
  });

  test("throws when calling track() while batching", () => {
    throws(() => Signal.batch(() => Signal.track(() => void 0)), /Cannot track while batching/);
  });

  test("throws when calling track() while computing", () => {
    const a = Signal.createComputation(() => Signal.track(() => void 0));

    throws(() => a.peek(), /Cannot track while computing/);
  });

  test("throws when calling track() while tracking", () => {
    throws(() => Signal.track(() => Signal.track(() => void 0)), /Cannot track while tracking/);
  });

  test("throws when calling batch() while computing", () => {
    const a = Signal.createComputation(() => Signal.batch(() => void 0));

    throws(() => a.peek(), /Cannot batch while computing/);
  });

  test("throws when calling batch() while tracking", () => {
    throws(() => Signal.track(() => Signal.batch(() => void 0)), /Cannot batch while tracking/);
  });

  test("throws when calling source signal publish() while not batching", () => {
    const a = Signal.createSource(5);

    throws(() => a.publish(10), /Can only publish while batching/);
  });

  test("throws when calling source signal publish() while computing", () => {
    const a = Signal.createSource(5);
    const b = Signal.createComputation(() => a.publish(10));

    throws(() => b.peek(), /Can only publish while batching/);
  });

  test("throws when calling source signal publish() while tracking", () => {
    const a = Signal.createSource(5);

    throws(() => Signal.track(() => a.publish(10)), /Can only publish while batching/);
  });

  test("throws when calling source signal peek() while computing", () => {
    const a = Signal.createSource(5);
    const b = Signal.createComputation(() => a.peek());

    throws(() => b.peek(), /Cannot peek while computing/);
  });

  test("throws when calling computation signal peek() while computing", () => {
    const a = Signal.createSource(5);
    const b = Signal.createComputation(() => a.subscribe() * 10);
    const c = Signal.createComputation(() => b.peek() * 10);

    throws(() => c.peek(), /Cannot peek while computing/);
  });

  test("throws when calling source signal subscribe() while not tracking or computing", () => {
    const a = Signal.createSource(5);

    throws(() => a.subscribe(), /Can only subscribe while tracking or computing/);
  });

  test("throws when calling source signal subscribe() while batching", () => {
    const a = Signal.createSource(5);

    throws(
      () => Signal.batch(() => a.subscribe()),
      /Can only subscribe while tracking or computing/,
    );
  });

  test("throws when calling computation signal subscribe() while not tracking or computing", () => {
    const a = Signal.createSource(5);
    const b = Signal.createComputation(() => a.peek() * 10);

    throws(() => b.subscribe(), /Can only subscribe while tracking or computing/);
  });

  test("isolates computation state across different lines", () => {
    const line1 = Signal.createLine();
    const line2 = Signal.createLine();
    const a1 = line1.createSource(10);
    const a2 = line2.createSource(20);
    const b1 = line1.createComputation(() => a1.subscribe() + a2.peek());

    equal(b1.peek(), 30);

    const c1 = line1.createComputation(() => a1.peek());

    throws(() => c1.peek(), /Cannot peek while computing/);
  });
});
