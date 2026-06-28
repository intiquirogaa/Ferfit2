import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Zap } from "lucide-react";

export interface CalendarDay {
  date: Date;
  isPadding: boolean;
  isTrainingDay: boolean;
  focus?: string;
  exercises?: Array<{
    name: string;
    sets: number | string;
    reps: string;
  }>;
  completed?: boolean;
  xpEarned?: number;
  completedSeries?: number;
  totalSeries?: number;
}

interface Props {
  calendarDays: CalendarDay[];
  onDayClick?: (day: CalendarDay) => void;
  selectedDay: CalendarDay | null;
}

export default function TrainingCalendar({ calendarDays, onDayClick, selectedDay }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [daysInMonth, setDaysInMonth] = useState<CalendarDay[]>([]);

  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInPrevMonth = firstDay.getDay();
    const daysInCurrentMonth = lastDay.getDate();

    const days: CalendarDay[] = [];

    // Padding for previous month
    for (let i = 0; i < daysInPrevMonth; i++) {
      days.push({
        date: new Date(year, month, -i), // dummy date
        isPadding: true,
        isTrainingDay: false,
      });
    }

    // Days of current month
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const date = new Date(year, month, day);
      
      // Find if this date matches any training/rest day in calendarDays
      const match = calendarDays.find(cd => {
        const cdDate = new Date(cd.date);
        return cdDate.toDateString() === date.toDateString();
      });

      if (match) {
        days.push({
          ...match,
          isPadding: false,
        });
      } else {
        days.push({
          date,
          isPadding: false,
          isTrainingDay: false,
        });
      }
    }

    setDaysInMonth(days);
  }, [currentMonth, calendarDays]);

  const monthName = currentMonth.toLocaleString("es-ES", { month: "long", year: "numeric" });
  const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sab"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl font-bold text-foreground capitalize">{monthName}</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {daysInMonth.map((day, idx) => {
          if (day.isPadding) {
            return <div key={idx} className="aspect-square" />;
          }

          const isSelected = selectedDay && selectedDay.date.toDateString() === day.date.toDateString();
          const percent = day.totalSeries && day.totalSeries > 0 
            ? Math.round(((day.completedSeries || 0) / day.totalSeries) * 100) 
            : 0;

          return (
            <div key={idx} className="aspect-square">
              <Card
                className={`h-full p-2 cursor-pointer transition-all hover:shadow-md flex flex-col justify-between text-xs ${
                  isSelected 
                    ? "ring-2 ring-accent border-accent" 
                    : day.isTrainingDay 
                      ? day.completed 
                        ? "bg-green-500/10 border-green-500/30 text-green-400" 
                        : percent > 0 
                          ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-500"
                          : "bg-accent/5 border-accent/20"
                      : "bg-muted/10 border-border/20 text-muted-foreground opacity-70"
                }`}
                onClick={() => onDayClick?.(day)}
              >
                <div className="flex items-start justify-between gap-1 w-full">
                  <span className={`font-semibold ${isSelected ? "text-accent" : "text-foreground"}`}>
                    {day.date.getDate()}
                  </span>
                  {day.isTrainingDay && day.completed && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  )}
                </div>

                {day.isTrainingDay ? (
                  <div className="space-y-0.5 text-left">
                    <p className="font-medium truncate text-[10px] md:text-xs text-foreground">
                      {day.focus}
                    </p>
                    {percent > 0 && !day.completed && (
                      <p className="text-[9px] text-yellow-500 font-semibold">{percent}%</p>
                    )}
                    {day.xpEarned && day.xpEarned > 0 ? (
                      <div className="flex items-center gap-0.5 text-[9px] opacity-80">
                        <Zap className="w-2 h-2 text-accent fill-accent" />
                        <span>{day.xpEarned} XP</span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-center pb-2 text-[9px] opacity-40 text-muted-foreground">
                    Descanso
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
