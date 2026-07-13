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
  const [selectedImageName, setSelectedImageName] = useState<string>("");
  const [isFileUploading, setIsFileUploading] = useState<boolean>(false);
  const [isErrorInUploadImages, setIsErrorInUploadImages] = useState<boolean>(false);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedImage(null);
    setIsErrorInUploadImages(false);
    let selectedFile;
    if (event.target.files) {
      selectedFile = event.target.files[0];
    }
    if (selectedFile) {
      if (!selectedFile.type.startsWith("image/")) {
        setIsErrorInUploadImages(true);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target) {
          setSelectedImage(e.target.result ? String(e.target.result) : null);
        }
      };
      setSelectedImageName(selectedFile.name);
      reader.readAsDataURL(selectedFile);
    }
  };

  const dataURLtoBlob = (dataURL: string) => {
    const byteString = atob(dataURL.split(",")[1]);
    const mimeString = dataURL.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };

  const handleFileUploadSubmit = async () => {
    setIsFileUploading(true);
    if (selectedImage) {
      const blob = dataURLtoBlob(selectedImage);
      const response: { success: boolean; data?: any } | undefined = await uploadFile(
        blob,
        selectedImageName,
      );
      if (response && response.success) {
        onSubmit(response?.data);
      }
    }
    setIsFileUploading(false);
  };

  const handleClose = () => {
    setSelectedImage(null);
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
            <Button disabled={!selectedImage || isFileUploading} onClick={handleFileUploadSubmit}>
              <UploadCloud size={15} /> {isFileUploading ? "Uploading..." : "Upload image"}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default ImageCrop;