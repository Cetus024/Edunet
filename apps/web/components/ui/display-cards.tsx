import type * as React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DisplayCardProps {
  className?: string;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  date?: string;
  iconClassName?: string;
  titleClassName?: string;
  onClick?: () => void;
  isActive?: boolean;
}

function DisplayCard({
  className,
  icon = <Sparkles className="size-4" />,
  title = 'Featured',
  description = 'Discover study content',
  date = 'Just now',
  iconClassName = 'text-accent-foreground',
  titleClassName = 'text-foreground',
  onClick,
  isActive = false,
}: DisplayCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -10, rotate: -2 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'relative flex h-36 w-full max-w-[22rem] -skew-y-[8deg] select-none flex-col justify-between rounded-2xl border-2 bg-card px-4 py-3 text-left text-card-foreground shadow-[0_14px_34px_rgba(29,58,98,0.12)] transition-all duration-500 after:pointer-events-none after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[45%] after:bg-gradient-to-l after:from-background after:to-transparent after:content-[\'\'] hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>*]:flex [&>*]:items-center [&>*]:gap-2',
        isActive && 'border-accent bg-accent text-accent-foreground after:opacity-0',
        className,
      )}
      aria-pressed={isActive}
    >
      <div>
        <span
          className={cn(
            'relative inline-flex rounded-full bg-primary p-2 text-primary-foreground',
            isActive && 'bg-background text-foreground',
            iconClassName,
          )}
        >
          {icon}
        </span>
        <p className={cn('text-lg font-bold', titleClassName, isActive && 'text-accent-foreground')}>
          {title}
        </p>
      </div>
      <p className="whitespace-nowrap text-base font-semibold">{description}</p>
      <p className={cn('text-xs text-muted-foreground', isActive && 'text-accent-foreground')}>
        {date}
      </p>
    </motion.button>
  );
}

interface DisplayCardsProps {
  cards?: DisplayCardProps[];
  layout?: 'stack' | 'grid';
}

export default function DisplayCards({ cards, layout = 'stack' }: DisplayCardsProps) {
  const displayCards = cards || [];
  const isGrid = layout === 'grid';

  return (
    <div
      className={cn(
        'opacity-100 animate-in fade-in-0 duration-700',
        isGrid
          ? 'mx-auto grid w-full max-w-4xl grid-cols-1 place-items-center gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4'
          : "grid min-h-[250px] [grid-template-areas:'stack'] place-items-center overflow-visible py-10",
      )}
    >
      {displayCards.map((cardProps: DisplayCardProps, index: number) => (
        <DisplayCard key={`${cardProps.title ?? 'card'}-${index}`} {...cardProps} />
      ))}
    </div>
  );
}
