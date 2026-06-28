import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { TrainingPlanSelector } from "@/components/TrainingPlanSelector";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Apple, Droplets, Pill, Flame, Plus, Zap } from "lucide-react";
import type { GeneratedTrainingAndNutritionPlan, MealPlan } from "@/types";

export default function Nutricion() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: planData, isLoading } = trpc.training.getActivePlan.useQuery();
  const hasPlan = planData && (planData as any).hasPlan;

  const plan: GeneratedTrainingAndNutritionPlan | null = hasPlan && (planData as any).generatedContent
    ? (typeof (planData as any).generatedContent === "string"
        ? JSON.parse((planData as any).generatedContent)
        : (planData as any).generatedContent)
    : null;

  const nutrition = plan?.nutrition;

  const handlePlanCreated = () => {
    utils.training.getActivePlan.invalidate();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Nutrición</h1>
            <p className="text-muted-foreground mt-1">Tu plan nutricional personalizado</p>
          </div>
          {!hasPlan && (
            <Button onClick={() => setWizardOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
              <Plus className="w-4 h-4" /> Crear plan
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl bg-muted/30" />)}
          </div>
        )}

        {!isLoading && !hasPlan && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
              <Apple className="w-10 h-10 text-accent" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-3">Sin plan nutricional</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Creá tu plan de entrenamiento y recibirás automáticamente un plan nutricional personalizado.
            </p>
            <Button onClick={() => setWizardOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
              <Zap className="w-4 h-4" /> Crear mi plan
            </Button>
          </div>
        )}

        {!isLoading && hasPlan && nutrition && (
          <>
            {/* Macros */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 border-border/50 text-center">
                <p className="text-xs text-muted-foreground">Calorías</p>
                <p className="text-3xl font-bold text-accent mt-1 font-display">{nutrition.dailyCalories}</p>
                <p className="text-xs text-muted-foreground">kcal/día</p>
              </Card>
              <Card className="p-4 border-border/50 text-center">
                <p className="text-xs text-muted-foreground">Proteína</p>
                <p className="text-3xl font-bold text-red-400 mt-1 font-display">{nutrition.dailyMacros?.protein}g</p>
                <p className="text-xs text-muted-foreground">por día</p>
              </Card>
              <Card className="p-4 border-border/50 text-center">
                <p className="text-xs text-muted-foreground">Carbohidratos</p>
                <p className="text-3xl font-bold text-blue-400 mt-1 font-display">{nutrition.dailyMacros?.carbs}g</p>
                <p className="text-xs text-muted-foreground">por día</p>
              </Card>
              <Card className="p-4 border-border/50 text-center">
                <p className="text-xs text-muted-foreground">Grasas</p>
                <p className="text-3xl font-bold text-yellow-400 mt-1 font-display">{nutrition.dailyMacros?.fats}g</p>
                <p className="text-xs text-muted-foreground">por día</p>
              </Card>
            </div>

            {/* Meals */}
            <div>
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Apple className="w-4 h-4 text-accent" /> Plan de Comidas
              </h2>
              <div className="space-y-3">
                {nutrition.meals?.map(meal => <MealCard key={meal.mealNumber} meal={meal} />)}
              </div>
            </div>

            {/* Hydration + Supplementation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5 border-border/50">
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-400" /> Hidratación
                </h3>
                <p className="text-sm text-muted-foreground">{nutrition.hydration}</p>
              </Card>
              {nutrition.supplementation && (
                <Card className="p-5 border-border/50">
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Pill className="w-4 h-4 text-purple-400" /> Suplementación
                  </h3>
                  <p className="text-sm text-muted-foreground">{nutrition.supplementation}</p>
                </Card>
              )}
            </div>

            {/* Tips */}
            <Card className="p-5 border-accent/30 bg-accent/5">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-accent" /> Tips de Nutrición
              </h3>
              <ul className="space-y-2">
                {nutrition.tips?.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-accent font-bold shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {nutrition.notes && (
              <Card className="p-5 border-border/50">
                <h3 className="font-semibold text-foreground mb-2">Notas del Plan</h3>
                <p className="text-sm text-muted-foreground">{nutrition.notes}</p>
              </Card>
            )}
          </>
        )}
      </div>

      <TrainingPlanSelector isOpen={wizardOpen} onClose={() => setWizardOpen(false)} onPlanCreated={handlePlanCreated} />
    </DashboardLayout>
  );
}

function MealCard({ meal }: { meal: MealPlan }) {
  return (
    <Card className="p-4 border-border/50">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-foreground">Comida {meal.mealNumber}: {meal.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{meal.time}</p>
        </div>
        <Badge variant="outline" className="border-accent/30 text-accent">{meal.calories} kcal</Badge>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {meal.foods?.map((food, i) => (
          <Badge key={i} variant="secondary" className="text-xs bg-muted/40">{food}</Badge>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 bg-red-500/10 rounded-lg text-center">
          <p className="text-muted-foreground">Proteína</p>
          <p className="font-bold text-red-400">{meal.macros?.protein}g</p>
        </div>
        <div className="p-2 bg-blue-500/10 rounded-lg text-center">
          <p className="text-muted-foreground">Carbs</p>
          <p className="font-bold text-blue-400">{meal.macros?.carbs}g</p>
        </div>
        <div className="p-2 bg-yellow-500/10 rounded-lg text-center">
          <p className="text-muted-foreground">Grasas</p>
          <p className="font-bold text-yellow-400">{meal.macros?.fats}g</p>
        </div>
      </div>
      {meal.notes && <p className="text-xs text-muted-foreground mt-2 italic">💡 {meal.notes}</p>}
    </Card>
  );
}
