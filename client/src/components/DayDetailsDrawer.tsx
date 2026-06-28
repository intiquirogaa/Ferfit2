import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Clock, Zap, Dumbbell } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { exerciseTranslations } from "@/lib/exerciseTranslations";

interface DayDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
}

export function DayDetailsDrawer({ isOpen, onClose, date }: DayDetailsDrawerProps) {
  const { data, isLoading } = trpc.training.getDayDetails.useQuery(
    { date: date || new Date() },
    { enabled: isOpen && !!date }
  );

  if (!date) return null;

  const formattedDate = format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="bg-background border-border/50">
        <DrawerHeader className="border-b border-border/50">
          <DrawerTitle className="text-2xl">Detalles del Entrenamiento</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground mt-2">
            {capitalizedDate}
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Spinner />
            </div>
          ) : !data?.checklist ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No hay entrenamiento registrado para este día</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 border-border/50 bg-card/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">XP Ganado</span>
                  </div>
                  <p className="text-lg font-bold text-green-500">{data.checklist.xpEarned}</p>
                </Card>

                <Card className="p-3 border-border/50 bg-card/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Dumbbell className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Series</span>
                  </div>
                  <p className="text-lg font-bold text-blue-500">
                    {data.checklist.completedSeries}/{data.checklist.totalSeries}
                  </p>
                </Card>

                <Card className="p-3 border-border/50 bg-card/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-purple-500" />
                    <span className="text-xs text-muted-foreground">Duración</span>
                  </div>
                  <p className="text-lg font-bold text-purple-500">{data.duration || 0} min</p>
                </Card>
              </div>

              {/* Exercises */}
              <div>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Dumbbell className="w-4 h-4" />
                  Ejercicios ({data.exercises.length})
                </h3>

                {data.exercises.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay ejercicios para este día</p>
                ) : (
                  <div className="space-y-2">
                    {data.exercises.map((exercise: any, idx: number) => (
                      <Card key={idx} className="p-3 border-border/50 bg-card/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{exerciseTranslations[exercise.name] ?? exercise.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {exercise.sets} x {exercise.reps} • Descanso: {exercise.restSeconds || 60}s
                            </p>
                            {exercise.technique && (
                              <p className="text-xs text-muted-foreground mt-1">
                                <strong>Técnica:</strong> {exercise.technique}
                              </p>
                            )}
                            {exercise.muscleGroup && (
                              <Badge variant="secondary" className="mt-2 text-xs">
                                {exercise.muscleGroup}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Completion Status */}
              <Card className="p-3 border-border/50 bg-card/50">
                <p className="text-sm">
                  <strong>Estado:</strong>{" "}
                  <Badge variant={data.checklist.isCompleted ? "default" : "outline"}>
                    {data.checklist.isCompleted ? "✓ Completado" : "Pendiente"}
                  </Badge>
                </p>
              </Card>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
