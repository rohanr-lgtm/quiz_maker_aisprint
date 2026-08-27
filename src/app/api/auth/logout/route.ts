import { NextResponse } from "next/server";

/**
 * No server-side session exists to invalidate (see PRD Scope > Cut). This
 * endpoint exists to satisfy the user-facing logout action; the real logout
 * behavior is client-side: discard in-memory user state and redirect to
 * `/login`.
 */
export async function POST() {
  return NextResponse.json({ success: true });
}
