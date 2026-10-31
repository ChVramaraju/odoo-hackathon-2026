import React from 'react';
import { Clock, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

interface ModulePlaceholderProps {
  title: string;
  badge: string;
  description: string;
  targetEndpoints: Array<{ method: string; path: string; purpose: string }>;
  contractsRef: string;
  plannedFeatures: string[];
}

export const ModulePlaceholder: React.FC<ModulePlaceholderProps> = ({
  title,
  badge,
  description,
  targetEndpoints,
  contractsRef,
  plannedFeatures,
}) => {
  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading text-2xl font-bold text-surface-text tracking-tight">{title}</h1>
            <Badge variant="mint">{badge}</Badge>
          </div>
          <p className="text-sm text-surface-textMuted">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="forest" className="border-amber-500/30 text-amber-400">
            <Clock className="w-3.5 h-3.5 mr-1" /> Awaiting Backend Endpoints
          </Badge>
        </div>
      </div>

      {/* Target API Contracts Accordion */}
      <Card className="bg-forest-900/60 border-surface-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Target Backend API Contracts (from {contractsRef})</span>
            </div>
            <span className="text-xs text-surface-textMuted font-mono">Status: Defined in API_CONTRACTS.md</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-surface-border/40">
            {targetEndpoints.map((ep, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      ep.method === 'GET'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : ep.method === 'POST'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono text-surface-text font-medium">{ep.path}</span>
                </div>
                <span className="text-surface-textMuted">{ep.purpose}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Planned Feature Blueprint */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="bg-forest-900/40 border-surface-border">
          <CardHeader>
            <CardTitle className="text-sm">Planned UI Capabilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {plannedFeatures.map((feat, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-surface-text">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{feat}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-forest-900/40 border-surface-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-mint-400" />
              <span>Architectural Rule Notice</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-surface-textMuted leading-relaxed space-y-2">
            <p>
              In strict accordance with <strong className="text-surface-text">PROJECT_STANDARD.md</strong> and{' '}
              <strong className="text-surface-text">AI_RULES.md</strong>, the frontend never mocks or simulates financial totals,
              invoice generation, or payment reconciliation as real data.
            </p>
            <p>
              As soon as the backend lead merges endpoints on <code className="text-emerald-400">feature/lead-backend</code>, this
              module will immediately transition to live server-authoritative mutations.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
