/**
 * TimeToZone popup. Bundles the engine directly: no network calls, works
 * offline. docs/10.
 */
import { ZONES } from "../../src/data/zones";
import { fmtClock, fmtOffsetShort, localZone, offsetMinutes, wallTime } from "../../src/engine/tz";
import { abbrFor } from "../../src/engine/side";

const SITE = "https://timetozone.com";
const STORE_URL = "https://chromewebstore.google.com/detail/timetozone";
const MAX_PINS = 8;

interface Pin {
  key: string;
  label: string;
  tz: string;
}

interface State {
  pins: Pin[];
  h12: boolean;
  opens: number;
  reviewDone: boolean;
}

function defaultPins(): Pin[] {
  const local = localZone();
  const pins: Pin[] = [{ key: "local", label: "My time", tz: local }];
  for (const [key, label, tz] of [
    ["et", "Eastern (ET)", "America/New_York"],
    ["utc", "UTC", "Etc/UTC"],
    ["ist", "India (IST)", "Asia/Kolkata"],
  ] as const) {
    if (tz !== local) pins.push({ key, label, tz });
  }
  return pins.slice(0, MAX_PINS);
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let state: State = { pins: defaultPins(), h12: true, opens: 0, reviewDone: false };
let sliderMinutes = 0;

/* ------------------------------------------------------------------ storage */

function load(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["pins", "h12", "opens", "reviewDone"], (got) => {
      if (Array.isArray(got.pins) && got.pins.length) {
        state.pins = (got.pins as Pin[]).filter((p) => p && p.tz && p.label).slice(0, MAX_PINS);
        // keep "My time" following the current machine
        const local = state.pins.find((p) => p.key === "local");
        if (local) local.tz = localZone();
      }
      if (typeof got.h12 === "boolean") state.h12 = got.h12;
      state.opens = typeof got.opens === "number" ? got.opens + 1 : 1;
      state.reviewDone = got.reviewDone === true;
      chrome.storage.sync.set({ opens: state.opens });
      resolve();
    });
  });
}

function savePins() {
  chrome.storage.sync.set({ pins: state.pins });
}

/* --------------------------------------------------------------- rendering */

function sliderLabel(): string {
  if (sliderMinutes === 0) return "Now";
  const sign = sliderMinutes > 0 ? "+" : "−";
  const a = Math.abs(sliderMinutes);
  const h = Math.floor(a / 60);
  const m = a % 60;
  const parts = [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ");
  return `${sign}${parts} from now`;
}

function render() {
  const now = Date.now() + sliderMinutes * 60_000;

  $("slabel").textContent = sliderLabel();
  $("offs").textContent = sliderLabel();
  $<HTMLButtonElement>("h12").setAttribute("aria-pressed", String(state.h12));
  $<HTMLButtonElement>("h24").setAttribute("aria-pressed", String(!state.h12));

  const ul = $<HTMLUListElement>("rows");
  ul.textContent = "";
  for (const [i, pin] of state.pins.entries()) {
    const w = wallTime(pin.tz, now);
    const li = document.createElement("li");

    const who = document.createElement("div");
    who.className = "who";
    const lab = document.createElement("div");
    lab.className = "lab";
    lab.textContent = pin.label;
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = `${abbrFor(pin.tz, now)} · UTC${fmtOffsetShort(offsetMinutes(pin.tz, now))} · ${w.weekday}`;
    who.append(lab, sub);

    const clock = document.createElement("div");
    clock.className = "clock";
    clock.textContent = fmtClock(w.hour, w.minute, state.h12);

    li.append(who, clock);

    if (state.pins.length > 1) {
      const rm = document.createElement("button");
      rm.className = "rm";
      rm.type = "button";
      rm.textContent = "×";
      rm.title = `Remove ${pin.label}`;
      rm.setAttribute("aria-label", `Remove ${pin.label}`);
      rm.addEventListener("click", () => {
        state.pins.splice(i, 1);
        savePins();
        render();
      });
      li.append(rm);
    }
    ul.append(li);
  }

  $<HTMLInputElement>("addin").disabled = state.pins.length >= MAX_PINS;
  $<HTMLButtonElement>("addbtn").disabled = state.pins.length >= MAX_PINS;

  const review = $("review");
  if (state.opens >= 10 && !state.reviewDone) review.classList.add("on");
  else review.classList.remove("on");
}

/* -------------------------------------------------------------- the picker */

function fillDatalist() {
  const list = $<HTMLDataListElement>("zonelist");
  const add = (value: string, label?: string) => {
    const o = document.createElement("option");
    o.value = value;
    if (label) o.label = label;
    list.append(o);
  };
  for (const z of ZONES) add(`${z.abbr} — ${z.name}`);
  try {
    for (const tz of Intl.supportedValuesOf("timeZone")) add(tz.replace(/_/g, " "));
  } catch {
    /* older Chrome */
  }
}

function resolveInput(raw: string): Pin | null {
  const text = raw.trim();
  if (!text) return null;

  const code = text.split(/\s+|—/)[0].toUpperCase();
  const zone = ZONES.find((z) => z.abbr.toUpperCase() === code || z.slug === code.toLowerCase());
  if (zone) return { key: `z:${zone.slug}`, label: `${zone.abbr} — ${zone.name}`, tz: zone.iana };

  const candidate = text.replace(/\s/g, "_");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(0);
    const city = candidate.split("/").pop()!.replace(/_/g, " ");
    return { key: `t:${candidate}`, label: city, tz: candidate };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------- wiring */

async function main() {
  await load();
  fillDatalist();

  $<HTMLAnchorElement>("full").href = `${SITE}/?utm_source=chrome-extension&utm_medium=popup`;
  $<HTMLAnchorElement>("reviewlink").href = `${STORE_URL}/reviews`;

  $("h12").addEventListener("click", () => {
    state.h12 = true;
    chrome.storage.sync.set({ h12: true });
    render();
  });
  $("h24").addEventListener("click", () => {
    state.h12 = false;
    chrome.storage.sync.set({ h12: false });
    render();
  });

  const slider = $<HTMLInputElement>("slider");
  slider.addEventListener("input", () => {
    sliderMinutes = Number(slider.value);
    render();
  });

  $("reset").addEventListener("click", () => {
    sliderMinutes = 0;
    slider.value = "0";
    render();
  });

  const addInput = $<HTMLInputElement>("addin");
  const doAdd = () => {
    const pin = resolveInput(addInput.value);
    if (!pin) {
      addInput.setAttribute("aria-invalid", "true");
      addInput.placeholder = "Try EST, CET, or Europe/Paris";
      return;
    }
    addInput.removeAttribute("aria-invalid");
    if (state.pins.length < MAX_PINS && !state.pins.some((p) => p.tz === pin.tz)) {
      state.pins.push(pin);
      savePins();
    }
    addInput.value = "";
    render();
  };
  $("addbtn").addEventListener("click", doAdd);
  addInput.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") doAdd();
  });

  $("reviewno").addEventListener("click", () => {
    state.reviewDone = true;
    chrome.storage.sync.set({ reviewDone: true });
    render();
  });
  $("reviewlink").addEventListener("click", () => {
    state.reviewDone = true;
    chrome.storage.sync.set({ reviewDone: true });
  });

  render();
  setInterval(render, 1000);
}

void main();
