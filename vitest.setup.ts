// jsdom does not implement ResizeObserver, which Base UI's floating-element
// positioning (used by DropdownMenu, AlertDialog, etc.) relies on to open.
// Without this stub, opening any Base UI popup under jsdom silently no-ops.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
