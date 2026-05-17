import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Fase G1 — variants do design system Stitch.
        // approve: fundo translúcido verde + borda verde + texto verde
        //   (mockup topbar "Aprovar"). Estado "approved" (depois do clique)
        //   muda só por callback do consumer — não tem variant separada.
        approve:
          "bg-success/10 text-success border border-success/40 shadow-sm hover:bg-success/20",
        // Onda 19.A — approveSubtle: variant alternativa pra "Aprovar" quando
        // o verde puro fica gritante em dark theme. Fundo/texto/borda neutros
        // (ink-700/ink-200), ícone fica verde como acento via className do
        // caller (`<Check className="text-success" />`). Mantém significação
        // de "aprovação positiva" sem competir visualmente com o resto da UI.
        approveSubtle:
          "bg-ink-900 text-ink-200 border border-ink-700 shadow-sm hover:bg-ink-800 hover:border-ink-600",
        // svg: idem mas violeta — botão "Gerar SVG"/"SVG" do mockup.
        // Disabled-by-default visual: caller passa `disabled` quando pedido
        // não está aprovado ainda. Cor primária complementa "Aprovar".
        svg:
          "bg-primary/10 text-primary border border-primary/40 shadow-sm hover:bg-primary/20",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
