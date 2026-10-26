export function createCommandClient({ onReply = () => {}, onError = () => {}, timers = globalThis } = {}) {
  let port = null;
  const pending = new Map();
  const disconnected = () => new Error("The extension connection is unavailable");
  const disconnect = () => {
    port = null;
    for (const entry of pending.values()) { timers.clearTimeout(entry.timer); entry.reject(disconnected()); }
    pending.clear();
  };
  return {
    setPort(next) { if (port !== next) disconnect(); port = next; },
    receive(reply) {
      if (reply.type !== "RESULT") return false;
      const entry = pending.get(reply.commandId);
      if (!entry) return true;
      pending.delete(reply.commandId);
      timers.clearTimeout(entry.timer);
      if (reply.ok) { onReply(reply); entry.resolve(reply); }
      else { const error = new Error(reply.params?.details || "Command failed"); error.reply = reply; entry.reject(error); }
      return true;
    },
    send(message) {
      const task = new Promise((resolve, reject) => {
        if (!port) { reject(disconnected()); return; }
        const commandId = crypto.randomUUID();
        const timer = timers.setTimeout(() => {
          pending.delete(commandId);
          reject(new Error("The command timed out; its result is unknown"));
        }, 10000);
        pending.set(commandId, { resolve, reject, timer });
        try { port.postMessage({ ...message, commandId }); }
        catch (error) { pending.delete(commandId); timers.clearTimeout(timer); reject(error); }
      });
      // Report centrally, while retaining a rejecting promise for action callers.
      task.catch(onError);
      return task;
    },
    disconnect,
  };
}
