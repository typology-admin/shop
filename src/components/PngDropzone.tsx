import { useEffect, useRef, useState } from 'react';
import { assertItemImageFile } from '../lib/pngClient.ts';

type Props = {
  disabled?: boolean;
  onFile: (file: File) => void;
  onError: (message: string) => void;
};

export function PngDropzone({ disabled, onFile, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const prevent = (event: DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  async function takeFile(file: File | undefined) {
    if (!file || disabled) return;
    try {
      assertItemImageFile(file);
      onFile(file);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not read that photo.');
    }
  }

  return (
    <div
      className={`dropzone${over ? ' is-over' : ''}${disabled ? ' is-disabled' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        void takeFile(event.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          void takeFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <p className="dropzone-label">Product photo</p>
      <button
        type="button"
        className="text-btn"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Drop a JPG or PNG, or choose one
      </button>
      <p className="dropzone-hint">White studio backgrounds are removed automatically.</p>
    </div>
  );
}
