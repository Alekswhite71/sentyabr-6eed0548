"""Генерирует calendar.ics — по одному событию на каждый день ожидания.
Каждое событие в 09:00 по Москве с будильником, то есть на iPhone это
превращается в ежедневное уведомление со счётчиком и тёплой фразой.

Это резервный вариант: основной способ — настоящие пуши через GitHub Actions.
Календарь пригодится, если пуши по какой-то причине не заработают.

Тексты берутся из phrases.full.json — полного набора фраз.
Публичный docs/phrases.json содержит только уже открытые дни."""

import json
from datetime import date, datetime, timedelta
from pathlib import Path

MEET = date(2026, 9, 9)
START = date(2026, 8, 22)
HOUR_UTC = 6  # 09:00 MSK = 06:00 UTC

SRC = json.loads((Path(__file__).parent / "phrases.full.json").read_text("utf-8"))

# тексты приходят из docs/phrases.json — один источник для страницы,
# пушей и календаря
PH = {int(k): v for k, v in SRC["phrases"].items()}
FAR = SRC["far"]


def plural(n, one, few, many):
    a, b = abs(n) % 100, abs(n) % 10
    if 10 < a < 20:
        return many
    if 1 < b < 5:
        return few
    if b == 1:
        return one
    return many


def esc(s):
    return s.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;")


def fold(line):
    """RFC 5545: строки не длиннее 75 октетов, продолжение с пробела."""
    out, cur = [], ""
    for ch in line:
        if len((cur + ch).encode("utf-8")) > 73:
            out.append(cur)
            cur = " "
        cur += ch
    out.append(cur)
    return "\r\n".join(out)


rows = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//nash sentyabr//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:♥ До встречи",
    "X-WR-CALDESC:Каждый день на один ближе",
]

day, n = START, 0
while day <= MEET:
    left = (MEET - day).days
    phrase = PH.get(left) or FAR[left % len(FAR)]
    short = long = phrase
    word = plural(left, "день", "дня", "дней")

    if left == 0:
        title = "♥ СЕГОДНЯ. " + short
    else:
        title = f"♥ {left} {word} — {short}"

    stamp = datetime(day.year, day.month, day.day, HOUR_UTC, 0, 0)
    rows += [
        "BEGIN:VEVENT",
        f"UID:vika-{day.isoformat()}@nash-sentyabr",
        "DTSTAMP:20260822T090000Z",
        f"DTSTART:{stamp.strftime('%Y%m%dT%H%M%S')}Z",
        f"DTEND:{(stamp + timedelta(minutes=15)).strftime('%Y%m%dT%H%M%S')}Z",
        fold("SUMMARY:" + esc(title)),
        fold("DESCRIPTION:" + esc(long + "  ♥")),
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:PT0S",
        fold("DESCRIPTION:" + esc(title)),
        "END:VALARM",
        "END:VEVENT",
    ]
    day += timedelta(days=1)
    n += 1

rows.append("END:VCALENDAR")

with open("calendar.ics", "w", encoding="utf-8", newline="") as f:
    f.write("\r\n".join(rows) + "\r\n")

print(f"calendar.ics готов: {n} событий, с {START} по {MEET}")
