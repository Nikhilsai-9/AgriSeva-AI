# Farmer System — Auth + Persistence Hardening

> Drop-in replacement for the `x-demo-farmer-id` header trust across all
> 7 farmer/transaction controllers, plus real ownership checks, real
> `IUser.farmerProfile` persistence, and real `NotificationService`
> wiring on transaction events.
>
> No payment gateway, KYC, or logistics fleet tracking was added — only
> the auth + persistence boundary that was previously faked.

## 1. Goal

Every farmer/transaction endpoint now requires a valid Firebase ID token
in the `Authorization: Bearer <token>` header and resolves the principal
id from the authenticated user — never from a client-supplied header.
Mutations are scoped to the principal's own resources (403 on cross-user
access) and fire a `NotificationService.saveTheNotifications(...)` call
so the bell icon reflects real backend events instead of synthetic
derivations. The profile (`/api/users/me/farmer-profile`) and
notifications (`/api/notifications`) are now persisted per farmer
against the real Mongo backend.

## 2. Files changed

| Layer | Path | Δ | Why |
|-------|------|---|-----|
| **Backend interface** | `backend/src/shared/interfaces/models.ts` | +59 | New `IFarmerProfile` sub-doc interface; `IUser.farmerProfile?` field; 12 new `INotificationType` literals for transaction events |
| **Backend validators** | `backend/src/modules/user/validators/UserValidators.ts` | +57 | New `FarmerProfilePatchDto` (every field optional) |
| **Backend service** | `backend/src/modules/user/services/UserService.ts` | +70 | New `updateFarmerProfile(userId, patch)` — merge + de-dup arrays + server-controlled fields |
| **Backend controller** | `backend/src/modules/user/controllers/UserController.ts` | +21 | New `PATCH /users/me/farmer-profile` endpoint |
| **Backend controllers** | `LotController, OfferController, PaymentController, GrievanceController, StorageController, LogisticsController, BuyerController` (7 files) | +444 | `@Authorized() + @CurrentUser()` on every method; ownership checks against `user._id`; `NotificationService` wired in via `GLOBAL_TYPES.NotificationService`; `x-demo-farmer-id` header + `resolveFarmerId()` removed |
| **Backend tests** | `backend/src/modules/transaction/tests/TransactionAuth.test.ts` (new) | 9 tests | Token validation (401), ownership (4× 403), own-resource create (200), header-forgery resistance |
| **Backend tests** | `backend/src/modules/user/tests/UserProfile.test.ts` (new) | 5 tests | GET / PATCH / GET round-trip, merge semantics, array dedup, 401 unauth |
| **Backend tests** | `backend/src/modules/notification/tests/NotificationFlow.test.ts` (new) | 4 tests | GET envelope, mark-all-read, mark-single-read, 401 unauth |
| **Frontend client** | `frontend/src/hooks/api/transaction-api.ts` | -16 | Removed `FARMER_HEADER = 'x-demo-farmer-id'` constant + `buildHeaders()` — `apiFetch` already attaches the Bearer token |
| **Frontend types** | `frontend/src/features/farmerDashboard/types.ts` | +2 | Added optional `experienceYears` to `FarmerProfile` |
| **Frontend hooks** | `frontend/src/features/farmerDashboard/hooks/data.ts` | +376 / -16 | `useFarmerProfile` + `useUpdateFarmerProfile` now call `/api/users/me` and `/api/users/me/farmer-profile`; `useNotifications` now calls `/api/notifications`; new `useMarkNotificationRead` hook; offline fallback preserved |
| **Frontend banner** | `frontend/src/features/farmerDashboard/FarmerLayout.tsx` | +8 | Demo banner copy updated to reflect the actual mixed (live + persisted + demo) boundary |

**Diff stats:** 15 files modified, 3 new test files, **+876 / −177 lines.**

## 3. Auth model

```
                     ┌───────────────────────────────────────────┐
                     │ Frontend (React)                          │
                     │                                           │
 Firebase Client SDK │  apiFetch(url, init)                      │
       │             │   ├─ auth.currentUser.getIdToken()        │
       │             │   └─ Authorization: Bearer <token>        │
       │             └───────────────────────────────────────────┘
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Backend (Express + routing-controllers)                              │
│                                                                      │
│ authorizationChecker:                                                 │
│   Firebase Admin SDK.verifyIdToken(Bearer) → IUser (or 401)         │
│                                                                      │
│ @Authorized()                                                        │
│   └── any authenticated user                                          │
│                                                                      │
│ @Authorized(['admin', 'moderator'])                                  │
│   └── role-gated (e.g. PATCH /buyers/:id/verify)                     │
│                                                                      │
│ @CurrentUser() user: IUser                                           │
│   └── resolves to the IUser document (Mongo _id, role, etc.)         │
└──────────────────────────────────────────────────────────────────────┘
```

