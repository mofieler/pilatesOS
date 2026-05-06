import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    console.log('[SEED] Starting database seeding...');
    
    // Run seed using drizzle-kit
    const { stdout, stderr } = await execAsync('pnpm db:seed', {
      cwd: process.cwd(),
      env: { ...process.env }
    });
    
    console.log('[SEED] Seed stdout:', stdout);
    if (stderr) console.log('[SEED] Seed stderr:', stderr);
    
    console.log('[SEED] Database seeding completed successfully!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database seeding completed successfully',
      stdout: stdout.trim()
    });
    
  } catch (error) {
    console.error('[SEED] Seeding failed:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error as any
    }, { status: 500 });
  }
}
