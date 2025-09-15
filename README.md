# sigflow

A strict, synchronous reactive system with explicit state management and atomic updates. Enforces
clear boundaries between reactive domains while preventing common pitfalls through well-defined
execution modes.

```js
import { Signal } from "sigflow";

// State signals
const $items = Signal.createSource([]);
const $taxRate = Signal.createSource(0.1);
const $discountCode = Signal.createSource("");

// Derived computations
const $subtotal = Signal.createComputation(() =>
  $items.subscribe().reduce((sum, item) => sum + item.price * item.quantity, 0),
);

const $discount = Signal.createComputation(() =>
  $discountCode.subscribe() === "SAVE10" ? $subtotal.subscribe() * 0.1 : 0,
);

const $total = Signal.createComputation(() => {
  const subtotal = $subtotal.subscribe();
  const tax = subtotal * $taxRate.subscribe();

  return subtotal + tax - $discount.subscribe();
});

// Side effects
const cleanup = Signal.track(() => console.log(`Cart total: $${$total.subscribe().toFixed(2)}`));

// Usage
Signal.batch(() => {
  $items.publish([
    { name: "Coffee", price: 12.99, quantity: 2 },
    { name: "Mug", price: 8.5, quantity: 1 },
  ]);

  $discountCode.publish("SAVE10");
});

cleanup();
```

```
Cart total: $0.00
Cart total: $34.48
```

## Core Concepts

**Signals as Communication Lines**: Signals flow along isolated "lines" - independent reactive
environments that maintain separate execution state. This enables clean separation between different
reactive domains and prevents cross-contamination.

**Explicit State Management**: The system operates in distinct modes (batching, computing, tracking)
with strict rules about what operations are allowed in each. This prevents race conditions and
ensures predictable execution order.

**Deferred Updates**: All signal changes are batched and applied atomically. Updates are deferred
until batch completion, ensuring consistent state throughout the update cycle.

## API Design

- `createLine()` - isolated reactive environments
- `createSource()` - mutable signals for application state
- `createComputation()` - immutable derived signals that update automatically
- `track()` - reactive subscriptions for side effects
- `subscribe()` - read signal value and establish reactive dependency
- `batch()` - atomic update operations
- `publish()` - update mutable signal value (triggers reactive updates)
- `peek()` - read signal value without establishing reactive dependency
