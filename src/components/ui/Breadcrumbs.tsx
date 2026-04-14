
import { cn } from '../../utils/cn';

export interface BreadcrumbItem {
    label: string;
    onClick?: () => void;
    active?: boolean;
}

export interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
    return (
        <nav aria-label="Breadcrumb" className={cn("flex items-center text-sm text-secondary", className)}>
            <ol className="flex items-center space-x-2">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;

                    return (
                        <li key={index} className="flex items-center">
                            {index > 0 && (
                                <span className="mx-2 select-none text-muted/70">/</span>
                            )}
                            {item.active || isLast ? (
                                <span
                                    className={cn(
                                        "font-medium text-foreground",
                                        isLast && "cursor-default"
                                    )}
                                    aria-current={isLast ? "page" : undefined}
                                >
                                    {item.label}
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={item.onClick}
                                    className={cn(
                                        "text-secondary transition-colors hover:text-foreground",
                                        !item.onClick && "cursor-default hover:text-secondary"
                                    )}
                                    disabled={!item.onClick}
                                >
                                    {item.label}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
