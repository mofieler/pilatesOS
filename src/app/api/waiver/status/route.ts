import { NextRequest, NextResponse } from 'next/server';
import { checkWaiverStatusAction } from '@/modules/users/actions/waiver.action';

// Error codes for better maintainability
const ERROR_CODES = {
  UNAUTHORIZED: 401,
  SERVER_ERROR: 500,
} as const;

export async function GET(request: NextRequest) {
  try {
    const result = await checkWaiverStatusAction();
    
    if (!result.success) {
      console.warn('Waiver status check failed:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: ERROR_CODES.UNAUTHORIZED }
      );
    }

    return NextResponse.json({
      hasSignedWaiver: result.hasSignedWaiver,
    });
  } catch (error) {
    console.error('Waiver status API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: ERROR_CODES.SERVER_ERROR }
    );
  }
}
