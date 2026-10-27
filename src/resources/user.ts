import type { ResolvedAdsefidClientOptions } from "../config.js";
import { dateFromWire, type Wire } from "../dates.js";
import { type CallOptions, sendRequest } from "../http.js";
import type {
  GetUserInfoResponse,
  GetUserLinesResponse,
  GetUserProfilesResponse,
  GetUserTemplatesQuery,
  GetUserTemplatesResponse,
} from "../models/user.js";
import { assertInRange, LIMITS } from "../validation.js";
import { mapResponse } from "../wire.js";

/** Account/user endpoints — accessed via `client.user`. */
export class UserResource {
  public constructor(private readonly config: ResolvedAdsefidClientOptions) {}

  /** GET /v1/user/info — doc §6.1 */
  public async getInfo(options?: CallOptions): Promise<GetUserInfoResponse> {
    return sendRequest<GetUserInfoResponse>(
      this.config,
      {
        method: "GET",
        path: "/v1/user/info",
      },
      options,
    );
  }

  /** GET /v1/user/lines — doc §6.2 */
  public async getLines(options?: CallOptions): Promise<GetUserLinesResponse> {
    return sendRequest<GetUserLinesResponse>(
      this.config,
      {
        method: "GET",
        path: "/v1/user/lines",
        expect: "array",
      },
      options,
    );
  }

  /** GET /v1/user/profiles — doc §6.3 */
  public async getProfiles(options?: CallOptions): Promise<GetUserProfilesResponse> {
    return sendRequest<GetUserProfilesResponse>(
      this.config,
      {
        method: "GET",
        path: "/v1/user/profiles",
        expect: "array",
      },
      options,
    );
  }

  /** GET /v1/user/templates — doc §6.4 */
  public async getTemplates(
    query: GetUserTemplatesQuery = {},
    options?: CallOptions,
  ): Promise<GetUserTemplatesResponse> {
    if (query.take !== undefined) {
      assertInRange(query.take, LIMITS.templatesTakeMin, LIMITS.templatesTakeMax, "take");
    }
    if (query.skip !== undefined) {
      assertInRange(query.skip, 0, Number.MAX_SAFE_INTEGER, "skip");
    }

    const response = await sendRequest<Wire<GetUserTemplatesResponse>>(
      this.config,
      {
        method: "GET",
        path: "/v1/user/templates",
        query: {
          state: query.state,
          skip: query.skip?.toString(),
          take: query.take?.toString(),
        },
      },
      options,
    );

    return mapResponse("/v1/user/templates", () => ({
      ...response,
      items: response.items.map((item) => ({
        ...item,
        created_at: dateFromWire(item.created_at, "created_at"),
        updated_at: dateFromWire(item.updated_at, "updated_at"),
      })),
    }));
  }
}
