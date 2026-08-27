/**
 * The one place the frontend applies a documented contract guarantee that the
 * generated OpenAPI types cannot express.
 *
 * docs/ui-backend-contract.md § "Exact models and nullability" states:
 *
 *   "Fields marked `?` are nullable. Arrays are always present and may be empty."
 *
 * FastAPI emits Pydantic list fields with defaults as non-required, so the
 * generated types mark them optional. Rather than force every component to write
 * `?? []`, the guarantee is applied once, here, at the provider boundary.
 *
 * This is not semantic derivation: filling an absent array with an empty array is
 * exactly what the contract promises. Nothing in this file interprets a value.
 */

export const list = <T>(value: T[] | undefined | null): T[] => value ?? [];

export const text = (value: string | undefined | null): string => value ?? "";
