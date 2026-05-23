/**
 * Gerador de IDs Capi para objetos do canvas e camadas.
 *
 * Prefixo curto + sequência crypto-random. Não é UUID puro (mais legível em
 * debug) mas é colisão-resistente o bastante para projetos com milhares de
 * objetos.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSegment(len: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    let out = '';
    for (let i = 0; i < len; i++) {
      out += ALPHABET[arr[i] % ALPHABET.length];
    }
    return out;
  }
  // Fallback: Math.random (não criptográfico — só em ambientes sem WebCrypto,
  // o que não é o caso de Tauri/Node 18+ mas mantém o código defensivo).
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** ID de objeto canvas: 'obj-XXXXXXXX'. */
export function newObjectId(): string {
  return `obj-${randomSegment(8)}`;
}

/** ID de camada: 'lay-XXXXXXXX'. */
export function newLayerId(): string {
  return `lay-${randomSegment(8)}`;
}
