/* Прогоняет формирование уведомления по всем датам от старта до конца поездки,
   чтобы убедиться, что нигде нет пропусков, дублей и сбоя падежей. */
import { readFileSync } from "node:fs";
import { compose } from "./send-push.mjs";

const MEET = new Date(
  JSON.parse(readFileSync(new URL("../docs/phrases.json", import.meta.url), "utf8")).meet
);

/** Число «дней», которое в этот момент показывает плитка счётчика на странице. */
const tileDays = (now) => Math.floor((MEET - now) / 86400000);

const from = new Date("2026-08-22T06:00:00Z"); // 09:00 МСК
const to = new Date("2026-10-02T06:00:00Z");

let d = new Date(from);
let prev = null;
let problems = 0;

while (d <= to) {
  const msg = compose(d);
  const day = d.toISOString().slice(0, 10);

  if (!msg) {
    console.log(`${day}  — тишина (поездка закончилась)`);
  } else {
    console.log(`${day}  ${msg.title}\n             ${msg.body}`);
    if (prev && prev.title === msg.title) {
      console.log(`  ⚠ заголовок повторяет предыдущий день`);
      problems++;
    }
    if (!msg.body || msg.body.length < 8) {
      console.log(`  ⚠ подозрительно короткий текст`);
      problems++;
    }
    // если в заголовке есть число, оно обязано совпасть с плиткой на странице
    const n = msg.title.match(/(\d+) (?:день|дня|дней)/);
    const tile = tileDays(d);
    if (n && tile >= 0 && Number(n[1]) !== tile) {
      console.log(`  ⚠ в пуше ${n[1]}, а на плитке ${tile}`);
      problems++;
    }
  }
  prev = msg;
  d = new Date(d.getTime() + 86400000);
}

console.log(problems ? `\nПроблем: ${problems}` : "\nПроблем не найдено.");
