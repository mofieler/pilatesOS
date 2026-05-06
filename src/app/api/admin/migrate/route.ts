import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    console.log('[MIGRATE] Starting database migration...');
    console.log('[MIGRATE] Working directory:', process.cwd());
    console.log('[MIGRATE] Environment check:', {
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV
    });
    
    // Use npm only (always available in production)
    const command = 'npm run db:migrate';
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      env: { ...process.env }
    });
    
    console.log('[MIGRATE] Migration stdout:', stdout);
    if (stderr) console.log('[MIGRATE] Migration stderr:', stderr);
    
    console.log('[MIGRATE] Database migration completed successfully!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database migration completed successfully',
      stdout: stdout.trim(),
      command: command
    });
    
  } catch (error) {
    console.error('[MIGRATE] Migration failed:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        message: (error as any).message,
        code: (error as any).code,
        signal: (error as any).signal,
        stdout: (error as any).stdout,
        stderr: (error as any).stderr
      }
    }, { status: 500 });
  }
}
