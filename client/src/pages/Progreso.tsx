import { trpc } from "@/lib/trpc";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Zap, Flame, Trophy, TrendingUp, Star, Award, Target, Calendar, Dumbbell, TrendingUpIcon } from "lucide-react";
import TrainingCalendar, { CalendarDay } from "@/components/TrainingCalendar";
import ExerciseChecklist from "@/components/ExerciseChecklist";
import ProgressGraphs from "@/components/ProgressGraphs";
import { exerciseTranslations } from "@/lib/exerciseTranslations";

const LEVEL_TITLES: Record<number, string> = {
  1: "Novato", 2: "Aprendiz", 3: "Atleta", 4: "Guerrero",
  5: "Campeón", 6: "Élite", 7: "Maestro", 8: "Leyenda",
  9: "Mítico", 10: "Inmortal",
};

export default function Progreso() {
  const { data: progress, isLoading: isProgressLoading } = trpc.training.getUserProgress.useQuery();
  const { data: completedDatesData, isLoading: isDatesLoading } = trpc.training.getCompletedDates.useQuery();
  const { data: trainingPlanData, isLoading: isPlanLoading } = trpc.training.getActivePlan.useQuery();
  const { data: checklistsData, isLoading: isChecklistsLoading } = trpc.training.getChecklists.useQuery();
  
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const isLoading = isProgressLoading || isDatesLoading || isPlanLoading || isChecklistsLoading;

  const level = progress?.level || 1;
  const xpInLevel = (progress?.totalXP || 0) % 500;
  const xpProgress = (xpInLevel / 500) * 100;
  const levelTitle = LEVEL_TITLES[Math.min(level, 10)] || "Leyenda";

  // Dynamic training days calculation from plan startDate forward for 4 months (120 days)
  const generateTrainingDays = (): CalendarDay[] => {
    if (!trainingPlanData || !(trainingPlanData as any).hasPlan) return [];
    
    const planObj = (trainingPlanData as any).generatedContent 
      ? (typeof (trainingPlanData as any).generatedContent === "string"
          ? JSON.parse((trainingPlanData as any).generatedContent)
          : (trainingPlanData as any).generatedContent)
      : null;

    if (!planObj || !planObj.days || planObj.days.length === 0) return [];

    const startDateStr = (trainingPlanData as any).startDate;
    if (!startDateStr) return [];
    const startDate = new Date(startDateStr);
    
    // N training days per week
    const N = planObj.daysPerWeek || 3;
    const startDayOfWeek = startDate.getDay();

    // Map which day indices are training days based on standard spacing
    const trainingDaysOfWeek = new Set<number>();
    if (N === 1) {
      trainingDaysOfWeek.add(startDayOfWeek);
    } else if (N === 2) {
      trainingDaysOfWeek.add(startDayOfWeek);
      trainingDaysOfWeek.add((startDayOfWeek + 3) % 7);
    } else if (N === 3) {
      trainingDaysOfWeek.add(startDayOfWeek);
      trainingDaysOfWeek.add((startDayOfWeek + 2) % 7);
      trainingDaysOfWeek.add((startDayOfWeek + 4) % 7);
    } else if (N === 4) {
      trainingDaysOfWeek.add(startDayOfWeek);
      trainingDaysOfWeek.add((startDayOfWeek + 1) % 7);
      trainingDaysOfWeek.add((startDayOfWeek + 3) % 7);
      trainingDaysOfWeek.add((startDayOfWeek + 4) % 7);
    } else if (N === 5) {
      trainingDaysOfWeek.add(startDayOfWeek);
      trainingDaysOfWeek.add((startDayOfWeek + 1) % 7);
      trainingDaysOfWeek.add((startDayOfWeek + 2) % 7);
      trainingDaysOfWeek.add((startDayOfWeek + 4) % 7);
      trainingDaysOfWeek.add((startDayOfWeek + 5) % 7);
    } else if (N === 6) {
      trainingDaysOfWeek.add(startDayOfWeek);
      trainingDaysOfWeek.add((startDayOfWeek + 1) % 7);
      trainingDaysOfWeek.add((startDayOfWeek + 2) % 7);
      trainingDaysOfWeek.add((startDayOfWeek + 3) % 7);
      trainingDaysOfWeek.add((startDayOfWeek + 4) % 7);
      trainingDaysOfWeek.add((startDayOfWeek + 5) % 7);
    } else if (N === 7) {
      for (let i = 0; i < 7; i++) trainingDaysOfWeek.add(i);
    }

    const list: CalendarDay[] = [];
    let trainingDayIndex = 0;

    // Generate days for 4 months (120 days)
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 120);

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (trainingDaysOfWeek.has(dayOfWeek)) {
        const planDay = planObj.days[trainingDayIndex % planObj.days.length];
        const dateStr = current.toISOString().split('T')[0];
        const checklist = checklistsData?.checklists?.find((c: any) => c.date === dateStr);

        list.push({
          date: new Date(current),
          isPadding: false,
          isTrainingDay: true,
          focus: planDay.focus,
          exercises: planDay.exercises || [],
          completed: checklist ? checklist.isCompleted === 1 : false,
          completedSeries: checklist ? checklist.completedSeries : 0,
          totalSeries: checklist ? checklist.totalSeries : (planDay.exercises?.reduce((acc: number, ex: any) => acc + (typeof ex.sets === 'string' ? parseInt(ex.sets) : ex.sets), 0) || 0),
          xpEarned: checklist ? checklist.xpEarned : 0,
        });

        trainingDayIndex++;
      } else {
        list.push({
          date: new Date(current),
          isPadding: false,
          isTrainingDay: false,
        });
      }
      current.setDate(current.getDate() + 1);
    }

    return list;
  };

  const calendarDays = generateTrainingDays();

  // Mock exercise progress data
  const exerciseProgressData = {
    "Press de Banca": [
      { date: "Jun 20", weight: 80, reps: 10, sets: 4, duration: 1200, xp: 50 },
      { date: "Jun 22", weight: 82, reps: 9, sets: 4, duration: 1250, xp: 50 },
      { date: "Jun 24", weight: 85, reps: 8, sets: 4, duration: 1300, xp: 50 },
    ],
    "Dominadas": [
      { date: "Jun 20", reps: 8, sets: 4, duration: 900, xp: 40 },
      { date: "Jun 22", reps: 9, sets: 4, duration: 950, xp: 45 },
      { date: "Jun 24", reps: 10, sets: 4, duration: 1000, xp: 50 },
    ],
  };

  // Mock exercises for checklist
  const todayExercises = [
    {
      id: 1,
      name: "Sentadillas",
      plannedSets: 4,
      plannedReps: "8-10",
      completedSets: 3,
      completedReps: "10",
      weight: 100,
      duration: 1200,
      notes: "Última serie con buen control",
      isCompleted: true,
      gifUrl: "https://media.giphy.com/media/l0HlTy9x-Fqw0XO1i/giphy.gif",
    },
    {
      id: 2,
      name: "Prensa de Piernas",
      plannedSets: 3,
      plannedReps: "10-12",
      completedSets: 2,
      completedReps: "12",
      weight: 150,
      duration: 900,
      notes: "",
      isCompleted: false,
      gifUrl: "https://media.giphy.com/media/l0HlQXzRG5Lz0XO1i/giphy.gif",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground text-left">Progreso</h1>
          <p className="text-muted-foreground mt-1 text-left">Tu historial y estadísticas de entrenamiento</p>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl bg-muted/30" />)}
          </div>
        )}

        {!isLoading && progress && (
          <>
            {/* Level Card */}
            <Card className="p-6 border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">Nivel actual</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="font-display text-5xl font-bold text-accent">{level}</span>
                    <div>
                      <p className="font-semibold text-foreground text-lg">{levelTitle}</p>
                      <p className="text-xs text-muted-foreground">{progress.totalXP?.toLocaleString()} XP total</p>
                    </div>
                  </div>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-accent" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Nivel {level}</span>
                  <span>{xpInLevel} / 500 XP</span>
                  <span>Nivel {level + 1}</span>
                </div>
                <Progress value={xpProgress} className="h-3" />
                <p className="text-xs text-muted-foreground text-center">
                  {500 - xpInLevel} XP para alcanzar el nivel {level + 1}
                </p>
              </div>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Zap} label="XP Total" value={progress.totalXP?.toLocaleString() || "0"} sub="puntos" color="text-accent" bg="bg-accent/10" />
              <StatCard icon={Flame} label="Racha Actual" value={`${progress.streak}`} sub="días" color="text-orange-400" bg="bg-orange-400/10" />
              <StatCard icon={TrendingUp} label="Series Completadas" value={`${progress.seriesCompletedHistorically}`} sub="históricas" color="text-blue-400" bg="bg-blue-400/10" />
              <StatCard icon={Target} label="Total Días Entrenados" value={`${completedDatesData?.dates?.length || 0}`} sub="días" color="text-purple-400" bg="bg-purple-400/10" />
            </div>

            {/* Tabs for Calendar, Checklist, and Progress */}
            <Tabs defaultValue="calendar" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted/30">
                <TabsTrigger value="calendar" className="gap-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                  <Calendar className="w-4 h-4" /> Calendario
                </TabsTrigger>
                <TabsTrigger value="checklist" className="gap-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                  <Dumbbell className="w-4 h-4" /> Hoy
                </TabsTrigger>
                <TabsTrigger value="progress" className="gap-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                  <TrendingUpIcon className="w-4 h-4" /> Gráficos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="calendar" className="mt-5 space-y-4">
                <TrainingCalendar
                  calendarDays={calendarDays}
                  onDayClick={(day) => setSelectedDay(day)}
                  selectedDay={selectedDay}
                />

                {selectedDay && (
                  <Card className="p-5 border-border/50 bg-card/50">
                    <h3 className="font-semibold text-foreground text-lg mb-2 text-left">
                      Detalle del día: {selectedDay.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                    </h3>
                    
                    {!selectedDay.isTrainingDay ? (
                      <p className="text-sm text-muted-foreground text-left">
                        Día de descanso programado. Sin entrenamiento para hoy.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="text-sm font-medium text-accent">
                            Enfoque: {selectedDay.focus}
                          </p>
                          {selectedDay.date < new Date(new Date().setHours(0, 0, 0, 0)) ? (
                            <Badge variant={selectedDay.completed ? "default" : "secondary"} className={selectedDay.completed ? "bg-green-500/20 text-green-400 border-green-500/30" : ""}>
                              {selectedDay.completed ? "Rutina Completada" : `Incompleto (${selectedDay.completedSeries}/${selectedDay.totalSeries} series)`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-accent/30 text-accent">
                              Próximo Entrenamiento
                            </Badge>
                          )}
                        </div>

                        {selectedDay.totalSeries && selectedDay.totalSeries > 0 ? (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Progreso de series</span>
                              <span>{selectedDay.completedSeries} / {selectedDay.totalSeries} ({Math.round(((selectedDay.completedSeries || 0) / selectedDay.totalSeries) * 100)}%)</span>
                            </div>
                            <Progress value={((selectedDay.completedSeries || 0) / selectedDay.totalSeries) * 100} className="h-2" />
                          </div>
                        ) : null}

                        {selectedDay.exercises && selectedDay.exercises.length > 0 && (
                          <div className="space-y-2 text-left">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ejercicios programados:</p>
                            <div className="grid grid-cols-1 gap-2">
                              {selectedDay.exercises.map((ex, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                                  <div className="text-left">
                                    <p className="text-sm font-semibold text-foreground">
                                      {exerciseTranslations[ex.name] ?? ex.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {ex.sets} sets × {ex.reps} reps
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="checklist" className="mt-5">
                <ExerciseChecklist
                  exercises={todayExercises}
                  onExerciseComplete={(id) => console.log("Exercise completed:", id)}
                  onExerciseUpdate={(id, data) => console.log("Exercise updated:", id, data)}
                />
              </TabsContent>

              <TabsContent value="progress" className="mt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(exerciseProgressData).map(([exerciseName, data]) => (
                    <ProgressGraphs
                      key={exerciseName}
                      exerciseName={exerciseName}
                      data={data as any}
                    />
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {/* Achievements */}
            <Card className="p-5 border-border/50">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-left">
                <Award className="w-4 h-4 text-accent" /> Logros
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-left">
                {[
                  { icon: "🔥", title: "Primera Racha", desc: "3 días consecutivos", unlocked: progress.streak >= 3 },
                  { icon: "💪", title: "Guerrero", desc: "50 series completadas", unlocked: (progress.seriesCompletedHistorically || 0) >= 50 },
                  { icon: "⚡", title: "Nivel 5", desc: "Alcanzar nivel 5", unlocked: level >= 5 },
                  { icon: "🏆", title: "Centurión", desc: "100 series completadas", unlocked: (progress.seriesCompletedHistorically || 0) >= 100 },
                  { icon: "🌟", title: "Racha Épica", desc: "7 días consecutivos", unlocked: progress.streak >= 7 },
                  { icon: "👑", title: "Élite", desc: "Alcanzar nivel 6", unlocked: level >= 6 },
                ].map((a, i) => (
                  <div key={i} className={`p-4 rounded-xl border transition-all ${a.unlocked ? "border-accent/40 bg-accent/5" : "border-border/20 bg-muted/10 opacity-50"}`}>
                    <div className="text-2xl mb-2">{a.icon}</div>
                    <p className={`font-semibold text-sm ${a.unlocked ? "text-foreground" : "text-muted-foreground"}`}>{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                    {a.unlocked && <p className="text-xs text-accent mt-1 font-semibold">✓ Desbloqueado</p>}
                  </div>
                ))}
              </div>
            </Card>

            {/* Last workout */}
            {progress.lastWorkoutDate && (
              <Card className="p-4 border-border/50">
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-yellow-400" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Último entrenamiento</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(progress.lastWorkoutDate).toLocaleDateString("es-AR", {
                        weekday: "long", year: "numeric", month: "long", day: "numeric"
                      })}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: any; label: string; value: string; sub: string; color: string; bg: string;
}) {
  return (
    <Card className="p-4 border-border/50 text-left">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold font-display mt-1 ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </Card>
  );
}
