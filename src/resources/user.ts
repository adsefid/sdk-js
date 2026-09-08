import type { ResolvedAdsefidClientOptions } from "../config.js";
import { dateFromWire, type Wire } from "../dates.js";
import { TemplateParameterType } from "../enums.js";
import { sendRequest } from "../http.js";
import type {
  GetUserInfoResponse,
  GetUserLinesResponse,
  GetUserProfilesResponse,
  GetUserTemplatesQuery,
  GetUserTemplatesResponse,
} from "../models/user.js";
import { assertInRange } from "../validation.js";

const TEMPLATES_MIN_TAKE = 1;
const TEMPLATES_MAX_TAKE = 100;

/** Account/user endpoints — accessed via `client.user`. */
export class UserResource {
  public constructor(private readonly config: ResolvedAdsefidClientOptions) {}

  /** GET /v1/user/info — doc §6.1 */
  public async getInfo(): Promise<GetUserInfoResponse> {
    return sendRequest<GetUserInfoResponse>(this.config, {
      method: "GET",
      path: "/v1/user/info",
    });
  }

  /** GET /v1/user/lines — doc §6.2 */
  public async getLines(): Promise<GetUserLinesResponse> {
    return sendRequest<GetUserLinesResponse>(this.config, {
      method: "GET",
      path: "/v1/user/lines",
    });
  }

  /** GET /v1/user/profiles — doc §6.3 */
  public async getProfiles(): Promise<GetUserProfilesResponse> {
    return sendRequest<GetUserProfilesResponse>(this.config, {
      method: "GET",
      path: "/v1/user/profiles",
    });
  }

  /** GET /v1/user/templates — doc §6.4 */
  public async getTemplates(query: GetUserTemplatesQuery = {}): Promise<GetUserTemplatesResponse> {
    if (query.take !== undefined) {
      assertInRange(query.take, TEMPLATES_MIN_TAKE, TEMPLATES_MAX_TAKE, "take");
    }
    if (query.skip !== undefined) {
      assertInRange(query.skip, 0, Number.MAX_SAFE_INTEGER, "skip");
    }

    const response = await sendRequest<Wire<GetUserTemplatesResponse>>(this.config, {
      method: "GET",
      path: "/v1/user/templates",
      query: {
        state: query.state,
        skip: query.skip?.toString(),
        take: query.take?.toString(),
      },
    });

    return {
      ...response,
      items: response.items.map((item) => ({
        ...item,
        created_at: dateFromWire(item.created_at, "created_at"),
        updated_at: dateFromWire(item.updated_at, "updated_at"),
        parameters: Object.fromEntries(
          Object.entries(item.parameters).filter(
            ([, type]) =>
              type === TemplateParameterType.String || type === TemplateParameterType.Number,
          ),
        ),
      })),
    };
  }
}
