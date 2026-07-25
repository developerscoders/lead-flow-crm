import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/api";

const MAIN_STAGES: { key: LeadStatus; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
];

type Props = {
  status: LeadStatus;
  onChange?: (next: LeadStatus) => void;
  interactive?: boolean;
  size?: "sm" | "md";
  className?: string;
};

export function PipelineRail({ status, onChange, interactive, size = "md", className }: Props) {
  const activeIndex = MAIN_STAGES.findIndex((s) => s.key === status);
  const isLost = status === "lost";
  const isWon = status === "won";
  const dotSize = size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        {/* rail */}
        <div
          className={cn(
            "absolute top-1/2 left-0 right-0 -translate-y-1/2 rounded-full bg-border/70",
            size === "sm" ? "h-[2px]" : "h-[3px]",
          )}
        />
        {/* active fill */}
        <motion.div
          className={cn(
            "absolute top-1/2 left-0 -translate-y-1/2 rounded-full",
            size === "sm" ? "h-[2px]" : "h-[3px]",
            isLost ? "bg-destructive/60" : "bg-accent",
          )}
          initial={false}
          animate={{
            width:
              isLost || activeIndex < 0
                ? "0%"
                : `${(activeIndex / (MAIN_STAGES.length - 1)) * 100}%`,
          }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
        />

        <div className="relative flex items-center justify-between">
          {MAIN_STAGES.map((stage, i) => {
            const reached = !isLost && i <= activeIndex;
            const isCurrent = !isLost && i === activeIndex;
            const Node: any = interactive ? "button" : "div";
            return (
              <Node
                key={stage.key}
                type={interactive ? "button" : undefined}
                onClick={interactive ? () => onChange?.(stage.key) : undefined}
                className={cn(
                  "group relative flex flex-col items-center gap-2",
                  interactive && "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "relative z-10 rounded-full border-2 bg-background transition-colors",
                    dotSize,
                    reached
                      ? "border-accent bg-accent"
                      : "border-border bg-background group-hover:border-accent/60",
                    isCurrent && "ring-4 ring-accent/20",
                  )}
                />
                <span
                  className={cn(
                    "font-medium uppercase tracking-wider",
                    textSize,
                    reached ? "text-foreground" : "text-muted-foreground",
                    isCurrent && "text-accent-foreground/90",
                  )}
                >
                  {stage.label}
                </span>
              </Node>
            );
          })}
        </div>
      </div>

      {/* Lost branch */}
      <div className="mt-3 flex items-center justify-end gap-2">
        {interactive ? (
          <button
            type="button"
            onClick={() => onChange?.("lost")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors",
              isLost
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-border text-muted-foreground hover:border-destructive/60 hover:text-destructive",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", isLost ? "bg-destructive" : "bg-muted-foreground/60")} />
            Lost
          </button>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider",
              isLost
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-transparent text-transparent",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Lost
          </span>
        )}
      </div>
    </div>
  );
}
