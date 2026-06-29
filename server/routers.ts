import { COOKIE_NAME } from "@shared/const";
import { getDb } from "./db";
import { eq } from "drizzle-orm"; 
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { callDataApi } from "./_core/dataApi";
import { z } from "zod";
import * as db from "./db";
import { trainingPlans, dailyChecklists, userProgress } from "../drizzle/schema";

const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Helper para actualizar plan de entrenamiento
async function updateTrainingPlanContent(planId: number, generatedContent: string) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.update(trainingPlans)
    .set({ generatedContent })
    .where(eq(trainingPlans.id, planId));
}


export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  training: router({
    createPlan: protectedProcedure
      .input(z.object({
        objective: z.enum(["hypertrophy", "strength", "fat_loss", "recomposition"]),
        experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
        age: z.number().min(13).max(100),
        weight: z.number().min(30).max(300),
        height: z.number().min(100).max(250),
        daysPerWeek: z.number().min(2).max(6),
        equipment: z.enum(["full_gym", "dumbbells", "bodyweight", "limited"]),
        injuries: z.string().optional(),
        preferences: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Not authenticated");
        try {
          console.log("[createPlan] Generating plan for user:", ctx.user.id);
          const generatedPlan = await generatePersonalizedPlanWithNutrition(input);
          const generatedContentJson = JSON.stringify(generatedPlan);
          const result = await db.createTrainingPlan(
            ctx.user.id,
            input.objective === "strength" ? "strength" : "hypertrophy",
            input.daysPerWeek,
            generatedContentJson
          );
          console.log("[createPlan] Plan saved:", result);
          return {
            id: (result as any).insertId || 0,
            userId: ctx.user.id,
            type: input.objective === "strength" ? "strength" : "hypertrophy",
            daysPerWeek: input.daysPerWeek,
            durationWeeks: 12,
            generatedContent: generatedContentJson,
            isActive: 1,
            startDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        } catch (error) {
          console.error("[createPlan] Error:", error);
          throw error;
        }
      }),

    getActivePlan: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Not authenticated");
      try {
        const plan = await db.getActiveTrainingPlan(ctx.user.id);
        if (!plan) return { hasPlan: false, id: null, userId: ctx.user.id };
        let generatedContent = plan.generatedContent;
        if (typeof generatedContent === "string") {
          try { generatedContent = JSON.parse(generatedContent); } catch { /* keep as string */ }
        }
        return { ...plan, hasPlan: true, generatedContent };
      } catch (error) {
        console.error("[getActivePlan] Error:", error);
        return { hasPlan: false, id: null, userId: ctx.user.id };
      }
    }),

    getTodayChecklist: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Not authenticated");
      try {
        const checklist = await db.getTodayChecklist(ctx.user.id);
        return checklist || { hasTrainingToday: false, exercises: [], id: null, userId: ctx.user.id };
      } catch (error) {
        console.error("[getTodayChecklist] Error:", error);
        return { hasTrainingToday: false, exercises: [], id: null, userId: ctx.user.id };
      }
    }),

    updateProgress: protectedProcedure
      .input(z.object({
        checklistId: z.number(),
        completedSeries: z.number(),
        xpEarned: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Not authenticated");
        await db.updateChecklistProgress(input.checklistId, input.completedSeries, input.xpEarned);
        await db.updateUserProgress(ctx.user.id, input.xpEarned, input.completedSeries);
        return { success: true };
      }),

    getUserProgress: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Not authenticated");
      let progress = await db.getUserProgress(ctx.user.id);
      if (!progress) {
        await db.createUserProgress(ctx.user.id);
        progress = await db.getUserProgress(ctx.user.id);
      }
      return progress;
    }),

    getAchievements: publicProcedure.query(async () => {
      return await db.getAchievements();
    }),

    getUserAchievements: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Not authenticated");
      return await db.getUserAchievements(ctx.user.id);
    }),

    getStats: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Not authenticated");
      
      const database = await db.getDb();
      if (!database) throw new Error("Database not available");

      const progress = await db.getUserProgress(ctx.user.id);
      
      const checklists = await database
        .select()
        .from(dailyChecklists)
        .where(eq(dailyChecklists.userId, ctx.user.id));
      
      const totalWorkoutsCompleted = checklists.filter((c: any) => c.isCompleted === 1).length;

      const plans = await database
        .select()
        .from(trainingPlans)
        .where(eq(trainingPlans.userId, ctx.user.id));
      
      let seriesProgrammed = 0;
      let seriesCompleted = 0;

      for (const plan of plans) {
        const generatedContent = JSON.parse(plan.generatedContent || "{}");
        for (const day of generatedContent.days || []) {
          for (const ex of day.exercises || []) {
            const totalSets = ex.sets || 3;
            seriesProgrammed += totalSets;
            seriesCompleted += Object.values(ex.seriesCompleted || {}).filter(Boolean).length;
          }
        }
      }

      return {
        seriesCompleted,
        seriesProgrammed,
        totalWorkoutsCompleted,
        xp: progress?.totalXP || 0,
      };
    }),


    createDailyChecklist: protectedProcedure
      .input(z.object({
        trainingPlanId: z.number(),
        dayOfWeek: z.string(),
        totalSeries: z.number().min(1).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Not authenticated");
        return await db.createDailyChecklist(ctx.user.id, input.trainingPlanId, input.dayOfWeek, input.totalSeries);
      }),

    generateDemoRoutine: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Not authenticated");
      try {
        const generatedContent = await generatePersonalizedPlanWithNutrition({
          objective: "hypertrophy",
          experienceLevel: "intermediate",
          age: 28,
          weight: 75,
          height: 180,
          daysPerWeek: 4,
          equipment: "full_gym",
          injuries: "",
          preferences: "Upper/Lower split",
        });
        const planId = await db.createTrainingPlan(ctx.user.id, "hypertrophy", 4, JSON.stringify(generatedContent));
        return { id: planId, userId: ctx.user.id, type: "hypertrophy", daysPerWeek: 4, generatedContent, isActive: 1 };
      } catch (error) {
        console.error("[generateDemoRoutine] Error:", error);
        throw new Error("No se pudo generar la rutina de demo");
      }
    }),

    searchExercise: protectedProcedure
      .input(z.object({ name: z.string() }))
      .query(async ({ input }) => {
        try {
          console.log("[searchExercise] Searching for:", input.name);
          const result = await callDataApi("ExerciseDB/exercises/name/{name}", {
            pathParams: { name: encodeURIComponent(input.name.toLowerCase()) },
            query: { limit: 3, offset: 0 },
          }) as any[];
          if (Array.isArray(result) && result.length > 0) {
            const ex = result[0];
            return {
              found: true,
              gifUrl: ex.gifUrl || null,
              instructions: Array.isArray(ex.instructions) ? ex.instructions : [],
              targetMuscles: ex.target || ex.targetMuscles || "",
              secondaryMuscles: Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [],
              equipment: ex.equipment || "",
              bodyPart: ex.bodyPart || "",
            };
          }
          return { found: false, gifUrl: null, instructions: [], targetMuscles: "", secondaryMuscles: [], equipment: "", bodyPart: "" };
        } catch (error) {
          console.error("[searchExercise] Error:", error);
          return { found: false, gifUrl: null, instructions: [], targetMuscles: "", secondaryMuscles: [], equipment: "", bodyPart: "" };
        }
      }),
    markSeriesComplete: protectedProcedure
      .input(z.object({
        trainingPlanId: z.number(),
        dayNumber: z.number(),
        exerciseIndex: z.number(),
        seriesIndex: z.number(),
        completed: z.boolean(),
        weight: z.number().optional(),
        reps: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Not authenticated");
        try {
          // Obtener el plan actual
          const plan = await db.getActiveTrainingPlan(ctx.user.id);
          if (!plan) throw new Error("No active training plan");
          
          const generatedContent = JSON.parse(plan.generatedContent || "{}");
          const day = generatedContent.days?.[input.dayNumber - 1];
          if (!day) throw new Error("Day not found");
          
          const exercise = day.exercises?.[input.exerciseIndex];
          if (!exercise) throw new Error("Exercise not found");
          
          // Inicializar tracking si no existe
          if (!exercise.seriesCompleted) exercise.seriesCompleted = {};
          if (!exercise.seriesWeights) exercise.seriesWeights = {};
          if (!exercise.seriesReps) exercise.seriesReps = {};
          
          const wasCompleted = exercise.seriesCompleted[input.seriesIndex] === true;
          const currentWeight = exercise.seriesWeights[input.seriesIndex];
          const currentReps = exercise.seriesReps[input.seriesIndex];
          
          // Check if anything actually changed
          const completionChanged = wasCompleted !== input.completed;
          const weightChanged = input.weight !== undefined && currentWeight !== input.weight;
          const repsChanged = input.reps !== undefined && currentReps !== input.reps;
          
          if (!completionChanged && !weightChanged && !repsChanged) {
            return { success: true, xpGained: 0, newXp: 0, unlockedAchievements: [] };
          }
          
          // Save weight and reps
          if (input.weight !== undefined) {
            exercise.seriesWeights[input.seriesIndex] = input.weight;
          }
          if (input.reps !== undefined) {
            exercise.seriesReps[input.seriesIndex] = input.reps;
          }
          
          exercise.seriesCompleted[input.seriesIndex] = input.completed;
          
          // Calcular XP: +10 por serie completada, -10 al desmarcar
          let xpGained = 0;
          if (completionChanged) {
            if (input.completed) {
              xpGained = 10;
              // Bonus si todas las series del ejercicio están completadas
              const totalSeries = exercise.sets || 3;
              const completedSeries = Object.values(exercise.seriesCompleted as Record<string, boolean>).filter(Boolean).length;
              if (completedSeries === totalSeries) xpGained += 25;
            } else {
              xpGained = -10;
            }
          }
          
          // Actualizar progreso del usuario
          let progress = await db.getUserProgress(ctx.user.id);
          if (!progress) {
            await db.createUserProgress(ctx.user.id);
            progress = await db.getUserProgress(ctx.user.id);
          }
          let newXp = progress ? (progress.totalXP || 0) : 0;
          if (progress && completionChanged) {
            newXp = Math.max(0, newXp + xpGained);
            await db.updateUserProgress(ctx.user.id, xpGained, input.completed ? 1 : -1);
          }
          
          // Guardar cambios en el plan
          const updatedPlan = JSON.stringify(generatedContent);
          await updateTrainingPlanContent(plan.id, updatedPlan);

          // --- CÁLCULO DE COMPLETADO DEL DÍA & RACHA ---
          let totalSeriesToday = 0;
          let completedSeriesToday = 0;
          for (const dEx of day.exercises || []) {
            totalSeriesToday += dEx.sets || 3;
            completedSeriesToday += Object.values(dEx.seriesCompleted || {}).filter(Boolean).length;
          }

          let checklist = await db.getTodayChecklist(ctx.user.id);
          if (!checklist) {
            // Si no existe checklist hoy, crearlo
            const dayName = DAYS_FULL[new Date().getDay()];
            await db.createDailyChecklist(ctx.user.id, plan.id, dayName, totalSeriesToday);
            checklist = await db.getTodayChecklist(ctx.user.id);
          }

          if (checklist) {
            const isDayCompletedNow = completedSeriesToday === totalSeriesToday;
            // Actualizar checklist
            const d = await db.getDb();
            if (d) {
              await d.update(dailyChecklists).set({
                completedSeries: completedSeriesToday,
                isCompleted: isDayCompletedNow ? 1 : 0,
                xpEarned: Math.max(0, (checklist.xpEarned || 0) + xpGained),
              }).where(eq(dailyChecklists.id, checklist.id));
            }

            // Si se acaba de completar el día, actualizamos racha
            if (isDayCompletedNow && checklist.isCompleted === 0) {
              if (progress) {
                let newStreak = progress.streak || 0;
                const todayStr = new Date().toISOString().split('T')[0];
                const lastWorkoutStr = progress.lastWorkoutDate ? new Date(progress.lastWorkoutDate).toISOString().split('T')[0] : null;

                if (lastWorkoutStr !== todayStr) {
                  if (!lastWorkoutStr) {
                    newStreak = 1;
                  } else {
                    const lastDate = new Date(lastWorkoutStr);
                    const todayDate = new Date(todayStr);
                    const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    const frequency = plan.daysPerWeek || 3;
                    const maxAllowedGap = Math.ceil(7 / frequency) + 1;

                    if (diffDays <= maxAllowedGap) {
                      newStreak = (progress.streak || 0) + 1;
                    } else {
                      newStreak = 1;
                    }
                  }

                  // Guardar racha
                  if (d) {
                    await d.update(userProgress).set({
                      streak: newStreak,
                      lastWorkoutDate: new Date(),
                    }).where(eq(userProgress.userId, ctx.user.id));
                  }
                }
              }
            }
          }
          
          // Verificar logros
          const newlyUnlocked = await db.checkAndUnlockAchievements(ctx.user.id);

          return { 
            success: true, 
            xpGained, 
            newXp,
            unlockedAchievements: newlyUnlocked 
          };
        } catch (error) {
          console.error("[markSeriesComplete] Error:", error);
          throw error;
        }
      }),
    searchExerciseWithMedia: publicProcedure
      .input(z.object({
        name: z.string(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          const { getExerciseMediaUrl } = await import("./_core/musclewiki");
          const media = await getExerciseMediaUrl(input.name);
          return {
            success: true,
            media,
            exerciseName: input.name,
          };
        } catch (error) {
          console.error("[searchExerciseWithMedia] Error:", error);
          return {
            success: false,
            media: null,
            error: "Failed to search exercise media",
          };
        }
      }),

    getDailyProgress: protectedProcedure
      .input(z.object({
        trainingPlanId: z.number(),
        dayNumber: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Not authenticated");
        try {
          const plan = await db.getActiveTrainingPlan(ctx.user.id);
          if (!plan) return { exercises: [] };
          
          const generatedContent = JSON.parse(plan.generatedContent || "{}");
          const day = generatedContent.days?.[input.dayNumber - 1];
          if (!day) return { exercises: [] };
          
          return {
            dayNumber: input.dayNumber,
            focus: day.focus,
            exercises: (day.exercises || []).map((ex: any, idx: number) => ({
              index: idx,
              name: ex.name,
              sets: ex.sets || 3,
              reps: ex.reps,
              seriesCompleted: ex.seriesCompleted || {},
            })),
          };
        } catch (error) {
          console.error("[getDailyProgress] Error:", error);
          return { exercises: [] };
        }
      }),
      getChecklists: protectedProcedure.query(async ({ ctx }) => {
        if (!ctx.user) throw new Error("Not authenticated");
        try {
          const checklists = await db.getUserChecklists(ctx.user.id);
          return { success: true, checklists };
        } catch (error) {
          console.error("[getChecklists] Error:", error);
          return { success: false, checklists: [] };
        }
      }),
      getCompletedDates: protectedProcedure.query(async ({ ctx }) => {
        if (!ctx.user) throw new Error("Not authenticated");
        try {
          const completedDates = await db.getCompletedDates(ctx.user.id);
          return { dates: completedDates };
        } catch (error) {
          console.error("[getCompletedDates] Error:", error);
          return { dates: [] };
        }
      }),
      getDayDetails: protectedProcedure
        .input(z.object({ date: z.date() }))
        .query(async ({ ctx, input }) => {
          if (!ctx.user) throw new Error("Not authenticated");
          try {
            const dayDetails = await db.getDayDetails(ctx.user.id, input.date);
            if (!dayDetails) return { checklist: null, exercises: [], duration: 0 };
            const plan = JSON.parse(dayDetails.plan.generatedContent || "{}");
            const dayOfWeek = input.date.toLocaleDateString('es-ES', { weekday: 'long' });
            const dayIndex = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].indexOf(dayOfWeek.toLowerCase());
            const dayPlan = plan.plan?.days?.[dayIndex] || { exercises: [] };
            return { checklist: dayDetails.checklist, exercises: dayPlan.exercises || [], duration: dayPlan.duration || 0 };
          } catch (error) {
            console.error("[getDayDetails] Error:", error);
            return { checklist: null, exercises: [], duration: 0 };
          }
        }),

      getDashboardData: protectedProcedure.query(async ({ ctx }) => {
        if (!ctx.user) throw new Error("Not authenticated");
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");

          const allChecklists = await db.getUserChecklists(ctx.user.id);

          // Weekly chart: workouts per day-of-week for the current week (Mon-Sun)
          const now = new Date();
          const dayOfWeek = now.getDay(); // 0=Sun,1=Mon...
          // Start of this week Monday
          const startOfWeek = new Date(now);
          startOfWeek.setHours(0, 0, 0, 0);
          startOfWeek.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);

          // Count completed workouts per weekday this week
          const weekCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
          for (const c of allChecklists) {
            if (c.isCompleted !== 1) continue;
            const d = new Date(c.date);
            if (d >= startOfWeek && d <= endOfWeek) {
              const wd = (d.getDay() + 6) % 7; // Mon=0...Sun=6
              weekCounts[wd] = (weekCounts[wd] || 0) + 1;
            }
          }
          const weeklyChart = [
            { day: "Lun", count: weekCounts[0] },
            { day: "Mar", count: weekCounts[1] },
            { day: "Mié", count: weekCounts[2] },
            { day: "Jue", count: weekCounts[3] },
            { day: "Vie", count: weekCounts[4] },
            { day: "Sáb", count: weekCounts[5] },
            { day: "Dom", count: weekCounts[6] },
          ];

          // Recent workouts: last 3 completed checklists
          const completed = allChecklists
            .filter((c: any) => c.isCompleted === 1)
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 3);

          const plan = await db.getActiveTrainingPlan(ctx.user.id);
          let planContent: any = null;
          if (plan?.generatedContent) {
            try { planContent = JSON.parse(plan.generatedContent); } catch {}
          }

          const recentWorkouts = completed.map((c: any, i: number) => {
            const daysAgo = Math.floor((now.getTime() - new Date(c.date).getTime()) / (1000 * 60 * 60 * 24));
            const dayLabel = daysAgo === 0 ? "Hoy" : daysAgo === 1 ? "Ayer" : `Hace ${daysAgo} días`;
            const dayIndex = (new Date(c.date).getDay() + 6) % 7;
            const dayPlan = planContent?.days?.[dayIndex];
            const focus = dayPlan?.focus || "Entrenamiento completo";
            return {
              id: c.id,
              name: focus,
              type: plan?.type === "strength" ? "Rutina de fuerza" : "Rutina de hipertrofia",
              date: dayLabel,
              completedSeries: c.completedSeries,
              totalSeries: c.totalSeries,
              xpEarned: c.xpEarned || 0,
            };
          });

          // Activity feed: up to 3 milestone items
          const progress = await db.getUserProgress(ctx.user.id);
          const totalWorkouts = allChecklists.filter((c: any) => c.isCompleted === 1).length;
          const activityItems: { icon: string; title: string; description: string; time: string }[] = [];

          if (progress) {
            if (progress.streak && progress.streak >= 3) {
              activityItems.push({ icon: "flame", title: `¡Racha de ${progress.streak} días!`, description: "Seguís entrenando sin parar", time: "Hoy" });
            }
            if (progress.level && progress.level > 1) {
              activityItems.push({ icon: "trophy", title: `Nivel ${progress.level} alcanzado`, description: `Lograste ${progress.totalXP} XP en total`, time: "Reciente" });
            }
          }
          if (totalWorkouts >= 1) {
            activityItems.push({ icon: "dumbbell", title: `${totalWorkouts} entrenamiento${totalWorkouts > 1 ? "s" : ""} completado${totalWorkouts > 1 ? "s" : ""}`, description: "Seguís construyendo tu mejor versión", time: "Reciente" });
          }
          if (plan) {
            activityItems.push({ icon: "zap", title: "Plan activo", description: `Rutina de ${plan.daysPerWeek} días por semana en curso`, time: "Activo" });
          }
          // Default items if not enough
          if (activityItems.length === 0) {
            activityItems.push({ icon: "star", title: "¡Bienvenido a FerFit!", description: "Comenzá tu viaje fitness", time: "Hoy" });
            activityItems.push({ icon: "user", title: "Perfil creado", description: "Configuración inicial completada", time: "Hoy" });
            activityItems.push({ icon: "target", title: "Objetivo establecido", description: "Definí tu objetivo principal", time: "Hoy" });
          }

          return {
            weeklyChart,
            recentWorkouts,
            activityFeed: activityItems.slice(0, 3),
          };
        } catch (error) {
          console.error("[getDashboardData] Error:", error);
          return { weeklyChart: [], recentWorkouts: [], activityFeed: [] };
        }
      }),

      getAITips: protectedProcedure.query(async ({ ctx }) => {
        if (!ctx.user) throw new Error("Not authenticated");
        try {
          const progress = await db.getUserProgress(ctx.user.id);
          const allChecklists = await db.getUserChecklists(ctx.user.id);
          const plan = await db.getActiveTrainingPlan(ctx.user.id);
          const totalWorkouts = allChecklists.filter((c: any) => c.isCompleted === 1).length;

          let planContent: any = null;
          if (plan?.generatedContent) {
            try { planContent = JSON.parse(plan.generatedContent); } catch {}
          }

          const userContext = `
El usuario tiene los siguientes datos:
- XP Total: ${progress?.totalXP || 0}
- Nivel: ${progress?.level || 1}
- Racha actual: ${progress?.streak || 0} días consecutivos
- Total de entrenamientos completados: ${totalWorkouts}
- Series completadas históricamente: ${progress?.seriesCompletedHistorically || 0}
- Tiene plan activo: ${plan ? "Sí" : "No"}
- Días por semana entrenados: ${plan?.daysPerWeek || 0}
- Objetivo: ${planContent?.objective || "no especificado"}
`;

          const prompt = `Eres un entrenador personal experto y nutricionista. Basándote en el perfil del usuario, generá exactamente 3 consejos personalizados, concisos y motivadores.

${userContext}

Devolvé SOLO un JSON válido con este formato exacto, sin texto adicional:
{
  "tips": [
    { "icon": "droplets", "title": "Título corto", "description": "Descripción de 1-2 oraciones" },
    { "icon": "moon", "title": "Título corto", "description": "Descripción de 1-2 oraciones" },
    { "icon": "zap", "title": "Título corto", "description": "Descripción de 1-2 oraciones" }
  ]
}

Los iconos disponibles son: droplets, moon, zap, flame, apple, heart, activity, trophy, target, dumbbell, star, shield.
Personalizá los consejos según el nivel y comportamiento real del usuario.`;

          const result = await invokeLLM({
            messages: [
              { role: "system", content: "Eres un entrenador personal experto. Responde SOLO con JSON válido, sin markdown ni texto adicional." },
              { role: "user", content: prompt },
            ],
          });
          const content = result.choices[0]?.message.content;
          const rawText = typeof content === "string" ? content : JSON.stringify(content);
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.tips && Array.isArray(parsed.tips)) {
              return { tips: parsed.tips };
            }
          }
          // Fallback tips
          return {
            tips: [
              { icon: "droplets", title: "Hidratate", description: "Recordá tomar al menos 2L de agua al día para optimizar tu rendimiento." },
              { icon: "moon", title: "Descansá bien", description: "Dormí 7-8 horas para una mejor recuperación muscular." },
              { icon: "zap", title: "Constancia es clave", description: "La clave está en la consistencia diaria, no en la intensidad puntual." },
            ],
          };
        } catch (error) {
          console.error("[getAITips] Error:", error);
          return {
            tips: [
              { icon: "droplets", title: "Hidratate", description: "Recordá tomar al menos 2L de agua al día." },
              { icon: "moon", title: "Descansá bien", description: "Dormí 7-8 horas para mejor recuperación." },
              { icon: "zap", title: "Constancia es clave", description: "La clave está en la consistencia diaria." },
            ],
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

/* ─── HELPERS ────────────────────────────────────────────── */

function calculateTDEE(age: number, weight: number, height: number, daysPerWeek: number): number {
  const bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  const activityMultipliers: Record<number, number> = { 2: 1.375, 3: 1.375, 4: 1.55, 5: 1.725, 6: 1.725 };
  return Math.round(bmr * (activityMultipliers[daysPerWeek] || 1.55));
}

function calculateMacros(objective: string, weight: number, tdee: number) {
  let calories = tdee;
  if (objective === "hypertrophy") calories = tdee + 300;
  else if (objective === "fat_loss") calories = tdee - 400;
  else if (objective === "recomposition") calories = tdee;
  const protein = Math.round(weight * 2.2);
  const fats = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fats * 9) / 4);
  return { protein, carbs, fats };
}

