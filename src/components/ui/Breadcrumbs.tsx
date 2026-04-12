
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
        <nav aria-label="Breadcrumb" className={cn("flex items-center text-sm", className)}>
            <ol className="flex items-center space-x-2">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;

                    return (
                        <li key={index} className="flex items-center">
                            {index > 0 && (
                                <span className="mx-2 text-zinc-400 dark:text-zinc-600 select-none">/</span>
                            )}
                            {item.active || isLast ? (
                                <span
                                    className={cn(
                                        "font-medium text-zinc-900 dark:text-zinc-100",
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
                                        "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors",
                                        !item.onClick && "cursor-default hover:text-zinc-500 dark:hover:text-zinc-400"
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
