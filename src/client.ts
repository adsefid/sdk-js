import { type AdsefidClientOptions, resolveClientOptions } from "./config.js";
import { MessengerResource } from "./resources/messenger.js";
import { SmsResource } from "./resources/sms.js";
import { UserResource } from "./resources/user.js";

/**
 * Entry point for the adsefid.com SMS Web Service API. Construct one per API
 * key and reuse it — it holds no per-request state beyond the resolved
 * config passed to `sms`, `messenger`, and `user`.
 */
export class AdsefidClient {
  public readonly sms: SmsResource;
  public readonly messenger: MessengerResource;
  public readonly user: UserResource;

  public constructor(options: AdsefidClientOptions) {
    const config = resolveClientOptions(options);
    this.sms = new SmsResource(config);
    this.messenger = new MessengerResource(config);
    this.user = new UserResource(config);
  }
}
