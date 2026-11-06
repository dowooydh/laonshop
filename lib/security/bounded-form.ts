/** Public provider inputs are bounded before parsing; raw values must not be logged. */
export const PG_BODY_LIMIT_BYTES = 32 * 1024;

export class BoundedInputError extends Error {
  constructor(public readonly status: 400 | 413 | 415, message = "결제 결과 입력을 확인해 주세요.") {
    super(message);
    this.name = "BoundedInputError";
  }
}

type BodySource = { headers: Headers; body: ReadableStream<Uint8Array> | null };

export async function readBoundedBody(source: BodySource, limit = PG_BODY_LIMIT_BYTES): Promise<Uint8Array<ArrayBuffer>> {
  const length = source.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw new BoundedInputError(400);
  if (length !== null && Number(length) > limit) throw new BoundedInputError(413);
  if (!source.body) return new Uint8Array();
  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        throw new BoundedInputError(413);
      }
      chunks.push(new Uint8Array(value));
    }
  } catch (error) {
    if (error instanceof BoundedInputError) throw error;
    throw new BoundedInputError(400);
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function readBoundedPgForm(request: Request): Promise<FormData> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(type) && !/^multipart\/form-data(?:\s*;|$)/i.test(type)) throw new BoundedInputError(415);
  const bytes = await readBoundedBody(request);
  let form: FormData;
  try { form = await new Response(bytes, { headers: { "content-type": type } }).formData(); }
  catch { throw new BoundedInputError(400); }
  for (const value of form.values()) if (typeof value !== "string") throw new BoundedInputError(400);
  return form;
}

export function singlePgValue(form: FormData, name: string, maxLength: number): string {
  const values = form.getAll(name);
  if (values.length > 1) throw new BoundedInputError(400);
  const value = values[0] ?? "";
  if (typeof value !== "string" || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) throw new BoundedInputError(400);
  return value;
}
