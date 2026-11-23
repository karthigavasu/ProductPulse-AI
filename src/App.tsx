import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Bot,
  Briefcase,
  Compass,
  DollarSign,
  FlaskConical,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Map,
  Menu,
  MessageSquare,
  Shield,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { AdminModule } from './components/AdminModule';
import { AiAssistantModule } from './components/AiAssistantModule';
import { AnalyticsModule } from './components/AnalyticsModule';
import { AuthModal } from './components/AuthModal';
import { BusinessCaseModule } from './components/BusinessCaseModule';
import { DocsDeliverablesModule } from './components/DocsDeliverablesModule';
import { ExperimentsModule } from './components/ExperimentsModule';
import { FeedbackModule } from './components/FeedbackModule';
import { OverviewModule } from './components/OverviewModule';
import { PmWorkspaceModule } from './components/PmWorkspaceModule';
import { PrioritizationModule } from './components/PrioritizationModule';
import { RoadmapModule } from './components/RoadmapModule';
import { UxJourneyModule } from './components/UxJourneyModule';
import { api, setAuthToken } from './lib/api';
import type { AuthUser } from './types/productpulse';

interface NavItem {
  id: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', group: 'Analytics', icon: LayoutDashboard },
  { id: 'analytics', label: 'Product Analytics', group: 'Analytics', icon: BarChart3 },
  { id: 'feedback', label: 'Customer Feedback', group: 'Voice of Customer', icon: MessageSquare },
  { id: 'insights', label: 'AI Feedback Insights', group: 'Voice of Customer', icon: Sparkles },
  { id: 'prioritization', label: 'RICE Prioritization', group: 'Strategy & Roadmap', icon: ListOrdered },
  { id: 'roadmap', label: 'Product Roadmap', group: 'Strategy & Roadmap', icon: Map },
  { id: 'experiments', label: 'A/B Experiments', group: 'Strategy & Roadmap', icon: FlaskConical },
  { id: 'business', label: 'Business Case & ROI', group: 'Business & UX', icon: DollarSign },
  { id: 'ux', label: 'UX & Customer Journey', group: 'Business & UX', icon: Compass },
  { id: 'workspace', label: 'PM Workspace', group: 'Business & UX', icon: Briefcase },
  { id: 'assistant', label: 'AI Product Assistant', group: 'Intelligence & Docs', icon: Bot },
  { id: 'deliverables', label: 'PM Docs & Templates', group: 'Intelligence & Docs', icon: BookOpen },
  { id: 'admin', label: 'Admin & Audit Logs', group: 'Governance', icon: Shield },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [hasAdmin, setHasAdmin] = useState<boolean>(true);
  const [envAdminPasscodeConfigured, setEnvAdminPasscodeConfigured] =
    useState<boolean>(false);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(false);
  const [featurePrefill, setFeaturePrefill] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const refreshAuthStatus = async () => {
    try {
      const status = await api.getAuthStatus();
      setHasAdmin(status.hasAdmin);
      setEnvAdminPasscodeConfigured(status.envAdminPasscodeConfigured);
      setGeminiConfigured(status.geminiConfigured);
      setCurrentUser(status.currentUser);
    } catch {
      // Ignore transient boot error
    }
  };

  useEffect(() => {
    void refreshAuthStatus();
  }, []);

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
  };

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];
  const groups = Array.from(new Set(NAV_ITEMS.map((i) => i.group)));

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Navigation Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-150 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              PP
            </div>
            <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              ProductPulse AI
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav
          aria-label="Primary Workspace Navigation"
          className="flex-1 space-y-5 overflow-y-auto px-3 py-4"
        >
          {groups.map((group) => (
            <div key={group}>
              <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-slate-400">
                {group}
              </div>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
          {currentUser ? (
            <div className="space-y-2">
              <div className="font-semibold text-slate-900 truncate">
                {currentUser.name}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {currentUser.email} · {currentUser.role}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <UserCheck className="h-3.5 w-3.5" />
              {!hasAdmin ? 'Claim Admin Account' : 'Sign In / Register'}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header Contract */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
              <span className="font-medium text-slate-900 whitespace-nowrap">
                ProductPulse AI
              </span>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-blue-700 whitespace-nowrap truncate">
                {activeNav.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {!currentUser ? (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                {!hasAdmin ? 'Claim Admin' : 'Sign In'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {currentUser.name} · {currentUser.role}
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-8">
          {activeTab === 'overview' && (
            <OverviewModule
              currentUser={currentUser}
              onRequireAuth={() => setAuthModalOpen(true)}
              onNavigate={setActiveTab}
            />
          )}
          {activeTab === 'analytics' && <AnalyticsModule />}
          {(activeTab === 'feedback' || activeTab === 'insights') && (
            <FeedbackModule
              initialView={activeTab === 'insights' ? 'insights' : 'queue'}
              currentUser={currentUser}
              onRequireAuth={() => setAuthModalOpen(true)}
              onPromoteToFeature={(prefill) => {
                setFeaturePrefill(prefill);
                setActiveTab('prioritization');
              }}
            />
          )}
          {activeTab === 'prioritization' && (
            <PrioritizationModule
              currentUser={currentUser}
              onRequireAuth={() => setAuthModalOpen(true)}
              prefill={featurePrefill}
              onClearPrefill={() => setFeaturePrefill(null)}
            />
          )}
          {activeTab === 'roadmap' && (
            <RoadmapModule
              currentUser={currentUser}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          )}
          {activeTab === 'experiments' && (
            <ExperimentsModule
              currentUser={currentUser}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          )}
          {activeTab === 'business' && (
            <BusinessCaseModule
              currentUser={currentUser}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          )}
          {activeTab === 'ux' && (
            <UxJourneyModule
              currentUser={currentUser}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          )}
          {activeTab === 'workspace' && (
            <PmWorkspaceModule
              currentUser={currentUser}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          )}
          {activeTab === 'assistant' && (
            <AiAssistantModule geminiConfigured={geminiConfigured} />
          )}
          {activeTab === 'deliverables' && <DocsDeliverablesModule />}
          {activeTab === 'admin' && (
            <AdminModule
              currentUser={currentUser}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          )}
        </main>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        hasAdmin={hasAdmin}
        envAdminPasscodeConfigured={envAdminPasscodeConfigured}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={(user) => {
          setCurrentUser(user);
          void refreshAuthStatus();
        }}
      />
    </div>
  );
}
