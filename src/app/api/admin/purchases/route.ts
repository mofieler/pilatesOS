import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/auth/api-auth';
import { getAllCreditPurchasesAction, updateCreditPurchaseAction, getPurchaseStatsAction } from '@/modules/billing/actions/creditPurchase.actions';

// GET all credit purchases (admin only)
export async function GET(request: NextRequest) {
  const authResult = await requireAdminRole(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const result = await getAllCreditPurchasesAction();
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.code === 'UNAUTHORIZED' ? 401 : 500 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error fetching credit purchases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit purchases' },
      { status: 500 }
    );
  }
}

// POST - Update credit purchase status (mark as paid, etc.)
export async function POST(request: NextRequest) {
  const authResult = await requireAdminRole(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const result = await updateCreditPurchaseAction(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.code === 'UNAUTHORIZED' ? 401 : result.code === 'INVALID_STATE' ? 400 : 500 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error updating credit purchase:', error);
    return NextResponse.json(
      { error: 'Failed to update credit purchase' },
      { status: 500 }
    );
  }
}
