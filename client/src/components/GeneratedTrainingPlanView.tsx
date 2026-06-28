import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download, Dumbbell, Apple, ChevronLeft, ChevronRight, Clock,
  Flame as FlameIcon, ChevronDown, Loader2, Check, Sparkles, Calendar
} from "lucide-react";
import { toast } from "sonner";
import type { GeneratedTrainingAndNutritionPlan, Meal } from "@/types";
import { trpc } from "@/lib/trpc";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { exerciseTranslations } from "@/lib/exerciseTranslations";

interface Props {
  plan: GeneratedTrainingAndNutritionPlan;
}

function SeriesRow({
  seriesIdx,
  totalSets,
  isCompleted,
  weightVal,
  repsVal,
  restSeconds,
  xpValue,
  exerciseName,
  idx,
  trainingPlanId,
  dayNumber,
}: {
  seriesIdx: number;
  totalSets: number;
  isCompleted: boolean;
  weightVal: any;
  repsVal: any;
  restSeconds: number;
  xpValue: number;
  exerciseName: string;
  idx: number;
  trainingPlanId: number;
  dayNumber: number;
}) {
  const utils = trpc.useUtils();
  const [weight, setWeight] = useState(weightVal !== undefined && weightVal !== null ? String(weightVal) : "");
  const [reps, setReps] = useState(repsVal !== undefined && repsVal !== null ? String(repsVal) : "");

  useEffect(() => {
    setWeight(weightVal !== undefined && weightVal !== null ? String(weightVal) : "");
  }, [weightVal]);

  useEffect(() => {
    setReps(repsVal !== undefined && repsVal !== null ? String(repsVal) : "");
  }, [repsVal]);

  const markComplete = trpc.training.markSeriesComplete.useMutation({
    onSuccess: (data) => {
      utils.training.getActivePlan.invalidate();
      utils.training.getUserProgress.invalidate();
      utils.training.getChecklists.invalidate();
      
      if (data.success && data.xpGained !== 0) {
        if (data.xpGained > 0) {
          toast.success(`+${data.xpGained} XP`, {
            description: "Serie completada",
            duration: 3000,
          });
        } else {
          toast.info(`Serie desmarcada`, {
            description: `${data.xpGained} XP`,
            duration: 2000,
          });
        }
      }
    },
    onError: (err) => {
      toast.error("Error al registrar serie", {
        description: err.message,
      });
    }
  });

  const handleSaveData = async (completedState = isCompleted) => {
    const parsedWeight = parseFloat(weight);
    const parsedReps = parseInt(reps, 10);
    await markComplete.mutateAsync({
      trainingPlanId,
      dayNumber,
      exerciseIndex: idx,
      seriesIndex: seriesIdx,
      completed: completedState,
      weight: isNaN(parsedWeight) ? undefined : parsedWeight,
      reps: isNaN(parsedReps) ? undefined : parsedReps,
    });
  };

  const handleCheckboxClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (markComplete.isPending) return;
    const nextCompleted = !isCompleted;
    await handleSaveData(nextCompleted);
  };

  return (
    <div
      onClick={handleCheckboxClick}
      className={`flex flex-col md:grid md:grid-cols-[auto_1fr_120px_120px_100px_100px] items-start md:items-center gap-3 md:gap-4 p-3.5 md:p-2.5 rounded-xl border transition-all cursor-pointer ${
        isCompleted
          ? "bg-green-950/20 border-green-500/30 text-green-400 hover:bg-green-950/30"
          : "border-border/30 bg-muted/5 hover:bg-muted/10 text-muted-foreground"
      }`}
    >
      {/* Checkbox & Series label */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all shrink-0 ${
          isCompleted
            ? "bg-green-500 border-green-500 text-black"
            : "border-muted-foreground/30 bg-transparent"
        }`}>
          {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </div>
        <span className={`md:hidden text-sm font-semibold ${isCompleted ? "text-green-400" : "text-foreground"}`}>
          Serie {seriesIdx + 1} de {totalSets}
        </span>
      </div>

      {/* Title (Desktop) */}
      <div className="hidden md:flex flex-col text-left">
        <span className={`text-sm font-semibold ${isCompleted ? "text-green-400" : "text-foreground"}`}>
          Serie {seriesIdx + 1} de {totalSets}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          {exerciseTranslations[exerciseName] ?? exerciseName}
        </span>
      </div>

      {/* Mobile inputs layout */}
      <div className="flex items-center gap-2 w-full md:hidden">
        {/* Weight input mobile */}
        <div className="flex-1 flex items-center gap-1.5 bg-muted/20 border border-border/30 rounded-lg px-2.5 py-1 text-xs">
          <span className="text-[10px] text-muted-foreground uppercase">Peso:</span>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => handleSaveData()}
            onClick={(e) => e.stopPropagation()}
            placeholder="-"
            className="w-full bg-transparent border-none text-right font-semibold text-foreground focus:outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-muted-foreground">kg</span>
        </div>

        {/* Reps input mobile */}
        <div className="flex-1 flex items-center gap-1.5 bg-muted/20 border border-border/30 rounded-lg px-2.5 py-1 text-xs">
          <span className="text-[10px] text-muted-foreground uppercase">Reps:</span>
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onBlur={() => handleSaveData()}
            onClick={(e) => e.stopPropagation()}
            placeholder="-"
            className="w-full bg-transparent border-none text-right font-semibold text-foreground focus:outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Rest display mobile */}
        <div className="text-xs text-muted-foreground bg-muted/10 border border-border/10 rounded-lg px-2 py-1.5 shrink-0">
          {restSeconds}s
        </div>

        {/* XP Badge mobile */}
        <div className={`text-xs font-bold px-2 py-1.5 rounded-lg shrink-0 ${
          isCompleted ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-muted/10 text-muted-foreground/60"
        }`}>
          +{xpValue} XP{isCompleted && " ✓"}
        </div>
      </div>

      {/* Desktop inputs (hidden on mobile) */}
      <div className="hidden md:flex justify-center w-full" onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() => handleSaveData()}
          placeholder="-"
          className="w-16 h-8 text-center bg-muted/20 border border-border/30 rounded-lg text-sm font-semibold text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>

      <div className="hidden md:flex justify-center w-full" onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={() => handleSaveData()}
          placeholder="-"
          className="w-16 h-8 text-center bg-muted/20 border border-border/30 rounded-lg text-sm font-semibold text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>

      <div className="hidden md:block text-center text-sm w-full">
        {restSeconds}s
      </div>

      <div className="hidden md:flex justify-end w-full">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all ${
          isCompleted
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-muted/10 border-border/10 text-muted-foreground/60"
        }`}>
          +{xpValue} XP
        </span>
      </div>
    </div>
  );
}

