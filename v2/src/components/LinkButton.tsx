import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Looks like <Button> but is a real link: a <button> inside <a> is invalid
// HTML and creates two tab stops. Keep the classes in sync with ui/button.tsx.
const linkButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        default: "h-10 px-4 py-2",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

type Props = VariantProps<typeof linkButtonVariants> & {
  className?: string;
  children: ReactNode;
} & ({ to: string; href?: never } | { href: string; to?: never });

/** Router link (`to`) or in-page/external anchor (`href`) styled as a button. */
export function LinkButton({ to, href, variant, size, className, children }: Props) {
  const cls = cn(linkButtonVariants({ variant, size }), className);
  return to != null ? <Link to={to} className={cls}>{children}</Link> : <a href={href} className={cls}>{children}</a>;
}