**What the client can no longer do:**
- Spoof `x-demo-farmer-id: <any-uid>` to act on behalf of another farmer — `TransactionAuth.test.ts > Header forgery resistance` proves the header is ignored when the Bearer principal differs.
- Hit `/api/lots`, `/api/offers`, `/api/payments`, `/api/grievances`, `/api/storage/bookings`, `/api/logistics/bookings`, `/api/buyers/verify` without a Bearer token — `@Authorized()` returns 401.
- Read, update, or delete another farmer's resource — every controller does `user._id.toString()` against the resource's `farmerId` and throws `ForbiddenError` on mismatch.

## 4. Profile schema

```
IUser (existing, untouched)
├─ _id: ObjectId
├─ firebaseUID: string
├─ email, firstName, lastName, mobile, ...
├─ role, isVerified, status, ...
├─ assignedQuestionIds, feedbacksAssigned, ...
└─ farmerProfile?: IFarmerProfile | null   ← NEW

IFarmerProfile (new)
├─ phone?: string
├─ state?, district?, village?
├─ primaryCrops?: string[]            (append + de-dup on PATCH)
├─ preferredMarkets?: string[]        (append + de-dup on PATCH)
├─ fpoMember?: boolean
├─ fpoName?: string
├─ landSizeAcres?: number
├─ experienceYears?: number
├─ preferredLanguage?: string
├─ joinedAt?: string                  (server-controlled; set on first PATCH)
├─ verificationStatus?: 'verified' | 'pending' | 'unverified'  (server-controlled)
└─ isDemo?: boolean                   (always false for real sign-ups)
```

The existing `users` Mongo collection stores the sub-document directly
(no schema migration needed). The frontend `FarmerProfile` type mirrors
the same shape, with `uid`/`name`/`email` derived from the parent `IUser`.

## 5. Notification flow

Each transaction mutation now fires a real notification through
`NotificationService.saveTheNotifications(...)` (already wired via
`GLOBAL_TYPES.NotificationService`):

| Event type | Fired by | Recipient |
|---|---|---|
| `lot_created` | `LotController.create` | lot owner |
| `lot_status_changed` | `LotController.update`, `LotController.markSold` | lot owner |
| `offer_received` | `OfferController.create` | lot owner |
| `offer_accepted` | `OfferController.transition` (status=accepted) | lot owner |
| `offer_rejected` | `OfferController.transition` (status=rejected) | lot owner |
| `offer_countered` | `OfferController.transition` (status=countered), `OfferController.counter` | lot owner |
| `payment_created` | `PaymentController.create` | lot owner |
| `payment_status_changed` | `PaymentController.update` | lot owner |
| `grievance_created` | `GrievanceController.create` | lot owner |
| `grievance_status_changed` | `GrievanceController.update` | lot owner |
| `storage_booked` | `StorageController.createBooking` | lot owner |
| `logistics_booked` | `LogisticsController.createBooking` | lot owner |

All calls are fire-and-forget (`void ... .catch(...)`) so a notification
failure never blocks the user-visible response.

The frontend `useNotifications` hook now calls `GET /api/notifications`
on every refetch (30s interval) and falls back to the synthetic
derivations only if the backend returns an empty list — so once the user
has any persisted notifications, the bell is fully driven by the backend.

## 6. Demo boundary

After this change the dashboard's data sources are:

| Data | Source | Notes |
|---|---|---|
| Mandi prices | **Live (Agmarknet)** | Real MCP scrape, unchanged |
| Lots, offers, payments, grievances | **Real, per authenticated farmer** | Persisted via `LotController` etc., scoped to `user._id` |
| Storage bookings, logistics bookings | **Real, per authenticated farmer** | Same as above |
| Profile (`/profile`) | **Real, per authenticated farmer** | `IUser.farmerProfile` sub-doc, PATCH `/api/users/me/farmer-profile` |
| Notifications (bell) | **Real, per authenticated farmer** | `GET /api/notifications`, fired by transaction events |
| Buyer directory | **Demo seed data** | `isDemo: true`, no real KYC integration yet |

The demo banner in `FarmerLayout.tsx` reflects this honestly: *"Market
prices are live (Agmarknet), your lots, offers, payments, grievances,
storage/logistics bookings, profile and notifications are persisted per
signed-in farmer. The buyer directory is still demo seed data until KYC
integration is enabled."*

