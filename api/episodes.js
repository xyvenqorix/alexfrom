import { ObjectId } from "mongodb";
import { getDb, fail, requireAdmin, clean, validHttpUrl, objectId } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    const db = await getDb();
    const episodes = db.collection("episodes");
    const titles = db.collection("titles");

    if (req.method === "GET") {
      const titleId = String(req.query?.titleId || "");
      if (!objectId(titleId)) return fail(res, 400, "Falta un titleId válido.");
      const title = await titles.findOne({ _id: new ObjectId(titleId) }, { projection: { type: 1 } });
      if (!title) return fail(res, 404, "No se encontró el título.");
      if (title.type !== "series") return fail(res, 400, "Los episodios pertenecen a una serie.");
      const filter = { titleId: new ObjectId(titleId) };
      if (req.query?.season !== undefined) {
        const season = Number(req.query.season);
        if (!Number.isInteger(season) || season < 1) return fail(res, 400, "Temporada inválida.");
        filter.seasonNumber = season;
      }
      const result = await episodes.find(filter).sort({ seasonNumber: 1, episodeNumber: 1 }).limit(2000).toArray();
      return res.status(200).json(result);
    }

    if (!["POST", "PATCH", "DELETE"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST, PATCH, DELETE");
      return fail(res, 405, "Método no permitido.");
    }
    if (!requireAdmin(req, res)) return;

    if (req.method === "POST") {
      const body = req.body || {};
      const titleId = String(body.titleId || "");
      const seasonNumber = Number(body.seasonNumber);
      const episodeNumber = Number(body.episodeNumber);
      const name = clean(body.name, 160);
      const description = clean(body.description, 2000);
      const posterUrl = clean(body.posterUrl, 2000);
      const videoUrl = clean(body.videoUrl, 2000);

      if (!objectId(titleId)) return fail(res, 400, "Elige una serie válida.");
      const title = await titles.findOne({ _id: new ObjectId(titleId) }, { projection: { type: 1 } });
      if (!title || title.type !== "series") return fail(res, 400, "Solo puedes añadir capítulos a una serie.");
      if (!Number.isInteger(seasonNumber) || seasonNumber < 1 || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
        return fail(res, 400, "Temporada y capítulo deben ser números enteros positivos.");
      }
      if (!name || !videoUrl || !validHttpUrl(videoUrl)) return fail(res, 400, "El título del capítulo y una URL de reproductor válida son obligatorios.");
      if (posterUrl && !validHttpUrl(posterUrl)) return fail(res, 400, "La imagen del capítulo tiene una URL inválida.");
      const duplicate = await episodes.findOne({ titleId: new ObjectId(titleId), seasonNumber, episodeNumber });
      if (duplicate) return fail(res, 409, "Ya existe ese capítulo en esa temporada.");
      const now = new Date();
      const doc = { titleId: new ObjectId(titleId), seasonNumber, episodeNumber, name, description, posterUrl, videoUrl, createdAt: now, updatedAt: now };
      const result = await episodes.insertOne(doc);
      return res.status(201).json({ message: "Capítulo guardado.", id: result.insertedId });
    }

    if (req.method === "PATCH") {
      const id = String(req.query?.id || "");
      if (!objectId(id)) return fail(res, 400, "ID de capítulo inválido.");
      const body = req.body || {};
      const update = {};
      if (body.name !== undefined) update.name = clean(body.name, 160);
      if (body.description !== undefined) update.description = clean(body.description, 2000);
      for (const field of ["videoUrl", "posterUrl"]) {
        if (body[field] !== undefined) {
          const value = clean(body[field], 2000);
          if (value && !validHttpUrl(value)) return fail(res, 400, `URL inválida: ${field}.`);
          if (field === "videoUrl" && !value) return fail(res, 400, "La URL del reproductor no puede quedar vacía.");
          update[field] = value;
        }
      }
      for (const field of ["seasonNumber", "episodeNumber"]) {
        if (body[field] !== undefined) {
          const value = Number(body[field]);
          if (!Number.isInteger(value) || value < 1) return fail(res, 400, `${field} debe ser un entero positivo.`);
          update[field] = value;
        }
      }
      if (!Object.keys(update).length) return fail(res, 400, "No hay cambios.");
      update.updatedAt = new Date();
      const result = await episodes.updateOne({ _id: new ObjectId(id) }, { $set: update });
      if (!result.matchedCount) return fail(res, 404, "No se encontró el capítulo.");
      return res.status(200).json({ message: "Capítulo actualizado." });
    }

    if (req.method === "DELETE") {
      const id = String(req.query?.id || "");
      if (!objectId(id)) return fail(res, 400, "ID inválido.");
      const result = await episodes.deleteOne({ _id: new ObjectId(id) });
      if (!result.deletedCount) return fail(res, 404, "No se encontró el capítulo.");
      return res.status(200).json({ message: "Capítulo eliminado." });
    }
  } catch (error) {
    console.error("NEXORA episodes:", error);
    return fail(res, 500, "Error interno al procesar los capítulos.");
  }
}