export interface MutableSignal<TValue> extends ImmutableSignal<TValue> {
  publish(newValue?: TValue): void;
}

export interface ImmutableSignal<TValue> {
  peek(): TValue;
  subscribe(): TValue;
}

// biome-ignore lint/suspicious/noExplicitAny: any kind of source signal
type AnySource = Source<any>;

class State {
  readonly changedSignals = new Set<AnySource>();

  batchDepth = 0;
  computationDepth = 0;
  trackedSignals: Set<AnySource> | undefined;
  isUntrackedComputation = false;

  get isBatching(): boolean {
    return this.batchDepth > 0;
  }

  get isComputing(): boolean {
    return this.computationDepth > 0;
  }

  get isTracking(): boolean {
    return this.trackedSignals !== undefined;
  }
}

export class Signal {
  static readonly defaultLine = Signal.createLine();

  private readonly state = new State();

  private constructor() {}

  static createLine(): Signal {
    return new Signal();
  }

  static createSource<TValue>(initialValue: TValue): MutableSignal<TValue> {
    return Signal.defaultLine.createSource(initialValue);
  }

  createSource<TValue>(initialValue: TValue): MutableSignal<TValue> {
    if (this.state.isBatching) {
      throw new Error("Cannot create signal while batching");
    }

    if (this.state.isComputing) {
      throw new Error("Cannot create signal while computing");
    }

    if (this.state.isTracking) {
      throw new Error("Cannot create signal while tracking");
    }

    return new Source(this.state, initialValue);
  }

  static createComputation<TValue>(callback: (this: void) => TValue): ImmutableSignal<TValue> {
    return Signal.defaultLine.createComputation(callback);
  }

  createComputation<TValue>(callback: (this: void) => TValue): ImmutableSignal<TValue> {
    if (this.state.isBatching) {
      throw new Error("Cannot create signal while batching");
    }

    if (this.state.isComputing) {
      throw new Error("Cannot create signal while computing");
    }

    if (this.state.isTracking) {
      throw new Error("Cannot create signal while tracking");
    }

    return new Computation(this.state, callback);
  }

  static batch(callback: (this: void) => void): void {
    Signal.defaultLine.batch(callback);
  }

  batch(callback: (this: void) => void): void {
    if (this.state.isComputing) {
      throw new Error("Cannot batch while computing");
    }

    if (this.state.isTracking) {
      throw new Error("Cannot batch while tracking");
    }

    this.state.batchDepth += 1;

    try {
      callback();
    } finally {
      this.state.batchDepth -= 1;
    }

    if (this.state.isBatching) {
      return;
    }

    const uniqueListeners = new Set<() => void>();

    for (const signal of this.state.changedSignals) {
      if (signal.pendingValue !== signal.currentValue) {
        signal.currentValue = signal.pendingValue;

        for (const listener of signal.listeners) {
          uniqueListeners.add(listener);
        }
      }
    }

    this.state.changedSignals.clear();

    for (const listener of uniqueListeners) {
      listener();
    }
  }

  static track(callback: (this: void) => void): () => void {
    return Signal.defaultLine.track(callback);
  }

  track(callback: (this: void) => void): () => void {
    if (this.state.isBatching) {
      throw new Error("Cannot track while batching");
    }

    if (this.state.isComputing) {
      throw new Error("Cannot track while computing");
    }

    if (this.state.isTracking) {
      throw new Error("Cannot track while tracking");
    }

    const ownTrackedSignals = new Set<AnySource>();

    const listener = () => {
      for (const signal of ownTrackedSignals) {
        signal.listeners.delete(listener);
      }

      ownTrackedSignals.clear();

      this.state.trackedSignals = ownTrackedSignals;

      try {
        callback();
      } finally {
        this.state.trackedSignals = undefined;
      }

      for (const signal of ownTrackedSignals) {
        signal.listeners.add(listener);
      }
    };

    listener();

    return () => {
      for (const signal of ownTrackedSignals) {
        signal.listeners.delete(listener);
      }
    };
  }
}

class Source<TValue> implements MutableSignal<TValue> {
  readonly state: State;
  readonly initialValue: TValue;
  readonly listeners = new Set<() => void>();

  currentValue: TValue;
  pendingValue: TValue | undefined;

  constructor(state: State, initialValue: TValue) {
    this.state = state;
    this.initialValue = initialValue;
    this.currentValue = initialValue;
  }

  publish(newValue: TValue = this.initialValue): void {
    if (!this.state.isBatching) {
      throw new Error("Can only publish while batching");
    }

    this.pendingValue = newValue;

    this.state.changedSignals.add(this);
  }

  peek(): TValue {
    if (this.state.isComputing) {
      throw new Error("Cannot peek while computing");
    }

    return this.currentValue;
  }

  subscribe(): TValue {
    if (!this.state.isTracking && !this.state.isComputing) {
      throw new Error("Can only subscribe while tracking or computing");
    }

    if (!this.state.isUntrackedComputation) {
      this.state.trackedSignals?.add(this);
    }

    return this.currentValue;
  }
}

class Computation<TValue> implements ImmutableSignal<TValue> {
  readonly state: State;
  readonly callback: (this: void) => TValue;

  constructor(state: State, callback: (this: void) => TValue) {
    this.state = state;
    this.callback = callback;
  }

  peek(): TValue {
    if (this.state.isComputing) {
      throw new Error("Cannot peek while computing");
    }

    this.state.computationDepth += 1;
    this.state.isUntrackedComputation = true;

    try {
      return this.callback();
    } finally {
      this.state.computationDepth -= 1;
      this.state.isUntrackedComputation = false;
    }
  }

  subscribe(): TValue {
    if (!this.state.isTracking && !this.state.isComputing) {
      throw new Error("Can only subscribe while tracking or computing");
    }

    this.state.computationDepth += 1;

    try {
      return this.callback();
    } finally {
      this.state.computationDepth -= 1;
    }
  }
}
