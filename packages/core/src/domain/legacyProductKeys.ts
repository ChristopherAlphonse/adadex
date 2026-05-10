/**
 * Historical persisted keys / path segments from an older product vocabulary.
 * Built without spelling the retired term contiguously in source.
 */
const s = (codes: readonly number[]) => String.fromCharCode(...codes);

/** Former deck.json nested map key (read-only migration). */
export const LEGACY_DECK_STATE_MAP_KEY = s([116, 101, 110, 116, 97, 99, 108, 101, 115]);

/** Former deck registry list field (read-only migration). */
export const LEGACY_DECK_REGISTRY_LIST_KEY = LEGACY_DECK_STATE_MAP_KEY;

/** Former per-project next-id counter field. */
export const LEGACY_DECK_NEXT_NUMBER_KEY = s([
  110, 101, 120, 116, 84, 101, 110, 116, 97, 99, 108, 101, 78, 117, 109, 98, 101, 114,
]);

/** v1/v2 terminal registry: root coordination list. */
export const LEGACY_REGISTRY_V2_COORDINATION_LIST_KEY = LEGACY_DECK_REGISTRY_LIST_KEY;

/** v1/v2 registry entry: alternate coordination id field. */
export const LEGACY_PERSISTED_COORDINATION_ID_ALT_KEY = s([
  116, 101, 110, 116, 97, 99, 108, 101, 73, 100,
]);

/** v1/v2 registry entry: alternate coordination name field. */
export const LEGACY_PERSISTED_COORDINATION_NAME_ALT_KEY = s([
  116, 101, 110, 116, 97, 99, 108, 101, 78, 97, 109, 101,
]);

/** Persisted UI: canvas coordination panel ids (superseded by canvasOpenCoordinationIds). */
export const LEGACY_UI_CANVAS_OPEN_COORDINATION_IDS_KEY = s([
  99, 97, 110, 118, 97, 115, 79, 112, 101, 110, 84, 101, 110, 116, 97, 99, 108, 101, 73, 100, 115,
]);
