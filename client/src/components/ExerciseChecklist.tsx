import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Circle, Dumbbell, Clock, Weight } from "lucide-react";
import { exerciseTranslations } from "@/lib/exerciseTranslations";

interface Exercise {
  id: number;
  name: string;
  plannedSets: number;
  plannedReps: string;
  completedSets: number;
  completedReps?: string;
  weight?: number;
  duration?: number;
  notes?: string;
  isCompleted: boolean;
  gifUrl?: string;
  instructions?: string;
  tips?: string;
}

interface Props {
  exercises: Exercise[];
  onExerciseUpdate?: (exerciseId: number, data: Partial<Exercise>) => void;
  onExerciseComplete?: (exerciseId: number) => void;
}

export default function ExerciseChecklist({ exercises, onExerciseUpdate, onExerciseComplete }: Props) {
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<Record<number, Partial<Exercise>>>({});

  const handleToggleComplete = (exerciseId: number) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (exercise) {
      onExerciseComplete?.(exerciseId);
    }
  };

  const handleSaveChanges = (exerciseId: number) => {
    if (editingData[exerciseId]) {
      onExerciseUpdate?.(exerciseId, editingData[exerciseId]);
      setEditingData(prev => {
        const newData = { ...prev };
        delete newData[exerciseId];
        return newData;
      });
    }
  };

  const completedCount = exercises.filter(e => e.isCompleted).length;
  const totalCount = exercises.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-accent/10 to-accent/5 rounded-lg border border-accent/20">
        <div>
          <p className="text-sm font-semibold text-foreground">Progreso del Entrenamiento</p>
          <p className="text-2xl font-bold text-accent mt-1">{completedCount}/{totalCount} Ejercicios</p>
        </div>
        <div className="text-right">
          <div className="w-20 h-20 rounded-full bg-background border-4 border-accent/30 flex items-center justify-center">
            <span className="text-2xl font-bold text-accent">{completionPercentage}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {exercises.map((exercise, idx) => (
          <Card
            key={exercise.id}
            className={`p-4 border transition-all cursor-pointer ${
              exercise.isCompleted
                ? "bg-accent/5 border-accent/30"
                : "bg-card/50 border-border/30 hover:border-accent/50"
            }`}
            onClick={() => setExpandedExercise(expandedExercise === exercise.id ? null : exercise.id)}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleComplete(exercise.id);
                }}
                className="mt-1 shrink-0"
              >
                {exercise.isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-accent" />
                ) : (
                  <Circle className="w-6 h-6 text-muted-foreground hover:text-accent transition-colors" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={`font-semibold ${exercise.isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {idx + 1}. {exerciseTranslations[exercise.name] ?? exercise.name}
                  </h4>
                  {exercise.isCompleted && <Badge variant="outline" className="bg-accent/10 text-accent">Completado</Badge>}
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Dumbbell className="w-4 h-4" />
                    {exercise.completedSets}/{exercise.plannedSets} series
                  </span>
                  <span className="flex items-center gap-1">
                    <span>{exercise.completedReps || exercise.plannedReps} reps</span>
                  </span>
                  {exercise.weight && (
                    <span className="flex items-center gap-1">
                      <Weight className="w-4 h-4" />
                      {exercise.weight} kg
                    </span>
                  )}
                  {exercise.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {exercise.duration}s
                    </span>
                  )}
                </div>
              </div>
            </div>

            {expandedExercise === exercise.id && (
              <div className="mt-4 pt-4 border-t border-border/30 space-y-4">
                {exercise.gifUrl && (
                  <div className="mb-4">
                    <img
                      src={exercise.gifUrl}
                      alt={exerciseTranslations[exercise.name] ?? exercise.name}
                      className="w-full h-48 object-cover rounded-lg bg-muted"
                    />
                  </div>
                )}
                
                {exercise.instructions && (
                  <div className="mb-4 text-sm text-foreground space-y-1">
                    <strong className="text-accent">Instrucciones:</strong>
                    <p className="text-muted-foreground whitespace-pre-line">{exercise.instructions}</p>
                  </div>
                )}

                {exercise.tips && (
                  <div className="mb-4 text-sm text-foreground space-y-1">
                    <strong className="text-accent">Tips:</strong>
                    <p className="text-muted-foreground whitespace-pre-line">{exercise.tips}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Series Completadas</Label>
                    <Input
                      type="number"
                      min="0"
                      max={exercise.plannedSets}
                      value={editingData[exercise.id]?.completedSets ?? exercise.completedSets}
                      onChange={(e) =>
                        setEditingData(prev => ({
                          ...prev,
                          [exercise.id]: { ...prev[exercise.id], completedSets: parseInt(e.target.value) }
                        }))
                      }
                      className="mt-1 text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Repeticiones</Label>
                    <Input
                      type="text"
                      placeholder={exercise.plannedReps}
                      value={editingData[exercise.id]?.completedReps ?? exercise.completedReps ?? ""}
                      onChange={(e) =>
                        setEditingData(prev => ({
                          ...prev,
                          [exercise.id]: { ...prev[exercise.id], completedReps: e.target.value }
                        }))
                      }
                      className="mt-1 text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Peso (kg)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={editingData[exercise.id]?.weight ?? exercise.weight ?? ""}
                      onChange={(e) =>
                        setEditingData(prev => ({
                          ...prev,
                          [exercise.id]: { ...prev[exercise.id], weight: e.target.value ? parseInt(e.target.value) : undefined }
                        }))
                      }
                      className="mt-1 text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Duración (seg)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editingData[exercise.id]?.duration ?? exercise.duration ?? ""}
                      onChange={(e) =>
                        setEditingData(prev => ({
                          ...prev,
                          [exercise.id]: { ...prev[exercise.id], duration: e.target.value ? parseInt(e.target.value) : undefined }
                        }))
                      }
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Notas</Label>
                  <Textarea
                    placeholder="Añade notas sobre este ejercicio..."
                    value={editingData[exercise.id]?.notes ?? exercise.notes ?? ""}
                    onChange={(e) =>
                      setEditingData(prev => ({
                        ...prev,
                        [exercise.id]: { ...prev[exercise.id], notes: e.target.value }
                      }))
                    }
                    className="mt-1 text-sm resize-none"
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedExercise(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveChanges(exercise.id);
                      setExpandedExercise(null);
                    }}
                  >
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
