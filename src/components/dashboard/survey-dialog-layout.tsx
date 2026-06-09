'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogContent, DialogTitle } from '@/components/ui/dialog';

export function SurveyDialogLayout({
  title,
  stepIndex,
  stepCount,
  stepTitle,
  children,
  onBack,
  onNext,
  nextLabel,
  loading = false,
}: {
  title: string;
  stepIndex: number;
  stepCount: number;
  stepTitle: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  loading?: boolean;
}) {
  const progress = ((stepIndex + 1) / stepCount) * 100;

  return (
    <DialogContent
      hideCloseButton
      className="flex h-[min(88vh,760px)] w-[min(94vw,720px)] max-w-none flex-col gap-0 overflow-hidden rounded-3xl p-0"
    >
      <DialogTitle className="sr-only">{title}</DialogTitle>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-6 pt-12">
        <h3 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{stepTitle}</h3>
        <div className="mt-6">{children}</div>
      </div>

      <div className="shrink-0 space-y-5 px-8 pb-7 pt-2">
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          {onBack ? (
            <Button type="button" variant="ghost" onClick={onBack} disabled={loading}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" size="lg" onClick={onNext} disabled={loading}>
            {nextLabel}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
