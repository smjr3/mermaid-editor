import { describe, expect, it } from 'vitest';
import {
  deserializeState,
  MAX_INFLATED_BYTES,
  pakoSerde,
  serializeState,
  type SerdeType
} from './serde';
import { defaultState } from './state.svelte';
import type { State } from '$lib/types';

const verifySerde = (state: State, serde?: SerdeType): string => {
  const serialized = serializeState(state, serde);
  const deserialized = deserializeState(serialized);
  expect(deserialized).to.deep.equal(state);
  return serialized;
};

describe('Serde tests', () => {
  it('should serialize and deserialize with default serde', () => {
    expect(verifySerde(defaultState)).toMatchInlineSnapshot(
      `"pako:eNpVjLFuwkAQRH9ltVUi4R9wgQR2QoMEBVUcipW99p3gbk_rs1Bk-985A5GS6UbvzYxYS8OYY3uVW21II5zKbw8pm6owavvoqD9Dlq2nHUdw4vlngu3bTqA3EoL13fvT3y4SFON-0Riisf4yP1Hx2B88T1BWewpRwvkvOd1kgo_KHk26_0-Mclp9Vi3lLWU1KRSkDwVX2KltMI868Aodq6Ol4jgnFMh_ibhfqjJ0BtPFtU9tCA1FLi11Si9lvgMWKFYF"`
    );
  });

  it('should serialize and deserialize with base64 serde', () => {
    expect(verifySerde(defaultState, 'base64')).toMatchInlineSnapshot(
      `"base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgQVtDaHJpc3RtYXNdIC0tPnxHZXQgbW9uZXl8IEIoR28gc2hvcHBpbmcpXG4gICAgQiAtLT4gQ3tMZXQgbWUgdGhpbmt9XG4gICAgQyAtLT58T25lfCBEW0xhcHRvcF1cbiAgICBDIC0tPnxUd298IEVbaVBob25lXVxuICAgIEMgLS0-fFRocmVlfCBGW2ZhOmZhLWNhciBDYXJdXG4gICIsImdyaWQiOnRydWUsIm1lcm1haWQiOiJ7fSIsInBhblpvb20iOnRydWUsInJvdWdoIjpmYWxzZSwidXBkYXRlRGlhZ3JhbSI6dHJ1ZX0"`
    );
  });

  it('should serialize and deserialize with pako serde', () => {
    expect(verifySerde(defaultState, 'pako')).toMatchInlineSnapshot(
      `"pako:eNpVjLFuwkAQRH9ltVUi4R9wgQR2QoMEBVUcipW99p3gbk_rs1Bk-985A5GS6UbvzYxYS8OYY3uVW21II5zKbw8pm6owavvoqD9Dlq2nHUdw4vlngu3bTqA3EoL13fvT3y4SFON-0Riisf4yP1Hx2B88T1BWewpRwvkvOd1kgo_KHk26_0-Mclp9Vi3lLWU1KRSkDwVX2KltMI868Aodq6Ol4jgnFMh_ibhfqjJ0BtPFtU9tCA1FLi11Si9lvgMWKFYF"`
    );
  });

  it('should throw error for unrecognized serde', () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    expect(() => serializeState(defaultState, 'unknown')).toThrowError(
      'Unknown serde type: unknown'
    );
    expect(() => deserializeState('unknown:hello')).toThrowError('Unknown serde type: unknown');
  });
});

// Local: a link is a few hundred KB at most, but deflate packs repetitive text
// about 1000:1 — a 265 KB hash unpacked to 200 MB (+500 MB of memory) before
// this cap. Measured with pako 2.1.0 in Node 24.
describe('unpacking a link', () => {
  const stateOfSize = (bytes: number) =>
    JSON.stringify({ code: `graph TD\n${'A'.repeat(bytes)}`, mermaid: '{}' });

  it('is capped at 5 MB', () => {
    expect(MAX_INFLATED_BYTES).toBe(5 * 1024 * 1024);
  });

  it('refuses a pako link that unpacks to more than the cap, with a clear error', () => {
    const bomb = `pako:${pakoSerde.serialize(stateOfSize(MAX_INFLATED_BYTES + 1))}`;
    expect(bomb.length).toBeLessThan(20_000);
    expect(() => deserializeState(bomb)).toThrow(/larger than 5 MB/);
  });

  it('still reads a large diagram below the cap', () => {
    const json = stateOfSize(MAX_INFLATED_BYTES - 1024);
    expect(deserializeState(`pako:${pakoSerde.serialize(json)}`)).toEqual(JSON.parse(json));
  });

  it('keeps multi-byte text whole across unpacked chunks', () => {
    const code = `graph TD\n${'図形🙂'.repeat(50_000)}`;
    const json = JSON.stringify({ code, mermaid: '{}' });
    expect(pakoSerde.deserialize(pakoSerde.serialize(json))).toBe(json);
  });

  it('refuses a base64 link that decodes to more than the cap', () => {
    const big = `base64:${btoa(stateOfSize(MAX_INFLATED_BYTES + 1))}`;
    expect(() => deserializeState(big)).toThrow(/larger than 5 MB/);
  });

  it('reports a corrupt pako link as an error', () => {
    expect(() => deserializeState('pako:AAAA')).toThrow();
  });
});
