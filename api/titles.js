import { ObjectId } from "mongodb";
import { getDb, fail, requireAdmin, clean, validHttpUrl, objectId } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    const db = await getDb();
    const collection = db.collection("titles");

    if (req.method === "GET") {
      const filter = {};
      const type = String(req.query?.type || "");
      const search = clean(String(req.query?.search || ""), 80);
      const id = String(req.query?.id || "");

      if (id) {
        if (!objectId(id)) return fail(res, 400, "ID inválido.");
        const item = await collection.findOne({ _id: new ObjectId(id) });
        if (!item) return fail(res, 404, "No se encontró el título.");
        return res.status(200).json(item);
      }
      if (type === "movie" || type === "series") filter.type = type;
      if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

      const items = await collection.find(filter).sort({ createdAt: -1 }).limit(500).toArray();
      return res.status(200).json(items);
    }

    if (!["POST", "PATCH", "DELETE"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST, PATCH, DELETE");
      return fail(res, 405, "Método no permitido.");
    }
    if (!requireAdmin(req, res)) return;

    if (req.method === "POST") {
      const body = req.body || {};
      const name = clean(body.name, 160);
      const type = body.type === "series" || body.type === "movie" ? body.type : "";
      const imageUrl = clean(body.imageUrl, 2000);
      const videoUrl = clean(body.videoUrl, 2000);
      const description = clean(body.description, 3000);
      const year = Number(body.year) || null;
      const genres = Array.isArray(body.genres) ? body.genres.map(x => clean(x, 40)).filter(Boolean).slice(0, 12) : [];

      if (!name || !type || !imageUrl || !validHttpUrl(imageUrl)) {
        return fail(res, 400, "Nombre, tipo y URL de portada válida son obligatorios.");
      }
      if (type === "movie" && (!videoUrl || !validHttpUrl(videoUrl))) {
        return fail(res, 400, "Las películas necesitan una URL válida del reproductor autorizado.");
      }
      if (type === "series" && videoUrl && !validHttpUrl(videoUrl)) {
        return fail(res, 400, "La URL del reproductor no es válida.");
      }

      const now = new Date();
      const doc = { name, type, imageUrl, videoUrl: type === "movie" ? videoUrl : "", description, year, genres, createdAt: now, updatedAt: now };
      const result = await collection.insertOne(doc);
      return res.status(201).json({ message: "Título guardado.", id: result.insertedId });
    }

    if (req.method === "PATCH") {
      const id = String(req.query?.id || "");
      if (!objectId(id)) return fail(res, 400, "ID inválido.");
      const body = req.body || {};
      const update = {};
      if (body.name !== undefined) update.name = clean(body.name, 160);
      if (body.type !== undefined) {
        if (!["movie", "series"].includes(body.type)) return fail(res, 400, "Tipo inválido.");
        update.type = body.type;
      }
      if (body.imageUrl !== undefined) {
        const value = clean(body.imageUrl, 2000);
        if (!validHttpUrl(value)) return fail(res, 400, "URL de portada inválida.");
        update.imageUrl = value;
      }
      if (body.videoUrl !== undefined) {
        const value = clean(body.videoUrl, 2000);
        if (value && !validHttpUrl(value)) return fail(res, 400, "URL del reproductor inválida.");
        update.videoUrl = value;
      }
      if (body.description !== undefined) update.description = clean(body.description, 3000);
      if (body.year !== undefined) update.year = Number(body.year) || null;
      if (body.genres !== undefined) update.genres = Array.isArray(body.genres) ? body.genres.map(x => clean(x, 40)).filter(Boolean).slice(0, 12) : [];
      if (!Object.keys(update).length) return fail(res, 400, "No hay cambios.");
      update.updatedAt = new Date();
      const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: update });
      if (!result.matchedCount) return fail(res, 404, "No se encontró el título.");
      return res.status(200).json({ message: "Título actualizado." });
    }

    if (req.method === "DELETE") {
      const id = String(req.query?.id || "");
      if (!objectId(id)) return fail(res, 400, "ID inválido.");
      const oid = new ObjectId(id);
      const existing = await collection.findOne({ _id: oid }, { projection: { type: 1 } });
      if (!existing) return fail(res, 404, "No se encontró el título.");
      await collection.deleteOne({ _id: oid });
      if (existing.type === "series") await db.collection("episodes").deleteMany({ titleId: oid });
      return res.status(200).json({ message: "Título eliminado." });
    }
  } catch (error) {
    console.error("NEXORA titles:", error);
    return fail(res, 500, "Error interno al procesar el catálogo.");
  }
}