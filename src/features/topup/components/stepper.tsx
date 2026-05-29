import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  steps: string[];
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-center gap-3">
      {steps.map((label, idx) => {
        const done = idx < current;
        const active = idx === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-3">
            <div
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary",
                !done && !active && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : idx + 1}
            </div>
            <span
              className={cn(
                "hidden text-sm font-medium md:inline",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 transition-colors",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
