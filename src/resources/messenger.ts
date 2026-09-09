import type { ResolvedAdsefidClientOptions } from "../config.js";
import { dateToWire, nullableDateFromWire, type Wire } from "../dates.js";
import { sendRequest } from "../http.js";
import type {
  CancelMessengerRequest,
  CancelMessengerResponse,
  GetMessengerStatusQuery,
  GetMessengerStatusResponse,
  SendBulkMessengerRequest,
  SendBulkMessengerResponse,
  SendP2pMessengerRequest,
  SendP2pMessengerResponse,
  SendSingleMessengerRequest,
  SendSingleMessengerResponse,
  SendTemplateMessengerRequest,
  SendTemplateMessengerResponse,
  UploadMessengerFileResponse,
} from "../models/messenger.js";
import { buildFileFormData, type UploadableFile } from "../multipart.js";
import {
  assertAtLeastOneProvided,
  assertMaxCount,
  assertMaxLength,
  assertNonEmptyArray,
  assertRequired,
  assertValidLocalId,
  joinCsv,
  LIMITS,
} from "../validation.js";

/** Params for `client.messenger.uploadFile` — `POST /v1/messenger/file` (doc §5.4). */
export interface UploadMessengerFileParams {
  file: UploadableFile;
  filename: string;
  /** If omitted, a `Blob`'s own `.type` is used; other input kinds get no content type. */
  contentType?: string;
}

/** Messenger (Rubika/Bale/etc.) endpoints — accessed via `client.messenger`. */
export class MessengerResource {
  public constructor(private readonly config: ResolvedAdsefidClientOptions) {}

  /** POST /v1/messenger/single — doc §5.1 */
  public async sendSingle(
    request: SendSingleMessengerRequest,
  ): Promise<SendSingleMessengerResponse> {
    assertRequired(request.message, "message");
    assertMaxLength(request.message, LIMITS.messengerMessageMaxLength, "message");
    assertRequired(request.receptor, "receptor");
    assertRequired(request.profile, "profile");
    assertValidLocalId(request.local_id, "local_id");

    const response = await sendRequest<Wire<SendSingleMessengerResponse>>(this.config, {
      method: "POST",
      path: "/v1/messenger/single",
      jsonBody: { ...request, send_time: dateToWire(request.send_time, "send_time") },
    });

    return { ...response, send_time: nullableDateFromWire(response.send_time, "send_time") };
  }

  /** POST /v1/messenger/bulk — doc §5.2 */
  public async sendBulk(request: SendBulkMessengerRequest): Promise<SendBulkMessengerResponse> {
    assertNonEmptyArray(request.receptors, "receptors");
    assertRequired(request.message, "message");
    assertMaxLength(request.message, LIMITS.messengerMessageMaxLength, "message");
    assertRequired(request.profile, "profile");
    request.receptors.forEach((receptor, index) => {
      assertRequired(receptor.receptor, `receptors[${index}].receptor`);
      assertValidLocalId(receptor.local_id, `receptors[${index}].local_id`);
    });

    const response = await sendRequest<Wire<SendBulkMessengerResponse>>(this.config, {
      method: "POST",
      path: "/v1/messenger/bulk",
      jsonBody: { ...request, send_time: dateToWire(request.send_time, "send_time") },
    });

    return { ...response, send_time: nullableDateFromWire(response.send_time, "send_time") };
  }

  /** POST /v1/messenger/p2p — doc §5.3 */
  public async sendP2P(request: SendP2pMessengerRequest): Promise<SendP2pMessengerResponse> {
    assertNonEmptyArray(request.receptors, "receptors");
    assertRequired(request.profile, "profile");
    request.receptors.forEach((receptor, index) => {
      assertRequired(receptor.receptor, `receptors[${index}].receptor`);
      assertRequired(receptor.message, `receptors[${index}].message`);
      assertMaxLength(
        receptor.message,
        LIMITS.messengerMessageMaxLength,
        `receptors[${index}].message`,
      );
      assertValidLocalId(receptor.local_id, `receptors[${index}].local_id`);
    });

    const response = await sendRequest<Wire<SendP2pMessengerResponse>>(this.config, {
      method: "POST",
      path: "/v1/messenger/p2p",
      jsonBody: { ...request, send_time: dateToWire(request.send_time, "send_time") },
    });

    return { ...response, send_time: nullableDateFromWire(response.send_time, "send_time") };
  }

  /** POST /v1/messenger/file — doc §5.4 */
  public async uploadFile(params: UploadMessengerFileParams): Promise<UploadMessengerFileResponse> {
    assertRequired(params.file, "file");
    assertRequired(params.filename, "filename");
    const formData = await buildFileFormData(params);

    return sendRequest<UploadMessengerFileResponse>(this.config, {
      method: "POST",
      path: "/v1/messenger/file",
      formBody: formData,
    });
  }

  /** POST /v1/messenger/cancel — doc §5.5 */
  public async cancel(request: CancelMessengerRequest): Promise<CancelMessengerResponse> {
    assertAtLeastOneProvided([
      { name: "message_ids", value: request.message_ids },
      { name: "local_ids", value: request.local_ids },
    ]);

    return sendRequest<CancelMessengerResponse>(this.config, {
      method: "POST",
      path: "/v1/messenger/cancel",
      jsonBody: request,
    });
  }

  /** POST /v1/messenger/template — doc §5.6 */
  public async sendTemplate(
    request: SendTemplateMessengerRequest,
  ): Promise<SendTemplateMessengerResponse> {
    assertRequired(request.template_id, "template_id");
    assertRequired(request.parameters, "parameters");
    assertRequired(request.receptor, "receptor");
    assertRequired(request.profile, "profile");
    assertValidLocalId(request.local_id, "local_id");

    const response = await sendRequest<Wire<SendTemplateMessengerResponse>>(this.config, {
      method: "POST",
      path: "/v1/messenger/template",
      jsonBody: { ...request, expiry_date: dateToWire(request.expiry_date, "expiry_date") },
    });

    return {
      ...response,
      send_time: nullableDateFromWire(response.send_time, "send_time"),
      expiry_date: nullableDateFromWire(response.expiry_date, "expiry_date"),
    };
  }

  /** GET /v1/messenger/status — doc §5.7 */
  public async getStatus(query: GetMessengerStatusQuery): Promise<GetMessengerStatusResponse> {
    assertAtLeastOneProvided([
      { name: "message_ids", value: query.message_ids },
      { name: "local_ids", value: query.local_ids },
    ]);
    const combinedCount =
      new Set(query.message_ids ?? []).size + new Set(query.local_ids ?? []).size;
    assertMaxCount(combinedCount, LIMITS.combinedStatusIdsMax, "message_ids+local_ids");

    const response = await sendRequest<Wire<GetMessengerStatusResponse>>(this.config, {
      method: "GET",
      path: "/v1/messenger/status",
      query: {
        message_ids: joinCsv(query.message_ids),
        local_ids: joinCsv(query.local_ids),
      },
    });

    return {
      receptors: response.receptors.map((receptor) => ({
        ...receptor,
        send_time: nullableDateFromWire(receptor.send_time, "send_time"),
        delivery_time: nullableDateFromWire(receptor.delivery_time, "delivery_time"),
      })),
    };
  }
}
