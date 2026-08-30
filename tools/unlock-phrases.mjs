/* Собирает docs/phrases.json только из уже открытых фраз.
   Полный текст лежит в phrases.full.json (не отдаётся GitHub Pages).
   Будущие дни на сайте не появляются — их Виктория увидит только
   в утреннем уведомлении и потом в открытке. */

import { readFileSync, writeFileSync } from "node:fs";

const FULL = JSON.parse(readFileSync(new URL("../phrases.full.json", import.meta.url), "utf8"));
const meet = new Date(FULL.meet);

function daysLeft(now = new Date()) {
  const msk = (d) => new Date(d.getTime() + 3 * 3600 * 1000);
  const a = msk(now);
  const b = msk(meet);
  const da = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const db = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((db - da) / 86400000);
}

const left = daysLeft();
const unlocked = {};

if (FULL.phrases) {
  for (const [k, v] of Object.entries(FULL.phrases)) {
    const n = Number(k);
    // ключ = сколько дней оставалось; открыты сегодня и всё, что уже было
    if (Number.isFinite(n) && n >= left) unlocked[k] = v;
  }
}

const night = {
  title: FULL.night?.title || "♥ Доброй ночи",
  body: FULL.night?.body || "Доброй ночи, моя королева.",
  byDay: {}
};
if (FULL.night?.byDay) {
  for (const [k, v] of Object.entries(FULL.night.byDay)) {
    if (Number(k) >= left) night.byDay[k] = v;
  }
}

const out = {
  meet: FULL.meet,
  comment: "Публичный файл для открытки: только уже открытые дни. Полный набор — phrases.full.json.",
  unlockedThrough: left,
  generated: new Date().toISOString(),
  night,
  phrases: unlocked,
  far: FULL.far || []
};

// trip-фразы на сайте не нужны до поездки и тоже могут спойлерить
if (left < 0 && FULL.trip) {
  const day = 1 - left;
  out.trip = {};
  for (const [k, v] of Object.entries(FULL.trip)) {
    if (Number(k) <= day) out.trip[k] = v;
  }
}

writeFileSync(
  new URL("../docs/phrases.json", import.meta.url),
  JSON.stringify(out, null, 2) + "\n"
);

console.log(`открыто до left=${left}: ${Object.keys(unlocked).sort((a,b)=>Number(b)-Number(a)).join(", ") || "(пусто)"}`);
