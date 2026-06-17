'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Grid3x3, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface GalleryPhoto {
  id: string;
  url: string;
  is_featured?: boolean;
  display_order?: number;
  created_at?: string;
}

interface PhotoMosaicProps {
  photos: GalleryPhoto[];
  className?: string;
  /** Host-only control rendered inside the mosaic (e.g. manage photos). */
  manageAction?: ReactNode;
  /** Shown when there are no photos. */
  emptyState?: ReactNode;
}

function sortPhotos(photos: GalleryPhoto[]): GalleryPhoto[] {
  return [...photos].sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    const orderA = a.display_order ?? 0;
    const orderB = b.display_order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    if (a.created_at && b.created_at) {
      return a.created_at.localeCompare(b.created_at);
    }
    return 0;
  });
}

function mosaicCellClass(index: number, count: number): string {
  if (count === 1) return 'col-span-4 row-span-2';

  if (index === 0) return 'col-span-2 row-span-2';

  if (count === 2) return 'col-span-2 row-span-2';

  if (count === 3) {
    return index === 1
      ? 'col-span-2 row-span-1'
      : 'col-span-2 row-span-1';
  }

  return 'col-span-1 row-span-1';
}

function MosaicTile({
  photo,
  index,
  count,
  onOpen,
  className,
}: {
  photo: GalleryPhoto;
  index: number;
  count: number;
  onOpen: (index: number) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={cn(
        'relative min-h-0 overflow-hidden bg-muted',
        mosaicCellClass(index, count),
        className
      )}
    >
      <Image
        src={photo.url}
        alt=""
        fill
        className="object-cover transition duration-300 hover:brightness-95"
        sizes={
          index === 0
            ? '(max-width: 768px) 100vw, 50vw'
            : '(max-width: 768px) 25vw, 25vw'
        }
        priority={index === 0}
      />
    </button>
  );
}

function PhotoLightbox({
  photos,
  lightboxIndex,
  onClose,
  onPrev,
  onNext,
}: {
  photos: GalleryPhoto[];
  lightboxIndex: number | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl border-none bg-black/95 p-0 text-white">
        <DialogTitle className="sr-only">Photo gallery</DialogTitle>
        {lightboxIndex !== null && (
          <div className="relative flex min-h-[60vh] items-center justify-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10 text-white hover:bg-white/20"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>

            {photos.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 z-10 text-white hover:bg-white/20"
                  onClick={onPrev}
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-white hover:bg-white/20"
                  onClick={onNext}
                  aria-label="Next photo"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            <div className="relative h-[60vh] w-full">
              <Image
                src={photos[lightboxIndex].url}
                alt=""
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>

            {photos.length > 1 && (
              <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-sm text-white/70">
                {lightboxIndex + 1} / {photos.length}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PhotoMosaic({
  photos,
  className,
  manageAction,
  emptyState,
}: PhotoMosaicProps) {
  const sorted = sortPhotos(photos);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const mosaicPhotos = sorted.slice(0, 5);
  const mosaicCount = mosaicPhotos.length;
  const hasMorePhotos = sorted.length > 1;

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const goPrev = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex(
      lightboxIndex === 0 ? sorted.length - 1 : lightboxIndex - 1
    );
  };

  const goNext = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex(
      lightboxIndex === sorted.length - 1 ? 0 : lightboxIndex + 1
    );
  };

  if (mosaicCount === 0) {
    return (
      <div
        className={cn(
          'relative flex h-56 items-center justify-center overflow-hidden rounded-xl bg-muted sm:h-72',
          className
        )}
      >
        {emptyState ?? (
          <p className="text-sm text-muted-foreground">No photos yet</p>
        )}
        {manageAction && (
          <div className="absolute bottom-4 right-4">{manageAction}</div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={cn('relative', className)}>
        {/* Mobile: hero + thumbnail strip */}
        <div className="space-y-2 md:hidden">
          <button
            type="button"
            onClick={() => openLightbox(0)}
            className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-muted"
          >
            <Image
              src={mosaicPhotos[0].url}
              alt=""
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          </button>
          {mosaicCount > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {mosaicPhotos.slice(1).map((photo, i) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => openLightbox(i + 1)}
                  className="relative aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  <Image
                    src={photo.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="25vw"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop: Airbnb-style mosaic */}
        <div className="hidden h-[min(56vw,420px)] min-h-[280px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-xl md:grid">
          {mosaicPhotos.map((photo, index) => (
            <MosaicTile
              key={photo.id}
              photo={photo}
              index={index}
              count={mosaicCount}
              onOpen={openLightbox}
              className={cn(
                index === 0 && 'rounded-l-xl',
                index === 1 && mosaicCount === 2 && 'rounded-r-xl',
                index === 1 && mosaicCount >= 3 && 'rounded-tr-xl',
                index === 2 && mosaicCount === 3 && 'rounded-br-xl',
                index === 2 && mosaicCount >= 4 && 'rounded-none',
                index === 3 && mosaicCount === 4 && 'rounded-br-xl',
                index === 4 && 'rounded-br-xl'
              )}
            />
          ))}
        </div>

        <div className="absolute bottom-4 right-4 flex flex-wrap items-center justify-end gap-2">
          {hasMorePhotos && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shadow-md"
              onClick={() => openLightbox(0)}
            >
              <Grid3x3 className="mr-1.5 h-4 w-4" />
              Show all photos
            </Button>
          )}
          {manageAction}
        </div>
      </div>

      <PhotoLightbox
        photos={sorted}
        lightboxIndex={lightboxIndex}
        onClose={closeLightbox}
        onPrev={goPrev}
        onNext={goNext}
      />
    </>
  );
}

/** @deprecated Use PhotoMosaic — kept for existing imports. */
export function PhotoGallery({
  photos,
  title,
  className,
}: {
  photos: GalleryPhoto[];
  title?: string;
  className?: string;
}) {
  if (photos.length === 0 && !title) return null;

  return (
    <section className={cn(title && 'py-10', className)}>
      {title && (
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      )}
      <PhotoMosaic
        photos={photos}
        className={cn(title && 'mt-6')}
      />
    </section>
  );
}
