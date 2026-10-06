import { createSupabaseAdminClient, createSupabaseServerClient } from './supabase/server';

export async function requireUser(request: Request) {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new Error('AUTH_REQUIRED');

  const supabase = createSupabaseServerClient(token);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('AUTH_INVALID');
  return data.user;
}

export async function requireWorkspaceMember(userId: string, workspaceId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('workspaces')
    .select('id, organization_id')
    .eq('id', workspaceId)
    .maybeSingle();
  if (error || !data) throw new Error('WORKSPACE_NOT_FOUND');

  const { data: membership, error: membershipError } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', data.organization_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (membershipError || !membership) throw new Error('WORKSPACE_FORBIDDEN');

  return { workspace: data, role: membership.role as string };
}
