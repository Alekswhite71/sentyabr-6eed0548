/* Прогоняет формирование уведомления по всем датам от старта до конца поездки,
   чтобы убедиться, что нигде нет пропусков, дублей и сбоя падежей. */
import { compose } from "./send-push.mjs";

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
  }
  prev = msg;
  d = new Date(d.getTime() + 86400000);
}

console.log(problems ? `\nПроблем: ${problems}` : "\nПроблем не найдено.");
