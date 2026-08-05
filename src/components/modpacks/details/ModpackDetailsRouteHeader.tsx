import { ArrowLeft } from 'lucide-react';
import { Breadcrumbs } from '../../ui/Breadcrumbs';
import { Button } from '../../ui/Button';

interface ModpackDetailsRouteHeaderProps {
  modpackName: string;
  modpacksLabel: string;
  backLabel: string;
  onBack: () => void;
}

export function ModpackDetailsRouteHeader({
  modpackName,
  modpacksLabel,
  backLabel,
  onBack,
}: ModpackDetailsRouteHeaderProps) {
  return <div className="border-b border-border/70 bg-card/78 px-6 py-3 backdrop-blur-md" data-testid="modpack-details-route-top">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Breadcrumbs items={[{ label: modpacksLabel, onClick: onBack }, { label: modpackName, active: true }]} />
      <Button variant="secondary" size="sm" onClick={onBack} className="flex items-center gap-2">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {backLabel}
      </Button>
    </div>
  </div>;
}
