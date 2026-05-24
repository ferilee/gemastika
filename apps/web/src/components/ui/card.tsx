import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLElement> & { asChild?: boolean };

export function Card({ className, asChild, ...props }: CardProps) {
  const Comp: React.ElementType = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(
        // Glass + neon glow card (dark mode) inspired by the provided NFT Gallery reference.
        // Kept as a single element so existing layout/spacing doesn't change.
        "relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 shadow-[0_10px_30px_-16px_rgba(15,23,42,0.30),0_2px_8px_-3px_rgba(15,23,42,0.16)] backdrop-blur-sm",
        "dark:border-white/10 dark:bg-[#0b1220]/55 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_60px_-34px_rgba(168,85,247,0.45)]",
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-300 before:content-['']",
        "before:bg-[radial-gradient(circle_at_18%_12%,rgba(168,85,247,0.22),transparent_42%),radial-gradient(circle_at_82%_18%,rgba(56,189,248,0.14),transparent_44%),radial-gradient(circle_at_70%_92%,rgba(245,158,11,0.10),transparent_45%)]",
        "dark:before:opacity-100",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-3xl after:content-['']",
        "after:ring-1 after:ring-inset after:ring-white/10 dark:after:ring-white/10",
        "transition-shadow hover:shadow-[0_16px_40px_-20px_rgba(15,23,42,0.36),0_4px_12px_-4px_rgba(15,23,42,0.20)] dark:hover:shadow-[0_0_0_1px_rgba(168,85,247,0.28),0_22px_80px_-38px_rgba(56,189,248,0.34)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-extrabold", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}
