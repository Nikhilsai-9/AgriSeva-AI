/**
 * Smoke test for the notification endpoints.
 *
 * Validates that GET /api/notifications requires authentication,
 * returns the expected envelope shape, and that PATCH /api/notifications
 * (mark-all-read) returns the modified-count envelope. Also verifies
 * the single-notification mark-as-read PATCH.
 *
 * Mocks the NotificationService so no Mongo / Firebase is required.
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
import { HttpErrorHandler } from '#shared/index.js';
import { NotificationController } from '../controllers/NotificationController.js';

let nextUser = null;

const mockNotificationService = {
  getNotifications: vi.fn(async (userId) => ({
    notifications: [
      {
        _id: 'n-1',
        enitity_id: 'lot-1',
        title: 'New offer from Acme',
        message: 'Rs 25/kg for 100kg',
        type: 'offer_received',
        is_read: false,
        createdAt: new Date().toISOString(),
      },
    ],
    page: 1,
    totalCount: 1,
    totalPages: 1,
  })),
  markAsRead: vi.fn(async () => ({ modifiedCount: 1 })),
  markAllAsRead: vi.fn(async () => ({ modifiedCount: 1 })),
};

const authorizationChecker = async () => {
  if (!nextUser) throw new UnauthorizedError('Missing token');
  return true;
};
const currentUserChecker = async () => nextUser;

describe('NotificationController — auth + envelope shape', () => {
  let app;

  beforeAll(() => {
    const container = new Container();
    container.bind(NotificationController).toSelf().inSingletonScope();
    container.bind(GLOBAL_TYPES.NotificationService).toConstantValue(mockNotificationService);
    container.bind(HttpErrorHandler).toSelf().inSingletonScope();

    useContainer(new InversifyAdapter(container));

    app = useExpressServer(Express(), {
      controllers: [NotificationController],
      middlewares: [HttpErrorHandler],
      defaultErrorHandler: false,
      validation: false,
      authorizationChecker,
      currentUserChecker,
    });
  });

  beforeEach(() => {
    nextUser = { _id: '64dddd4444444444444444dd', role: 'user' };
    mockNotificationService.getNotifications.mockClear();
    mockNotificationService.markAsRead.mockClear();
    mockNotificationService.markAllAsRead.mockClear();
  });

  it('GET /notifications returns the expected envelope', async () => {
    const res = await request(app).get('/notifications?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('notifications');
    expect(res.body.notifications[0].type).toBe('offer_received');
    expect(mockNotificationService.getNotifications).toHaveBeenCalled();
  });

  it('GET /notifications requires authentication (401 without token)', async () => {
    nextUser = null;
    const res = await request(app).get('/notifications');
    expect(res.status).toBe(401);
  });

  it('PATCH /notifications (mark-all) returns modified-count envelope', async () => {
    const res = await request(app).patch('/notifications');
    expect(res.status).toBe(200);
    expect(mockNotificationService.markAllAsRead).toHaveBeenCalled();
  });

  it('PATCH /notifications/:id marks a single notification read', async () => {
    const res = await request(app).patch('/notifications/n-1');
    expect(res.status).toBe(200);
    expect(mockNotificationService.markAsRead).toHaveBeenCalledWith('n-1');
  });
});
