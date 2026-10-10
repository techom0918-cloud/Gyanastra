// Reads a JSON request body with a hard byte limit, so oversized payloads are refused before parsing.
import { NextResponse } from 'next/server';

export const DEFAULT_MAX_BODY_BYTES = 16 * 1024;

export type JsonBodyResult = { ok: true; value: unknown } | { ok: false; response: NextResponse };

export async function readJsonBody(req: Request, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<JsonBodyResult> {
  const tooLarge = () => ({ ok: false as const, response: NextResponse.json({ error: 'Request body too large' }, { status: 413 }) });
  const invalid = () => ({ ok: false as const, response: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) });

  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();
  if (!req.body) return invalid();

  // Content-Length can be absent or wrong (chunked uploads), so count bytes while streaming.
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return tooLarge();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
  } catch {
    return invalid();
  }
}
