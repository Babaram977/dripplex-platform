/**
 * Types for `server.mjs`.
 *
 * The server stays plain `.mjs` on purpose: the Docker runner stage copies it
 * next to `dist/` and runs it with bare `node`, with no build step and no
 * TypeScript toolchain in the image. Hand-written declarations are the cost of
 * that, and they are small.
 */
import type { Server } from 'node:http';

/** Apple's required Universal Links path. */
export declare const AASA_ROUTE: string;

/**
 * Builds the static server: `serve-handler` for everything, with
 * {@link AASA_ROUTE} answered directly as `application/json`.
 *
 * @param root directory containing `dist/` and `serve.json`; defaults to cwd.
 */
export declare function createApp(root?: string): Promise<Server>;
