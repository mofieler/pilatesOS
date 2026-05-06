import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireAdminRole } from '@/lib/auth/api-auth';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  // Hard gate: this endpoint runs `npm run db:migrate` via shell exec.
  // Even with admin auth it must never be reachable in production —
  // migrations belong in the deploy pipeline, not the web request path.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_RUNTIME_MIGRATE !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const authResult = await requireAdminRole(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    console.log('[MIGRATE] Starting database migration...');

    const command = 'npm run db:migrate';
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    console.log('[MIGRATE] Migration stdout:', stdout);
    if (stderr) console.log('[MIGRATE] Migration stderr:', stderr);

    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully',
      stdout: stdout.trim(),
      command,
    });
  } catch (error) {
    console.error('[MIGRATE] Migration failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
