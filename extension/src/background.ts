/**
 * Service worker: the right-click "Convert '3pm EST' to my time" action.
 * docs/10.
 */
import { convert } from "./convert";

const MENU_ID = "ttz-convert";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Convert "%s" to my time',
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  const message = convert(info.selectionText ?? "");
  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      func: showToast,
      args: [message],
    })
    .catch(() => {
      /* restricted page: nothing we can do */
    });
});

/** Injected into the page. Must be self-contained. */
function showToast(text: string) {
  const ID = "ttz-toast";
  document.getElementById(ID)?.remove();
  const el = document.createElement("div");
  el.id = ID;
  el.textContent = text;
  el.setAttribute("role", "status");
  const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  el.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:2147483647",
    "max-width:320px",
    "padding:12px 14px",
    "border-radius:12px",
    `background:${dark ? "#f7f7f7" : "#080808"}`,
    `color:${dark ? "#080808" : "#ffffff"}`,
    "font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif",
    "box-shadow:0 8px 28px rgba(0,0,0,.28)",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}
