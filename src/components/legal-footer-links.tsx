import Link from 'next/link';
import { SITE_DOCUMENT_PATHS } from '@/lib/site-documents';

export function LegalFooterLinks() {
  return (
    <nav
      aria-label="Legal"
      className="flex flex-col gap-1 text-sm text-muted-foreground"
    >
      <Link
        href={SITE_DOCUMENT_PATHS.terms}
        className="hover:text-foreground hover:underline underline-offset-4"
      >
        Terms of Service
      </Link>
      <Link
        href={SITE_DOCUMENT_PATHS.privacy}
        className="hover:text-foreground hover:underline underline-offset-4"
      >
        Privacy Policy
      </Link>
    </nav>
  );
}
