import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  label: string;
  description?: string;
}

type StepStatus = "pending" | "active" | "done" | "error";

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
  status?: StepStatus;
  className?: string;
}

export function StepProgress({ steps, currentStep, status = "active", className }: StepProgressProps) {
  return (
    <div className={cn("flex items-start gap-0", className)}>
      {steps.map((step, idx) => {
        const isDone = idx < currentStep;
        const isActive = idx === currentStep;
        const isError = isActive && status === "error";
        const isLast = idx === steps.length - 1;

        return (
          <div key={idx} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300",
                  isDone && "bg-emerald-500 border-emerald-500 text-white",
                  isActive && !isError && "bg-primary border-primary text-primary-foreground",
                  isActive && isError && "bg-destructive border-destructive text-destructive-foreground",
                  !isDone && !isActive && "bg-muted border-muted-foreground/20 text-muted-foreground"
                )}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5" />
                ) : isActive && status === "active" && currentStep > 0 ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <div className="mt-1.5 text-center">
                <p className={cn("text-xs font-medium", isActive ? "text-foreground" : isDone ? "text-emerald-400" : "text-muted-foreground")}>{step.label}</p>
                {step.description && <p className="text-xs text-muted-foreground/60 max-w-[80px]">{step.description}</p>}
              </div>
            </div>
            {!isLast && (
              <div className={cn("flex-1 h-0.5 mt-3.5 mx-1 transition-all duration-500", isDone ? "bg-emerald-500" : "bg-muted-foreground/20")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
