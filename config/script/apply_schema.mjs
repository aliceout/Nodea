// Fonction utilitaire pour question/réponse interactive
function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

import fs from "fs";
import path from "path";

import "dotenv/config";
import readline from "readline";
import promptSync from "prompt-sync";
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Récupère la liste des noms de collections PocketBase
async function getCollections(token) {
  const res = await fetch(`${PB_URL}/api/collections`, {
    headers: { Authorization: token },
  });
  if (!res.ok) {
    throw new Error(
      `Get collections failed: ${res.status} ${await res.text()}`
    );
  }
  const data = await res.json();
  return (data.items || []).map((c) => c.name);
}
// Définir PB_URL, COLLECTIONS_FILE et RULES_FILE
const PB_URL =
  process.env.PB_URL ||
  process.env.VITE_PB_URL ||
  `http://${process.env.PB_HOST || "127.0.0.1"}:${
    process.env.POCKETBASE_PORT || "8090"
  }`;
const COLLECTIONS_FILE = path.resolve("config/schema/collections.json");
const RULES_FILE = path.resolve("config/schema/rules.json");

console.log(`🔗 PB_URL: ${PB_URL}`);

// Fonction d'authentification admin (POST /api/admins/auth-with-password)
async function adminLogin(identity, password) {
  const r = await fetch(
    `${PB_URL}/api/collections/_superusers/auth-with-password`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity, password }),
    }
  );
  if (!r.ok) {
    throw new Error(`Admin login failed: ${r.status} ${await r.text()}`);
  }
  const { token } = await r.json();
  return { token };
}

async function main() {
  await waitForPocketBaseReady(PB_URL);
  // Utilise les identifiants admin API passés en argument, sinon demande en interactif
  let identity = process.argv[3];
  let password = process.argv[4];
  const prompt = promptSync();
  if (!identity) identity = await ask("Admin email: ");
  if (!password) password = prompt("Admin password: ", { echo: "*" });

  const { token } = await adminLogin(identity, password);

  // 1. Créer les collections manquantes (sauf 'users')
  const collectionsData = JSON.parse(fs.readFileSync(COLLECTIONS_FILE, "utf8"));
  const existingCollections = await getCollections(token);
  for (const col of collectionsData) {
    if (col.name === "users") continue; // Ne jamais créer la collection système
    if (!existingCollections.includes(col.name)) {
      console.log(`➕ create collection: ${col.name}`);
      const res = await fetch(`${PB_URL}/api/collections`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify(col),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Create ${col.name} failed: ${res.status} ${t}`);
      }
    } else {
      console.log(`✔︎ exists: ${col.name}`);
    }
  }

  // 2. Appliquer les rules (y compris pour 'users')
  if (fs.existsSync(RULES_FILE)) {
    const rules = JSON.parse(fs.readFileSync(RULES_FILE, "utf8"));
    for (const [name, rulesObj] of Object.entries(rules)) {
      console.log(`⚙︎ rules → ${name}`);
      await patchRules(token, name, rulesObj);
    }
  } else {
    console.log("ℹ️  Aucun rules.json trouvé — étape ignorée.");
  }

  rl.close();
  console.log("✅ Schéma appliqué.");
}

async function createCollection(token, name) {
  const r = await fetch(`${PB_URL}/api/collections`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      type: "base",
      name,
      schema: [
        // aucun champ métier : tout est dans `payload` chiffré côté client.
        // les champs techniques (id, created, updated) sont gérés par PB.
        // si tu veux forcer des index/constraints, tu pourras le faire ici plus tard.
      ],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Create ${name} failed: ${r.status} ${t}`);
  }
}

async function patchRules(token, name, rulesObj) {
  // récupère la collection pour avoir son id
  const all = await (
    await fetch(`${PB_URL}/api/collections`, {
      headers: { Authorization: token },
    })
  ).json();
  const col = (all.items || []).find((c) => c.name === name);
  if (!col) throw new Error(`Collection ${name} not found to patch rules`);

  const payload = {};
  ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"].forEach(
    (k) => {
      if (rulesObj[k] !== undefined) payload[k] = rulesObj[k];
    }
  );

  if (Object.keys(payload).length === 0) return;

  const r = await fetch(`${PB_URL}/api/collections/${col.id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Patch rules ${name} failed: ${r.status} ${t}`);
  }
}

async function waitForPocketBaseReady(url, maxTries = 40, delayMs = 250) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const r = await fetch(url + "/api/health");
      if (r.ok) return true;
    } catch (e) {}
    await new Promise((res) => setTimeout(res, delayMs));
  }
  throw new Error("PocketBase n'est pas prêt après attente.");
}

main().catch((e) => {
  rl.close();
  console.error("❌", e.message);
  process.exit(1);
});
