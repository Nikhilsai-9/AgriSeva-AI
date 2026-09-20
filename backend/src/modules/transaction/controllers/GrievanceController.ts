/**
 * GrievanceController — REST endpoints for farmer grievance tickets.
 *
 * Closes the missing "grievance status update" workflow that the audit
 * flagged: open -> in_review -> resolved/rejected.
 */

import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {
  JsonController,
  Get,
  Post,
  Patch,
  Param,
  Body,
  QueryParams,
  HeaderParam,
  HttpCode,
  NotFoundError,
  ForbiddenError,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {GLOBAL_TYPES} from '#root/types.js';
import {GrievanceRepository} from '../repositories/GrievanceRepository.js';
import {SeedLoader} from '../services/SeedLoader.js';
import type {GrievanceRecord} from '../types.js';
import {
  GrievanceListQuery,
  GrievanceIdParam,
  CreateGrievanceBody,
  UpdateGrievanceBody,
} from '../validators/TransactionValidators.js';

const DEMO_HEADER = 'x-demo-farmer-id';

function resolveFarmerId(header?: string): string {
  return header && header.trim() ? header.trim() : 'demo-farmer-uid';
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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
  ) {}

  @Get('/')
  @HttpCode(200)
  async list(
    @QueryParams() query: GrievanceListQuery,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{
    success: boolean;
    grievances: GrievanceRecord[];
    isDemo: boolean;
    total: number;
  }> {
    await this.seed.ensureSeeded();
    const farmerId = resolveFarmerId(farmerHeader);
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

  @Get('/:id')
  @HttpCode(200)
  async byId(
    @Param('id') id: string,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{success: boolean; grievance: GrievanceRecord}> {
    await this.seed.ensureSeeded();
    const farmerId = resolveFarmerId(farmerHeader);
    const record = await this.grievances.findById(id);
    if (!record) {
      throw new NotFoundError(`Grievance ${id} not found`);
    }
    if (record.farmerId !== farmerId) {
      throw new ForbiddenError('Grievance does not belong to this farmer');
    }
    return {success: true, grievance: record};
  }

  @Post('/')
  @HttpCode(201)
  async create(
    @Body() body: CreateGrievanceBody,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{success: boolean; grievance: GrievanceRecord}> {
    const farmerId = resolveFarmerId(farmerHeader);
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
    return {success: true, grievance: record};
  }

  @Patch('/:id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateGrievanceBody,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{success: boolean; grievance: GrievanceRecord}> {
    const farmerId = resolveFarmerId(farmerHeader);
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
    return {success: true, grievance: updated};
  }
}