/**
 * Persistence round-trip test for PATCH /users/me/farmer-profile.
 *
 * Verifies that:
 *   1. GET /users/me returns the IUser (including the persisted
 *      farmerProfile sub-document).
 *   2. PATCH /users/me/farmer-profile merges the body into the
 *      existing sub-doc (no overwrite-with-undefined).
 *   3. A subsequent GET reflects the merged profile.
 *
 * No Firebase / Mongo required — mocks both.
 */

import 'reflect-metadata';
import request from 'supertest';
import Express from 'express';
import { useExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { UnauthorizedError } from 'routing-controllers';

import { GLOBAL_TYPES } from '#root/types.js';
import { CHATBOT_TYPES } from '#root/modules/chatbot/types.js';
import { AUDIT_TRAILS_TYPES } from '#root/modules/auditTrails/types.js';
import { HttpErrorHandler } from '#shared/index.js';
import { UserController } from '../controllers/UserController.js';

const FARMER_ID = '64cccc3333333333333333cc';
const farmer = {
  _id: FARMER_ID,
  firebaseUID: 'firebase-uid-1',
  email: 'farmer@example.com',
  firstName: 'Test',
  lastName: 'Farmer',
  role: 'user',
};

let userDoc = { ...farmer, farmerProfile: null };

const mockUserService = {
  getUserById: vi.fn(async (id) => {
    if (id === FARMER_ID) {
      return { ...userDoc, notifications: 0 };
    }
    return null;
  }),
  updateFarmerProfile: vi.fn(async (id, patch) => {
    if (id !== FARMER_ID) return null;
    const current = userDoc.farmerProfile ?? {};
    const merged = {
      ...current,
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.state !== undefined ? { state: patch.state } : {}),
      ...(patch.district !== undefined ? { district: patch.district } : {}),
      ...(patch.village !== undefined ? { village: patch.village } : {}),
      ...(patch.fpoMember !== undefined ? { fpoMember: patch.fpoMember } : {}),
      ...(patch.fpoName !== undefined ? { fpoName: patch.fpoName } : {}),
      ...(patch.landSizeAcres !== undefined ? { landSizeAcres: patch.landSizeAcres } : {}),
      ...(patch.preferredLanguage !== undefined ? { preferredLanguage: patch.preferredLanguage } : {}),
      primaryCrops: Array.from(
        new Set([...(current.primaryCrops ?? []), ...(patch.primaryCrops ?? [])]),
      ),
      preferredMarkets: Array.from(
        new Set([...(current.preferredMarkets ?? []), ...(patch.preferredMarkets ?? [])]),
      ),
      joinedAt: current.joinedAt ?? new Date().toISOString(),
      verificationStatus: current.verificationStatus ?? 'unverified',
      isDemo: false,
    };
    userDoc = { ...userDoc, farmerProfile: merged };
    return { ...userDoc, farmerProfile: merged };
  }),
};

let nextUser = null;

const authorizationChecker = async () => {
  if (!nextUser) throw new UnauthorizedError('Missing token');
  return true;
};
const currentUserChecker = async () => nextUser;

describe('UserController — farmer profile persistence', () => {
  let app;

  beforeAll(() => {
    const container = new Container();
    container.bind(UserController).toSelf().inSingletonScope();
    container.bind(GLOBAL_TYPES.UserService).toConstantValue(mockUserService);
    container.bind(CHATBOT_TYPES.ChatbotService).toConstantValue({});
    container.bind(AUDIT_TRAILS_TYPES.AuditTrailsService).toConstantValue({});
    container.bind(HttpErrorHandler).toSelf().inSingletonScope();

    useContainer(new InversifyAdapter(container));

    app = useExpressServer(Express(), {
      controllers: [UserController],
      middlewares: [HttpErrorHandler],
      defaultErrorHandler: false,
      validation: false,
      authorizationChecker,
      currentUserChecker,
    });
  });


  beforeEach(() => {
    userDoc = { ...farmer, farmerProfile: null };
    nextUser = farmer;
    mockUserService.getUserById.mockClear();
    mockUserService.updateFarmerProfile.mockClear();
  });

  it('GET /users/me returns the authenticated user', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(FARMER_ID);
    expect(res.body.farmerProfile).toBeNull();
  });

  it('PATCH /users/me/farmer-profile persists the merged sub-document', async () => {
    const res = await request(app)
      .patch('/users/me/farmer-profile')
      .send({
        state: 'Karnataka',
        district: 'Kolar',
        primaryCrops: ['Tomato', 'Onion'],
        landSizeAcres: 4.5,
      });
    expect(res.status).toBe(200);
    expect(res.body.farmerProfile.state).toBe('Karnataka');
    expect(res.body.farmerProfile.district).toBe('Kolar');
    expect(res.body.farmerProfile.primaryCrops).toEqual(['Tomato', 'Onion']);
    expect(res.body.farmerProfile.landSizeAcres).toBe(4.5);
    expect(res.body.farmerProfile.verificationStatus).toBe('unverified');
    expect(res.body.farmerProfile.isDemo).toBe(false);
  });

  it('a subsequent PATCH merges (does not overwrite) the existing profile', async () => {
    await request(app)
      .patch('/users/me/farmer-profile')
      .send({ state: 'Karnataka', village: 'Srinivasapura' });

    const res = await request(app)
      .patch('/users/me/farmer-profile')
      .send({ phone: '+91 9999999999' });

    expect(res.status).toBe(200);
    expect(res.body.farmerProfile.phone).toBe('+91 9999999999');
    expect(res.body.farmerProfile.state).toBe('Karnataka');
    expect(res.body.farmerProfile.village).toBe('Srinivasapura');
  });

  it('primaryCrops are appended + de-duped (not overwritten)', async () => {
    await request(app)
      .patch('/users/me/farmer-profile')
      .send({ primaryCrops: ['Tomato', 'Onion'] });

    const res = await request(app)
      .patch('/users/me/farmer-profile')
      .send({ primaryCrops: ['Onion', 'Maize'] });

    expect(res.status).toBe(200);
    const crops = res.body.farmerProfile.primaryCrops;
    expect(crops).toContain('Tomato');
    expect(crops).toContain('Onion');
    expect(crops).toContain('Maize');
    expect(new Set(crops).size).toBe(crops.length);
  });

  it('PATCH requires authentication (401 without token)', async () => {
    nextUser = null;
    const res = await request(app)
      .patch('/users/me/farmer-profile')
      .send({ state: 'Karnataka' });
    expect(res.status).toBe(401);
  });
});
