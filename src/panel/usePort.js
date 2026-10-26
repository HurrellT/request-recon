import { onCleanup, onMount } from "solid-js";
import { addRequest, findRule, receiveCommandReply, setIsRecording, setPort, setRules, showToast } from "./store";
import { t } from "../lib/i18n";
import boltSvg from "../assets/icons/bolt.svg?raw";

export function usePort(tabId) {
  let reconnectTimer = null;
  let keepaliveTimer = null;
  let activePort = null;
  let disposed = false;

  const connect = () => {
    if (disposed) return;
    activePort = chrome.runtime.connect({ name: `panel-${tabId}` });
    const connectedPort = activePort;
    setPort(activePort);

    activePort.onMessage.addListener((msg) => {
      if (disposed || activePort !== connectedPort || receiveCommandReply(msg)) return;
      switch (msg.type) {
        case "STATUS":
          setIsRecording(msg.active);
          break;
        case "REQUEST":
          addRequest(msg.data);
          if (msg.data.ruleApplied && msg.data.ruleId) {
            const appliedRule = findRule(msg.data.ruleId);
            if (appliedRule) injectPageToast(msg.data, appliedRule);
          }
          break;
        case "RULES":
          setRules(msg.rules || []);
          break;
        case "ERROR":
          showToast(msg.errorKey ? t(msg.errorKey, msg.params) : msg.message, "error");
          break;
      }
    });

    activePort.onDisconnect.addListener(() => {
      if (disposed || activePort !== connectedPort) return;
      setPort(null);
      setIsRecording(false);
      activePort = null;
      clearInterval(keepaliveTimer);
      reconnectTimer = setTimeout(connect, 800);
    });

    keepaliveTimer = setInterval(() => {
      try { activePort?.postMessage({ type: "KEEPALIVE" }); } catch (_) {}
    }, 20_000);
  };

  onMount(connect);
  onCleanup(() => {
    disposed = true;
    clearTimeout(reconnectTimer);
    clearInterval(keepaliveTimer);
    activePort?.disconnect();
    setPort(null);
  });
}

function injectPageToast(reqData, rule) {
  // The inspected page can observe this DOM; keep rule names and URLs private.
  const label = t("responseOverrideApplied");
  // Read the vector path from the same bundled Tabler asset used by the panel.
  const boltPath = boltSvg.match(/<path d="([^"]+)"/)?.[1] ?? "";
  const payload = JSON.stringify({
    method: reqData.method,
    label,
    status: reqData.networkFailureApplied ? t("networkFailureShort") : String(reqData.appliedStatus ?? reqData.resStatus ?? ""),
    boltPath,
  });

  const script = `
    (function(d) {
      const CONTAINER_ID = '__rr_toasts__';
      let container = document.getElementById(CONTAINER_ID);
      if (!container) {
        container = document.createElement('div');
        container.id = CONTAINER_ID;
        Object.assign(container.style, {
          position: 'fixed', top: '12px', right: '12px',
          zIndex: '2147483647',
          display: 'flex', flexDirection: 'column', gap: '6px',
          pointerEvents: 'none',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          lineHeight: '1.4'
        });
        document.documentElement.appendChild(container);
      }

      if (!document.getElementById('__rr_keyframes__')) {
        const style = document.createElement('style');
        style.id = '__rr_keyframes__';
        style.textContent =
          '@keyframes __rr_in  { from { opacity:0; transform:translateX(14px) } to { opacity:1; transform:translateX(0) } }' +
          '@keyframes __rr_out { to   { opacity:0; transform:translateX(14px) } }';
        document.head.appendChild(style);
      }

      const toast = document.createElement('div');
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      Object.assign(toast.style, {
        background: '#141f16',
        border: '1px solid #4ec9b0',
        borderRadius: '6px',
        padding: '8px 12px',
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        maxWidth: '340px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
        animation: reducedMotion ? 'none' : '__rr_in 0.18s ease'
      });

      const svgNS = 'http://www.w3.org/2000/svg';
      const icon = document.createElementNS(svgNS, 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('stroke-linejoin', 'round');
      icon.setAttribute('aria-hidden', 'true');
      const iconPath = document.createElementNS(svgNS, 'path');
      iconPath.setAttribute('d', d.boltPath);
      icon.appendChild(iconPath);
      Object.assign(icon.style, { width: '16px', height: '16px', color: '#4ec9b0', flexShrink: '0', marginTop: '1px' });

      const body = document.createElement('div');
      Object.assign(body.style, { minWidth: '0' });

      const title = document.createElement('div');
      title.textContent = 'Request Recon';
      Object.assign(title.style, {
        color: '#4ec9b0', fontSize: '10px', fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px'
      });

      const info = document.createElement('div');
      Object.assign(info.style, { color: '#cccccc', fontSize: '12px', wordBreak: 'break-word' });

      const methodBadge = document.createElement('span');
      methodBadge.textContent = d.method;
      Object.assign(methodBadge.style, {
        color: '#569cd6', fontFamily: 'monospace', fontWeight: '700',
        fontSize: '11px', marginRight: '6px'
      });

      info.appendChild(methodBadge);
      info.appendChild(document.createTextNode(d.label));

      if (d.status) {
        const statusNode = document.createElement('span');
        statusNode.textContent = ' (' + d.status + ')';
        Object.assign(statusNode.style, { color: '#858585', fontSize: '11px' });
        info.appendChild(statusNode);
      }

      body.appendChild(title);
      body.appendChild(info);
      toast.appendChild(icon);
      toast.appendChild(body);
      container.appendChild(toast);

      setTimeout(function() {
        toast.style.animation = reducedMotion ? 'none' : '__rr_out 0.22s ease forwards';
        setTimeout(function() { toast.remove(); }, 220);
      }, 3200);

      return true;
    })(${payload});
  `;

  chrome.devtools.inspectedWindow.eval(script, (_result, err) => {
    // The inspected page can navigate before this optional toast is injected.
    // Chrome reports that as an Inspector protocol error; the rule was already applied.
    if (err && err.code !== "E_PROTOCOLERROR") {
      console.warn("[RR] page toast error:", err.description, err.details || err.value);
    }
  });
}
