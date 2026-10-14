import { useRef, useState } from 'react';
import { Upload, X, Loader2, FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { uploadPrivateFile } from '@/lib/fileStorage';
import { cn } from '@/lib/utils';

export interface AttachedFile {
  /** documents.id — pass this to PrivateFileButton to view it later */
  id: string;
  file_name: string;
  file_size: number;
  /** php://<path> marker stored in *_url columns */
  marker: string;
}

interface FileUploadFieldProps {
  label?: string;
  description?: string;
  /** Free-text label describing the document, e.g. "Member Photo" */
  category: string;
  societyId: string;
  entityId?: string | null;
  multiple?: boolean;
  maxFiles?: number;
  /** Restrict the picker. Server allows PDF, JPG, PNG and WEBP regardless. */
  accept?: string;
  value: AttachedFile[];
  onChange: (files: AttachedFile[]) => void;
  disabled?: boolean;
  className?: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

function prettySize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Uploads to private Hostinger storage and hands back the saved document
 * records. Nothing is written to Supabase Storage.
 *
 * Files upload immediately on selection rather than on form submit, so a
 * slow upload never blocks the save and a failed upload is visible right
 * away instead of at the end.
 */
export function FileUploadField({
  label = 'Attachments',
  description,
  category,
  societyId,
  entityId,
  multiple = false,
  maxFiles = 5,
  accept = '.pdf,.jpg,.jpeg,.png,.webp',
  value,
  onChange,
  disabled,
  className,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    if (!societyId) {
      toast.error('Select a society before uploading.');
      return;
    }

    const incoming = Array.from(fileList);
    const room = multiple ? maxFiles - value.length : 1;

    if (room <= 0) {
      toast.error(`You can attach at most ${maxFiles} file${maxFiles > 1 ? 's' : ''}.`);
      return;
    }

    const toUpload = incoming.slice(0, room);
    if (incoming.length > room) {
      toast.warning(`Only the first ${room} file${room > 1 ? 's' : ''} will be uploaded.`);
    }

    const oversize = toUpload.find((f) => f.size > MAX_BYTES);
    if (oversize) {
      toast.error(`"${oversize.name}" is larger than 10 MB.`);
      return;
    }

    setBusy(true);
    const saved: AttachedFile[] = [];

    for (const file of toUpload) {
      try {
        const res = await uploadPrivateFile({
          file,
          societyId,
          category,
          entityId: entityId ?? undefined,
        });
        saved.push({
          id: res.id,
          file_name: res.file_name,
          file_size: res.file_size,
          marker: `php://${res.id}`,
        });
      } catch (err: any) {
        toast.error(`${file.name}: ${err?.message || 'upload failed'}`);
      }
    }

    setBusy(false);
    if (saved.length) {
      onChange(multiple ? [...value, ...saved] : saved);
      toast.success(`${saved.length} file${saved.length > 1 ? 's' : ''} uploaded`);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (index: number) => {
    const next = [...value];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && !busy) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'rounded-lg border-2 border-dashed p-4 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          (disabled || busy) && 'opacity-60'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          disabled={disabled || busy}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {busy ? (
          <div className="space-y-2 py-2">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Uploading…</p>
            <Progress value={66} className="h-1" />
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Paperclip className="mr-2 h-4 w-4" />
              Choose file{multiple ? 's' : ''}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              {description || 'PDF, JPG, PNG or WEBP · up to 10 MB'}
            </p>
          </>
        )}
      </div>

      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((f, i) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
            >
              {/\.(jpe?g|png|webp)$/i.test(f.file_name) ? (
                <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1 truncate">{f.file_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {prettySize(f.file_size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                disabled={disabled}
                onClick={() => removeAt(i)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
