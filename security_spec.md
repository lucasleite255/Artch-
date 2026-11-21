# Artchê Catalog & Admin Security Specification

## 1. Data Invariants

1. **Zero-Trust Default Deny**: Every unspecified Firestore path is explicitly denied via `match /{document=**} { allow read, write: if false; }`.
2. **Verified Admin Mutation Boundary**: Only an authenticated user with `request.auth.token.email_verified == true` who matches a bootstrapped admin email (`lucasleite255@gmail.com`, `artchesul@gmail.com`) or possesses a verified `admins/{uid}` record with `role == 'admin'` may create, update, or delete `/products/{productId}`, `/removedProducts/{productId}`, `/categories/{categoryId}`, or `/heroSlides/{slideId}`.
3. **Public Storefront Non-PII Read**: `/products/{productId}`, `/removedProducts/{productId}`, `/categories/{categoryId}`, and `/heroSlides/{slideId}` contain strictly non-PII catalog/storefront metadata (no emails, phones, addresses, or customer data). Storefront visitors may read active catalog metadata (`get`, `list`), while `/admins/{uid}` is strictly private to the matching verified admin (`request.auth.uid == uid`) or bootstrapped admin.
4. **Immutable Ownership & Temporal Integrity**: On `create`, `createdAt == request.time`, `updatedAt == request.time`, and `createdBy == request.auth.uid` are enforced. On `update`, `id`, `createdAt`, and `createdBy` are immutable, `updatedAt == request.time`, and `affectedKeys().hasOnly(...)` prevents shadow fields.
5. **Bounded Volumetric Limits & Path Hardening**: Document IDs match `^[a-zA-Z0-9_\-]+$` (`<= 64` chars), strings enforce strict min/max lengths, numeric ordering fields (`sortOrder`, `featuredOrder`) are bounded integers (`0..1000`), image/media URLs must start with `/assets/`, `/uploads/`, or `https://` (`<= 1000` chars), CTA navigation links must start with `/` or `https://` (`<= 1000` chars), and arrays (`categories`, `images`, `variants`) enforce bounded `.size()` and first-element string checks.
6. **Privilege Escalation Prevention**: Non-admin users cannot self-register in `/admins/{uid}` or inject `role` / `isAdmin` ghost fields into any document.

## 2. The "Dirty Dozen" Attack Payloads

1. **Unauthenticated Product Creation**: Anonymous client attempts `setDoc(/products/fake-01, validProduct)` -> `PERMISSION_DENIED`.
2. **Non-Admin Signed-In Deletion**: Authenticated user (`intruder@example.com`, `email_verified: true`) attempts `deleteDoc(/products/artche-001)` -> `PERMISSION_DENIED`.
3. **Unverified Admin Email Spoof**: User with token `{ email: "lucasleite255@gmail.com", email_verified: false }` attempts `setDoc(/products/spoof-01, ...)` -> `PERMISSION_DENIED`.
4. **Shadow / Ghost Field Injection on Create**: Admin attempts `setDoc(/products/prod-01, { ...validProduct, isAdmin: true, priceOverride: 0 })` -> `PERMISSION_DENIED` (blocked by `hasOnly`).
5. **Shadow / Ghost Field Injection on Update**: Admin attempts `updateDoc(/products/prod-01, { name: "Ok", updatedAt: serverTimestamp(), createdBy: "otherUid" })` -> `PERMISSION_DENIED` (blocked by `affectedKeys().hasOnly` & immutable `createdBy`).
6. **Identity Spoofing on Create**: Admin attempts `setDoc(/products/prod-02, { ...validProduct, createdBy: "victim_uid" })` -> `PERMISSION_DENIED` (`createdBy == request.auth.uid`).
7. **Client Timestamp Forgery**: Admin attempts `setDoc(/products/prod-03, { ...validProduct, createdAt: new Date("2020-01-01") })` -> `PERMISSION_DENIED` (`createdAt == request.time`).
8. **XSS / `javascript:` Image URL Poisoning**: Admin attempts `setDoc(/products/prod-04, { ...validProduct, cover: "javascript:alert(1)" })` -> `PERMISSION_DENIED` (pattern `^(/assets/|https://).+$`).
9. **Denial-of-Wallet Oversized String**: Admin attempts `setDoc(/products/prod-05, { ...validProduct, name: "A".repeat(10000) })` -> `PERMISSION_DENIED` (`name.size() <= 140`).
10. **ID Poisoning Path Traversal / Oversized Doc ID**: Admin attempts `setDoc(/products/${"x".repeat(200)}, validProduct)` -> `PERMISSION_DENIED` (`isValidProductId(productId)`).
11. **Unbounded Array Exhaustion**: Admin attempts `setDoc(/products/prod-06, { ...validProduct, categories: Array(50).fill("/feminino/") })` -> `PERMISSION_DENIED` (`categories.size() <= 8`).
12. **Self-Admin Privilege Escalation**: Non-admin user attempts `setDoc(/admins/attackerUid, { uid: "attackerUid", role: "admin", createdAt: serverTimestamp() })` -> `PERMISSION_DENIED`.

