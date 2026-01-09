import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3! inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive overflow-hidden group/badge',
  {
    variants: {
      variant: {
        default:
          'border-primary/20 bg-primary text-primary-foreground [a]:hover:bg-primary/90',
        secondary:
          'border-secondary-foreground/10 bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
        destructive:
          'border-destructive/20 bg-destructive/10 text-destructive [a]:hover:bg-destructive/15 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20 dark:border-destructive/30',
        outline:
          'border-border bg-transparent text-foreground [a]:hover:bg-muted',
        ghost:
          'border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/50',
        link: 'border-transparent bg-transparent text-primary underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type BadgeProps = Omit<useRender.ComponentProps<'span'>, 'className'> &
  VariantProps<typeof badgeVariants>;

function Badge({ variant = 'default', render, ...props }: BadgeProps) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: badgeVariants({ variant }),
      },
      props,
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  });
}

export { Badge, badgeVariants };
