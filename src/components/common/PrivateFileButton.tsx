import { useState } from 'react';
import { Loader2, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { openPrivateFile, downloadPrivateFile } from '@/lib/fileStorage';

interface PrivateFileButtonProps {
  documentId: string;
  fileName?: string;
  mode?: 'open' | 'download';
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

/**
 * Opens or downloads a file held in private Hostinger storage.
 *
 * These files have no public URL on purpose — a plain <a href> cannot
 * reach them, because the server requires an Authorization header it
 * checks against the database before releasing anything. This button
 * does that fetch and hands the browser a temporary blob instead.
 */
export function PrivateFileButton({
  documentId,
  fileName,
  mode = 'open',
  label,
  variant = 'outline',
  size = 'sm',
  className,
}: PrivateFileButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      if (mode === 'download') {
        await downloadPrivateFile(documentId, fileName || 'document');
      } else {
        await openPrivateFile(documentId);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not open the file.');
    } finally {
      setBusy(false);
    }
  };

  const Icon = mode === 'download' ? Download : ExternalLink;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {size !== 'icon' && (
        <span className="ml-2">
          {label || (mode === 'download' ? 'Download' : 'View')}
        </span>
      )}
    </Button>
  );
}
