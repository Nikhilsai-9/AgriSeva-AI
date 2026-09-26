/**
 * MarketReliabilityService — computes per-source reliability score
 * from the `data_update_logs` collection.
 *
 * Score breakdown (sums to ~100):
 *   recentSuccessRatio    40%  — successes / attempts over last 24h
 *   fetchFreshness        30%  — minutes since last success (decays
 *                                  linearly over 6h, then floors at 0)
 *   recentActivity        20%  — at least one attempt in last 6h
 *   lowConsecutiveFails   10%  — penalised by streak of failed fetches
 *
 * The score is INTENTIONALLY about *the source itself*, not buyer trust.
 * The dashboard surfaces this as a small chip on the Market Prices page.
 */

import {inject, injectable} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  DataUpdateLogRepository,
  IDataUpdateLog,
} from '../repositories/DataUpdateLogRepository.js';
import type {MarketReliabilitySnapshot, MarketSourceId} from '../types.js';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

@injectable()
export class MarketReliabilityService {
  constructor(
    @inject(GLOBAL_TYPES.DataUpdateLogRepository)
    private readonly logRepo: DataUpdateLogRepository,
  ) {}

  public async snapshot(
    source: MarketSourceId,
  ): Promise<MarketReliabilitySnapshot> {
    const since24h = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
    const since6h = new Date(Date.now() - SIX_HOURS_MS);

    const [recent24h, recent6h] = await Promise.all([
      this.logRepo.findRecent({source, fetchedAt: {$gte: since24h.toISOString()}}, 200),
      this.logRepo.findRecent({source, fetchedAt: {$gte: since6h.toISOString()}}, 50),
    ]);

    const successes24h = recent24h.filter(r => r.success).length;
    const attempts24h = recent24h.length;
    const successes6h = recent6h.filter(r => r.success).length;
    const attempts6h = recent6h.length;
    // PHASE 2 §P2.D — captcha incidents in last 24h
    const captchaIncidentsLast24h = recent24h.filter(
      r => r.errorCategory === 'captcha',
    ).length;

    // last success & last attempt
    const all = await this.logRepo.findRecent({source}, 200);
    const lastSuccess = all.find(r => r.success);
    const lastAttempt = all[0];

    // consecutive failures
    let consecutiveFails = 0;
    for (const r of all) {
      if (r.success) break;
      consecutiveFails += 1;
    }

    const reasons: string[] = [];

    // Component 1: recentSuccessRatio (40%)
    const successRatio = attempts24h > 0 ? successes24h / attempts24h : 0;
    const successScore = Math.round(successRatio * 40);
    if (successRatio >= 0.9) reasons.push(`${Math.round(successRatio * 100)}% of recent fetches succeeded`);
    else if (successRatio < 0.5) reasons.push(`Only ${Math.round(successRatio * 100)}% of recent fetches succeeded`);

    // Component 2: fetchFreshness (30%)
    let freshnessScore = 0;
    let freshnessLabel = '';
    if (lastSuccess?.fetchedAt) {
      const ageMs = Date.now() - new Date(lastSuccess.fetchedAt).getTime();
      const sixHours = SIX_HOURS_MS;
      freshnessScore = Math.max(
        0,
        Math.round(30 * (1 - Math.min(ageMs, sixHours) / sixHours)),
      );
      const ageH = Math.round(ageMs / (60 * 60 * 1000));
      freshnessLabel = `last success ${ageH}h ago`;
      reasons.push(freshnessLabel);
    } else {
      reasons.push('no successful fetch on record');
    }

    // Component 3: recentActivity (20%)
    const activityScore = attempts6h > 0 ? 20 : 0;
    if (attempts6h === 0) reasons.push('no activity in last 6h');

    // Component 4: lowConsecutiveFails (10%)
    const failScore = Math.max(0, 10 - consecutiveFails * 2);
    if (consecutiveFails >= 2)
      reasons.push(`${consecutiveFails} consecutive failures`);

    // PHASE 2 §P2.D — captcha incidents surface as an
    // operator-visible reason. We deliberately do NOT fold
    // them into the score: captcha is an external signal
    // (the upstream is rate-limiting), not a reliability
    // problem with our code.
    if (captchaIncidentsLast24h > 0) {
      reasons.push(
        `${captchaIncidentsLast24h} captcha incident${
          captchaIncidentsLast24h === 1 ? '' : 's'
        } in last 24h — upstream may be rate-limiting`,
      );
    }

    const total = successScore + freshnessScore + activityScore + failScore;

    return {
      source,
      score: Math.max(0, Math.min(100, total)),
      label: labelFor(total),
      lastSuccessAt: lastSuccess?.fetchedAt,
      lastAttemptAt: lastAttempt?.fetchedAt,
      consecutiveFailures: consecutiveFails,
      recentSuccessesLast24h: successes24h,
      recentAttemptsLast24h: attempts24h,
      reasons,
      captchaIncidentsLast24h,
    };
  }

  public async snapshotAll(): Promise<MarketReliabilitySnapshot[]> {
    const [ag, en] = await Promise.all([
      this.snapshot('agmarknet'),
      this.snapshot('enam'),
    ]);
    return [ag, en];
  }
}

function labelFor(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Limited';
}
