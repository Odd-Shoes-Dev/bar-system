import { sql } from '@/lib/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export type UserRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'viewer';

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  bar_id: string;
  branch_id: string | null;   // null = owner (all-branch access)
  branch_name: string | null;
}

/**
 * Get current authenticated user from session (includes branch data)
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) return null;

    const [session] = await sql`
      SELECT s.user_id, s.bar_id, s.branch_id, b.name AS branch_name
      FROM   sessions s
      LEFT JOIN branches b ON b.id = s.branch_id
      WHERE  s.token = ${token} AND s.expires_at > NOW()
    `;

    if (!session) return null;

    const [staff] = await sql`
      SELECT id, name, phone, email, role, bar_id, branch_id
      FROM   users
      WHERE  id = ${session.user_id} AND is_active = true
    `;

    if (!staff) return null;

    return {
      id:          staff.id,
      name:        staff.name,
      phone:       staff.phone,
      email:       staff.email,
      role:        staff.role,
      bar_id:    staff.bar_id,
      branch_id:   session.branch_id  ?? null,
      branch_name: session.branch_name ?? null,
    } as AuthUser;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Returns a 401 JSON response AND clears the auth cookie.
 */
export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  const response = NextResponse.json({ error: message }, { status: 401 });
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}

/**
 * Login with phone and PIN.
 * branch_id is required for non-owner accounts when the salon has multiple branches.
 */
