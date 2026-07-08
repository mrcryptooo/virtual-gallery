/**
 * @virtual-gallery/engine — public API surface.
 *
 * This file is the ONLY entry point clients may import (doc 03 rule 1).
 * The engine facade (`createPanoramaEngine`) lands in milestone M1.2;
 * until then this module exports wiring constants only — no engine code
 * exists yet by design (M0.0 scope).
 */

/** Package identity, used by clients to verify workspace wiring. */
export const ENGINE_NAME = '@virtual-gallery/engine';

/** Engine version; kept in lockstep with package.json once the facade lands (M1.2). */
export const ENGINE_VERSION = '0.0.0';