const EQUIPMENT_MAP: Record<string, string> = {
  full_gym: "gimnasio completo con máquinas, barras, mancuernas y poleas",
  dumbbells: "solo mancuernas (sin máquinas ni barras)",
  bodyweight: "solo peso corporal, sin equipamiento",
  limited: "equipo limitado (bandas elásticas, mancuernas ligeras)",
};

const OBJECTIVE_MAP: Record<string, string> = {
  hypertrophy: "hipertrofia muscular (ganar músculo)",
  strength: "fuerza máxima (sentadilla, press, peso muerto)",
  fat_loss: "pérdida de grasa (déficit calórico, cardio incluido)",
  recomposition: "recomposición corporal (ganar músculo y perder grasa simultáneamente)",
};

const LEVEL_MAP: Record<string, string> = {
  beginner: "principiante (menos de 1 año entrenando, ejercicios básicos, bajo volumen)",
  intermediate: "intermedio (1-3 años, puede usar técnicas avanzadas moderadas)",
  advanced: "avanzado (más de 3 años, puede usar periodización compleja)",
};

function validateGeneratedPlan(plan: any, input: any) {
  const injuries = (input.injuries || "").toLowerCase();
  const equipment = input.equipment || "full_gym";

  const hasLegInjury = ["rodilla", "tobillo", "pie", "cadera", "pierna", "knee", "ankle", "foot", "hip", "leg"].some(term => injuries.includes(term));
  const hasShoulderInjury = ["hombro", "muñeca", "codo", "brazo", "shoulder", "wrist", "elbow", "arm"].some(term => injuries.includes(term));
  const hasBackInjury = ["espalda", "lumbar", "columna", "back", "spine"].some(term => injuries.includes(term));

  const BODYWEIGHT_REPLACEMENTS: Record<string, { name: string; notes?: string }> = {
    "bench press": { name: "Push-up", notes: "Versión peso corporal" },
    "dumbbell press": { name: "Push-up", notes: "Versión peso corporal" },
    "dumbbell bench press": { name: "Push-up", notes: "Versión peso corporal" },
    "barbell squat": { name: "Bodyweight Squat", notes: "Sentadilla con peso corporal" },
    "goblet squat": { name: "Bodyweight Squat", notes: "Sentadilla con peso corporal" },
    "dumbbell goblet squat": { name: "Bodyweight Squat", notes: "Sentadilla con peso corporal" },
    "leg press": { name: "Air Squat", notes: "Sentadilla con peso corporal" },
    "overhead press": { name: "Pike Push-up", notes: "Flexiones en pica" },
    "dumbbell overhead press": { name: "Pike Push-up", notes: "Flexiones en pica" },
    "dumbbell shoulder press": { name: "Pike Push-up", notes: "Flexiones en pica" },
    "bent over rows": { name: "Inverted Row", notes: "Usa una mesa o baranda" },
    "dumbbell row": { name: "Inverted Row", notes: "Usa una mesa o baranda" },
    "lat pulldown": { name: "Pull-up", notes: "Si no tienes barra de dominadas, haz Inverted Row" },
    "cable flyes": { name: "Push-up", notes: "Enfoque en contracción de pecho" },
    "rope pushdown": { name: "Bench Dips", notes: "Fondos en banco o silla" },
    "tricep dips": { name: "Bench Dips", notes: "Fondos en banco o silla" },
    "barbell curls": { name: "Chin-up", notes: "Dominadas con agarre supino" },
    "dumbbell curls": { name: "Chin-up", notes: "Dominadas con agarre supino" },
    "hammer curls": { name: "Chin-up", notes: "Dominadas con agarre supino" },
    "barbell deadlift": { name: "Single-leg Glute Bridge", notes: "Puente de glúteo a una pierna" },
    "dumbbell deadlift": { name: "Single-leg Glute Bridge", notes: "Puente de glúteo a una pierna" },
    "romanian deadlift": { name: "Single-leg Romanian Deadlift (Bodyweight)", notes: "Peso muerto rumano sin peso" },
    "dumbbell romanian deadlift": { name: "Single-leg Romanian Deadlift (Bodyweight)", notes: "Peso muerto rumano sin peso" },
    "lying leg curl": { name: "Glute Bridge", notes: "Puente de glúteo" },
    "leg curl": { name: "Glute Bridge", notes: "Puente de glúteo" },
    "leg extensions": { name: "Bodyweight Squat", notes: "Sentadilla con peso corporal" },
    "incline dumbbell press": { name: "Decline Push-up", notes: "Flexión declinada (pies elevados)" },
    "lateral raise": { name: "Arm Circles", notes: "Círculos con brazos estirados" },
    "dumbbell lateral raise": { name: "Arm Circles", notes: "Círculos con brazos estirados" }
  };

  const DUMBBELL_REPLACEMENTS: Record<string, { name: string; notes?: string }> = {
    "bench press": { name: "Dumbbell Bench Press", notes: "Versión con mancuernas" },
    "barbell squat": { name: "Dumbbell Goblet Squat", notes: "Sentadilla Goblet con mancuerna" },
    "barbell deadlift": { name: "Dumbbell Deadlift", notes: "Peso muerto con mancuernas" },
    "bent over rows": { name: "Dumbbell Row", notes: "Remo con mancuernas" },
    "lat pulldown": { name: "Dumbbell Row", notes: "Remo con mancuernas" },
    "overhead press": { name: "Dumbbell Shoulder Press", notes: "Prensa militar con mancuernas" },
    "tricep dips": { name: "Dumbbell Kickbacks", notes: "Patada de tríceps con mancuerna" },
    "cable flyes": { name: "Dumbbell Flyes", notes: "Aperturas con mancuernas" },
    "barbell curls": { name: "Dumbbell Curl", notes: "Curl de bíceps con mancuernas" }
  };

  const LOWER_BODY_EXERCISES = [
    "squat", "lunge", "deadlift", "leg press", "leg curl", "leg extension", "calf raise", "step-up", "thruster", "calf"
  ];
  const PRESSING_EXERCISES = [
    "bench press", "overhead press", "shoulder press", "push-up", "dips", "handstand", "pike push-up"
  ];

  const CORE_REPLACEMENTS = [
    { name: "Plank", muscleGroup: "Core", sets: 3, reps: "30-60s", restSeconds: 60, notes: "Activa el core", technique: "Cuerpo recto", alternatives: ["Side Plank"] },
    { name: "Dead Bug", muscleGroup: "Core", sets: 3, reps: "12 por lado", restSeconds: 45, notes: "Lento y controlado", technique: "Espalda plana", alternatives: ["Bird Dog"] },
    { name: "Bird Dog", muscleGroup: "Core", sets: 3, reps: "12 por lado", restSeconds: 45, notes: "Estabilidad lumbar", technique: "Sin balanceo", alternatives: ["Dead Bug"] },
    { name: "Abdominal Crunch", muscleGroup: "Abdomen", sets: 3, reps: "15-20", restSeconds: 45, notes: "Tensión en abdomen", technique: "No tires del cuello", alternatives: ["Russian Twists"] }
  ];

  const SHOULDER_REPLACEMENTS = [
    { name: "Plank", muscleGroup: "Core", sets: 3, reps: "30-60s", restSeconds: 60, notes: "Apóyate en antebrazos", technique: "Core activo", alternatives: ["Dead Bug"] },
    { name: "Abdominal Crunch", muscleGroup: "Abdomen", sets: 3, reps: "15-20", restSeconds: 45, notes: "Lento y controlado", technique: "Fuerza en abdomen", alternatives: ["Russian Twists"] },
    { name: "Lying Leg Raise", muscleGroup: "Abdomen", sets: 3, reps: "12-15", restSeconds: 60, notes: "Espalda apoyada", technique: "Controla bajada", alternatives: ["Plank"] }
  ];

  let coreIdx = 0;
  let shoulderIdx = 0;

  for (const day of plan.days || []) {
    day.exercises = (day.exercises || []).map((exercise: any) => {
      let nameLower = (exercise.name || "").toLowerCase().trim();

      // 1. Reemplazo de equipamiento
      if (equipment === "bodyweight" || equipment === "limited") {
        if (BODYWEIGHT_REPLACEMENTS[nameLower]) {
          const repl = BODYWEIGHT_REPLACEMENTS[nameLower];
          exercise.name = repl.name;
          exercise.notes = (exercise.notes || "") + ` (${repl.notes})`;
          nameLower = repl.name.toLowerCase();
        }
      } else if (equipment === "dumbbells") {
        if (DUMBBELL_REPLACEMENTS[nameLower]) {
          const repl = DUMBBELL_REPLACEMENTS[nameLower];
          exercise.name = repl.name;
          exercise.notes = (exercise.notes || "") + ` (${repl.notes})`;
          nameLower = repl.name.toLowerCase();
        }
      }

      // 2. Reemplazo por lesiones
      if (hasLegInjury && LOWER_BODY_EXERCISES.some(term => nameLower.includes(term))) {
        const repl = CORE_REPLACEMENTS[coreIdx % CORE_REPLACEMENTS.length];
        coreIdx++;
        exercise.name = repl.name;
        exercise.muscleGroup = repl.muscleGroup;
        exercise.sets = repl.sets;
        exercise.reps = repl.reps;
        if (repl.restSeconds) exercise.restSeconds = repl.restSeconds;
        exercise.notes = (exercise.notes || "") + " (Reemplazado por lesión en el miembro inferior)";
        exercise.technique = repl.technique;
        exercise.alternatives = repl.alternatives;
      } else if (hasShoulderInjury && PRESSING_EXERCISES.some(term => nameLower.includes(term))) {
        const repl = SHOULDER_REPLACEMENTS[shoulderIdx % SHOULDER_REPLACEMENTS.length];
        shoulderIdx++;
        exercise.name = repl.name;
        exercise.muscleGroup = repl.muscleGroup;
        exercise.sets = repl.sets;
        exercise.reps = repl.reps;
        if (repl.restSeconds) exercise.restSeconds = repl.restSeconds;
        exercise.notes = (exercise.notes || "") + " (Reemplazado por dolor/lesión de hombro o brazo)";
        exercise.technique = repl.technique;
        exercise.alternatives = repl.alternatives;
      }

      return exercise;
    });
  }

  return plan;
}

