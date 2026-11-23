import React, { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { api, setAuthToken } from '../lib/api';
import type { AuthUser } from '../types/productpulse';

interface AuthModalProps {
  isOpen: boolean;
  hasAdmin: boolean;
  envAdminPasscodeConfigured: boolean;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  hasAdmin,
  envAdminPasscodeConfigured,
  onClose,
  onAuthenticated,
}) => {
  const defaultTab = !hasAdmin ? 'claim-admin' : 'login';
  const [tab, setTab] = useState<'login' | 'register' | 'claim-admin'>(defaultTab);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result: { token: string; user: AuthUser };
      if (tab === 'login') {
        result = await api.login({ email, password });
      } else if (tab === 'register') {
        result = await api.register({ email, name, password });
      } else {
        result = await api.claimAdmin({
          email,
          name,
          password,
          adminPasscode: envAdminPasscodeConfigured ? adminPasscode : undefined,
        });
      }
      setAuthToken(result.token);
      onAuthenticated(result.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
              <h2 id="auth-modal-title" className="text-lg font-semibold text-slate-900">
                Workspace Authentication
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Sign in to create or edit records, run CSV imports, and record audit logs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close authentication modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError('');
            }}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError('');
            }}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Standard User
          </button>
          {(!hasAdmin || envAdminPasscodeConfigured) && (
            <button
              type="button"
              onClick={() => {
                setTab('claim-admin');
                setError('');
              }}
              className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === 'claim-admin'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Claim Admin
            </button>
          )}
        </div>

        {tab === 'claim-admin' && !hasAdmin && (
          <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            First-run setup: Create the initial Administrator account to manage workspace roles and audit logs.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {tab !== 'login' && (
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Full Name
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Work Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pm@company.com"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Password {tab !== 'login' && <span className="text-slate-400">(min 8 chars)</span>}
            </label>
            <input
              type="password"
              required
              minLength={tab === 'login' ? 1 : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            />
          </div>

          {tab === 'claim-admin' && envAdminPasscodeConfigured && (
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Server Admin Passcode
              </label>
              <input
                type="password"
                required
                value={adminPasscode}
                onChange={(e) => setAdminPasscode(e.target.value)}
                placeholder="Configured ADMIN_PASSCODE"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="whitespace-nowrap rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? 'Authenticating...'
                : tab === 'login'
                ? 'Sign In'
                : tab === 'register'
                ? 'Create Account'
                : 'Claim Admin Access'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
