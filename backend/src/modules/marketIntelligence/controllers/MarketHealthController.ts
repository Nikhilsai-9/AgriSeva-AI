/**
 * MarketHealthController — liveness endpoint for the market
 * intelligence layer.
 *
 * Surfaces the resolved upstream MCP endpoints and recent
 * reliability snapshots so operators can confirm both MCPs are
 * reachable from this backend.
 */

import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {JsonController, Get, HttpCode} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {GLOBAL_TYPES} from '#root/types.js';
import {AgmarknetMcpClient} from '../mcp/agmarknetClient.js';
import {EnamMcpClient} from '../mcp/enamClient.js';
import {MarketReliabilityService} from '../services/ReliabilityService.js';
import type {MarketReliabilitySnapshot} from '../types.js';

@OpenAPI({
  tags: ['market-intelligence'],
  description: 'Operational health for the market-intelligence layer.',
})
@injectable()
@JsonController('/market-health')
export class MarketHealthController {
  constructor(
    @inject(GLOBAL_TYPES.AgmarknetMcpClient)
    private readonly agmarknet: AgmarknetMcpClient,

    @inject(GLOBAL_TYPES.EnamMcpClient)
    private readonly enam: EnamMcpClient,

    @inject(GLOBAL_TYPES.MarketReliabilityService)
    private readonly reliabilityService: MarketReliabilityService,
  ) {}

  @OpenAPI({summary: 'Upstream endpoint + reliability snapshot'})
  @Get('/')
  @HttpCode(200)
  async health(): Promise<{
    success: boolean;
    fetchedAt: string;
    /** PHASE 2 §P2.D — true when any source has had a captcha
     *  incident in the last 24h. Operators can monitor this
     *  to detect upstream rate-limiting without scraping the
     *  full reliability snapshots. */
    captchaSuspected: boolean;
    sources: Array<{
      id: string;
      endpoint: string;
      reliability: MarketReliabilitySnapshot;
    }>;
  }> {
    const [agRel, enRel] = await Promise.all([
      this.reliabilityService.snapshot('agmarknet'),
      this.reliabilityService.snapshot('enam'),
    ]);
    const captchaSuspected =
      agRel.captchaIncidentsLast24h > 0 || enRel.captchaIncidentsLast24h > 0;
    return {
      success: !captchaSuspected,
      fetchedAt: new Date().toISOString(),
      captchaSuspected,
      sources: [
        {
          id: 'agmarknet',
          endpoint: this.agmarknet.getEndpoint(),
          reliability: agRel,
        },
        {
          id: 'enam',
          endpoint: this.enam.getEndpoint(),
          reliability: enRel,
        },
      ],
    };
  }
}
