import { describe, expect, it } from 'vitest';

import { computeProximity } from '@/core/canvas/alignment/proximity-calculator';
import type { RectMm } from '@/core/canvas/alignment/snap-targets';

// Placa padrão usada nos testes — 300×90mm (igual à placa-300x90 da Onda 8).
const CANVAS: RectMm = { left: 0, top: 0, width: 300, height: 90 };

function rect(left: number, top: number, width = 20, height = 10): RectMm {
  return { left, top, width, height };
}

describe('proximity-calculator — computeProximity', () => {
  it('1: sem outros objetos → 4 distâncias até bordas da placa', () => {
    // Target: 20×10 em (40, 30) → bordas: top=30, bottom=40, left=40, right=60
    // Placa 300×90: top=0, bottom=90, left=0, right=300
    const target = rect(40, 30);
    const result = computeProximity({ target, others: [], canvasBounds: CANVAS });
    expect(result.top).toBe(30); // 30 - 0
    expect(result.bottom).toBe(50); // 90 - 40
    expect(result.left).toBe(40); // 40 - 0
    expect(result.right).toBe(240); // 300 - 60
  });

  it('2: obstáculo à esquerda com interseção vertical → distância correta', () => {
    // Target em (100, 30), 20×10. Bordas: left=100, right=120, top=30, bottom=40.
    // Obstáculo em (40, 25), 20×20 → right=60, top=25, bottom=45.
    // Interseção vertical: target.top(30) < other.bottom(45) E target.bottom(40) > other.top(25) ✓
    // ESQUERDA: distância = target.left(100) - other.right(60) = 40
    const target = rect(100, 30);
    const obstacle = rect(40, 25, 20, 20);
    const result = computeProximity({
      target,
      others: [obstacle],
      canvasBounds: CANVAS,
    });
    expect(result.left).toBe(40);
    // Outras direções devem usar fallback de canvas.
    expect(result.top).toBe(30);
    expect(result.bottom).toBe(50);
    expect(result.right).toBe(180); // 300 - 120
  });

  it('3: obstáculo à esquerda SEM interseção vertical → ignorado, fallback pra borda', () => {
    // Target em (100, 30), 20×10. Bottom=40, top=30.
    // Obstáculo em (40, 70), 20×10 → bottom=80, top=70 — está bem abaixo do target.
    // Interseção vertical: target.top(30) < other.bottom(80) ✓ MAS target.bottom(40) > other.top(70) é falso → SEM interseção.
    // ESQUERDA não captura. Fallback pra borda esquerda da placa.
    const target = rect(100, 30);
    const obstacle = rect(40, 70);
    const result = computeProximity({
      target,
      others: [obstacle],
      canvasBounds: CANVAS,
    });
    expect(result.left).toBe(100); // borda esquerda da placa
    // Mas obstáculo conta como ABAIXO porque other.top(70) > target.bottom(40) E intersecção horizontal:
    // target.left(100) < other.right(60)? 100 < 60 falso → SEM interseção horizontal → ignorado também.
    expect(result.bottom).toBe(50); // fallback pra borda inferior
  });

  it('4: 2 obstáculos à direita → vence o mais próximo (menor left)', () => {
    // Target em (40, 30), 20×10. Right=60, top=30, bottom=40.
    // Obs A em (100, 30), 20×10 → left=100. Distância = 100 - 60 = 40.
    // Obs B em (150, 30), 20×10 → left=150. Distância = 150 - 60 = 90.
    // Vence A.
    const target = rect(40, 30);
    const a = rect(100, 30);
    const b = rect(150, 30);
    const result = computeProximity({ target, others: [a, b], canvasBounds: CANVAS });
    expect(result.right).toBe(40);
  });

  it('5: obstáculo exatamente alinhado verticalmente acima → captura', () => {
    // Target em (40, 50), 20×10. Top=50, left=40, right=60.
    // Obstáculo em (40, 10), 20×20 → bottom=30, left=40, right=60. (mesma coluna)
    // Interseção horizontal: target.left(40) < other.right(60) E target.right(60) > other.left(40) ✓
    // ACIMA: distância = target.top(50) - other.bottom(30) = 20
    const target = rect(40, 50);
    const obstacle = rect(40, 10, 20, 20);
    const result = computeProximity({
      target,
      others: [obstacle],
      canvasBounds: CANVAS,
    });
    expect(result.top).toBe(20);
  });

  it('6: obstáculo sobreposto horizontalmente E está acima → captura', () => {
    // Target em (40, 50), 30×10. Left=40, right=70, top=50.
    // Obstáculo em (55, 10), 30×20 → left=55, right=85, bottom=30. (sobrepõe horizontalmente)
    // Interseção horizontal: 40 < 85 E 70 > 55 ✓
    // ACIMA: bottom=30 < target.top=50 ✓. Distância = 50 - 30 = 20.
    const target = rect(40, 50, 30, 10);
    const obstacle = rect(55, 10, 30, 20);
    const result = computeProximity({
      target,
      others: [obstacle],
      canvasBounds: CANVAS,
    });
    expect(result.top).toBe(20);
  });

  it('7: target colado na borda esquerda da placa → distância esquerda = 0', () => {
    // Target em (0, 30), 20×10. Left=0.
    const target = rect(0, 30);
    const result = computeProximity({ target, others: [], canvasBounds: CANVAS });
    expect(result.left).toBe(0);
  });

  it('8: 4 obstáculos espelhados em cada direção → cada um detectado no lado correto', () => {
    // Target central na placa: (140, 40), 20×10. Bordas: left=140, right=160, top=40, bottom=50.
    // Cima:    em (140, 10), 20×10 → bottom=20. Distância top = 40 - 20 = 20.
    // Baixo:   em (140, 70), 20×10 → top=70. Distância bottom = 70 - 50 = 20.
    // Esquerda em (100, 40), 20×10 → right=120. Distância left = 140 - 120 = 20.
    // Direita  em (180, 40), 20×10 → left=180. Distância right = 180 - 160 = 20.
    const target = rect(140, 40);
    const others = [
      rect(140, 10), // cima
      rect(140, 70), // baixo
      rect(100, 40), // esquerda
      rect(180, 40), // direita
    ];
    const result = computeProximity({ target, others, canvasBounds: CANVAS });
    expect(result.top).toBe(20);
    expect(result.bottom).toBe(20);
    expect(result.left).toBe(20);
    expect(result.right).toBe(20);
  });

  it('9: sobreposição total parcial — obstáculo ignorado em todas as 4 direções, fallback pra bordas', () => {
    // Caso da Pergunta 1 do plano: target sobrepõe outro obj.
    // Target em (40, 10), 20×20 → bottom=30, top=10.
    // Other em (45, 20), 20×20 → top=20, bottom=40 — sobrepõe verticalmente target.
    // ACIMA: other.bottom(40) < target.top(10)? não → ignorado.
    // ABAIXO: other.top(20) > target.bottom(30)? não → ignorado.
    // ESQUERDA: other.right(65) < target.left(40)? não → ignorado.
    // DIREITA: other.left(45) > target.right(60)? não → ignorado.
    // Resultado: 4 lados caem pra borda da placa.
    const target = rect(40, 10, 20, 20);
    const other = rect(45, 20, 20, 20);
    const result = computeProximity({
      target,
      others: [other],
      canvasBounds: CANVAS,
    });
    expect(result.top).toBe(10); // até borda top
    expect(result.bottom).toBe(60); // 90 - 30
    expect(result.left).toBe(40); // até borda left
    expect(result.right).toBe(240); // 300 - 60
  });
});
