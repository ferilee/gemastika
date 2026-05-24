import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-[rgb(var(--muted))] text-[rgb(var(--foreground))]",
        primary: "bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]",
        accent: "bg-mgmp-accent text-white",
        success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
