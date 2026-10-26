import { createRequestRecon } from '../background/controller.js';

export function event() {
  const listeners = new Set();
  return { listeners, addListener: (f) => listeners.add(f), removeListener: (f) => listeners.delete(f), emit: (...args) => [...listeners].map((f) => f(...args)) };
}

export function fixture(initialRules = [], options = {}) {
  let stored = structuredClone(initialRules);
  const commands = [];
  const messages = [];
  const timers = new Map();
  let nextTimer = 0;
  const changed = event();
  const chrome = {
    runtime: { id: 'request-recon-test', onConnect: event(), onMessage: event() },
    storage: { onChanged: changed, local: {
      async get(key) {
        if (options.getError) throw new Error('storage unavailable');
        return key === 'language' ? { language: 'en' } : { rules: structuredClone(stored) };
      },
      async set({ rules }) {
        if (options.setError) throw new Error('storage quota exceeded');
        if (options.beforeSet) await options.beforeSet(rules);
        stored = structuredClone(rules);
        changed.emit({ rules: { newValue: structuredClone(stored) } }, 'local');
      },
    } },
    i18n: { getUILanguage: () => 'en' },
    debugger: {
      onEvent: event(), onDetach: event(),
      async attach(target) { commands.push({ method: 'attach', target }); },
      async detach(target) {
        commands.push({ method: 'detach', target });
        if (options.detachError) throw new Error('detach failed');
        chrome.debugger.onDetach.emit(target);
      },
      async sendCommand(target, method, params) {
        commands.push({ target, method, params });
        if (options.rejectCommand === method) throw new Error('command failed');
        if (options.onCommand) await options.onCommand(method, params);
        if (method === 'Network.getResponseBody') return options.body || { body: '{"ok":true}', base64Encoded: false };
        return {};
      },
    },
  };
  const clock = { setTimeout: (f) => { timers.set(++nextTimer, f); return nextTimer; }, clearTimeout: (id) => timers.delete(id) };
  const controller = createRequestRecon(chrome, clock);
  const connect = () => {
    const port = { name: 'panel-1', sender: { id: chrome.runtime.id }, onMessage: event(), onDisconnect: event(), postMessage: (msg) => messages.push(msg) };
    chrome.runtime.onConnect.emit(port);
    return port;
  };
  const port = connect();
  const emit = (method, params) => controller.onEvent({ tabId: 1 }, method, params);
  const pause = (extra = {}) => emit('Fetch.requestPaused', {
    requestId: 'fetch-1', networkId: 'network-1', request: { url: 'https://example.com/api', method: 'GET', headers: {} },
    responseStatusCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], resourceType: 'Fetch', ...extra,
  });
  const request = (extra = {}) => emit('Network.requestWillBeSent', {
    requestId: 'network-1', type: 'Fetch', request: { url: 'https://example.com/api', method: 'GET', headers: {} }, ...extra,
  });
  const response = (extra = {}) => emit('Network.responseReceived', {
    requestId: 'network-1', type: 'Fetch', response: { status: 200, headers: { 'Content-Type': 'application/json' } }, ...extra,
  });
  return { chrome, controller, commands, messages, port, connect, emit, request, response, pause,
    getRules: () => stored,
    runTimers: async () => { for (const [id, f] of [...timers]) { timers.delete(id); await f(); } await new Promise((resolve) => setImmediate(resolve)); },
    requests: () => messages.filter((msg) => msg.type === 'REQUEST').map((msg) => msg.data),
  };
}
