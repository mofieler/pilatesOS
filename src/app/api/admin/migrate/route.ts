import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    console.log('[MIGRATE] Starting database migration...');
    
    // Run migration using drizzle-kit
    const { stdout, stderr } = await execAsync('pnpm db:migrate', {
      cwd: process.cwd(),
      env: { ...process.env }
    });
    
    console.log('[MIGRATE] Migration stdout:', stdout);
    if (stderr) console.log('[MIGRATE] Migration stderr:', stderr);
    
    console.log('[MIGRATE] Database migration completed successfully!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database migration completed successfully',
      stdout: stdout.trim()
    });
    
  } catch (error) {
    console.error('[MIGRATE] Migration failed:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error as any
    }, { status: 500 });
  }
}