## 3. Test Runner Reference (`firestore.rules.test.ts`)

```ts
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'node:fs';

async function runSecurityTests() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'artche-security-test',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
  });

  const anonDb = testEnv.unauthenticatedContext().firestore();
  const intruderDb = testEnv.authenticatedContext('intruder', {
    email: 'intruder@example.com',
    email_verified: true,
  }).firestore();
  const spoofedAdminDb = testEnv.authenticatedContext('spoof', {
    email: 'lucasleite255@gmail.com',
    email_verified: false,
  }).firestore();
  const adminDb = testEnv.authenticatedContext('admin-uid', {
    email: 'lucasleite255@gmail.com',
    email_verified: true,
  }).firestore();

  const validProduct = {
    id: 'artche-test-01',
    name: 'Casaco Alpino Teste',
    brand: 'Seleção Artchê',
    categories: ['/feminino/', '/Casacos e Jaquetas/'],
    images: ['/assets/catalogo-artche/artche-0001-01.jpg'],
    cover: '/assets/catalogo-artche/artche-0001-01.jpg',
    variants: ['Consulte tamanhos, cores e disponibilidade'],
    catalogSource: 'admin-dashboard',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: 'admin-uid',
  };

  await assertFails(setDoc(doc(anonDb, 'products/artche-test-01'), validProduct));
  await assertFails(deleteDoc(doc(intruderDb, 'products/artche-test-01')));
  await assertFails(setDoc(doc(spoofedAdminDb, 'products/artche-test-01'), validProduct));
  await assertFails(setDoc(doc(adminDb, 'products/artche-test-01'), { ...validProduct, isAdmin: true }));
  await assertFails(setDoc(doc(adminDb, 'products/artche-test-01'), { ...validProduct, createdBy: 'other' }));
  await assertFails(setDoc(doc(adminDb, 'products/artche-test-01'), { ...validProduct, createdAt: new Date(0) }));
  await assertFails(setDoc(doc(adminDb, 'products/artche-test-01'), { ...validProduct, cover: 'javascript:alert(1)' }));
  await assertFails(setDoc(doc(adminDb, 'products/artche-test-01'), { ...validProduct, name: 'A'.repeat(200) }));
  await assertFails(setDoc(doc(adminDb, `products/${'x'.repeat(150)}`), validProduct));
  await assertFails(setDoc(doc(adminDb, 'products/artche-test-01'), { ...validProduct, categories: Array(12).fill('/feminino/') }));
  await assertFails(setDoc(doc(intruderDb, 'admins/intruder'), { uid: 'intruder', role: 'admin', createdAt: serverTimestamp() }));

  await assertSucceeds(setDoc(doc(adminDb, 'products/artche-test-01'), validProduct));
  await assertFails(updateDoc(doc(adminDb, 'products/artche-test-01'), { createdBy: 'hijack', updatedAt: serverTimestamp() }));

  await testEnv.cleanup();
}
```
