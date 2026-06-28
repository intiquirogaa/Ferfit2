import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { exerciseTranslations } from "@/lib/exerciseTranslations";

interface SeriesChecklistItemProps {
  exerciseName: string;
  seriesNumber: number;
  totalSeries: number;
  dayNumber: number;
  exerciseIndex: number;
  seriesIndex: number;
  isCompleted: boolean;
  trainingPlanId: number;
}

export default function SeriesChecklistItem({
  exerciseName,
  seriesNumber,
  totalSeries,
  dayNumber,
  exerciseIndex,
  seriesIndex,
  isCompleted,
  trainingPlanId,
}: SeriesChecklistItemProps) {
  const [checked, setChecked] = useState(isCompleted);
  const [isAnimating, setIsAnimating] = useState(false);

  const markSeriesMutation = trpc.training.markSeriesComplete.useMutation({
    onSuccess: (data) => {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
      
      if (data.xpGained > 0) {
        toast.success(`+${data.xpGained} XP`, {
          description: seriesNumber === totalSeries ? "¡Ejercicio completado!" : "Serie completada",
          position: "top-right",
        });
      }
    },
    onError: (error) => {
      setChecked(!checked);
      toast.error("Error al actualizar", {
        description: error.message,
      });
    },
  });

  const handleToggle = () => {
    const newState = !checked;
    setChecked(newState);
    
    markSeriesMutation.mutate({
      trainingPlanId,
      dayNumber,
      exerciseIndex,
      seriesIndex,
      completed: newState,
    });
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
        checked
          ? "bg-green-500/10 border-green-500/30"
          : "bg-slate-900/50 border-slate-700/50 hover:border-slate-600"
      } ${isAnimating ? "scale-105" : "scale-100"}`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={handleToggle}
        disabled={markSeriesMutation.isPending}
        className="h-5 w-5"
      />
      
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-200">
          Serie {seriesNumber} de {totalSeries}
        </p>
        <p className="text-xs text-slate-400">{exerciseTranslations[exerciseName] ?? exerciseName}</p>
      </div>

      {checked && (
        <div className="flex items-center gap-1 text-green-400 animate-pulse">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold">+35 XP</span>
        </div>
      )}

      {markSeriesMutation.isPending && (
        <div className="h-4 w-4 rounded-full border-2 border-slate-500 border-t-green-400 animate-spin" />
      )}
    </div>
  );
}
