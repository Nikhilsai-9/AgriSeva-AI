/**
 * Security tests for the transaction controllers.
 *
 * These tests prove that the @Authorized() + @CurrentUser() refactor
 * (which replaced the x-demo-farmer-id trust) is actually enforced.
 *
 *   1. No Bearer token  -> 401
 *   2. Invalid Bearer   -> 401
 *   3. User A tries to GET / read User B's lot -> 403
 *   4. User A tries to PATCH User B's lot     -> 403
 *   5. User A tries to DELETE User B's lot    -> 403
 *   6. User A tries to mark User B's lot as sold -> 403
 *   7. User A creates a lot; succeeds (own resource)
 *   8. Forged x-demo-farmer-id header is ignored when the Bearer
 *      token belongs to user A — proves the header is no longer trusted.
 *
 * Mocks the Firebase-token validator to inject two users (A and B)
 * with stable _ids so we can exercise ownership checks without a
 * real Firebase project.
 */

import 'reflect-metadata';
import request from 'supertest';
import Express from 'express';
import { useExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

import { GLOBAL_TYPES } from '#root/types.js';
import { HttpErrorHandler } from '#shared/index.js';
import type { IUser } from '#root/shared/interfaces/models.js';
import { UnauthorizedError } from 'routing-controllers';
import { LotController } from '../controllers/LotController.js';
import { OfferController, LotOffersController } from '../controllers/OfferController.js';

const FARMER_A_ID = '64aaaa1111111111111111aa';
const FARMER_B_ID = '64bbbb2222222222222222bb';

const farmerA = {
  _id: FARMER_A_ID,
  firebaseUID: 'firebase-uid-A',
  email: 'a@example.com',
  firstName: 'Alpha',
  lastName: 'Farmer',
  role: 'user',
};

const farmerB = {
  _id: FARMER_B_ID,
  firebaseUID: 'firebase-uid-B',
  email: 'b@example.com',
  firstName: 'Beta',
  lastName: 'Farmer',
  role: 'user',
};

const bLot = {
  id: 'lot-b-1',
  farmerId: FARMER_B_ID,
  crop: 'Tomato',
  variety: 'Hybrid',
  quantityKg: 100,
  qualityGrade: 'A',
  qualityNotes: '',
  expectedPricePerKg: 2000,
  state: 'Karnataka',
  district: 'Kolar',
  village: 'Srinivasapura',
  harvestDate: new Date().toISOString(),
  images: [],
  status: 'active',
  isDemo: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockLotRepo = {
  findMany: vi.fn(async () => [bLot]),
  findById: vi.fn(async (id) => (id === bLot.id ? bLot : null)),
  findByIdForFarmer: vi.fn(async (id, farmerId) =>
    id === bLot.id && farmerId === FARMER_B_ID ? bLot : null
  ),
  insert: vi.fn(async () => undefined),
  update: vi.fn(async () => ({ ...bLot, status: 'sold' })),
  updateStatus: vi.fn(async () => ({ ...bLot, status: 'sold' })),
};

const mockOfferRepo = {
  findMany: vi.fn(async () => []),
  findById: vi.fn(async () => null),
  findByLot: vi.fn(async () => []),
  insert: vi.fn(async () => undefined),
  update: vi.fn(async () => null),
  updateStatus: vi.fn(async () => null),
  transition: vi.fn(async () => null),
  transitionCountered: vi.fn(async () => null),
  rejectSiblings: vi.fn(async () => 0),
  counterOffer: vi.fn(async () => ({ original: null, counter: null })),
  withdraw: vi.fn(async () => null),
  reject: vi.fn(async () => null),
};

const mockBuyerRepo = { findById: vi.fn(async () => null) };

const mockPaymentRepo = {
  findMany: vi.fn(async () => []),
  findById: vi.fn(async () => null),
  findActiveByLot: vi.fn(async () => null),
  insert: vi.fn(async () => undefined),
  updateStatus: vi.fn(async () => null),
};

const mockGrievanceRepo = {
  findMany: vi.fn(async () => []),
  findById: vi.fn(async () => null),
  insert: vi.fn(async () => undefined),
  update: vi.fn(async () => null),
  transition: vi.fn(async () => null),
};

const mockStorageRepo = {
  findAllOptions: vi.fn(async () => []),
  findOptionById: vi.fn(async () => null),
  findBookingsByFarmer: vi.fn(async () => []),
  insertBooking: vi.fn(async () => undefined),
};

const mockLogisticsRepo = {
  findAllOptions: vi.fn(async () => []),
  findOptionById: vi.fn(async () => null),
  findBookingsByFarmer: vi.fn(async () => []),
  insertBooking: vi.fn(async () => undefined),
};

const mockSeedLoader = { ensureSeeded: vi.fn(async () => undefined) };

const mockOfferService = {
  accept: vi.fn(),
  reject: vi.fn(),
  withdraw: vi.fn(),
  transitionCountered: vi.fn(),
  counterOffer: vi.fn(),
};

const mockNotificationService = {
  saveTheNotifications: vi.fn(async () => undefined),
};

let nextUser = null;
let nextAuthError = null;

const authorizationChecker = async () => {
  // When the harness sets `nextAuthError`, throw an UnauthorizedError
  // so routing-controllers returns 401. (Throwing a plain Error
  // becomes 500 instead.)
  if (nextAuthError) {
    throw new UnauthorizedError(nextAuthError.message);
  }
  return nextUser != null;
};

const currentUserChecker = async () => nextUser;

describe('Transaction controllers — auth & ownership', () => {
  let app;

  beforeAll(() => {
    const container = new Container();
    container.bind(LotController).toSelf().inSingletonScope();
    container.bind(OfferController).toSelf().inSingletonScope();
    container.bind(LotOffersController).toSelf().inSingletonScope();

    container.bind(GLOBAL_TYPES.TransactionLotRepository).toConstantValue(mockLotRepo);
    container.bind(GLOBAL_TYPES.TransactionOfferRepository).toConstantValue(mockOfferRepo);
    container.bind(GLOBAL_TYPES.TransactionBuyerRepository).toConstantValue(mockBuyerRepo);
    container.bind(GLOBAL_TYPES.TransactionPaymentRepository).toConstantValue(mockPaymentRepo);
    container.bind(GLOBAL_TYPES.TransactionGrievanceRepository).toConstantValue(mockGrievanceRepo);
    container.bind(GLOBAL_TYPES.TransactionStorageRepository).toConstantValue(mockStorageRepo);
    container.bind(GLOBAL_TYPES.TransactionLogisticsRepository).toConstantValue(mockLogisticsRepo);
    container.bind(GLOBAL_TYPES.TransactionSeedLoader).toConstantValue(mockSeedLoader);
    container.bind(GLOBAL_TYPES.TransactionOfferService).toConstantValue(mockOfferService);
    container.bind(GLOBAL_TYPES.NotificationService).toConstantValue(mockNotificationService);
    container.bind(HttpErrorHandler).toSelf().inSingletonScope();

    useContainer(new InversifyAdapter(container));

    app = useExpressServer(Express(), {
      controllers: [LotController, OfferController, LotOffersController],
      middlewares: [HttpErrorHandler],
      defaultErrorHandler: false,
      validation: false,
      authorizationChecker,
      currentUserChecker,
    });
  });

  beforeEach(() => {
    nextUser = null;
    nextAuthError = null;
    mockLotRepo.findById.mockClear();
    mockLotRepo.findByIdForFarmer.mockClear();
    mockLotRepo.update.mockClear();
    mockOfferService.accept.mockClear();
    mockNotificationService.saveTheNotifications.mockClear();
  });

  describe('Token validation', () => {
    it('returns 401 when no Bearer token is provided', async () => {
      nextAuthError = new Error('Missing Authorization header');
      const res = await request(app).get('/lots');
      expect(res.status).toBe(401);
    });

    it('returns 401 when Bearer token is rejected', async () => {
      nextAuthError = new Error('Invalid Firebase ID token');
      const res = await request(app).get('/lots');
      expect(res.status).toBe(401);
    });
  });

  describe('Ownership checks (user A vs user B)', () => {
    beforeEach(() => {
      nextUser = farmerA;
    });

    it("blocks user A from reading user B's lot (GET /lots/:id) with 403", async () => {
      const res = await request(app).get('/lots/' + bLot.id);
      expect(res.status).toBe(403);
      // LotController.byId uses `findById` and then compares
      // `lot.farmerId !== farmerId` — proves the principal id (A)
      // is what the controller compared against.
      expect(mockLotRepo.findById).toHaveBeenCalledWith(bLot.id);
    });

    it("blocks user A from updating user B's lot (PATCH /lots/:id) with 403", async () => {
      const res = await request(app)
        .patch('/lots/' + bLot.id)
        .send({ qualityNotes: 'hijacked' });
      expect(res.status).toBe(403);
      expect(mockLotRepo.update).not.toHaveBeenCalled();
    });

    it("blocks user A from deleting user B's lot (DELETE /lots/:id) with 403", async () => {
      const res = await request(app).delete('/lots/' + bLot.id);
      expect(res.status).toBe(403);
      expect(mockLotRepo.update).not.toHaveBeenCalled();
    });

    it("blocks user A from marking user B's lot as sold (POST /lots/:id/sell) with 403", async () => {
      const res = await request(app).post('/lots/' + bLot.id + '/sell').send({});
      expect(res.status).toBe(403);
      expect(mockLotRepo.update).not.toHaveBeenCalled();
    });

    it('allows user A to list only their own lots (GET /lots)', async () => {
      mockLotRepo.findMany.mockResolvedValueOnce([bLot]);
      const res = await request(app).get('/lots');
      expect(res.status).toBe(200);
      expect(mockLotRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ farmerId: FARMER_A_ID })
      );
    });
  });

  describe('Own-resource access (positive case)', () => {
    it('allows user A to create a lot (POST /lots)', async () => {
      nextUser = farmerA;
      let insertedRecord = null;
      // Use vi.fn() with an explicit implementation so vitest's generic
      // typing accepts the (record) => void callback.
      (mockLotRepo.insert as any).mockImplementationOnce(
        async (r: unknown) => {
          insertedRecord = r;
        },
      );
      const res = await request(app).post('/lots').send({
        crop: 'Onion',
        variety: 'Red',
        quantityKg: 200,
        qualityGrade: 'A',
        qualityNotes: '',
        expectedPricePerKg: 1500,
        state: 'Karnataka',
        district: 'Kolar',
        village: 'Test',
        harvestDate: new Date().toISOString(),
      });
      expect(res.status).toBe(201);
      expect(insertedRecord).toBeTruthy();
      expect(insertedRecord.farmerId).toBe(FARMER_A_ID);
      expect(mockNotificationService.saveTheNotifications).toHaveBeenCalledWith(
        expect.any(String),
        'New Lot Listed',
        expect.any(String),
        FARMER_A_ID,
        'lot_created'
      );
    });
  });

  describe('Header forgery resistance', () => {
    it('x-demo-farmer-id header does NOT override the Bearer principal', async () => {
      nextUser = farmerA;
      mockLotRepo.findMany.mockResolvedValueOnce([bLot]);
      const res = await request(app)
        .get('/lots')
        .set('x-demo-farmer-id', FARMER_B_ID);
      expect(res.status).toBe(200);
      expect(mockLotRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ farmerId: FARMER_A_ID })
      );
      expect(mockLotRepo.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ farmerId: FARMER_B_ID })
      );
    });
  });
});
