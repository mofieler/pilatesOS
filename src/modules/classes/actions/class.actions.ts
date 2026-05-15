'use server';

// Barrel — re-exports all class actions so existing imports remain unchanged.
// Implementations split by domain to keep each file under 900 lines.

export * from './classTemplate.actions';
export * from './classSession.actions';
export * from './sessionStudents.actions';
