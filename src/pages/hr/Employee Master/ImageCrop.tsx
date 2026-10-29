import { ChangeEvent, useState } from "react";
import { Upload, UploadCloud, AlertCircle } from "lucide-react";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";
import { uploadFile } from "../../../api/hr";

type ImageCropProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (arg0: any) => void;
  dialogTitle: string;
  aspectRatio?: number;
  Image?: string;
};

const ImageCrop = (props: ImageCropProps) => {
  const { open, onClose, onSubmit, dialogTitle } = props;

  const [selectedImage, setSelectedImage] = useState<string | null | undefined>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isFileUploading, setIsFileUploading] = useState<boolean>(false);
  const [isErrorInUploadImages, setIsErrorInUploadImages] = useState<boolean>(false);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedImage(null);
    setSelectedFile(null);
    setIsErrorInUploadImages(false);

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setIsErrorInUploadImages(true);
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target) {
        setSelectedImage(e.target.result ? String(e.target.result) : null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileUploadSubmit = async () => {
    if (!selectedFile) return;

    setIsFileUploading(true);
    try {
      // Pass the original File (which carries its own name) to the uploader.
      const response: { success: boolean; data?: any } | undefined = await uploadFile(
        selectedFile,
        selectedFile.name,
      );
      if (response && response.success) {
        onSubmit(response?.data);
      }
    } finally {
      setIsFileUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    setSelectedFile(null);
    setIsErrorInUploadImages(false);
    onClose();
  };

  return (
    <Dialog open={open} title={dialogTitle || "Upload File"} compact onClose={handleClose}>
      <div className="flex w-full flex-col gap-4">
        {selectedImage ? (
          <img src={selectedImage} alt="Preview" className="w-full rounded-md object-contain" />
        ) : (
          props.Image && <img src={props.Image} alt="Current" className="w-full rounded-md object-contain" />
        )}

        {!selectedImage && (
          <div className="flex items-center justify-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
              <Upload size={15} />
              Upload New File
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
            {isErrorInUploadImages && (
              <span title="Please upload an image.">
                <AlertCircle size={20} className="text-destructive" />
              </span>
            )}
          </div>
        )}

        {selectedImage && (
          <div className="flex justify-end">
            <Button disabled={!selectedFile || isFileUploading} onClick={handleFileUploadSubmit}>
              <UploadCloud size={15} /> {isFileUploading ? "Uploading..." : "Upload image"}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default ImageCrop;