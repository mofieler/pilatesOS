import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted runs before the module graph is resolved, so these
// values are safe to reference inside the vi.mock factories below.
const { mockTransaction } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: mockTransaction,
  },
}));

vi.mock('@/db/schema', () => ({
  creditBalances: { userId: 'userId', creditType: 'creditType', id: 'id', balance: 'balance', expiresAt: 'expiresAt' },
  creditTransactions: { userId: 'userId', createdAt: 'createdAt', type: 'type', creditType: 'creditType', amount: 'amount', balanceAfter: 'balanceAfter' },
  creditLots: { userId: 'userId', creditType: 'creditType', id: 'id', remainingAmount: 'remainingAmount', expiresAt: 'expiresAt', status: 'status', originalAmount: 'originalAmount' },
}));

import { creditService } from '../../src/modules/billing/services/credit.service';

// ─────────────────────────────────────────────────────────────────────────────

function makeTx(balanceRows: unknown[], lotRows: unknown[] = []) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          for: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue(balanceRows),
          })),
          orderBy: vi.fn(() => ({
            for: vi.fn().mockResolvedValue(lotRows),
          })),
          limit: vi.fn().mockResolvedValue(balanceRows),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'tx-1',
            userId: 'user-1',
            type: 'debit',
            creditType: 'pass',
            amount: -3,
            balanceAfter: 7,
          },
        ]),
      })),
    })),
  };
}

describe('creditService.debit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns INVALID_STATE when amount is zero or negative', async () => {
    const result = await creditService.debit({
      userId: 'user-1',
      creditType: 'pass',
      amount: 0,
      bookingId: 'booking-1',
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('INVALID_STATE');
  });

  it('debits balance and records a credit transaction', async () => {
    const fakeBalance = { id: 'bal-1', balance: 10 };
    const fakeLot = { id: 'lot-1', remainingAmount: 10, expiresAt: new Date(Date.now() + 86400000) };

    mockTransaction.mockImplementation(
      async (cb: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => cb(makeTx([fakeBalance], [fakeLot])),
    );

    const result = await creditService.debit({
      userId: 'user-1',
      creditType: 'pass',
      amount: 3,
      bookingId: 'booking-1',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(-3);
      expect(result.data.balanceAfter).toBe(7);
    }
  });

  it('returns INSUFFICIENT_CREDITS when balance is lower than the debit amount', async () => {
    const fakeBalance = { id: 'bal-1', balance: 2 };
    const fakeLot = { id: 'lot-1', remainingAmount: 2, expiresAt: new Date(Date.now() + 86400000) };

    mockTransaction.mockImplementation(
      async (cb: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => cb(makeTx([fakeBalance], [fakeLot])),
    );

    const result = await creditService.debit({
      userId: 'user-1',
      creditType: 'pass',
      amount: 5,
      bookingId: 'booking-1',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('INSUFFICIENT_CREDITS');
      expect(result.error).toContain('Has: 2');
      expect(result.error).toContain('Needs: 5');
    }
  });

  it('returns INSUFFICIENT_CREDITS when no balance row exists for the user', async () => {
    mockTransaction.mockImplementation(
      async (cb: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => cb(makeTx([], [])),
    );

    const result = await creditService.debit({
      userId: 'user-1',
      creditType: 'pass',
      amount: 1,
      bookingId: 'booking-1',
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('INSUFFICIENT_CREDITS');
  });
});
