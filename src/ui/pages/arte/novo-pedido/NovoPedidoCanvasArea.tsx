/**
 * NovoPedidoCanvasArea — área central (canvas) do editor (Onda 12 F4.1).
 *
 * F4.1: placeholder vazio com mensagem.
 * F4.3: vai instanciar useCanvasEngine quando produto for selecionado,
 * renderizar <canvas> com base SVG + material aplicado.
 */
export function NovoPedidoCanvasArea() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-mono text-xs text-muted-foreground">
          Escolha um produto na sidebar esquerda
        </p>
        <p className="font-mono text-[10px] text-muted-foreground/70">→</p>
      </div>
    </div>
  );
}
