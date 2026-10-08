import { useId, useRef, useState } from "react";
import type { DragEvent } from "react";
import { FileSpreadsheet, RefreshCw, UploadCloud, X } from "lucide-react";
import { Button } from "../../components/ui";
import { cn } from "../../utils/cn";
import { formatBytes } from "../../utils/format";

interface Props {
  file: File | null;
  disabled?: boolean;
  busy?: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
}

export function DatasetUpload({ file, disabled, busy, onSelect, onClear }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = () => inputRef.current?.click();
  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onSelect(f);
    if (inputRef.current) inputRef.current.value = "";
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  };

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept=".csv,text/csv"
      className="sr-only"
      disabled={disabled}
      onChange={(e) => handleFiles(e.target.files)}
      aria-label="Choose burn-in dataset CSV file"
    />
  );

  if (file) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-canvas/60 px-3 py-2.5">
        {input}
        <div className="flex min-w-0 items-center gap-3">
          <FileSpreadsheet className="size-5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0">
            <div className="num truncate text-[13px] font-medium" title={file.name}>
              {file.name}
            </div>
            <div className="text-xs text-ink-muted">{formatBytes(file.size)}{busy ? " · reading…" : ""}</div>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" disabled={disabled} onClick={pick} icon={<RefreshCw className="size-3.5" aria-hidden />}>
            Replace
          </Button>
          <Button size="sm" variant="ghost" disabled={disabled} onClick={onClear} aria-label="Remove file" icon={<X className="size-3.5" aria-hidden />} />
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-9 text-center transition-colors",
        dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-canvas/50",
      )}
    >
      {input}
      <UploadCloud className="size-7 text-ink-faint" aria-hidden />
      <p className="text-sm font-medium">Drag a burn-in CSV here</p>
      <p className="text-xs text-ink-muted">Chronological measurement data, one row per record</p>
      <Button className="mt-1" disabled={disabled} onClick={pick}>
        Choose file…
      </Button>
    </div>
  );
}