async function generatePersonalizedPlanWithNutrition(input: {
  objective: string;
  experienceLevel: string;
  age: number;
  weight: number;
  height: number;
  daysPerWeek: number;
  equipment: string;
  injuries?: string;
  preferences?: string;
}) {
  try {
    const imc = (input.weight / ((input.height / 100) ** 2)).toFixed(1);
    const tdee = calculateTDEE(input.age, input.weight, input.height, input.daysPerWeek);
    const macros = calculateMacros(input.objective, input.weight, tdee);
    const equipmentDesc = EQUIPMENT_MAP[input.equipment] || input.equipment;
    const objectiveDesc = OBJECTIVE_MAP[input.objective] || input.objective;
    const levelDesc = LEVEL_MAP[input.experienceLevel] || input.experienceLevel;

    const prompt = `Eres un Personal Trainer y Nutricionista experto. Genera un plan de entrenamiento y nutrición COMPLETAMENTE PERSONALIZADO en JSON.

PERFIL DEL CLIENTE:
- Objetivo: ${objectiveDesc}
- Nivel: ${levelDesc}
- Edad: ${input.age} años | Peso: ${input.weight}kg | Altura: ${input.height}cm | IMC: ${imc}
- Días de entrenamiento: ${input.daysPerWeek} días/semana
- Equipo disponible: ${equipmentDesc}
- Lesiones/limitaciones: ${input.injuries || "Ninguna"}
- Preferencias: ${input.preferences || "Sin preferencias específicas"}
- TDEE calculado: ${tdee} kcal/día

REGLAS CRÍTICAS:
1. La rutina DEBE estar ESTRICTAMENTE adaptada al perfil del cliente detallado arriba (lesiones, equipo, días, etc.).
2. Los ejercicios DEBEN ser compatibles con el equipo disponible (${equipmentDesc})
3. El volumen y complejidad DEBE corresponder al nivel ${input.experienceLevel}
4. Si hay lesiones, EVITAR ejercicios que las agraven
5. El objetivo condiciona la selección de ejercicios, series, reps y descansos
6. Para principiantes: ejercicios compuestos básicos, 3 series, 10-15 reps
7. Para avanzados: técnicas como drop sets, supersets, mayor volumen
8. Usa nombres de ejercicios en INGLÉS (para búsqueda en API de ejercicios)
9. DEBES incluir 'instructions' (instrucciones detalladas paso a paso en español) y 'tips' (consejos útiles en español) para CADA ejercicio.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown):
{
  "summary": "descripción del plan",
  "objective": "${input.objective}",
  "durationWeeks": 12,
  "daysPerWeek": ${input.daysPerWeek},
  "progressionStrategy": "estrategia de progresión específica",
  "days": [
    {
      "dayNumber": 1,
      "focus": "Chest and Triceps",
      "warmup": "descripción del calentamiento",
      "exercises": [
        {
          "name": "Bench Press",
          "muscleGroup": "Chest",
          "sets": 4,
          "reps": "8-10",
          "restSeconds": 90,
          "instructions": "1. Acuéstate en el banco... 2. Baja la barra hasta el pecho...",
          "tips": "Mantén los codos a 45 grados y el abdomen contraído.",
          "alternatives": ["Dumbbell Press", "Push-up"]
        }
      ],
      "cooldown": "descripción del enfriamiento",
      "notes": "notas del día"
    }
  ],
  "nutrition": {
    "dailyCalories": ${macros.protein * 4 + macros.carbs * 4 + macros.fats * 9},
    "dailyMacros": { "protein": ${macros.protein}, "carbs": ${macros.carbs}, "fats": ${macros.fats} },
    "mealFrequency": 5,
    "meals": [
      { "mealNumber": 1, "time": "08:00", "name": "Desayuno", "foods": ["Huevos", "Avena"], "macros": {"protein": 30, "carbs": 50, "fats": 15}, "calories": 450, "notes": "tip" }
    ],
    "tips": ["tip1", "tip2", "tip3"],
    "hydration": "recomendación de hidratación",
    "supplementation": "suplementos recomendados según objetivo",
    "notes": "notas nutricionales"
  },
  "generalAdvice": "consejos generales personalizados"
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Eres un experto en fitness y nutrición. Responde SOLO con JSON válido. Sin markdown, sin texto adicional." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message.content;
    if (!content) return generateBasicPlan(input, tdee, macros);

    let jsonString = typeof content === "string" ? content : JSON.stringify(content);
    if (jsonString.includes("```json")) jsonString = jsonString.split("```json")[1]?.split("```")[0] || jsonString;
    else if (jsonString.includes("```")) jsonString = jsonString.split("```")[1]?.split("```")[0] || jsonString;

    const parsed = JSON.parse(jsonString.trim());
    const validatedPlan = validateGeneratedPlan(parsed, input);
    
    // Enrich with media URLs
    const { getExerciseMediaUrl } = await import("./_core/musclewiki");
    for (const day of validatedPlan.days || []) {
      for (const ex of day.exercises || []) {
        if (ex.name) {
          const media = await getExerciseMediaUrl(ex.name);
          console.log("Ejercicio:", ex.name);

          console.log("Media:", media);
           console.log("Resultado:", media);
          

          if (media) {
            ex.gifUrl = media.url;
          }
        }
      }
    }

    console.log("[LLM] Plan generated and enriched with media successfully");
    return validatedPlan;
    
  } catch (error) {
    console.error("[LLM] Error:", error instanceof Error ? error.message : String(error));
    const tdee = calculateTDEE(input.age, input.weight, input.height, input.daysPerWeek);
    const macros = calculateMacros(input.objective, input.weight, tdee);
    return generateBasicPlan(input, tdee, macros);
  }
}

