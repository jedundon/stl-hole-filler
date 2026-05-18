import { Upload } from "lucide-react";
import { useRef } from "react";

interface DropZoneProps {
  isLoading: boolean;
  onFiles: (files: FileList | File[]) => void;
}

export function DropZone({ isLoading, onFiles }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="drop-zone">
      <button className="drop-target" onClick={() => inputRef.current?.click()}>
        <Upload size={28} />
        <span>{isLoading ? "Parsing STL files..." : "Drop STL files or click to browse"}</span>
        <small>Add multi-color fill solids to recessed text or logos, one file or a batch.</small>
      </button>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".stl,model/stl"
        multiple
        onChange={(event) => {
          if (event.target.files) {
            onFiles(event.target.files);
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