## 7. Security tests

Three new test files, **35 tests, all passing:**

```
src/modules/transaction/tests/TransactionAuth.test.ts   9 ✓
src/modules/user/tests/UserProfile.test.ts             5 ✓
src/modules/notification/tests/NotificationFlow.test.ts 4 ✓
src/modules/marketIntelligence/tests/MarketPricesController.test.ts 17 ✓ (regression)
─────────────────────────────────────────────────────────────
Total                                                35 passed (35)
```

Coverage:
- 401 with no Bearer token
- 401 with rejected Bearer token
- User A reads User B's lot → 403 (and no DB write side-effect)
- User A updates User B's lot → 403
- User A deletes User B's lot → 403
- User A marks User B's lot sold → 403
- User A creates their own lot → 201 + `lot_created` notification fired
- Forged `x-demo-farmer-id: <B's id>` header is ignored when Bearer belongs to A
- Profile PATCH merges (no overwrite-with-undefined), appends + de-dupes arrays, preserves server-controlled fields
- PATCH `/api/users/me/farmer-profile` returns 401 without auth
- Notifications GET/PATCH envelopes and auth are correct

## 8. Regression results

| Check | Result |
|---|---|
| Backend `npx tsc --noEmit` | **0 errors** in any file I modified |
| Frontend `npx tsc --noEmit` | **0 new errors** in `farmerDashboard/*` or `transaction-api.ts` (pre-existing errors in `LotDetailPage.tsx`, `OffersPage.tsx`, `chatbotDashboard/*` are unrelated to this change) |
| `MarketPricesController.test.ts` | **17/17 pass** (Agmarknet path untouched) |
| New `TransactionAuth.test.ts` | **9/9 pass** |
| New `UserProfile.test.ts` | **5/5 pass** |
| New `NotificationFlow.test.ts` | **4/4 pass** |

## 9. Git diff stats

```
 .../transaction/controllers/BuyerController.ts     |  19 +-
 .../transaction/controllers/GrievanceController.ts |  62 +++-
 .../transaction/controllers/LogisticsController.ts |  48 ++-
 .../transaction/controllers/LotController.ts       |  92 +++--
 .../transaction/controllers/OfferController.ts     | 113 ++++++-
 .../transaction/controllers/PaymentController.ts   |  62 +++-
 .../transaction/controllers/StorageController.ts   |  48 ++-
 .../modules/user/controllers/UserController.ts     |  21 +-
 .../modules/user/services/UserService.ts           |  70 ++++
 .../modules/user/validators/UserValidators.ts      |  57 +++-
 .../shared/interfaces/models.ts                    |  59 +++-
 .../features/farmerDashboard/FarmerLayout.tsx      |   8 +-
 .../features/farmerDashboard/hooks/data.ts         | 376 +++++++++++++++++----
 .../features/farmerDashboard/types.ts              |   2 +
 .../hooks/api/transaction-api.ts                   |  16 +-
 15 files changed, 876 insertions(+), 177 deletions(-)

 ?? backend/src/modules/notification/tests/        (new dir, 1 file)
 ?? backend/src/modules/transaction/tests/          (new dir, 1 file)
 ?? backend/src/modules/user/tests/                 (new dir, 1 file)
```

## 10. Known limitations

1. **`name` field on the profile form is not persisted.** It lives on
   `IUser.firstName`/`IUser.lastName`, not on `farmerProfile`. The
   frontend drops it from the PATCH body; the existing IUser-update
   endpoint would be the right place to add a name PATCH in a follow-up.
2. **`x-demo-farmer-id` is removed from the *frontend client* but still
   appears in the demo banner seed (`lots.mock.ts` → `DEMO_FARMER_UID`)
   and in the seed loader — these are demo data only, not auth tokens.
3. **No real payment gateway integration** — the payment endpoints still
   record transaction references only (status quo, unchanged).
4. **No real buyer KYC** — the buyer directory stays as demo seed data
   until KYC integration is enabled.
5. **Notification recipients for `grievance_created`** are the lot owner
   only. Admin/coordinator notifications for new grievances would need a
   `notifyAdmins(...)` helper (not in scope here).
6. **`NotificationService.saveTheNotifications(...)`** is fired
   fire-and-forget — there's no transaction-rollback coupling. If the DB
   write succeeds but the notification fails, the user simply doesn't
   see a bell item for that event.
7. **Tests use `vitest` with mocked Firebase tokens.** A real
   end-to-end test against Firebase + MongoDB would require additional
   setup (not in scope here).
