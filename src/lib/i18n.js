import { createSignal } from "solid-js";
import { normalizeLanguage, translate } from "./translations.js";

const browserLanguage = globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language;
export const [language, setLanguage] = createSignal(normalizeLanguage(browserLanguage));
let languageVersion = 0;

export const t = (key, params) => translate(language(), key, params);

export function chooseLanguage(value) {
  const next = normalizeLanguage(value);
  languageVersion += 1;
  setLanguage(next);
  return chrome.storage.local.set({ language: next });
}

export function initializeLanguage() {
  let active = true;
  const initialVersion = languageVersion;
  const onChanged = (changes, area) => {
    if (area === "local" && changes.language) {
      languageVersion += 1;
      setLanguage(normalizeLanguage(changes.language.newValue || browserLanguage));
    }
  };
  chrome.storage.onChanged.addListener(onChanged);
  chrome.storage.local.get("language").then(({ language: saved }) => {
    if (active && languageVersion === initialVersion && saved) setLanguage(normalizeLanguage(saved));
  }).catch(() => { /* retain the browser/current language if storage is unavailable */ });
  return () => {
    active = false;
    chrome.storage.onChanged.removeListener(onChanged);
  };
}
