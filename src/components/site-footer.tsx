import { Wordmark } from '@/components/brand/wordmark';

export function SiteFooter({ name }: { name?: string }) {
  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="mx-auto flex h-[200px] max-w-6xl flex-col justify-center gap-2 px-6">
        {name ? (
          <p className="font-display text-lg tracking-tight">{name}</p>
        ) : (
          <Wordmark className="h-5 text-primary" />
        )}
        {name && (
          <p className="text-sm text-muted-foreground">Powered by Gracious</p>
        )}
      </div>
    </footer>
  );
}
