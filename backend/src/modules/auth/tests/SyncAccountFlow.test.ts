import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requiresAdminVerification,
  ROLES_REQUIRING_ADMIN_VERIFICATION,
} from '#root/shared/constants/roles.js';
import { User } from '../classes/transformers/User.js';
import { AuthController } from '../controllers/AuthController.js';
import { HttpError } from 'routing-controllers';
import admin from 'firebase-admin';

vi.mock('firebase-admin', () => {
  return {
    default: {
      auth: vi.fn(),
      apps: [{ name: '[DEFAULT]' }],
      initializeApp: vi.fn(),
      credential: { cert: vi.fn() },
    },
  };
});

describe('Sync Account & Admin Verification Flow', () => {
  describe('requiresAdminVerification role rules', () => {
    it('normal user (farmer) never requires admin verification regardless of isVerified field', () => {
      expect(requiresAdminVerification({ role: 'user', isVerified: false })).toBe(false);
      expect(requiresAdminVerification({ role: 'user', isVerified: true })).toBe(false);
      expect(requiresAdminVerification({ role: 'user' })).toBe(false);
    });

    it('admin never requires admin verification', () => {
      expect(requiresAdminVerification({ role: 'admin', isVerified: false })).toBe(false);
      expect(requiresAdminVerification({ role: 'admin', isVerified: true })).toBe(false);
    });

    it('privileged roles require admin verification when isVerified is false', () => {
      for (const role of ROLES_REQUIRING_ADMIN_VERIFICATION) {
        expect(requiresAdminVerification({ role, isVerified: false })).toBe(true);
      }
    });

    it('privileged roles do not require admin verification once verified', () => {
      for (const role of ROLES_REQUIRING_ADMIN_VERIFICATION) {
        expect(requiresAdminVerification({ role, isVerified: true })).toBe(false);
      }
    });

    it('handles null or undefined input safely', () => {
      expect(requiresAdminVerification(null)).toBe(false);
      expect(requiresAdminVerification(undefined)).toBe(false);
      expect(requiresAdminVerification({})).toBe(false);
    });
  });

  describe('User transformer defaults', () => {
    it('defaults unassigned role to user rather than expert', () => {
      const user = new User({ email: 'farmer@example.com' });
      expect(user.role).toBe('user');
      expect(user.isVerified).toBe(true);
      expect(user.status).toBe('active');
    });

    it('defaults isVerified to false for privileged roles', () => {
      const pae = new User({ email: 'expert@example.com', role: 'pae_expert' });
      expect(pae.role).toBe('pae_expert');
      expect(pae.isVerified).toBe(false);

      const coord = new User({ email: 'coord@example.com', role: 'district_coordinator' });
      expect(coord.role).toBe('district_coordinator');
      expect(coord.isVerified).toBe(false);
    });

    it('preserves explicitly supplied isVerified value', () => {
      const verifiedExpert = new User({
        email: 'expert@example.com',
        role: 'pae_expert',
        isVerified: true,
      });
      expect(verifiedExpert.isVerified).toBe(true);

      const unverifiedUser = new User({
        email: 'user@example.com',
        role: 'user',
        isVerified: false,
      });
      expect(unverifiedUser.isVerified).toBe(false);
    });
  });

  describe('AuthController syncAccount endpoint behavior', () => {
    let controller: AuthController;
    let mockAuthService: any;
    let mockVerifyIdToken: any;

    beforeEach(() => {
      mockAuthService = {
        syncUserWithDb: vi.fn(),
      };
      mockVerifyIdToken = vi.fn();
      (admin.auth as any).mockReturnValue({
        verifyIdToken: mockVerifyIdToken,
      });
      controller = new AuthController(mockAuthService);
    });

    it('allows normal user to sync without 401 error', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'firebase-user-123',
        email: 'farmer@gmail.com',
        name: 'Ramesh Patel',
        email_verified: true,
      });

      const normalUser: any = {
        _id: 'mongo-id-1',
        firebaseUID: 'firebase-user-123',
        email: 'farmer@gmail.com',
        firstName: 'Ramesh',
        lastName: 'Patel',
        role: 'user',
        isVerified: true,
      };
      mockAuthService.syncUserWithDb.mockResolvedValue(normalUser);

      const result = await controller.syncAccount('Bearer valid-token');
      expect(result).toEqual({ success: true, user: normalUser });
      expect(mockAuthService.syncUserWithDb).toHaveBeenCalledWith(
        'firebase-user-123',
        'farmer@gmail.com',
        'Ramesh Patel'
      );
    });

    it('rejects unverified PAE expert with 401 pending admin verification', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'firebase-expert-456',
        email: 'expert@agriseva.ai',
        name: 'Agri Expert',
        email_verified: true,
      });

      const pendingExpert: any = {
        _id: 'mongo-id-2',
        firebaseUID: 'firebase-expert-456',
        email: 'expert@agriseva.ai',
        role: 'pae_expert',
        isVerified: false,
      };
      mockAuthService.syncUserWithDb.mockResolvedValue(pendingExpert);

      await expect(controller.syncAccount('Bearer expert-token')).rejects.toThrow(
        new HttpError(401, 'Your account is pending admin verification. Please contact an administrator.')
      );
    });

    it('allows approved PAE expert to sync successfully', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'firebase-expert-456',
        email: 'expert@agriseva.ai',
        name: 'Agri Expert',
        email_verified: true,
      });

      const approvedExpert: any = {
        _id: 'mongo-id-2',
        firebaseUID: 'firebase-expert-456',
        email: 'expert@agriseva.ai',
        role: 'pae_expert',
        isVerified: true,
      };
      mockAuthService.syncUserWithDb.mockResolvedValue(approvedExpert);

      const result = await controller.syncAccount('Bearer expert-token');
      expect(result).toEqual({ success: true, user: approvedExpert });
    });

    it('rejects unverified coordinator with 401 pending admin verification', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'firebase-coord-789',
        email: 'coordinator@agriseva.ai',
        name: 'District Lead',
        email_verified: true,
      });

      const pendingCoord: any = {
        _id: 'mongo-id-3',
        firebaseUID: 'firebase-coord-789',
        email: 'coordinator@agriseva.ai',
        role: 'district_coordinator',
        isVerified: false,
      };
      mockAuthService.syncUserWithDb.mockResolvedValue(pendingCoord);

      await expect(controller.syncAccount('Bearer coord-token')).rejects.toThrow(
        new HttpError(401, 'Your account is pending admin verification. Please contact an administrator.')
      );
    });

    it('allows approved coordinator to sync successfully', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'firebase-coord-789',
        email: 'coordinator@agriseva.ai',
        name: 'District Lead',
        email_verified: true,
      });

      const approvedCoord: any = {
        _id: 'mongo-id-3',
        firebaseUID: 'firebase-coord-789',
        email: 'coordinator@agriseva.ai',
        role: 'district_coordinator',
        isVerified: true,
      };
      mockAuthService.syncUserWithDb.mockResolvedValue(approvedCoord);

      const result = await controller.syncAccount('Bearer coord-token');
      expect(result).toEqual({ success: true, user: approvedCoord });
    });

    it('throws 401 when no token is provided', async () => {
      await expect(controller.syncAccount('')).rejects.toThrow(
        new HttpError(401, 'No token provided')
      );
    });
  });

  describe('FirebaseAuthService syncUserWithDb self-healing semantics', () => {
    it('normal user with isVerified: false is self-healed to isVerified: true', async () => {
      const mockUserRepo: any = {
        findByFirebaseUID: vi.fn(),
        findByEmail: vi.fn(),
        edit: vi.fn().mockResolvedValue(true),
        create: vi.fn(),
      };
      const mockDatabase: any = {};
      const mockNotificationService: any = {};

      const existingUnverifiedFarmer: any = {
        _id: 'mongo-id-farmer',
        firebaseUID: 'uid-farmer-1',
        email: 'farmer@gmail.com',
        role: 'user',
        isVerified: false,
      };
      const healedFarmer: any = {
        ...existingUnverifiedFarmer,
        isVerified: true,
      };

      // First call returns unverified, second call after edit returns healed
      mockUserRepo.findByFirebaseUID
        .mockResolvedValueOnce(existingUnverifiedFarmer)
        .mockResolvedValueOnce(healedFarmer);

      const { FirebaseAuthService } = await import('../services/FirebaseAuthService.js');
      const service = new FirebaseAuthService(mockUserRepo, mockDatabase, mockNotificationService);

      const result = await service.syncUserWithDb('uid-farmer-1', 'farmer@gmail.com', 'Farmer Ram');
      expect(mockUserRepo.edit).toHaveBeenCalledWith('mongo-id-farmer', { isVerified: true });
      expect(result.isVerified).toBe(true);
    });

    it('special role (pae_expert) with isVerified: false is NOT modified by self-healing', async () => {
      const mockUserRepo: any = {
        findByFirebaseUID: vi.fn(),
        findByEmail: vi.fn(),
        edit: vi.fn(),
        create: vi.fn(),
      };
      const mockDatabase: any = {};
      const mockNotificationService: any = {};

      const pendingExpert: any = {
        _id: 'mongo-id-expert',
        firebaseUID: 'uid-expert-2',
        email: 'expert@agriseva.ai',
        role: 'pae_expert',
        isVerified: false,
      };

      mockUserRepo.findByFirebaseUID.mockResolvedValue(pendingExpert);

      const { FirebaseAuthService } = await import('../services/FirebaseAuthService.js');
      const service = new FirebaseAuthService(mockUserRepo, mockDatabase, mockNotificationService);

      const result = await service.syncUserWithDb('uid-expert-2', 'expert@agriseva.ai', 'Dr. Sharma');
      expect(mockUserRepo.edit).not.toHaveBeenCalled();
      expect(result.isVerified).toBe(false);
    });
  });
});
