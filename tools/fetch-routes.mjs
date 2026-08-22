/* Строит геометрию перегонов по реальным дорогам через OSRM
   и сохраняет в docs/routes.json — карта читает его при загрузке.

   Перезапускать, если поменялись координаты точек или список LEGS. */

import { writeFileSync } from "node:fs";

const OSRM = "https://router.project-osrm.org/route/v1/driving";

const STOPS = {
  rostov: [47.2357, 39.7015],
  pyatigorsk: [44.0486, 43.0594],
  kislovodsk: [43.9053, 42.7168],
  dzhilisu: [43.433, 42.237],
  terskol: [43.2578, 42.4667],
  simba: [43.2508, 42.5085],
  azau: [43.2661, 42.4842],
  chegem: [43.431, 43.256],
  elista: [46.3078, 44.2558],
  volgograd: [48.7425, 44.537],
  borisoglebsk: [51.3669, 42.0747],
  prokhorovka: [51.037, 36.748],
  kursk: [51.7373, 36.1873],
  tula: [54.1931, 37.6173],
  yasna: [54.076, 37.526],
  yeysk: [46.7106, 38.2773],
  gelendzhik: [44.5622, 38.0848],
};

const LEGS = [
  ["rostov", "pyatigorsk"],
  ["pyatigorsk", "kislovodsk"],
  ["kislovodsk", "dzhilisu"],
  ["dzhilisu", "kislovodsk"],
  ["kislovodsk", "terskol"],
  ["terskol", "simba"],
  ["simba", "azau"],
  ["azau", "chegem"],
  ["chegem", "elista"],
  ["elista", "volgograd"],
  ["volgograd", "borisoglebsk"],
  ["borisoglebsk", "prokhorovka"],
  ["prokhorovka", "kursk"],
  ["kursk", "tula"],
  ["tula", "yasna"],
  ["rostov", "yeysk"],
  ["yeysk", "rostov"],
  ["terskol", "gelendzhik"],
  ["gelendzhik", "terskol"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function downsample(pts, max = 280) {
  if (pts.length <= max) return pts;
  const out = [pts[0]];
  for (let i = 1; i < max - 1; i++) out.push(pts[Math.round((i * (pts.length - 1)) / (max - 1))]);
  out.push(pts[pts.length - 1]);
  return out;
}

async function fetchLeg(from, to) {
  const a = STOPS[from];
  const b = STOPS[to];
  if (!a || !b) throw new Error(`нет координат: ${from} или ${to}`);

  const url =
    `${OSRM}/${a[1]},${a[0]};${b[1]},${b[0]}` +
    "?overview=full&geometries=geojson&steps=false";

  const res = await fetch(url, { headers: { "User-Agent": "otpusk-2026-route-builder" } });
  if (!res.ok) throw new Error(`${from}->${to}: HTTP ${res.status}`);

  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error(`${from}->${to}: OSRM ${data.code || "нет маршрута"}`);
  }

  const r = data.routes[0];
  // GeoJSON: [lng, lat] → Leaflet: [lat, lng]
  const pts = r.geometry.coordinates.map(([lng, lat]) => [
    Math.round(lat * 1e5) / 1e5,
    Math.round(lng * 1e5) / 1e5,
  ]);

  return {
    distance_m: Math.round(r.distance),
    duration_s: Math.round(r.duration),
    points: downsample(pts),
  };
}

const out = {
  source: "OSRM driving profile, router.project-osrm.org",
  generated: new Date().toISOString().slice(0, 10),
  legs: {},
};

for (const [from, to] of LEGS) {
  const key = `${from}->${to}`;
  process.stdout.write(`${key}… `);
  try {
    out.legs[key] = await fetchLeg(from, to);
    console.log(`${out.legs[key].points.length} точек, ${(out.legs[key].distance_m / 1000).toFixed(0)} км`);
  } catch (e) {
    console.log(`ОШИБКА: ${e.message}`);
    out.legs[key] = { error: e.message, points: [STOPS[from], STOPS[to]] };
  }
  await sleep(1200); // не долбим публичный сервер
}

writeFileSync(
  new URL("../docs/routes.json", import.meta.url),
  JSON.stringify(out, null, 0) + "\n"
);
console.log("\nготово: docs/routes.json");
