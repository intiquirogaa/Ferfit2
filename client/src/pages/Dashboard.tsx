import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useUser } from "@clerk/clerk-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/DashboardLayout";
import { TrainingPlanSelector } from "@/components/TrainingPlanSelector";
import {
  Zap, Flame, Trophy, TrendingUp, Dumbbell, Calendar, Plus, CheckCircle2,
  Circle, ChevronRight, Star, ChevronLeft, Droplets, Moon, Apple,
  Heart, Activity, Target, Shield, User
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { getLevelProgress } from "@/lib/levels";

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const ICON_MAP: Record<string, React.ElementType> = {
  droplets: Droplets, moon: Moon, zap: Zap, flame: Flame, apple: Apple,
  heart: Heart, activity: Activity, trophy: Trophy, target: Target,
  dumbbell: Dumbbell, star: Star, shield: Shield, user: User,
};

export default function Dashboard() {
  const { user } = useUser();
  const [, navigate] = useLocation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: planData, isLoading: planLoading } = trpc.training.getActivePlan.useQuery();
  const { data: progress, isLoading: progressLoading } = trpc.training.getUserProgress.useQuery();
  const { data: checklist } = trpc.training.getTodayChecklist.useQuery();
  const { data: dashData, isLoading: dashLoading } = trpc.training.getDashboardData.useQuery();
  const { data: tipsData, isLoading: tipsLoading } = trpc.training.getAITips.useQuery();
  const generateDemo = trpc.training.generateDemoRoutine.useMutation();

  const hasPlan = planData && (planData as any).hasPlan;
  const xpToNextLevel = ((progress?.level || 1) * 500);
  const xpProgress = progress ? ((progress.totalXP % 500) / 500) * 100 : 0;
  const todayIndex = new Date().getDay();

  const handlePlanCreated = () => {
    setWizardOpen(false);
    utils.training.getActivePlan.invalidate();
    toast.success("¡Plan creado exitosamente!");
  };

  const handleGenerateDemo = async () => {
    try {
      await generateDemo.mutateAsync();
      toast.success("¡Rutina de demo generada!");
      handlePlanCreated();
    } catch {
      toast.error("Error al generar la rutina de demo");
    }
  };

  const planWithContent = planData as any;
  const generatedPlan = hasPlan && planWithContent?.generatedContent
    ? (typeof planWithContent.generatedContent === "string"
      ? JSON.parse(planWithContent.generatedContent)
      : planWithContent.generatedContent)
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Hola, <span className="text-accent">{user?.firstName || user?.username || "Atleta"}</span> 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              {DAYS_FULL[todayIndex]}, {new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
            </p>
            <p className="text-muted-foreground text-sm mt-0.5">Bienvenido nuevamente a tu progreso</p>
          </div>
          {!hasPlan && (
            <Button onClick={() => setWizardOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
              <Plus className="w-4 h-4" /> Crear mi rutina
            </Button>
          )}
        </div>

        {/* Progress Stats */}
        {progressLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl bg-muted/30" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Zap} label="XP Total" value={progress?.totalXP?.toLocaleString() || "0"} sub="puntos de experiencia" color="text-accent" bg="bg-accent/10" />
            <StatCard icon={Trophy} label="Nivel" value={`${progress?.level || 1}`} sub={`${progress?.totalXP || 0} / ${xpToNextLevel} XP`} color="text-yellow-400" bg="bg-yellow-400/10" />
            <StatCard icon={Flame} label="Racha" value={`${progress?.streak || 0}`} sub="días consecutivos" color="text-orange-400" bg="bg-orange-400/10" />
            <StatCard icon={TrendingUp} label="Series" value={`${progress?.seriesCompletedHistorically || 0}`} sub="completadas en total" color="text-blue-400" bg="bg-blue-400/10" />
          </div>
        )}

        {/* XP Progress Bar */}
        {progress && (
          <Card className="p-4 border-border/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-semibold text-foreground">Nivel {progress.level}</span>
              </div>
              <span className="text-xs text-muted-foreground">{progress.totalXP % 500} / 500 XP</span>
            </div>
            <Progress value={xpProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {500 - (progress.totalXP % 500)} XP para el nivel {progress.level + 1}
            </p>
          </Card>
        )}

        {/* Weekly Summary + Plan Status side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Weekly Summary Chart */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" /> Resumen semanal
              </h3>
              <span className="text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-full">Esta semana</span>
            </div>
            {dashLoading ? (
              <Skeleton className="h-40 rounded-lg bg-muted/30" />
            ) : (
              <WeeklyBarChart data={dashData?.weeklyChart || []} />
            )}
          </Card>

          {/* Plan Status / No Plan */}
          {!planLoading && !hasPlan ? (
            <Card className="p-6 border-border/50 border-dashed text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-3">
                <Dumbbell className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">No tenés una rutina activa</h3>
              <p className="text-muted-foreground text-sm mb-5 max-w-xs">
                Creá tu plan personalizado con IA o generá una rutina de demo para comenzar.
              </p>
              <div className="flex flex-col gap-2 w-full">
                <Button onClick={() => setWizardOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 w-full">
                  <Zap className="w-4 h-4" /> Crear mi rutina personalizada
                </Button>
                <Button variant="outline" onClick={handleGenerateDemo} disabled={generateDemo.isPending} className="border-border/50 gap-2 w-full">
                  {generateDemo.isPending ? "Generando..." : "Ver rutina de demo"}
                </Button>
              </div>
            </Card>
          ) : hasPlan && generatedPlan ? (
            <Card className="p-5 border-border/50">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" /> Semana de Entrenamiento
              </h3>
              <WeeklyCalendar plan={generatedPlan} todayIndex={todayIndex} />
            </Card>
          ) : null}
        </div>

        {/* Today's Checklist */}
        {checklist && (checklist as any).id && (
          <Card className="p-5 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-accent" /> Entrenamiento de Hoy
              </h3>
              <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                {(checklist as any).completedSeries}/{(checklist as any).totalSeries} series
              </Badge>
            </div>
            <Progress value={((checklist as any).completedSeries / (checklist as any).totalSeries) * 100} className="h-2 mb-3" />
            <p className="text-xs text-muted-foreground">
              {(checklist as any).isCompleted ? "✅ ¡Entrenamiento completado! +XP" : `${(checklist as any).totalSeries - (checklist as any).completedSeries} series restantes`}
            </p>
          </Card>
        )}

        {/* Recent Workouts + Activity Feed */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Workouts */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-accent" /> Entrenamientos recientes
              </h3>
              <button
                onClick={() => navigate("/entrenamiento")}
                className="text-xs text-accent hover:text-accent/80 transition-colors font-medium"
              >
                Ver todos
              </button>
            </div>
            {dashLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg bg-muted/30" />)}
              </div>
            ) : dashData?.recentWorkouts && dashData.recentWorkouts.length > 0 ? (
              <div className="space-y-3">
                {dashData.recentWorkouts.map((w: any) => (
                  <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                      <Dumbbell className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{w.name}</p>
                      <p className="text-xs text-muted-foreground">{w.type}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge className="bg-accent/10 text-accent border-accent/20 text-xs mb-1">Completado</Badge>
                      <p className="text-xs text-muted-foreground">{w.date}</p>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => navigate("/progreso")}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Ver historial completo
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Dumbbell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Todavía no completaste ningún entrenamiento</p>
                <p className="text-xs text-muted-foreground/60 mt-1">¡Empezá hoy!</p>
              </div>
            )}
          </Card>

          {/* Activity Feed */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" /> Actividad
              </h3>
              <button
                onClick={() => navigate("/progreso")}
                className="text-xs text-accent hover:text-accent/80 transition-colors font-medium"
              >
                Ver todo
              </button>
            </div>
            {dashLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg bg-muted/30" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {(dashData?.activityFeed || DEFAULT_ACTIVITY).map((item: any, i: number) => {
                  const Icon = ICON_MAP[item.icon] || Zap;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{item.time}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* AI Tips */}
        <AiTipsCard tips={tipsData?.tips} isLoading={tipsLoading} />

        {/* Go to training */}
        {hasPlan && (
          <Button onClick={() => navigate("/entrenamiento")} className="w-full bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 gap-2" variant="outline">
            <Dumbbell className="w-4 h-4" /> Ver plan de entrenamiento completo
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>
        )}
      </div>

      <TrainingPlanSelector isOpen={wizardOpen} onClose={() => setWizardOpen(false)} onPlanCreated={handlePlanCreated} />
    </DashboardLayout>
  );
}

/* ────────────── Sub-components ────────────── */

const DEFAULT_ACTIVITY = [
  { icon: "star", title: "¡Bienvenido a FerFit!", description: "Comenzá tu viaje fitness", time: "Hoy" },
  { icon: "user", title: "Perfil creado", description: "Configuración inicial completada", time: "Hoy" },
  { icon: "target", title: "Objetivo establecido", description: "Definí tu objetivo principal", time: "Hoy" },
];

function StatCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: any; label: string; value: string; sub: string; color: string; bg: string;
}) {
  return (
    <Card className="p-4 border-border/50">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold font-display mt-1 ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </Card>
  );
}

function WeeklyBarChart({ data }: { data: { day: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const todayMon0 = (new Date().getDay() + 6) % 7; // Mon=0

  return (
    <div className="space-y-3">
      {/* Y-axis labels + bars */}
      <div className="flex items-end gap-2 h-40 pt-2">
        {/* Y axis */}
        <div className="flex flex-col justify-between text-right pr-1 h-full pb-0" style={{ minWidth: 20 }}>
          {[maxCount, Math.ceil(maxCount / 2), 0].map((v, i) => (
            <span key={i} className="text-[10px] text-muted-foreground leading-none">{v}</span>
          ))}
        </div>
        {/* Bars */}
        <div className="flex-1 flex items-end gap-1.5 h-full">
          {data.map((d, i) => {
            const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
            const isToday = i === todayMon0;
            const hasData = d.count > 0;
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: "calc(100% - 18px)" }}>
                  <div
                    className={`w-full rounded-t-md transition-all duration-700 ease-out ${
                      isToday
                        ? "bg-accent shadow-[0_0_12px_oklch(0.72_0.2_145/0.5)]"
                        : hasData
                        ? "bg-accent/60"
                        : "bg-muted/30"
                    }`}
                    style={{ height: `${Math.max(pct, hasData ? 8 : 4)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-medium ${isToday ? "text-accent" : "text-muted-foreground"}`}>
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Entrenamientos completados esta semana
      </p>
    </div>
  );
}

function WeeklyCalendar({ plan, todayIndex }: { plan: any; todayIndex: number }) {
  const daysPerWeek = plan.daysPerWeek || 3;
  const trainingDayIndices: number[] = [];
  for (let i = 0; i < daysPerWeek; i++) {
    trainingDayIndices.push((1 + i) % 7);
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {DAYS_ES.map((day, idx) => {
        const isTraining = trainingDayIndices.includes(idx);
        const isToday = idx === todayIndex;
        return (
          <div key={idx} className={`rounded-xl p-2 text-center transition-all ${
            isToday ? "border-2 border-accent bg-accent/10" :
            isTraining ? "border border-accent/30 bg-accent/5" :
            "border border-border/20 bg-muted/10"
          }`}>
            <p className={`text-xs font-semibold ${isToday ? "text-accent" : "text-muted-foreground"}`}>{day}</p>
            <div className={`w-6 h-6 rounded-full mx-auto mt-1 flex items-center justify-center ${
              isTraining ? "bg-accent/20" : "bg-transparent"
            }`}>
              {isTraining ? (
                <Dumbbell className={`w-3 h-3 ${isToday ? "text-accent" : "text-accent/60"}`} />
              ) : (
                <Circle className="w-3 h-3 text-border/40" />
              )}
            </div>
            {isToday && <div className="w-1.5 h-1.5 rounded-full bg-accent mx-auto mt-1" />}
          </div>
        );
      })}
    </div>
  );
}

const TIP_COLORS = [
  { bg: "bg-blue-500/10", border: "border-blue-500/20", icon: "text-blue-400" },
  { bg: "bg-purple-500/10", border: "border-purple-500/20", icon: "text-purple-400" },
  { bg: "bg-accent/10", border: "border-accent/20", icon: "text-accent" },
];

function AiTipsCard({ tips, isLoading }: { tips?: any[]; isLoading: boolean }) {
  const [current, setCurrent] = useState(0);
  const displayTips = tips || [];

  return (
    <Card className="p-5 border-border/50">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-yellow-400/20 flex items-center justify-center">
            <span className="text-sm">💡</span>
          </div>
          Consejos para vos
        </h3>
        {!isLoading && displayTips.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrent(c => Math.max(0, c - 1))}
              disabled={current === 0}
              className="w-7 h-7 rounded-full border border-border/50 flex items-center justify-center hover:bg-muted/40 disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrent(c => Math.min(displayTips.length - 1, c + 1))}
              disabled={current === displayTips.length - 1}
              className="w-7 h-7 rounded-full border border-border/50 flex items-center justify-center hover:bg-muted/40 disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl bg-muted/30" />)}
        </div>
      ) : displayTips.length > 0 ? (
        <>
          {/* Mobile: carousel */}
          <div className="md:hidden">
            <TipCard tip={displayTips[current]} colorSet={TIP_COLORS[current % TIP_COLORS.length]} />
            <div className="flex justify-center gap-1.5 mt-3">
              {displayTips.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-1.5 rounded-full transition-all ${i === current ? "w-5 bg-accent" : "w-1.5 bg-muted/50"}`}
                />
              ))}
            </div>
          </div>
          {/* Desktop: all 3 side by side */}
          <div className="hidden md:grid grid-cols-3 gap-4">
            {displayTips.map((tip: any, i: number) => (
              <TipCard key={i} tip={tip} colorSet={TIP_COLORS[i % TIP_COLORS.length]} />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Cargando consejos personalizados...</p>
      )}

      <p className="text-xs text-muted-foreground/50 text-center mt-4 flex items-center justify-center gap-1">
        <Zap className="w-3 h-3" /> Generado por IA según tu actividad
      </p>
    </Card>
  );
}

function TipCard({ tip, colorSet }: { tip: any; colorSet: { bg: string; border: string; icon: string } }) {
  const Icon = ICON_MAP[tip.icon] || Zap;
  return (
    <div className={`rounded-xl p-4 border ${colorSet.bg} ${colorSet.border} transition-all hover:scale-[1.02] duration-200`}>
      <div className={`w-9 h-9 rounded-xl ${colorSet.bg} border ${colorSet.border} flex items-center justify-center mb-3`}>
        <Icon className={`w-4.5 h-4.5 ${colorSet.icon}`} />
      </div>
      <p className="text-sm font-semibold text-foreground mb-1">{tip.title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{tip.description}</p>
    </div>
  );
}
