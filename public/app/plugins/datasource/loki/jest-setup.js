import '@grafana/plugin-configs/jest/jest-setup';

// Polyfills for MSW (used by setTestFlags in querySplitting.test.ts)
import 'whatwg-fetch';

const globalObj = typeof globalThis !== 'undefined' ? globalThis : global;
if (typeof globalObj.BroadcastChannel === 'undefined') {
  globalObj.BroadcastChannel = class BroadcastChannel {
    constructor() {}
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return true;
    }
  };
}
