import type { State } from '$lib/types';
import { fromBase64, fromUint8Array, toBase64, toUint8Array } from 'js-base64';
import { deflate, Inflate } from 'pako';

/**
 * Local: the most a link may unpack to. Deflate packs repetitive text about
 * 1000:1, so without a limit a link of a few hundred KB unpacks to hundreds of
 * MB before anything can look at it. No diagram comes near 5 MB.
 */
export const MAX_INFLATED_BYTES = 5 * 1024 * 1024;

const tooLarge = (): Error =>
  new RangeError(
    `The link's diagram is larger than ${MAX_INFLATED_BYTES / 1024 / 1024} MB once unpacked, so it was not loaded.`
  );

interface Serde {
  serialize: (state: string) => string;
  deserialize: (state: string) => string;
}

const base64Serde: Serde = {
  serialize: (state: string): string => {
    return toBase64(state, true);
  },
  deserialize: (state: string): string => {
    // Local: base64 is 4 characters per 3 bytes, so the length tells the size.
    if (Math.floor((state.length * 3) / 4) > MAX_INFLATED_BYTES) throw tooLarge();
    return fromBase64(state);
  }
};

export const pakoSerde: Serde = {
  serialize: (state: string): string => {
    const data = new TextEncoder().encode(state);
    const compressed = deflate(data, { level: 9 });
    return fromUint8Array(compressed, true);
  },
  deserialize: (state: string): string => {
    const data = toUint8Array(state);
    // Local: inflated in chunks and stopped at MAX_INFLATED_BYTES. The bytes are
    // decoded once at the end with TextDecoder, as pako 2.1.0's `to: 'string'`
    // does (serde.compat.test.ts holds the result to that).
    const inflator = new Inflate({ chunkSize: 64 * 1024 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    inflator.onData = (chunk: Uint8Array) => {
      size += chunk.length;
      if (size > MAX_INFLATED_BYTES) throw tooLarge();
      chunks.push(chunk);
    };
    inflator.push(data, true);
    if (inflator.err) {
      throw new Error(inflator.msg || 'The link could not be unpacked');
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(bytes);
  }
};

export type SerdeType = 'base64' | 'pako';

const serdes: Record<SerdeType, Serde> = {
  base64: base64Serde,
  pako: pakoSerde
};

export const serializeState = (state: State, serde: SerdeType = 'pako'): string => {
  if (!(serde in serdes)) {
    throw new Error(`Unknown serde type: ${serde}`);
  }
  const json = JSON.stringify(state);
  const serialized = serdes[serde].serialize(json);
  return `${serde}:${serialized}`;
};

export const deserializeState = (state: string): State => {
  let type: SerdeType, serialized: string;
  if (state.includes(':')) {
    let tempType: string;
    [tempType, serialized] = state.split(':');
    if (tempType in serdes) {
      type = tempType as SerdeType;
    } else {
      throw new Error(`Unknown serde type: ${tempType}`);
    }
  } else {
    type = 'base64';
    serialized = state;
  }
  const json = serdes[type].deserialize(serialized);
  return JSON.parse(json) as State;
};
