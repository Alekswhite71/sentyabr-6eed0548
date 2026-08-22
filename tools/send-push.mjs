/* Ежедневная отправка пуша. Запускается из GitHub Actions по расписанию.
 *
 * Нужны переменные окружения:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY — пара ключей
 *   PUSH_SUB   — подписка(и) в base64, как их показала страница.
 *                Несколько штук можно перечислить через запятую или перенос строки.
 *   DRY_RUN    — если "1", ничего не отправляем, только печатаем текст
 */

import { readFileSync } from "node:fs";

const MEET_KEY = "meet";
const DATA = JSON.parse(readFileSync(new URL("../docs/phrases.json", import.meta.url), "utf8"));

const meet = new Date(DATA[MEET_KEY]);
const TRIP_DAYS = 21;

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/** Календарные сутки до встречи по московскому времени. */
function daysLeft(now = new Date()) {
  const msk = (d) => new Date(d.getTime() + 3 * 3600 * 1000); // сдвигаем в UTC+3
  const a = msk(now);
  const b = msk(meet);
  const da = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const db = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((db - da) / 86400000);
}

export function composeNight(now = new Date()) {
  const left = daysLeft(now);
  const night = DATA.night || {};
  const special = night.byDay && night.byDay[String(left)];
  const body = special || night.body || "Доброй ночи, моя королева.";
  const title = night.title || "♥ Доброй ночи";
  return { title, body, tag: `night-${left}` };
}

export function compose(now = new Date()) {
  const left = daysLeft(now);

  // поездка уже идёт
  if (left < 0) {
    const day = 1 - left;
    if (day > TRIP_DAYS) return null; // всё закончилось, больше не пишем
    const special = DATA.trip && DATA.trip[String(day)];
    return {
      title: `♥ День ${day} из ${TRIP_DAYS}`,
      body: special || "Мы вместе. И это лучшее, что есть.",
      tag: `trip-${day}`
    };
  }

  const body =
    (DATA.phrases && DATA.phrases[String(left)]) ||
    DATA.far[left % DATA.far.length];

  const title =
    left === 0 ? "♥ СЕГОДНЯ. Я уже в пути к тебе."
    : left === 1 ? "♥ Завтра. Уже завтра."
    : `♥ ${left} ${plural(left, "день", "дня", "дней")} до встречи`;

  return { title, body, tag: `left-${left}` };
}

function parseSubs(raw) {
  return String(raw || "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => {
      try {
        return JSON.parse(Buffer.from(s, "base64").toString("utf8"));
      } catch (e) {
        console.error(`Подписка №${i + 1} не разобралась, пропускаю: ${e.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

// при импорте из тестов ничего не отправляем
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (!isMain) {
  // используется как модуль
} else {
  await main();
}

async function main() {
const slot = process.env.PUSH_SLOT || "morning";
const customTitle = process.env.PUSH_TITLE;
const customBody = process.env.PUSH_BODY;

let msg;
if (customTitle || customBody) {
  msg = {
    title: customTitle || "♥",
    body: customBody || "",
    tag: "custom",
  };
} else if (slot === "night") {
  msg = composeNight();
} else {
  msg = compose();
}
if (!msg) {
  console.log("Отпуск закончился — отправлять больше нечего.");
  process.exit(0);
}

console.log("Заголовок:", msg.title);
console.log("Текст:    ", msg.body);

if (process.env.DRY_RUN === "1") {
  console.log("DRY_RUN=1 — ничего не отправляю.");
  process.exit(0);
}

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SUB } = process.env;
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("Нет ключей VAPID в секретах.");
  process.exit(1);
}

const subs = parseSubs(PUSH_SUB);
if (!subs.length) {
  console.error("Нет ни одной подписки в секрете PUSH_SUB — отправлять некому.");
  process.exit(1);
}

// подключаем библиотеку только когда реально отправляем,
// чтобы сухой прогон работал без установки зависимостей
const webpush = (await import("web-push")).default;
webpush.setVapidDetails("mailto:noreply@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

let ok = 0;
let gone = 0;
let failed = 0;

for (const sub of subs) {
  try {
    await webpush.sendNotification(
      sub,
      JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag, url: "./" }),
      { TTL: 12 * 3600, urgency: "normal" }
    );
    ok++;
  } catch (e) {
    // 404/410 — подписка отозвана, её надо перевыпустить на телефоне
    if (e.statusCode === 404 || e.statusCode === 410) {
      gone++;
      console.error(`Подписка больше не действует (${e.statusCode}). Нужно заново разрешить уведомления на телефоне.`);
    } else {
      failed++;
      console.error(`Ошибка отправки: ${e.statusCode || ""} ${e.body || e.message}`);
    }
  }
}

console.log(`Отправлено: ${ok}, отозвано: ${gone}, ошибок: ${failed}`);
if (ok === 0) process.exit(1);
}
