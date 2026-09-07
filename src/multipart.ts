export type UploadableFile = Blob | ArrayBuffer | ReadableStream<Uint8Array>;

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
  if (file instanceof Blob) {
    return contentType ? file.slice(0, file.size, contentType) : file;
  }
  if (file instanceof ArrayBuffer) {
    return new Blob([file], contentType ? { type: contentType } : {});
  }
  // ReadableStream<Uint8Array>: buffer it via the Fetch API's Response helper,
  // which is globally available in Node 18+.
  const buffered = await new Response(file).blob();
  return contentType ? buffered.slice(0, buffered.size, contentType) : buffered;
}
