// Polyfill properties expected by webidl-conversions/jsdom in some Node versions/environments
(() => {
  try {
    const abDesc = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable');
    if (!abDesc) {
      Object.defineProperty(ArrayBuffer.prototype, 'resizable', {
        configurable: true,
        enumerable: false,
        get() {
          return false;
        }
      });
    }
  } catch {}

  try {
    // SharedArrayBuffer may be undefined in some environments
    // Only define growable if prototype exists and property descriptor is missing
    // eslint-disable-next-line no-undef
    const sabProto = (globalThis as any).SharedArrayBuffer?.prototype;
    if (sabProto && !Object.getOwnPropertyDescriptor(sabProto, 'growable')) {
      Object.defineProperty(sabProto, 'growable', {
        configurable: true,
        enumerable: false,
        get() {
          return false;
        }
      });
    }
  } catch {}
})();


