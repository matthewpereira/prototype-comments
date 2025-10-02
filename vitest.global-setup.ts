export default async function globalSetup() {
  try {
    if (!Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')) {
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
    const sabProto: any = (globalThis as any).SharedArrayBuffer?.prototype;
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
}


