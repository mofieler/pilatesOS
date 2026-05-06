import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    console.log('[SEED] Starting database seeding...');
    console.log('[SEED] Working directory:', process.cwd());
    console.log('[SEED] Environment check:', {
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV
    });
    
    // Use npm only (always available in production)
    const command = 'npm run db:seed';
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      env: { ...process.env }
    });
    
    console.log('[SEED] Seed stdout:', stdout);
    if (stderr) console.log('[SEED] Seed stderr:', stderr);
    
    console.log('[SEED] Database seeding completed successfully!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database seeding completed successfully',
      stdout: stdout.trim(),
      command: command
    });
    
  } catch (error) {
    console.error('[SEED] Seeding failed:', error);
    
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
