import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-bold whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-success-bg text-primary",
        success: "bg-success-bg text-success",
        warning: "bg-warning-bg text-warning",
        selected: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        accent: "bg-accent text-accent-foreground",
        outline: "border border-border text-muted-foreground",
        muted: "bg-muted text-muted-foreground",
        destructive: "bg-destructive-bg text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
