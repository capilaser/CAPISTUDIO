import { describe, expect, it, vi } from 'vitest';

import { humanizeError, svgErrorToToastArgs } from '@/core/canvas/corel-svg-errors';

describe('humanizeError', () => {
  it('aceita string direto', () => {
    const result = humanizeError('SVG está vazio. Corel exportou apenas elementos não-suportados.');
    expect(result.title).toBe('SVG sem elementos de desenho');
    expect(result.description).toMatch(/converta em curva/i);
  });

  it('aceita Error instance', () => {
    const result = humanizeError(new Error('SVG precisa estar em milímetros (recebemos pixels).'));
    expect(result.title).toBe('SVG precisa estar em milímetros');
    expect(result.description).toMatch(/Layout/);
  });

  it('aceita unknown qualquer', () => {
    const result = humanizeError({ weird: 'object' });
    expect(result.title).toBeTruthy();
  });

  describe('mapeamentos específicos', () => {
    it('SVG corrompido (XML malformed) loga detalhe técnico no console', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const raw = 'SVG inválido: não foi possível processar. (parse error)';
      const result = humanizeError(raw);
      expect(result.title).toBe('Arquivo SVG corrompido');
      expect(result.description).toMatch(/reexportar/i);
      expect(spy).toHaveBeenCalledWith('[corel-svg-parser] detalhe técnico:', raw);
      spy.mockRestore();
    });

    it('dimensão zerada', () => {
      const result = humanizeError('SVG com dimensão inválida no header: width="0mm".');
      expect(result.title).toBe('Tamanho do SVG inválido');
      expect(result.description).toMatch(/zero ou ilegível/i);
    });

    it('aspect ratio distorcido', () => {
      const result = humanizeError(
        'Esse SVG está esticado — largura e altura foram redimensionadas em escalas diferentes.'
      );
      expect(result.title).toBe('SVG com proporção distorcida');
      expect(result.description).toMatch(/Shift/);
    });

    it('viewBox ausente', () => {
      const result = humanizeError('Invalid viewBox attribute: "abc"');
      expect(result.title).toBe('SVG sem área de trabalho válida');
    });

    it('imagem rasterizada', () => {
      const result = humanizeError('SVG contém imagem rasterizada. Capi só aceita vetores.');
      expect(result.title).toBe('SVG contém imagem (não-vetor)');
      expect(result.description).toMatch(/foto.*imagem/i);
    });

    it('texto não convertido', () => {
      const result = humanizeError(
        'SVG tem texto não convertido em curva. No Corel: selecione texto, Ctrl+Q.'
      );
      expect(result.title).toBe('Texto não convertido em curva');
      expect(result.description).toMatch(/Ctrl\+Q/);
    });

    it('use/symbol references', () => {
      const result = humanizeError(
        'SVG tem referências internas não suportadas. No Corel: Ctrl+K para quebrar vínculos.'
      );
      expect(result.title).toBe('SVG com referências internas');
      expect(result.description).toMatch(/Ctrl\+K/);
    });
  });

  it('fallback: mensagem desconhecida vira título sem descrição', () => {
    const result = humanizeError('Erro genérico não mapeado.');
    expect(result.title).toBe('Erro genérico não mapeado.');
    expect(result.description).toBeUndefined();
  });
});

describe('svgErrorToToastArgs', () => {
  it('quando há description, options inclui description', () => {
    const result = svgErrorToToastArgs('SVG está vazio.');
    expect(result.title).toBe('SVG sem elementos de desenho');
    expect(result.options.description).toBeTruthy();
  });

  it('quando NÃO há description (fallback), options fica vazia', () => {
    const result = svgErrorToToastArgs('Erro qualquer.');
    expect(result.title).toBe('Erro qualquer.');
    expect(result.options).toEqual({});
  });
});
