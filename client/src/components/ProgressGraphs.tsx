import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Weight, Zap, Clock } from "lucide-react";
import { exerciseTranslations } from "@/lib/exerciseTranslations";

interface ProgressData {
  date: string;
  weight?: number;
  reps?: number;
  sets?: number;
  duration?: number;
  xp?: number;
}

interface Props {
  exerciseName: string;
  data: ProgressData[];
}

export default function ProgressGraphs({ exerciseName, data }: Props) {
  const translatedName = exerciseTranslations[exerciseName] ?? exerciseName;

  if (!data || data.length === 0) {
    return (
      <Card className="p-6 border-border/50 bg-card/50 text-center">
        <p className="text-muted-foreground">No hay datos de progreso disponibles para {translatedName}</p>
      </Card>
    );
  }

  const weightData = data.filter(d => d.weight !== undefined);
  const repsData = data.filter(d => d.reps !== undefined);
  const durationData = data.filter(d => d.duration !== undefined);
  const xpData = data.filter(d => d.xp !== undefined);

  const stats = {
    maxWeight: Math.max(...weightData.map(d => d.weight || 0)),
    avgWeight: weightData.length > 0 ? (weightData.reduce((sum, d) => sum + (d.weight || 0), 0) / weightData.length).toFixed(1) : 0,
    maxReps: Math.max(...repsData.map(d => d.reps || 0)),
    totalXP: xpData.reduce((sum, d) => sum + (d.xp || 0), 0),
  };

  return (
    <div className="space-y-4 p-4 border border-border/50 rounded-xl bg-card/30">
      <h3 className="font-semibold text-base text-foreground">{translatedName}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {weightData.length > 0 && (
          <Card className="p-4 border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Weight className="w-4 h-4 text-accent" />
              <p className="text-xs font-semibold text-muted-foreground">Peso Máximo</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.maxWeight} kg</p>
            <p className="text-xs text-muted-foreground mt-1">Promedio: {stats.avgWeight} kg</p>
          </Card>
        )}

        {repsData.length > 0 && (
          <Card className="p-4 border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <p className="text-xs font-semibold text-muted-foreground">Máx. Reps</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.maxReps}</p>
            <p className="text-xs text-muted-foreground mt-1">Repeticiones</p>
          </Card>
        )}

        {durationData.length > 0 && (
          <Card className="p-4 border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-accent" />
              <p className="text-xs font-semibold text-muted-foreground">Tiempo Total</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{(durationData.reduce((sum, d) => sum + (d.duration || 0), 0) / 60).toFixed(0)} min</p>
            <p className="text-xs text-muted-foreground mt-1">Acumulado</p>
          </Card>
        )}

        {xpData.length > 0 && (
          <Card className="p-4 border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-accent" />
              <p className="text-xs font-semibold text-muted-foreground">XP Ganado</p>
            </div>
            <p className="text-2xl font-bold text-accent">{stats.totalXP}</p>
            <p className="text-xs text-muted-foreground mt-1">Total</p>
          </Card>
        )}
      </div>

      <Tabs defaultValue="weight" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted/30">
          {weightData.length > 0 && <TabsTrigger value="weight">Peso</TabsTrigger>}
          {repsData.length > 0 && <TabsTrigger value="reps">Repeticiones</TabsTrigger>}
          {durationData.length > 0 && <TabsTrigger value="duration">Duración</TabsTrigger>}
          {xpData.length > 0 && <TabsTrigger value="xp">XP</TabsTrigger>}
        </TabsList>

        {weightData.length > 0 && (
          <TabsContent value="weight" className="mt-4">
            <Card className="p-4 border-border/50">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={weightData}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid #22c55e" }} />
                  <Area type="monotone" dataKey="weight" stroke="#22c55e" fillOpacity={1} fill="url(#colorWeight)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        )}

        {repsData.length > 0 && (
          <TabsContent value="reps" className="mt-4">
            <Card className="p-4 border-border/50">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={repsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid #22c55e" }} />
                  <Bar dataKey="reps" fill="#22c55e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        )}

        {durationData.length > 0 && (
          <TabsContent value="duration" className="mt-4">
            <Card className="p-4 border-border/50">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={durationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid #22c55e" }} />
                  <Line type="monotone" dataKey="duration" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e" }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        )}

        {xpData.length > 0 && (
          <TabsContent value="xp" className="mt-4">
            <Card className="p-4 border-border/50">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={xpData}>
                  <defs>
                    <linearGradient id="colorXP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid #fbbf24" }} />
                  <Area type="monotone" dataKey="xp" stroke="#fbbf24" fillOpacity={1} fill="url(#colorXP)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
