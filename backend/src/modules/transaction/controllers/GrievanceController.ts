/**
 * GrievanceController — REST endpoints for farmer grievance tickets.
 *
 * Closes the missing "grievance status update" workflow that the audit
 * flagged: open -> in_review -> resolved/rejected.
 *
 * Authentication: every endpoint requires a valid Firebase ID token.
 * The authenticated principal's Mongo `_id` is the source of truth
 * for ownership checks — no client-supplied `x-demo-farmer-id` header
 * is trusted. Mutations also fire `NotificationService` events.
 */

import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {
  JsonController,
  Authorized,
  Get,
  Post,
  Patch,
  Param,
  Body,
  QueryParams,
  CurrentUser,
  HttpCode,
  NotFoundError,
  ForbiddenError,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {GLOBAL_TYPES} from '#root/types.js';
import {GrievanceRepository} from '../repositories/GrievanceRepository.js';
import {SeedLoader} from '../services/SeedLoader.js';
import {NotificationService} from '#root/modules/notification/services/NotificationService.js';
import type {IUser} from '#root/shared/interfaces/models.js';
import type {GrievanceRecord} from '../types.js';
import {
  GrievanceListQuery,
  GrievanceIdParam,
  CreateGrievanceBody,
  UpdateGrievanceBody,
} from '../validators/TransactionValidators.js';

function randomId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function farmerIdOf(user: IUser): string {
  return user._id!.toString();
}

@OpenAPI({tags: ['transaction']})
@injectable()
@JsonController('/grievances')
export class GrievanceController {
  constructor(
    @inject(GLOBAL_TYPES.TransactionGrievanceRepository)
    private readonly grievances: GrievanceRepository,
    @inject(GLOBAL_TYPES.TransactionSeedLoader)
    private readonly seed: SeedLoader,
    @inject(GLOBAL_TYPES.NotificationService)
    private readonly notifications: NotificationService,
  ) {}

  @Authorized()
  @Get('/')
  @HttpCode(200)
  async list(
    @CurrentUser() user: IUser,
    @QueryParams() query: GrievanceListQuery,
  ): Promise<{
    success: boolean;
    grievances: GrievanceRecord[];
    isDemo: boolean;
    total: number;
  }> {
    await this.seed.ensureSeeded();
    const farmerId = farmerIdOf(user);
    const filter: Record<string, unknown> = {farmerId};
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    const records = await this.grievances.findMany(filter);
    return {
      success: true,
      grievances: records,
      isDemo: records.length > 0 && records.every((g) => g.isDemo),
      total: records.length,
    };
  }

  @Authorized()
  @Get('/:id')
  @HttpCode(200)
  async byId(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
  ): Promise<{success: boolean; grievance: GrievanceRecord}> {
    await this.seed.ensureSeeded();
    const farmerId = farmerIdOf(user);
    const record = await this.grievances.findById(id);
    if (!record) {
      throw new NotFoundError(`Grievance ${id} not found`);
    }
    if (record.farmerId !== farmerId) {
      throw new ForbiddenError('Grievance does not belong to this farmer');
    }
    return {success: true, grievance: record};
  }

  @Authorized()
  @Post('/')
  @HttpCode(201)
  async create(
    @CurrentUser() user: IUser,
    @Body() body: CreateGrievanceBody,
  ): Promise<{success: boolean; grievance: GrievanceRecord}> {
    const farmerId = farmerIdOf(user);
    const now = new Date().toISOString();
    const record: GrievanceRecord = {
      id: randomId('gv'),
      farmerId,
      raisedBy: body.raisedBy ?? 'Farmer',
      lotId: body.lotId ?? null,
      category: body.category,
      subject: body.subject,
      description: body.description,
      priority: body.priority ?? 'medium',
      transactionRef: body.transactionRef ?? null,
      status: 'open',
      assignedTo: null,
      resolutionNotes: null,
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      resolvedAt: null,
      isDemo: false,
    };
    await this.grievances.insert(record);
    void this.notifications
      .saveTheNotifications(
        `Grievance "${record.subject}" submitted (${record.priority} priority).`,
        'Grievance Submitted',
        record.id,
        farmerId,
        'grievance_created',
      )
      .catch((err) => console.error('[GrievanceController.create] notif failed', err));
    return {success: true, grievance: record};
  }

  @Authorized()
  @Patch('/:id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateGrievanceBody,
    @CurrentUser() user: IUser,
  ): Promise<{success: boolean; grievance: GrievanceRecord}> {
    const farmerId = farmerIdOf(user);
    const existing = await this.grievances.findById(id);
    if (!existing) {
      throw new NotFoundError(`Grievance ${id} not found`);
    }
    if (existing.farmerId !== farmerId) {
      throw new ForbiddenError('Grievance does not belong to this farmer');
    }
    let updated: GrievanceRecord | null = null;
    if (body.status && body.status !== existing.status) {
      updated = await this.grievances.transition(id, body.status);
    } else {
      const patch: Partial<GrievanceRecord> = {};
      if (body.priority !== undefined) patch.priority = body.priority;
      if (body.resolutionNotes !== undefined) patch.resolutionNotes = body.resolutionNotes;
      if (body.assignedTo !== undefined) patch.assignedTo = body.assignedTo;
      updated = await this.grievances.update(id, patch);
    }
    if (!updated) {
      throw new NotFoundError(`Grievance ${id} not found`);
    }
    if (body.status && body.status !== existing.status) {
      void this.notifications
        .saveTheNotifications(
          `Grievance "${updated.subject}" status: ${existing.status} -> ${updated.status}.`,
          'Grievance Updated',
          updated.id,
          farmerId,
          'grievance_status_changed',
        )
        .catch((err) => console.error('[GrievanceController.update] notif failed', err));
    }
    return {success: true, grievance: updated};
  }
}