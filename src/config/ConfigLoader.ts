import { ATLASConfig, ATLASConfigSchema } from './ATLASConfig';
import * as dotenv from 'dotenv';

export class ATLASConfigLoader {
  static load(): ATLASConfig {
    dotenv.config();

    return ATLASConfigSchema.parse({
      browser: { 
        viewport: {},
        headless: process.env.ATLAS_HEADLESS !== 'false'
      },
      navigation: {
        strictDomainCheck: process.env.ATLAS_STRICT_DOMAIN_CHECK !== 'false'
      },
      reasoning: {},
      resilience: {},
      execution: {},
      screenshots: {},
      logging: {},
      events: {
        asyncDispatch: process.env.ATLAS_ASYNC_EVENTS === 'true'
      }
    });
  }
}