async function generateBasicPlan(input: any, tdee: number, macros: any) {
  const injuries = (input.injuries || "").toLowerCase().trim();

  const hasLegInjury = ["rodilla", "tobillo", "pie", "cadera", "pierna", "knee", "ankle", "foot", "hip", "leg"].some(term => injuries.includes(term));
  const hasShoulderInjury = ["hombro", "muñeca", "codo", "brazo", "shoulder", "wrist", "elbow", "arm"].some(term => injuries.includes(term));
  const hasBackInjury = ["espalda", "lumbar", "columna", "back", "spine"].some(term => injuries.includes(term));

  const equip = input.equipment || "full_gym";

  // Pools of exercises based on equipment
  let chestTriceps: any[] = [];
  let backBiceps: any[] = [];
  let legs: any[] = [];
  let shouldersAbs: any[] = [];
  let fullBody: any[] = [];

  if (equip === "bodyweight" || equip === "limited") {
    // BODYWEIGHT
    chestTriceps = [
      { name: "Push-up", muscleGroup: "Pecho", sets: 3, reps: "10-15", restSeconds: 60, notes: "Mantén el cuerpo alineado", technique: "Apoya rodillas si es necesario", alternatives: ["Knee Push-up", "Decline Push-up"] },
      { name: "Bench Dips", muscleGroup: "Tríceps", sets: 3, reps: "12-15", restSeconds: 60, notes: "Usa una silla o banco", technique: "Baja controlado", alternatives: ["Push-up"] },
      { name: "Decline Push-up", muscleGroup: "Pecho superior", sets: 3, reps: "8-12", restSeconds: 60, notes: "Pies elevados", technique: "Controla la bajada", alternatives: ["Push-up"] },
      { name: "Diamond Push-up", muscleGroup: "Tríceps", sets: 3, reps: "8-12", restSeconds: 60, notes: "Manos juntas", technique: "Codos pegados al cuerpo", alternatives: ["Bench Dips"] }
    ];

    backBiceps = [
      { name: "Pull-up", muscleGroup: "Espalda", sets: 3, reps: "6-10", restSeconds: 90, notes: "Agarre prono", technique: "Codos hacia abajo", alternatives: ["Chin-up", "Inverted Row"] },
      { name: "Chin-up", muscleGroup: "Bíceps", sets: 3, reps: "6-10", restSeconds: 90, notes: "Agarre supino", technique: "Sube hasta pasar barbilla", alternatives: ["Pull-up", "Inverted Row"] },
      { name: "Inverted Row", muscleGroup: "Espalda media", sets: 3, reps: "10-12", restSeconds: 75, notes: "Usa una mesa o barra baja", technique: "Tira del pecho hacia la barra", alternatives: ["Pull-up"] },
      { name: "Superman", muscleGroup: "Espalda baja", sets: 3, reps: "12-15", restSeconds: 45, notes: "Acostado boca abajo", technique: "Eleva brazos y piernas", alternatives: ["Bird Dog"] }
    ];

    if (hasLegInjury) {
      legs = [
        { name: "Plank", muscleGroup: "Core", sets: 3, reps: "30-60s", restSeconds: 60, notes: "Cuerpo recto", technique: "Activa abdomen", alternatives: ["Side Plank"] },
        { name: "Bird Dog", muscleGroup: "Core", sets: 3, reps: "10-12 por lado", restSeconds: 45, notes: "Alterna brazo y pierna", technique: "Estabilidad total", alternatives: ["Dead Bug"] },
        { name: "Dead Bug", muscleGroup: "Core", sets: 3, reps: "10-12 por lado", restSeconds: 45, notes: "Espalda baja pegada al suelo", technique: "Movimiento lento", alternatives: ["Bird Dog"] },
        { name: "Abdominal Crunch", muscleGroup: "Abdomen", sets: 3, reps: "15-20", restSeconds: 45, notes: "Eleva escápulas", technique: "No tires del cuello", alternatives: ["Russian Twists"] }
      ];
    } else {
      legs = [
        { name: "Bodyweight Squat", muscleGroup: "Cuádriceps", sets: 3, reps: "15-20", restSeconds: 60, notes: "Rompe paralelo", technique: "Peso en talones", alternatives: ["Goblet Squat"] },
        { name: "Forward Lunge", muscleGroup: "Piernas", sets: 3, reps: "10-12 por lado", restSeconds: 60, notes: "Paso largo adelante", technique: "Mantén torso recto", alternatives: ["Step-up"] },
        { name: "Glute Bridge", muscleGroup: "Glúteos", sets: 3, reps: "15-20", restSeconds: 60, notes: "Empuja caderas arriba", technique: "Aprieta glúteos", alternatives: ["Single-leg Glute Bridge"] },
        { name: "Calf Raise", muscleGroup: "Gemelos", sets: 3, reps: "20-25", restSeconds: 45, notes: "De pie sobre el suelo", technique: "Extensión máxima", alternatives: ["Single-leg Calf Raise"] }
      ];
    }

    shouldersAbs = [
      hasShoulderInjury
        ? { name: "Arm Circles", muscleGroup: "Hombros", sets: 3, reps: "30-45s", restSeconds: 45, notes: "Círculos controlados", technique: "Mantén brazos rectos", alternatives: ["Superman"] }
        : { name: "Pike Push-up", muscleGroup: "Hombros", sets: 3, reps: "8-12", restSeconds: 75, notes: "Caderas elevadas", technique: "Cabeza hacia adelante", alternatives: ["Decline Push-up"] },
      { name: "Plank", muscleGroup: "Abdomen", sets: 3, reps: "45-60s", restSeconds: 60, notes: "Core firme", technique: "No caigas de cadera", alternatives: ["Side Plank"] },
      { name: "Lying Leg Raise", muscleGroup: "Abdomen", sets: 3, reps: "10-15", restSeconds: 60, notes: "Espalda apoyada", technique: "Baja controlado", alternatives: ["Abdominal Crunch"] }
    ];

    fullBody = [
      { name: "Push-up", muscleGroup: "Pecho", sets: 3, reps: "10-15", restSeconds: 60, notes: "Cuerpo recto", technique: "Codos a 45 grados", alternatives: ["Knee Push-up"] },
      { name: "Pull-up", muscleGroup: "Espalda", sets: 3, reps: "6-10", restSeconds: 90, notes: "Sube controlado", technique: "Codos abajo", alternatives: ["Inverted Row"] },
      hasLegInjury
        ? { name: "Plank", muscleGroup: "Core", sets: 3, reps: "45-60s", restSeconds: 60, notes: "Cuerpo firme", technique: "Activa core", alternatives: ["Dead Bug"] }
        : { name: "Bodyweight Squat", muscleGroup: "Piernas", sets: 3, reps: "15-20", restSeconds: 60, notes: "Peso en talones", technique: "Rompe paralelo", alternatives: ["Forward Lunge"] },
      { name: "Burpees", muscleGroup: "Cardio", sets: 3, reps: "8-12", restSeconds: 75, notes: "Ejercicio dinámico", technique: "Cae suave de rodillas", alternatives: ["Mountain Climbers"] }
    ];

  } else if (equip === "dumbbells") {
    // DUMBBELLS
    chestTriceps = [
      { name: "Dumbbell Bench Press", muscleGroup: "Pecho", sets: 3, reps: "10-12", restSeconds: 75, notes: "Acuéstese en banco plano", technique: "Empuja hacia arriba", alternatives: ["Dumbbell Flyes"] },
      { name: "Incline Dumbbell Press", muscleGroup: "Pecho superior", sets: 3, reps: "10-12", restSeconds: 75, notes: "Banco inclinado", technique: "Controla bajada", alternatives: ["Dumbbell Bench Press"] },
      { name: "Dumbbell Flyes", muscleGroup: "Pecho", sets: 3, reps: "12-15", restSeconds: 60, notes: "Movimiento de abrazo", technique: "Codos ligeramente doblados", alternatives: ["Dumbbell Bench Press"] },
      { name: "Dumbbell Kickbacks", muscleGroup: "Tríceps", sets: 3, reps: "12-15", restSeconds: 60, notes: "Codo alto e inmóvil", technique: "Extiende brazo atrás", alternatives: ["Overhead Dumbbell Extension"] }
    ];

    backBiceps = [
      { name: "Dumbbell Row", muscleGroup: "Espalda media", sets: 3, reps: "10-12", restSeconds: 75, notes: "Un brazo apoyado en banco", technique: "Lleva codo al techo", alternatives: ["Dumbbell Pullover"] },
      { name: "Dumbbell Curls", muscleGroup: "Bíceps", sets: 3, reps: "10-12", restSeconds: 60, notes: "Gira muñeca al subir", technique: "Sin balanceo del cuerpo", alternatives: ["Hammer Curls"] },
      { name: "Hammer Curls", muscleGroup: "Bíceps", sets: 3, reps: "10-12", restSeconds: 60, notes: "Agarre neutro (martillo)", technique: "Control total", alternatives: ["Dumbbell Curls"] },
      { name: "Dumbbell Pullover", muscleGroup: "Espalda/Pecho", sets: 3, reps: "12-15", restSeconds: 75, notes: "Acuéstese cruzado en banco", technique: "Estira dorsales", alternatives: ["Dumbbell Row"] }
    ];

    if (hasLegInjury) {
      legs = [
        { name: "Weighted Plank", muscleGroup: "Core", sets: 3, reps: "30-60s", restSeconds: 60, notes: "Disco o mancuerna ligera en espalda", technique: "Core muy firme", alternatives: ["Plank"] },
        { name: "Dumbbell Russian Twists", muscleGroup: "Core", sets: 3, reps: "12-15 por lado", restSeconds: 45, notes: "Sostén mancuerna frente a ti", technique: "Gira torso controlado", alternatives: ["Abdominal Crunch"] },
        { name: "Dead Bug", muscleGroup: "Core", sets: 3, reps: "10-12 por lado", restSeconds: 45, notes: "Espalda pegada al suelo", technique: "Control lento", alternatives: ["Bird Dog"] },
        { name: "Dumbbell Seated Calf Raise", muscleGroup: "Gemelos", sets: 3, reps: "15-20", restSeconds: 45, notes: "Sentado, mancuernas en rodillas", technique: "Sube talones", alternatives: ["Calf Raise"] }
      ];
    } else {
      legs = [
        { name: "Dumbbell Goblet Squat", muscleGroup: "Cuádriceps", sets: 3, reps: "12-15", restSeconds: 75, notes: "Sostén mancuerna en el pecho", technique: "Mantén pecho elevado", alternatives: ["Dumbbell Romanian Deadlift"] },
        { name: "Dumbbell Romanian Deadlift", muscleGroup: "Isquiotibiales", sets: 3, reps: "10-12", restSeconds: 90, notes: "Mancuernas pegadas a las piernas", technique: "Lleva cadera atrás", alternatives: ["Dumbbell Goblet Squat"] },
        { name: "Dumbbell Lunges", muscleGroup: "Piernas", sets: 3, reps: "10-12 por lado", restSeconds: 75, notes: "Mancuernas a los lados", technique: "Baja rodilla trasera", alternatives: ["Dumbbell Step-up"] },
        { name: "Dumbbell Calf Raise", muscleGroup: "Gemelos", sets: 3, reps: "15-20", restSeconds: 45, notes: "Mancuernas en manos", technique: "Sube talones máximo", alternatives: ["Calf Raise"] }
      ];
    }

    shouldersAbs = [
      hasShoulderInjury
        ? { name: "Dumbbell Lateral Raise", muscleGroup: "Hombros", sets: 3, reps: "12-15", restSeconds: 60, notes: "Peso ligero", technique: "Sube hasta altura de hombros", alternatives: ["Dumbbell Rear Delt Fly"] }
        : { name: "Dumbbell Shoulder Press", muscleGroup: "Hombros", sets: 3, reps: "10-12", restSeconds: 75, notes: "Sentado con soporte", technique: "Empuja sobre cabeza", alternatives: ["Dumbbell Lateral Raise"] },
      { name: "Dumbbell Lateral Raise", muscleGroup: "Hombros", sets: 3, reps: "12-15", restSeconds: 60, notes: "Codos ligeramente doblados", technique: "Eleva lateralmente", alternatives: ["Dumbbell Rear Delt Fly"] },
      { name: "Lying Leg Raise", muscleGroup: "Abdomen", sets: 3, reps: "12-15", restSeconds: 60, notes: "Baja piernas lento", technique: "Evita arquear espalda", alternatives: ["Abdominal Crunch"] }
    ];

    fullBody = [
      { name: "Dumbbell Bench Press", muscleGroup: "Pecho", sets: 3, reps: "10-12", restSeconds: 75, notes: "Mancuernas paralelas", technique: "Controla empuje", alternatives: ["Dumbbell Row"] },
      { name: "Dumbbell Row", muscleGroup: "Espalda", sets: 3, reps: "10-12", restSeconds: 75, notes: "Espalda recta", technique: "Codo arriba", alternatives: ["Dumbbell Bench Press"] },
      hasLegInjury
        ? { name: "Dumbbell Russian Twists", muscleGroup: "Core", sets: 3, reps: "12-15 por lado", restSeconds: 60, notes: "Controla giro", technique: "Gira torso", alternatives: ["Plank"] }
        : { name: "Dumbbell Goblet Squat", muscleGroup: "Piernas", sets: 3, reps: "12-15", restSeconds: 75, notes: "Sostén firme", technique: "Espalda recta", alternatives: ["Dumbbell Romanian Deadlift"] },
      hasShoulderInjury
        ? { name: "Dumbbell Rear Delt Fly", muscleGroup: "Hombros", sets: 3, reps: "12-15", restSeconds: 60, notes: "Peso ligero", technique: "Inclina torso adelante", alternatives: ["Dumbbell Lateral Raise"] }
        : { name: "Dumbbell Shoulder Press", muscleGroup: "Hombros", sets: 3, reps: "10-12", restSeconds: 75, notes: "Core firme", technique: "Presiona vertical", alternatives: ["Dumbbell Lateral Raise"] }
    ];

  } else {
    // FULL GYM
    chestTriceps = [
      { name: "Bench Press", muscleGroup: "Pecho", sets: 4, reps: "8-10", restSeconds: 90, notes: "Barra recta", technique: "Codos a 45°", alternatives: ["Dumbbell Press"] },
      { name: "Incline Dumbbell Press", muscleGroup: "Pecho superior", sets: 3, reps: "10-12", restSeconds: 75, notes: "Banco a 30-45°", technique: "Control total", alternatives: ["Smith Machine Incline"] },
      { name: "Cable Flyes", muscleGroup: "Pecho", sets: 3, reps: "12-15", restSeconds: 60, notes: "Movimiento de abrazo", technique: "Contracción máxima", alternatives: ["Pec Deck"] },
      { name: "Tricep Dips", muscleGroup: "Tríceps", sets: 3, reps: "8-12", restSeconds: 75, notes: "Máquina o peso corporal", technique: "Baja hasta 90°", alternatives: ["Rope Pushdown"] },
      { name: "Rope Pushdown", muscleGroup: "Tríceps", sets: 3, reps: "12-15", restSeconds: 60, notes: "Polea alta", technique: "Extensión completa", alternatives: ["V-bar Pushdown"] }
    ];

    backBiceps = [
      hasBackInjury
        ? { name: "Chest Supported Row", muscleGroup: "Espalda media", sets: 4, reps: "10-12", restSeconds: 90, notes: "Pecho apoyado", technique: "Evita tensión lumbar", alternatives: ["Lat Pulldown"] }
        : { name: "Barbell Deadlift", muscleGroup: "Espalda baja", sets: 4, reps: "6-8", restSeconds: 120, notes: "Espalda neutral", technique: "Cadera atrás", alternatives: ["Trap Bar Deadlift"] },
      hasBackInjury
        ? { name: "Lat Pulldown", muscleGroup: "Dorsales", sets: 4, reps: "10-12", restSeconds: 75, notes: "Controla subida", technique: "Codos abajo", alternatives: ["Pull-ups"] }
        : { name: "Bent Over Rows", muscleGroup: "Espalda media", sets: 4, reps: "8-10", restSeconds: 90, notes: "Barra recta", technique: "Codo atrás", alternatives: ["Dumbbell Rows"] },
      { name: "Lat Pulldown", muscleGroup: "Dorsales", sets: 3, reps: "10-12", restSeconds: 75, notes: "Agarre ancho", technique: "Codo abajo", alternatives: ["Pull-ups"] },
      { name: "Barbell Curls", muscleGroup: "Bíceps", sets: 3, reps: "8-10", restSeconds: 75, notes: "Barra recta", technique: "Sin impulso", alternatives: ["Dumbbell Curls"] },
      { name: "Hammer Curls", muscleGroup: "Bíceps", sets: 3, reps: "10-12", restSeconds: 60, notes: "Agarre neutro", technique: "Control total", alternatives: ["Machine Curls"] }
    ];

    if (hasLegInjury) {
      legs = [
        { name: "Plank", muscleGroup: "Core", sets: 3, reps: "30-60s", restSeconds: 60, notes: "Cuerpo recto", technique: "Activa abdomen", alternatives: ["Side Plank"] },
        { name: "Bird Dog", muscleGroup: "Core", sets: 3, reps: "10-12 por lado", restSeconds: 45, notes: "Alterna brazo y pierna", technique: "Estabilidad total", alternatives: ["Dead Bug"] },
        { name: "Dead Bug", muscleGroup: "Core", sets: 3, reps: "10-12 por lado", restSeconds: 45, notes: "Espalda baja pegada al suelo", technique: "Movimiento lento", alternatives: ["Bird Dog"] },
        { name: "Seated Calf Raise", muscleGroup: "Gemelos", sets: 3, reps: "15-20", restSeconds: 45, notes: "Máquina de gemelos sentado", technique: "Sube talones", alternatives: ["Calf Raise"] }
      ];
    } else {
      legs = [
        hasBackInjury 
          ? { name: "Leg Press", muscleGroup: "Cuádriceps", sets: 4, reps: "10-12", restSeconds: 90, notes: "Menos tensión lumbar", technique: "No bloquees rodillas", alternatives: ["Goblet Squat"] }
          : { name: "Barbell Squat", muscleGroup: "Cuádriceps", sets: 4, reps: "8-10", restSeconds: 120, notes: "Profundidad paralela", technique: "Rodillas hacia afuera", alternatives: ["Goblet Squat"] },
        hasBackInjury
          ? { name: "Leg Curl", muscleGroup: "Isquiotibiales", sets: 3, reps: "12-15", restSeconds: 75, notes: "Máquina acostado", technique: "Controla movimiento", alternatives: ["Romanian Deadlift"] }
          : { name: "Romanian Deadlift", muscleGroup: "Isquiotibiales", sets: 3, reps: "10-12", restSeconds: 90, notes: "Espalda recta", technique: "Empuja caderas hacia atrás", alternatives: ["Leg Curl"] },
        { name: "Hip Thrust", muscleGroup: "Glúteos", sets: 3, reps: "10-12", restSeconds: 75, notes: "Espalda en banco", technique: "Empuja caderas arriba", alternatives: ["Glute Bridge"] },
        { name: "Leg Press", muscleGroup: "Cuádriceps", sets: 3, reps: "12-15", restSeconds: 75, notes: "Pies a ancho de hombros", technique: "No bloquees rodillas", alternatives: ["Hack Squat"] }
      ];
    }

    shouldersAbs = [
      hasShoulderInjury
        ? { name: "Lateral Raise", muscleGroup: "Hombros", sets: 3, reps: "12-15", restSeconds: 60, notes: "Codos flexionados", technique: "Eleva lateralmente", alternatives: ["Cable Lateral Raise"] }
        : { name: "Overhead Press", muscleGroup: "Hombros", sets: 3, reps: "8-10", restSeconds: 90, notes: "De pie", technique: "Core activado", alternatives: ["Dumbbell Press"] },
      { name: "Lateral Raise", muscleGroup: "Hombros laterales", sets: 3, reps: "12-15", restSeconds: 60, notes: "Codos flexionados", technique: "Eleva hasta altura de hombro", alternatives: ["Cable Lateral Raise"] },
      { name: "Face Pull", muscleGroup: "Deltoides posteriores", sets: 3, reps: "12-15", restSeconds: 60, notes: "Cuerda", technique: "Tira hacia la cara", alternatives: ["Reverse Fly"] },
      { name: "Hanging Leg Raises", muscleGroup: "Abdominales", sets: 3, reps: "12-15", restSeconds: 60, notes: "Barra de dominadas", technique: "Levanta hasta 90°", alternatives: ["Ab Wheel Rollout"] }
    ];

    fullBody = [
      hasBackInjury
        ? { name: "Leg Press", muscleGroup: "Piernas", sets: 3, reps: "10-12", restSeconds: 90, notes: "Seguro para espalda", technique: "Controla flexión", alternatives: ["Goblet Squat"] }
        : { name: "Barbell Squat", muscleGroup: "Piernas", sets: 3, reps: "8-10", restSeconds: 120, notes: "Profundidad paralela", technique: "Rodillas afuera", alternatives: ["Leg Press"] },
      { name: "Bench Press", muscleGroup: "Pecho", sets: 3, reps: "8-10", restSeconds: 90, notes: "Barra recta", technique: "Codos a 45°", alternatives: ["Dumbbell Press"] },
      hasBackInjury
        ? { name: "Chest Supported Row", muscleGroup: "Espalda", sets: 3, reps: "10-12", restSeconds: 90, notes: "Firme contra soporte", technique: "Tracción constante", alternatives: ["Lat Pulldown"] }
        : { name: "Barbell Rows", muscleGroup: "Espalda", sets: 3, reps: "8-10", restSeconds: 90, notes: "Barra recta", technique: "Codo atrás", alternatives: ["Dumbbell Rows"] },
      hasShoulderInjury
        ? { name: "Face Pull", muscleGroup: "Hombros", sets: 3, reps: "12-15", restSeconds: 60, notes: "Cuerda polea alta", technique: "Hacia cara", alternatives: ["Lateral Raise"] }
        : { name: "Overhead Press", muscleGroup: "Hombros", sets: 3, reps: "8-10", restSeconds: 90, notes: "De pie", technique: "Core activado", alternatives: ["Dumbbell Press"] }
    ];
  }

  const exercisesByFocus: Record<string, any[]> = {
    "Chest and Triceps": chestTriceps,
    "Back and Biceps": backBiceps,
    "Legs": legs,
    "Shoulders and Abs": shouldersAbs,
    "Full Body": fullBody,
  };

  const days = [];
  const focusAreas = ["Chest and Triceps", "Back and Biceps", "Legs", "Shoulders and Abs", "Full Body"];
  
  for (let i = 0; i < input.daysPerWeek; i++) {
    const focusIndex = i % focusAreas.length;
    const focus = focusAreas[focusIndex];
    const exercises = exercisesByFocus[focus] || [];
    
    days.push({
      dayNumber: i + 1,
      focus,
      warmup: "5-10 minutos de cardio ligero + estiramientos dinámicos",
      exercises: exercises.slice(0, 5),
      cooldown: "Estiramientos estáticos 5-10 minutos",
      notes: `Día ${i + 1}: Enfoque en ${focus}`,
    });
  }

  return {
    summary: `Plan personalizado de ${input.daysPerWeek} días/semana para ${input.objective}`,
    objective: input.objective,
    durationWeeks: 12,
    daysPerWeek: input.daysPerWeek,
    progressionStrategy: "Aumenta peso cada semana en 2-5% o agrega 1-2 reps",
    days,
    nutrition: {
      dailyCalories: macros.protein * 4 + macros.carbs * 4 + macros.fats * 9,
      dailyMacros: macros,
      mealFrequency: 5,
      meals: [
        { mealNumber: 1, time: "08:00", name: "Desayuno", foods: ["Huevos", "Avena", "Plátano"], macros: { protein: 30, carbs: 50, fats: 15 }, calories: 450, notes: "Proteína + carbohidratos complejos" },
        { mealNumber: 2, time: "11:00", name: "Snack", foods: ["Almendras", "Manzana"], macros: { protein: 10, carbs: 25, fats: 12 }, calories: 250, notes: "Energía pre-entreno" },
        { mealNumber: 3, time: "14:00", name: "Almuerzo", foods: ["Pollo", "Arroz", "Verduras"], macros: { protein: 40, carbs: 60, fats: 10 }, calories: 500, notes: "Comida principal" },
        { mealNumber: 4, time: "17:00", name: "Pre-entreno", foods: ["Plátano", "Proteína"], macros: { protein: 25, carbs: 40, fats: 5 }, calories: 300, notes: "Antes del entrenamiento" },
        { mealNumber: 5, time: "20:00", name: "Cena", foods: ["Salmón", "Batata", "Brócoli"], macros: { protein: 35, carbs: 45, fats: 12 }, calories: 480, notes: "Proteína + grasas saludables" },
      ],
      tips: [
        "Bebe al menos 3 litros de agua diarios",
        "Come proteína en cada comida",
        "Come carbohidratos complejos antes del entreno",
        "Mantén un déficit calórico moderado para perder grasa",
        "Duerme 7-9 horas cada noche",
      ],
      hydration: "3-4 litros de agua diarios, aumenta si entrenas intenso",
      supplementation: "Proteína en polvo, Creatina, Multivitamínico, Omega-3",
      notes: "Ajusta calorías según progreso cada 2 semanas",
    },
    generalAdvice: "Sigue el plan consistentemente, descansa adecuadamente y ajusta según tu progreso",
  };
}

