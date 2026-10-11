# NEXORA Play — catálogo + panel + API

Proyecto listo para desplegar en Vercel con MongoDB Atlas. La base de datos guarda los metadatos y URLs de reproductores; **no almacena archivos de vídeo**.

## Antes de desplegar
1. En MongoDB Atlas, crea/usa la base `nexora` y la colección `titles`. La colección `episodes` se creará al guardar el primer capítulo.
2. Importa este repositorio en Vercel.
3. En Vercel → Settings → Environment Variables, configura:
   - `MONGODB_URI`: cadena de conexión de MongoDB Atlas.
   - `NEXORA_ADMIN_KEY`: una clave larga y privada.
4. Haz Deploy. Después de cambiar variables, vuelve a desplegar.

## Páginas
- `/` — catálogo público con buscador, filtros, detalles, temporadas, episodios y reproductor integrado.
- `/admin.html` — panel de administración. Pide la clave `NEXORA_ADMIN_KEY` configurada en Vercel.

La clave se envía al backend en el encabezado `x-admin-key` para crear, editar y borrar. No la pongas en `script.js`, `admin.js` ni en ninguna variable pública `NEXT_PUBLIC_...`.

## API
- `GET /api/titles` — lista pública.
- `GET /api/titles?type=series` — series.
- `GET /api/titles?type=movie` — películas.
- `POST /api/titles` — crea título (protegido).
- `PATCH /api/titles?id=ID` — edita título (protegido).
- `DELETE /api/titles?id=ID` — borra título (protegido; también borra sus episodios).
- `GET /api/episodes?titleId=ID` — episodios ordenados por temporada y número.
- `GET /api/episodes?titleId=ID&season=1` — episodios de una temporada.
- `POST /api/episodes` — crea capítulo (protegido).
- `PATCH /api/episodes?id=ID` — edita capítulo (protegido).
- `DELETE /api/episodes?id=ID` — borra capítulo (protegido).

## Reproducción
Cada película tiene una URL de reproductor. Cada capítulo tiene su propia URL. El catálogo muestra esas direcciones dentro de un iframe en una ventana integrada y ofrece cierre y pantalla completa. Algunos proveedores bloquean iframes mediante sus políticas, y ninguna web puede garantizar que una URL externa se inserte si el proveedor lo impide. Usa enlaces de reproductores que tengas autorización para insertar y distribuir.

## Campos de MongoDB
`titles`: `name`, `type` (`series`/`movie`), `imageUrl`, `description`, `year`, `genres`, `videoUrl` (películas), `createdAt`, `updatedAt`.
`episodes`: `titleId` (ObjectId de la serie), `seasonNumber`, `episodeNumber`, `name`, `description`, `posterUrl`, `videoUrl`, `createdAt`, `updatedAt`.

No hace falta crear documentos a mano en Atlas: usa el panel de administración.
