/**
 * A file to upload. `Uint8Array` covers a Node.js `Buffer` and the bytes Bun and
 * Deno file APIs return; pass it directly rather than its `.buffer`, which can be
 * a larger shared pool.
 */
export type UploadableFile = Blob | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>;

export interface BuildFileFormDataParams {
  file: UploadableFile;
  filename: string;
  contentType?: string;
}

/**
 * Builds a native `FormData` with field name `file`, matching doc §5.4.
 * `fetch` computes the multipart boundary automatically.
 */
export async function buildFileFormData(params: BuildFileFormDataParams): Promise<FormData> {
  const formData = new FormData();
  const blob = await toBlob(params.file, params.contentType);
  formData.set("file", blob, params.filename);
  return formData;
}

async function toBlob(file: UploadableFile, contentType?: string): Promise<Blob> {
  const options = contentType ? { type: contentType } : {};
  if (file instanceof Blob) {
    return contentType ? file.slice(0, file.size, contentType) : file;
  }
  if (file instanceof Uint8Array) {
    // slice() copies exactly the viewed bytes into an unshared ArrayBuffer.
    return new Blob([file.slice()], options);
  }
  if (file instanceof ArrayBuffer) {
    return new Blob([file], options);
  }
  const buffered = await new Response(file).blob();
  return contentType ? buffered.slice(0, buffered.size, contentType) : buffered;
}
