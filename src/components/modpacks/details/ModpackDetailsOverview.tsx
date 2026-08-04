import { ModpackDetailsHeader, type ModpackDetailsHeaderProps } from './ModpackDetailsHeader';
import {
  ModpackDetailsActionBar,
  type ModpackDetailsActionBarProps,
} from './ModpackDetailsActionBar';

export interface ModpackDetailsOverviewProps {
  actions: ModpackDetailsActionBarProps;
  header: ModpackDetailsHeaderProps;
}

export function ModpackDetailsOverview({ actions, header }: ModpackDetailsOverviewProps) {
  return (
    <div data-details-owner="overview" data-testid="modpack-details-overview" className="min-w-0">
      <section
        className="surface-card grid gap-3 overflow-hidden p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start"
        data-testid="modpack-details-hero"
      >
        <ModpackDetailsHeader {...header} />
        <ModpackDetailsActionBar {...actions} />
      </section>
    </div>
  );
}
