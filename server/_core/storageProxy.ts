import type { Express } from "express";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });

  app.get("/api/exercise-image", async (req, res) => {
    const exerciseId = req.query.exerciseId as string;
    if (!exerciseId) {
      res.status(400).send("Missing exerciseId");
      return;
    }

    try {
      const response = await fetch(
        `https://exercisedb.p.rapidapi.com/image?exerciseId=${encodeURIComponent(exerciseId)}&resolution=360`,
        {
          method: "GET",
          headers: {
            "x-rapidapi-key": ENV.muscleWikiApiKey || "",
            "x-rapidapi-host": "exercisedb.p.rapidapi.com",
          },
        }
      );

      if (!response.ok) {
        res.status(response.status).send("Failed to fetch image from ExerciseDB");
        return;
      }

      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.set("Content-Type", contentType);
      }
      const cacheControl = response.headers.get("cache-control");
      if (cacheControl) {
        res.set("Cache-Control", cacheControl);
      }

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("[ExerciseImageProxy] failed:", err);
      res.status(502).send("Exercise image proxy error");
    }
  });
}