export async function loginWithPin(
  phone: string,
  pin: string,
  barId: string,
  branchId: string | null
): Promise<{ success: boolean; token?: string; error?: string; lockedUntil?: string }> {
  try {
    const [staff] = await sql`
      SELECT id, pin_hash, bar_id, role, branch_id, is_active, failed_attempts, locked_until
      FROM   users
      WHERE  phone = ${phone} AND bar_id = ${barId}
    `;

    if (!staff) return { success: false, error: 'Invalid phone or PIN' };
    if (!staff.is_active) return { success: false, error: 'Account is inactive' };

    if (staff.locked_until && new Date(staff.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(staff.locked_until).getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Too many failed attempts. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`,
        lockedUntil: staff.locked_until,
      };
    }

    const isValid = await bcrypt.compare(pin, staff.pin_hash);
    if (!isValid) {
      const attempts = (staff.failed_attempts ?? 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await sql`UPDATE users SET failed_attempts = ${attempts}, locked_until = ${lockUntil} WHERE id = ${staff.id}`;
      if (lockUntil) {
        return { success: false, error: 'Too many failed attempts. Account locked for 15 minutes.', lockedUntil: lockUntil };
      }
      return { success: false, error: 'Invalid phone or PIN' };
    }

    const resolvedBranchId = await resolveBranchId(
      staff as { role: string; branch_id: string | null },
      branchId,
      barId
    );
    if (resolvedBranchId === 'INVALID') {
      return { success: false, error: 'You are not assigned to the selected branch.' };
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await sql`
      INSERT INTO sessions (user_id, bar_id, branch_id, token, expires_at)
      VALUES (${staff.id}, ${staff.bar_id}, ${resolvedBranchId}, ${token}, ${expiresAt.toISOString()})
    `;

    await sql`UPDATE users SET last_login = NOW(), failed_attempts = 0, locked_until = NULL WHERE id = ${staff.id}`;

    return { success: true, token };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

/**
 * Login with email or phone + password.
 */
export async function loginWithPassword(
  identifier: string,
  password: string,
  barId: string,
  branchId: string | null
): Promise<{ success: boolean; token?: string; error?: string; lockedUntil?: string }> {
  try {
    const isPhone = /^[\+\d]/.test(identifier.trim());

    const rows = isPhone
      ? await sql`SELECT id, password_hash, bar_id, role, branch_id, is_active, failed_attempts, locked_until FROM users WHERE bar_id = ${barId} AND phone = ${identifier.trim()}`
      : await sql`SELECT id, password_hash, bar_id, role, branch_id, is_active, failed_attempts, locked_until FROM users WHERE bar_id = ${barId} AND email = ${identifier.trim()}`;

    const staff = rows[0];

    if (!staff) return { success: false, error: 'Invalid credentials' };
    if (!staff.is_active) return { success: false, error: 'Account is inactive' };

    if (staff.locked_until && new Date(staff.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(staff.locked_until).getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Too many failed attempts. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`,
        lockedUntil: staff.locked_until,
      };
    }

    if (!staff.password_hash) {
      return { success: false, error: 'Password login not enabled for this account' };
    }

    const isValid = await bcrypt.compare(password, staff.password_hash);
    if (!isValid) {
      const attempts = (staff.failed_attempts ?? 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await sql`UPDATE users SET failed_attempts = ${attempts}, locked_until = ${lockUntil} WHERE id = ${staff.id}`;
      if (lockUntil) {
        return { success: false, error: 'Too many failed attempts. Account locked for 15 minutes.', lockedUntil: lockUntil };
      }
      return { success: false, error: 'Invalid email or password' };
    }

    const resolvedBranchId = await resolveBranchId(
      staff as { role: string; branch_id: string | null },
      branchId,
      barId
    );
    if (resolvedBranchId === 'INVALID') {
      return { success: false, error: 'You are not assigned to the selected branch.' };
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await sql`
      INSERT INTO sessions (user_id, bar_id, branch_id, token, expires_at)
      VALUES (${staff.id}, ${staff.bar_id}, ${resolvedBranchId}, ${token}, ${expiresAt.toISOString()})
    `;

    await sql`UPDATE users SET last_login = NOW(), failed_attempts = 0, locked_until = NULL WHERE id = ${staff.id}`;

    return { success: true, token };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

/**
 * Resolve which branch_id to store in the session.
 *  - Owner: can select any branch or null (all branches)
 *  - Others: must match their assigned branch_id
 *
 * Returns 'INVALID' if the staff member is not allowed at the requested branch.
 */
async function resolveBranchId(
  staff: { role: string; branch_id: string | null },
  requestedBranchId: string | null,
  barId: string
): Promise<string | null | 'INVALID'> {
  // Owner can see all branches; store the selected branch (or null = all)
  if (staff.role === 'owner') {
    if (requestedBranchId === null) return null;
    // Validate the branch belongs to this salon
    const [branch] = await sql`
      SELECT id FROM branches WHERE id = ${requestedBranchId} AND bar_id = ${barId} AND deleted_at IS NULL
    `;
    return branch ? requestedBranchId : 'INVALID';
  }

  // Regular staff: use their assigned branch (ignore what was requested)
  if (staff.branch_id) return staff.branch_id;

  // Staff with no assigned branch — fall back to first active branch of salon
  const [branch] = await sql`
    SELECT id FROM branches WHERE bar_id = ${barId} AND deleted_at IS NULL AND is_active = true ORDER BY created_at LIMIT 1
  `;
  return branch ? branch.id : null;
}

/**
 * Logout - destroy session
 */
export async function logout(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (token) {
      await sql`DELETE FROM sessions WHERE token = ${token}`;
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
}

/**
 * Hash PIN for storage
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

/**
 * Hash password for storage
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

function generateToken(): string {
  return Array.from({ length: 32 }, () =>
    Math.random().toString(36).charAt(2)
  ).join('');
}

/**
 * Check if user has permission for action
 */
export function hasPermission(user: AuthUser, action: string): boolean {
  const permissions: Record<string, string[]> = {
    'manage_users':    ['owner', 'admin'],
    'manage_services': ['owner', 'admin', 'manager'],
    'manage_clients':  ['owner', 'admin', 'manager'],
    'view_reports':    ['owner', 'admin', 'manager', 'viewer'],
    'use_pos':         ['owner', 'admin', 'manager', 'cashier'],
    'manage_branches': ['owner'],
  };

  return permissions[action]?.includes(user.role) || false;
}

/**
 * Check if a user's role can be changed by the acting user.
 */
export function canChangeRole(actingUser: AuthUser, targetRole: UserRole): boolean {
  if (targetRole === 'owner') return false;
  if (targetRole === 'admin') return actingUser.role === 'owner';
  return actingUser.role === 'owner' || actingUser.role === 'admin';
}

/**
 * Build a branch filter clause.
 * Owner with branch_id=null sees all; everyone else is restricted.
 */
export function getBranchFilter(user: AuthUser): string | null {
  if (user.role === 'owner' && user.branch_id === null) return null; // no filter
  return user.branch_id;
}
