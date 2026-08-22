/* Генерирует пару VAPID-ключей для Web Push без внешних зависимостей.
   Публичный ключ идёт в страницу, приватный — в секреты GitHub. */
import { generateKeyPairSync, createPublicKey } from "node:crypto";
import { writeFileSync } from "node:fs";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });

const priv = privateKey.export({ format: "jwk" });
const pub = createPublicKey(privateKey).export({ format: "jwk" });

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (s) => Buffer.from(s, "base64url");

// публичный ключ для Web Push — несжатая точка P-256: 0x04 || X || Y
const publicKey = b64u(
  Buffer.concat([Buffer.from([4]), fromB64u(pub.x), fromB64u(pub.y)])
);
const privateScalar = priv.d; // уже base64url, 32 байта

if (fromB64u(publicKey).length !== 65) throw new Error("публичный ключ не 65 байт");
if (fromB64u(privateScalar).length !== 32) throw new Error("приватный ключ не 32 байта");

writeFileSync(
  "vapid.local.json",
  JSON.stringify({ publicKey, privateKey: privateScalar }, null, 2) + "\n"
);

console.log("VAPID_PUBLIC_KEY =", publicKey);
console.log("VAPID_PRIVATE_KEY сохранён в vapid.local.json (не коммитить)");
