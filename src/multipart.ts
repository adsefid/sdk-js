import { AdsefidValidationError } from "./errors.js";
import { MESSENGER_MAX_FILE_SIZE_BYTES } from "./models/messenger.js";

/**
 * A file to upload. `Uint8Array` covers a Node.js `Buffer` and the bytes Bun and
 * Deno file APIs return; pass it directly rather than its `.buffer`, which can be
 * a larger shared pool.
 */
export type UploadableFile = Blob | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>;

export interface BuildFileFormDataParams {
  file: UploadableFile;
  filename: string;
  contentType: string;
}

/**
 * Builds a native `FormData` with field name `file`, matching doc §5.4.
 * `fetch` computes the multipart boundary automatically. Content above the
 * 15 MiB limit is rejected with an `AdsefidValidationError`.
 */
export async function buildFileFormData(params: BuildFileFormDataParams): Promise<FormData> {
  const blob = await toBlob(params.file, params.contentType);
  if (blob.size > MESSENGER_MAX_FILE_SIZE_BYTES) {
    throw new AdsefidValidationError(
      `file must be at most ${MESSENGER_MAX_FILE_SIZE_BYTES} bytes (15 MiB), got ${blob.size}`,
      "file",
    );
  }
  const formData = new FormData();
  formData.set("file", blob, params.filename);
  return formData;
}

async function toBlob(file: UploadableFile, contentType: string): Promise<Blob> {
  if (file instanceof Blob) {
    return file.slice(0, file.size, contentType);
  }
  if (file instanceof Uint8Array) {
    // slice() copies exactly the viewed bytes into an unshared ArrayBuffer.
    return new Blob([file.slice()], { type: contentType });
  }
  if (file instanceof ArrayBuffer) {
    return new Blob([file], { type: contentType });
  }
  const buffered = await new Response(file).blob();
  return buffered.slice(0, buffered.size, contentType);
}
