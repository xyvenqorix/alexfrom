import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Falta configurar MONGODB_URI en Vercel.");

let clientPromise = globalThis.__nexoraMongoPromise;
if (!clientPromise) {
  const client = new MongoClient(uri);
  clientPromise = client.connect();
  globalThis.__nexoraMongoPromise = clientPromise;
}

export async function getDb() {
  const client = await clientPromise;
  return client.db("nexora");
}

export function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

export function requireAdmin(req, res) {
  const expected = process.env.NEXORA_ADMIN_KEY;
  if (!expected) {
    fail(res, 503, "Falta configurar NEXORA_ADMIN_KEY en Vercel.");
    return false;
  }
  const supplied = req.headers["x-admin-key"];
  if (typeof supplied !== "string" || supplied !== expected) {
    fail(res, 401, "Clave de administración incorrecta.");
    return false;
  }
  return true;
}

export function clean(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function objectId(value) {
  return typeof value === "string" && /^[a-f\\d]{24}$/i.test(value);
}