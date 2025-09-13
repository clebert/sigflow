import { Signal } from "./src/signal.js";

// State signals
const $items = Signal.createSource(
  /** @type {{ name: string; price: number; quantity: number; }[]} */ ([]),
);

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
