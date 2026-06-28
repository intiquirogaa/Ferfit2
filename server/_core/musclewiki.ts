import { ENV } from "./env";

export interface ExerciseMedia {
  type: "image" | "video";
  url: string;
  exerciseName?: string;
}

/**
 * Get exercise media from ExerciseDB (RapidAPI)
 * Returns GIF images for exercise demonstrations
 */
export async function getExerciseMediaUrl(
  exerciseName: string
): Promise<ExerciseMedia | null> {

     console.log("Entró a getExerciseMediaUrl");

  try {
     console.log("Ejercicio recibido:", exerciseName);

    if (!exerciseName) {
       console.log("Sin nombre");
      return null;
    }

   console.log("API KEY:", ENV.muscleWikiApiKey);
  const normalizedName = exerciseName.toLowerCase().trim();
  console.log("Antes del fetch");
    // ExerciseDB RapidAPI endpoint: search by name
    const response = await fetch(
      `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(normalizedName)}?limit=1`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-key": ENV.muscleWikiApiKey || "",
         "x-rapidapi-host": "exercisedb.p.rapidapi.com",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.log(
        `[ExerciseDB] API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();
    console.log(data);

    if (Array.isArray(data) && data.length > 0) {
      const exercise = data[0];
      if (exercise.id) {
        return {
          type: "image",
          url: `/api/exercise-image?exerciseId=${encodeURIComponent(exercise.id)}`,
          exerciseName: exercise.name,
        };
      } else if (exercise.gifUrl) {
        return {
          type: "image",
          url: exercise.gifUrl,
          exerciseName: exercise.name,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("[ExerciseDB] Get media error:", error);
    return null;
  }
}

/**
 * Search for exercises in ExerciseDB
 * Returns exercises with their GIF images
 */
export async function searchExerciseWithMedia(
  name: string,
  limit: number = 5
): Promise<
  Array<{
    name: string;
    gifUrl: string;
    target?: string;
    equipment?: string;
  }>
> {
  try {
    if (!name) {
      return [];
    }

    const normalizedName = name.toLowerCase().trim();

    const response = await fetch(
      `https://exercise-db-fitness-workout-gym.p.rapidapi.com/search?q=${encodeURIComponent(normalizedName)}&limit=${limit}`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-key": ENV.muscleWikiApiKey || "",
          "x-rapidapi-host": "exercise-db-fitness-workout-gym.p.rapidapi.com",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.log(
        `[ExerciseDB] Search error: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      return data
        .filter((ex) => ex.gifUrl)
        .map((ex) => ({
          name: ex.name,
          gifUrl: ex.gifUrl,
          target: ex.target,
          equipment: ex.equipment,
        }));
    }

    return [];
  } catch (error) {
    console.error("[ExerciseDB] Search error:", error);
    return [];
  }
}
