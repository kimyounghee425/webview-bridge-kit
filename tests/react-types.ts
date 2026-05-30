import { createBridgeClient } from '../src/react';
import { defineContract, event } from '../src/define';
import type { Schema } from '../src/types';

const passthrough = <T>(): Schema<T> => ({ parse: (v) => v as T });

const contract = defineContract({
  PHOTO_TAKEN: event({ payload: passthrough<{ uri: string }>() }),
});

const { useBridge, useBridgeEvent } = createBridgeClient(contract);

const bridge = useBridge();
bridge.on('PHOTO_TAKEN', (payload) => {
  const uri: string = payload.uri;
  void uri;
});

useBridgeEvent('PHOTO_TAKEN', (payload) => {
  const uri: string = payload.uri;
  void uri;
});

// @ts-expect-error event names are constrained by the contract
useBridgeEvent('MISSING_EVENT', () => {});

// @ts-expect-error payload is inferred from the event schema
useBridgeEvent('PHOTO_TAKEN', (payload: { id: string }) => {
  void payload;
});
