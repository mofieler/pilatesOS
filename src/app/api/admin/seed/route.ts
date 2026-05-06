import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireAdminRole } from '@/lib/auth/api-auth';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  // Hard gate: this endpoint runs `npm run db:seed` via shell exec.
  // Even with admin auth it must never be reachable in production —
  // re-seeding overwrites/duplicates fixture data and would create
  // unintended admin/instructor accounts.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_RUNTIME_SEED !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const authResult = await requireAdminRole(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    console.log('[SEED] Starting database seeding...');

    const command = 'npm run db:seed';
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    console.log('[SEED] Seed stdout:', stdout);
    if (stderr) console.log('[SEED] Seed stderr:', stderr);

    return NextResponse.json({
      success: true,
      message: 'Database seeding completed successfully',
      stdout: stdout.trim(),
      command,
    });
  } catch (error) {
    console.error('[SEED] Seeding failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
