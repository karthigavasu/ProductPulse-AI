import React, { useEffect, useState } from 'react';
import { Lock, Shield, Users } from 'lucide-react';
import { api } from '../lib/api';
import type { AuditLogEntry, AuthUser } from '../types/productpulse';

interface AdminModuleProps {
  currentUser: AuthUser | null;
  onRequireAuth: () => void;
}

export const AdminModule: React.FC<AdminModuleProps> = ({
  currentUser,
  onRequireAuth,
}) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAdminData = async () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    setLoading(true);
    setError('');
    try {
      const [u, l] = await Promise.all([api.getAdminUsers(), api.getAuditLogs()]);
      setUsers(u);
      setLogs(l);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, [currentUser]);

  const handleRoleChange = async (id: number, role: 'admin' | 'user') => {
    setError('');
    setNotice('');
    try {
      await api.updateUserRole(id, role);
      setNotice(`Updated user #${id} role to ${role}.`);
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role update failed.');
    }
  };

  if (!currentUser) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <Lock className="mx-auto h-8 w-8 text-slate-400" />
        <h2 className="mt-3 text-base font-semibold text-slate-900">
          Administrator Sign-In Required
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          User management, role assignment, and immutable audit logs are protected by server-side RBAC.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Sign In / Claim Admin
        </button>
      </div>
    );
  }

  if (currentUser.role !== 'admin') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <Shield className="mx-auto h-8 w-8 text-amber-700" />
        <h2 className="mt-3 text-base font-semibold text-slate-900">
          Standard User Access ({currentUser.email})
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Your account has standard user permissions. Only accounts with the Admin role can view audit logs or modify user roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Administration, RBAC & Audit Logs
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Server-verified scrypt authentication, HMAC-SHA256 Bearer tokens, role-based access control, and decision audit trail
        </p>
      </div>

      {notice && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs text-teal-900">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">
          {error}
        </div>
      )}

      {/* User Directory */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5">
          <Users className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Workspace Users ({users.length})
          </h2>
        </div>
        {loading ? (
          <div className="p-6 text-xs text-slate-500">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">ID</th>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{u.id}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{u.name}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <select
                        aria-label={`Role for ${u.email}`}
                        value={u.role}
                        disabled={u.id === currentUser.id}
                        onChange={(e) =>
                          void handleRoleChange(u.id, e.target.value as 'admin' | 'user')
                        }
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                      >
                        <option value="admin">admin</option>
                        <option value="user">user</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">
                      {u.createdAt.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Logs */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">
            Immutable Product Decision Audit Log ({logs.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2.5 font-medium">Timestamp</th>
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Target</th>
                <th className="px-4 py-2.5 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                    {log.createdAt.replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-800">
                    {log.actorEmail}{' '}
                    <span className="text-slate-400">({log.actorRole})</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono font-medium text-blue-700">
                    {log.action}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">
                    {log.entityType}#{log.entityId}
                  </td>
                  <td className="max-w-md truncate px-4 py-2.5 font-mono text-slate-500">
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
