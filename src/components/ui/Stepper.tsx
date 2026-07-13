import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

type StepperProps = {
  steps: string[];
  activeStep: number;
  onStepClick?: (index: number) => void;
};

export function Stepper({ steps, activeStep, onStepClick }: StepperProps) {
  return (
    <div className="flex w-full items-center">
      {steps.map((label, index) => {
        const isCompleted = activeStep > index;
        const isActive = activeStep === index;
        const clickable = index < activeStep && !!onStepClick;

        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(index)}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors",
                clickable ? "cursor-pointer" : "cursor-default",
                isActive
                  ? "text-primary"
                  : isCompleted
                    ? "text-foreground"
                    : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCompleted
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                {isCompleted ? <Check size={14} /> : index + 1}
              </span>
              <span className="hidden whitespace-nowrap sm:inline">{label}</span>
            </button>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-px flex-1",
                  activeStep > index ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}