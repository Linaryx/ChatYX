import { type VariantProps, cva } from "class-variance-authority";
import type { Component, JSX } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = JSX.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

export const Badge: Component<BadgeProps> = (props) => {
  const [local, variants, rest] = splitProps(props, ["class"], ["variant"]);

  return <div class={cn(badgeVariants(variants), local.class)} {...rest} />;
};