function ExerciseItem({ exercise, idx, isExpanded, onToggle, trainingPlanId, dayNumber }: {
  exercise: any;
  idx: number;
  isExpanded: boolean;
  onToggle: () => void;
  trainingPlanId: number;
  dayNumber: number;
}) {
  const { data: mediaData, isLoading: mediaLoading } = trpc.training.searchExerciseWithMedia.useQuery(
    { name: exercise.name },
    { enabled: isExpanded && !exercise.gifUrl }
  );

  const { data: detailsData } = trpc.training.searchExercise.useQuery(
    { name: exercise.name },
    { enabled: isExpanded }
  );

  const gifUrl: string | null = exercise.gifUrl || mediaData?.media?.url || detailsData?.gifUrl || null;

  // Description / Step-by-step instructions
  let instructions: string[] = [];
  if (exercise.instructions) {
    instructions = Array.isArray(exercise.instructions)
      ? exercise.instructions
      : exercise.instructions.split(/[•\n]/).filter((t: string) => t.trim().length > 0);
  } else if (detailsData?.instructions && detailsData.instructions.length > 0) {
    instructions = detailsData.instructions;
  } else if (exercise.notes) {
    instructions = [exercise.notes];
  }

  // Tips / Execution tips
  let tips: string[] = [];
  if (exercise.tips) {
    tips = exercise.tips.split(/[•\n]/).filter((t: string) => t.trim().length > 0);
  } else if (exercise.technique) {
    tips = [exercise.technique];
  } else {
    tips = [
      "Realizá el movimiento con una técnica controlada, evitando balanceos.",
      "Mantené el core/abdomen activo durante todo el ejercicio.",
      "Exhalá durante la fase de esfuerzo (concéntrica) e inhalá al regresar.",
    ];
  }

  // Muscles
  const primaryMuscle = exercise.muscleGroup || detailsData?.targetMuscles || "Músculo objetivo";
  const secondaryMuscles = detailsData?.secondaryMuscles?.length
    ? detailsData.secondaryMuscles.join(", ")
    : null;

  // Equipment & body part
  const equipmentNeeded = detailsData?.equipment || null;
  const bodyPart = detailsData?.bodyPart || null;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className="border-border/50 overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-4">
              {/* Exercise Number */}
              <div className="w-10 h-10 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
                <span className="font-bold text-accent text-sm">{idx + 1}</span>
              </div>

              {/* Exercise Info */}
              <div className="flex-1 min-w-0">
                <h5 className="font-semibold text-foreground text-base text-left">
                  {exerciseTranslations[exercise.name] ?? exercise.name}
                </h5>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Dumbbell className="w-3.5 h-3.5 text-muted-foreground/75" />
                    {exercise.sets} × {exercise.reps}
                  </span>
                  {exercise.restSeconds && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground/75" />
                      {exercise.restSeconds}s descanso
                    </span>
                  )}
                  {exercise.muscleGroup && (
                    <span className="text-muted-foreground/80 font-medium">
                      {exerciseTranslations[exercise.muscleGroup] ?? exercise.muscleGroup}
                    </span>
                  )}
                </div>
              </div>

              {/* Expand Icon */}
              <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/30 p-4 space-y-5">
            {/* Split layout: Image/GIF on the left, info on the right on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
              {/* Left: GIF / Image */}
              <div className="flex flex-col justify-start">
                {isExpanded && mediaLoading && !exercise.gifUrl && (
                  <div className="w-full aspect-square bg-muted/30 rounded-xl flex items-center justify-center border border-border/15">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                )}
                {gifUrl && (
                  <div className="rounded-xl overflow-hidden bg-white/5 border border-border/15 max-w-sm mx-auto aspect-square flex items-center justify-center p-2">
                    <img
                      src={gifUrl}
                      alt={exerciseTranslations[exercise.name] ?? exercise.name}
                      className="w-full h-full object-contain rounded-lg"
                      onError={(e) => { e.currentTarget.parentElement!.style.display = "none"; }}
                    />
                  </div>
                )}
              </div>

              {/* Right: Info */}
              <div className="space-y-4 text-left">
                {/* Description */}
                {instructions.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Guía de Ejecución</h5>
                    <ol className="space-y-1 text-sm text-foreground/90 list-decimal pl-4">
                      {instructions.map((inst, i) => (
                        <li key={i} className="pl-1 text-muted-foreground">
                          {inst}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Muscles worked */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Músculo principal</h5>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                        <Dumbbell className="w-4 h-4 text-green-400" />
                      </div>
                      <span className="text-sm text-foreground/90 font-medium capitalize">
                        {exerciseTranslations[primaryMuscle.toLowerCase()] ?? primaryMuscle}
                      </span>
                    </div>
                  </div>

                  {secondaryMuscles && (
                    <div>
                      <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Músculos secundarios</h5>
                      <p className="text-sm text-muted-foreground capitalize">
                        {secondaryMuscles.split(", ").map((m: string) => exerciseTranslations[m.toLowerCase()] ?? m).join(", ")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Extra info: Equipment & Body Part */}
                {(equipmentNeeded || bodyPart) && (
                  <div className="flex flex-wrap gap-4 border-t border-border/20 pt-3">
                    {equipmentNeeded && (
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Equipamiento</span>
                        <span className="text-xs text-foreground/80 font-medium capitalize">{equipmentNeeded}</span>
                      </div>
                    )}
                    {bodyPart && (
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Región Corporal</span>
                        <span className="text-xs text-foreground/80 font-medium capitalize">{bodyPart}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tips */}
                {tips.length > 0 && (
                  <div className="border-t border-border/20 pt-3">
                    <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Consejos Clave</h5>
                    <ul className="space-y-1.5 text-sm text-foreground/90">
                      {tips.map((tipText, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5 stroke-[3]" />
                          <span className="text-xs text-muted-foreground">{tipText}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Alternatives */}
            {exercise.alternatives && exercise.alternatives.length > 0 && (
              <div className="text-left border-t border-border/20 pt-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Alternativas</p>
                <div className="flex flex-wrap gap-2">
                  {exercise.alternatives.map((alt: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs border-border/40 bg-muted/40 hover:bg-muted/60 text-muted-foreground">
                      {exerciseTranslations[alt] ?? alt}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Series Checklist */}
            <div className="border-t border-border/20 pt-4">
              <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-3 text-left">Marca tus series</p>
              
              {/* Desktop Headers (hidden on mobile) */}
              <div className="hidden md:grid grid-cols-[auto_1fr_120px_120px_100px_100px] gap-4 px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/20">
                <div></div>
                <div>Serie</div>
                <div className="text-center">Peso (kg)</div>
                <div className="text-center">Reps</div>
                <div className="text-center">Descanso</div>
                <div className="text-right">XP</div>
              </div>

              <div className="space-y-2 mt-2">
                {[...Array(typeof exercise.sets === 'string' ? parseInt(exercise.sets) : exercise.sets)].map((_, seriesIdx) => {
                  const isCompleted = exercise.seriesCompleted?.[seriesIdx] === true;
                  const weightVal = exercise.seriesWeights?.[seriesIdx];
                  const repsVal = exercise.seriesReps?.[seriesIdx];
                  
                  const totalSets = typeof exercise.sets === 'string' ? parseInt(exercise.sets) : exercise.sets;
                  const isLastSet = seriesIdx === totalSets - 1;
                  const xpValue = isLastSet ? 35 : 10;
                  
                  return (
                    <SeriesRow
                      key={seriesIdx}
                      seriesIdx={seriesIdx}
                      totalSets={totalSets}
                      isCompleted={isCompleted}
                      weightVal={weightVal}
                      repsVal={repsVal}
                      restSeconds={exercise.restSeconds}
                      xpValue={xpValue}
                      exerciseName={exercise.name}
                      idx={idx}
                      trainingPlanId={trainingPlanId}
                      dayNumber={dayNumber}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function GeneratedTrainingPlanView({ plan }: Props) {
  const { data: planData } = trpc.training.getActivePlan.useQuery();
  const trainingPlanId = (planData as any)?.id || 0;
  
  const calculateCurrentDayIndex = () => {
    const data = planData as any; if (!data?.startDate) return 0;
    const startDate = new Date(data.startDate);
    const today = new Date();
    const daysElapsed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(daysElapsed % (plan.daysPerWeek || 3), (plan.days?.length || 1) - 1));
  };
  
  const [currentDayIndex, setCurrentDayIndex] = useState(() => calculateCurrentDayIndex());
  const [expandedExercises, setExpandedExercises] = useState<Set<number>>(new Set());
  
  useEffect(() => {
    setCurrentDayIndex(calculateCurrentDayIndex());
    setExpandedExercises(new Set());
  }, [planData?.id, plan.daysPerWeek]);
  
  const currentDay = plan.days?.[currentDayIndex];
  const totalDays = plan.days?.length || 0;

  const handleDownloadPDF = async () => {
    try {
      const { exportTrainingAndNutritionPlanToPDF } = await import("@/lib/exportPDF");
      await exportTrainingAndNutritionPlanToPDF(plan);
      toast.success("PDF descargado exitosamente");
    } catch {
      toast.error("Error al descargar PDF");
    }
  };

  const toggleExercise = (index: number) => {
    const newExpanded = new Set(expandedExercises);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedExercises(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="text-left">
        <h2 className="font-display text-2xl font-bold text-foreground">Tu Rutina Personalizada</h2>
        <p className="text-muted-foreground mt-1 text-sm">{plan.summary}</p>
      </div>

      {/* Day Navigation */}
      {currentDay && (
        <div className="space-y-6">
          {/* Day Header */}
          <Card className="p-4 border border-accent/20 bg-accent/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-accent">
                  Día {currentDayIndex + 1}: {currentDay.focus}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {currentDay.notes || `Día ${currentDayIndex + 1}: Enfoque en ${currentDay.focus}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full border border-border/40 hover:bg-muted/40 shrink-0"
                onClick={() => setCurrentDayIndex(Math.max(0, currentDayIndex - 1))}
                disabled={currentDayIndex === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-semibold text-foreground px-2">
                {currentDayIndex + 1} / {totalDays}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full border border-border/40 hover:bg-muted/40 shrink-0"
                onClick={() => setCurrentDayIndex(Math.min(totalDays - 1, currentDayIndex + 1))}
                disabled={currentDayIndex === totalDays - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          {/* Warm-up Section */}
          {currentDay.warmup && (
            <Card className="p-4 border border-orange-500/20 bg-orange-500/5 flex items-start gap-3 text-left">
              <FlameIcon className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-orange-400 text-xs uppercase tracking-wider">Calentamiento</h4>
                <p className="text-sm text-muted-foreground mt-1">{currentDay.warmup}</p>
              </div>
            </Card>
          )}

          {/* Exercises Section */}
          <div className="space-y-3">
            <h4 className="font-semibold text-accent text-xs uppercase tracking-wider flex items-center gap-2 text-left">
              <Dumbbell className="w-4 h-4" /> Ejercicios ({currentDay.exercises?.length || 0})
            </h4>

            {currentDay.exercises && currentDay.exercises.map((exercise: any, idx: number) => (
              <ExerciseItem
                key={`${currentDayIndex}-${idx}`}
                exercise={exercise}
                idx={idx}
                isExpanded={expandedExercises.has(idx)}
                onToggle={() => toggleExercise(idx)}
                trainingPlanId={trainingPlanId}
                dayNumber={currentDayIndex + 1}
              />
            ))}
          </div>

          {/* Nutrition Tab */}
          {plan.nutrition && (
            <Tabs defaultValue="nutrition" className="w-full">
              <TabsList className="grid w-full grid-cols-1 bg-muted/30">
                <TabsTrigger value="nutrition" className="gap-2">
                  <Apple className="w-4 h-4" /> Plan Nutricional
                </TabsTrigger>
              </TabsList>

              <TabsContent value="nutrition" className="mt-4 space-y-4">
                {plan.nutrition.meals && plan.nutrition.meals.map((meal: Meal, idx: number) => (
                  <Card key={idx} className="p-4 border-border/50 text-left">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold text-foreground">{meal.name}</h4>
                      <Badge variant="outline" className="bg-muted/50">
                        {meal.calories} kcal
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{meal.foods.join(", ")}</p>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}
    </div>
  );
}
