// client/src/components/ExerciseCard.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2 } from "lucide-react";
import { exerciseTranslations } from "../lib/exerciseTranslations";


interface Exercise {
  name: string;
  sets: number;
  reps: string;
  restSeconds?: number;
  gifUrl?: string;
  imageUrl?: string;
  targetMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string;
  tips?: string;
  alternatives?: string[];
}

export  function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const imageSrc = exercise.gifUrl || exercise.imageUrl;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg font-bold text-foreground">
            {exerciseTranslations[exercise.name] ?? exercise.name}
          </CardTitle>

          <Badge variant="default" className="shrink-0">
            {exercise.sets} × {exercise.reps}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* GIF / Imagen */}
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          {imageSrc && !imageError ? (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <img
                src={imageSrc}
                alt={exerciseTranslations[exercise.name] ?? exercise.name}
                className="w-full h-full object-cover"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              Sin imagen disponible
            </div>
          )}
        </div>

        {/* Músculos */}
        {(exercise.targetMuscles || exercise.secondaryMuscles) && (
          <div className="flex flex-wrap gap-2">
            {exercise.targetMuscles?.map((muscle, i) => (
              <Badge key={i} variant="default">{muscle}</Badge>
            ))}
            {exercise.secondaryMuscles?.map((muscle, i) => (
              <Badge key={i} variant="secondary">{muscle}</Badge>
            ))}
          </div>
        )}

        {/* Botón de instrucciones */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="instructions">
            <AccordionTrigger>Ver instrucciones</AccordionTrigger>
            <AccordionContent className="text-sm space-y-3">
              {exercise.instructions && <p>{exercise.instructions}</p>}
              {exercise.tips && (
                <div>
                  <strong>Tips:</strong>
                  <p className="text-muted-foreground">{exercise.tips}</p>
                </div>
              )}
              {exercise.alternatives && exercise.alternatives.length > 0 && (
                <div>
                  <strong>Alternativas:</strong>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {exercise.alternatives.map((alt, i) => (
                      <li key={i}>{exerciseTranslations[alt] ?? alt}</li>
                    ))}
                  </ul>
                </div>
              )}
              {exercise.restSeconds && (
                <p><strong>Descanso:</strong> {exercise.restSeconds} segundos</p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}