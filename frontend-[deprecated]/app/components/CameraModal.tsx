"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Spinner } from "@/app/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

type CameraModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  isUploading?: boolean;
};

export default function CameraModal({ isOpen, onClose, onCapture, isUploading = false }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startRequestRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const [isEnumerating, setIsEnumerating] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedPreview(null);
      return;
    }

    if (capturedPreview) {
      stopCamera();
      return;
    }

    setIsCameraReady(false);
    startCamera(selectedCameraId);

    return () => {
      stopCamera();
    };
  }, [isOpen, selectedCameraId, capturedPreview]);

  useEffect(() => {
    if (!isOpen) return;

    const handleDeviceChange = () => {
      refreshCameras();
    };

    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);
    refreshCameras();

    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const video = videoRef.current;
    if (!video) return;

    // Function to check if video is actually playing
    const checkVideoReady = () => {
      if (!video || !streamRef.current) {
        console.log("Check failed: no video or stream");
        return false;
      }
      
      // Check if video has valid dimensions (camera stream is active)
      const hasValidDimensions = video.videoWidth > 0 && video.videoHeight > 0;
      console.log("Video dimensions:", video.videoWidth, video.videoHeight);
      
      // Check if video is playing (not paused)
      const isPlaying = !video.paused;
      console.log("Video paused:", video.paused, "Playing:", isPlaying);
      
      // Check ready state
      const isReady = video.readyState >= 2;
      console.log("Video readyState:", video.readyState);
      
      const result = hasValidDimensions && isPlaying && isReady;
      console.log("Video ready check result:", result);
      return result;
    };

    // Event handlers
    const handlePlaying = () => {
      console.log("Video playing event fired");
      if (checkVideoReady()) {
        setIsCameraReady(true);
      }
    };

    const handleLoadedMetadata = () => {
      console.log("Video metadata loaded");
      if (video.paused) {
        video.play().catch((err) => {
          console.error("Error playing video:", err);
        });
      }
    };

    const handleCanPlay = () => {
      console.log("Video can play event fired");
      if (checkVideoReady()) {
        setIsCameraReady(true);
      }
    };

    const handleTimeUpdate = () => {
      // This fires continuously when video is playing
      if (checkVideoReady() && !isCameraReady) {
        console.log("Video ready via timeupdate");
        setIsCameraReady(true);
      }
    };

    const handleError = (e: Event) => {
      console.error("Video error:", e);
      setIsCameraReady(false);
    };

    // Add event listeners
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("error", handleError);

    // Aggressive polling to check video state (for MediaStream, events might not fire reliably)
    const checkInterval = setInterval(() => {
      if (checkVideoReady()) {
        console.log("Video ready via polling check");
        setIsCameraReady(true);
        clearInterval(checkInterval);
      }
    }, 50); // Check every 50ms for faster detection

    // Cleanup after 10 seconds to prevent infinite checking
    const timeoutId = setTimeout(() => {
      clearInterval(checkInterval);
    }, 10000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeoutId);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("error", handleError);
    };
  }, [isOpen]);

  const refreshCameras = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setIsEnumerating(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === "videoinput");
      setAvailableCameras(videoDevices);

      if (!selectedCameraId && videoDevices.length > 0) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error("Error enumerating devices", err);
    } finally {
      setIsEnumerating(false);
    }
  };

  const startCamera = async (deviceId?: string) => {
    const requestId = ++startRequestRef.current;
    try {
      setError(null);
      setIsCameraReady(false);
      
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: "user" },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (requestId !== startRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      
      if (videoRef.current) {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        
        console.log("Stream set on video element");
        
        try {
          await videoRef.current.play();
          if (
            videoRef.current.videoWidth > 0 &&
            videoRef.current.videoHeight > 0 &&
            !videoRef.current.paused
          ) {
            setIsCameraReady(true);
          } else {
            setTimeout(() => {
              if (
                videoRef.current &&
                videoRef.current.videoWidth > 0 &&
                videoRef.current.videoHeight > 0 &&
                !videoRef.current.paused
              ) {
                setIsCameraReady(true);
              }
            }, 150);
          }
        } catch (err) {
          console.error("Error playing video:", err);
          setError("Failed to start video playback");
        }
      }

      await refreshCameras();
    } catch (err: any) {
      if (requestId !== startRequestRef.current) {
        return;
      }
      setError(err.message || "Failed to access camera");
      console.error("Camera error:", err);
      setIsCameraReady(false);
    }
  };

  const stopCamera = () => {
    startRequestRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const previewUrl = canvas.toDataURL("image/jpeg", 0.95);
    setCapturedPreview(previewUrl);
    stopCamera();

    // Convert canvas to blob, then to File
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], "student-picture.jpg", {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          onCapture(file);
        }
      },
      "image/jpeg",
      0.95
    );
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      if (isUploading) return;
      onClose();
    }
  };

  const handleRetake = () => {
    if (isUploading) return;
    setCapturedPreview(null);
    setTimeout(() => startCamera(selectedCameraId), 0);
  };

  const cameraDisabled = isUploading || !!error;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl w-full mx-4 p-0 overflow-hidden border border-border/50 bg-background/95 backdrop-blur">
        <DialogHeader className="p-6 pb-4 bg-linear-to-r from-primary/10 via-primary/5 to-transparent">
          <DialogTitle className="text-xl font-semibold">
            Capture your attendance photo
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Ensure you have good lighting, remove face coverings, and center yourself in the frame.
          </p>
        </DialogHeader>

        {/* Camera / Preview */}
        <div className="relative bg-black min-h-[320px]">
          {!capturedPreview && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto max-h-[70vh] object-contain"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />

          {capturedPreview && (
            <div className="relative flex items-center justify-center bg-black">
              <img
                src={capturedPreview}
                alt="Captured preview"
                className="max-h-[70vh] w-full object-contain"
              />
              <div className="absolute top-4 right-4 rounded-full bg-black/70 px-3 py-1 text-xs uppercase tracking-wider text-white/80">
                Preview
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center p-6">
                <p className="text-red-400 text-lg font-semibold mb-2">Camera Error</p>
                <p className="text-white/80">{error}</p>
                <button
                  onClick={() => startCamera(selectedCameraId)}
                  className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {!error && !isCameraReady && !capturedPreview && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center">
                <Spinner size="lg" className="border-white/30 border-t-white mx-auto mb-4" />
                <p className="text-white/80">Starting camera...</p>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur py-3 px-4 flex items-center justify-center gap-3 text-white text-sm">
              <Spinner size="sm" className="border-white/30 border-t-white" />
              Uploading photo. Please keep this window open.
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 bg-background space-y-5">
          <div>
            <p className="text-sm font-medium mb-2">Camera source</p>
            {availableCameras.length ? (
              <Select
                value={selectedCameraId ?? undefined}
                onValueChange={(value) => {
                  setSelectedCameraId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isEnumerating ? "Scanning cameras..." : "Choose a camera"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableCameras
                    .filter((device) => device.deviceId)
                    .map((device, index) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${index + 1}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground">
                {isEnumerating
                  ? "Searching for available cameras..."
                  : "No cameras detected"}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>

            {!capturedPreview ? (
              <Button
                onClick={capturePhoto}
                disabled={cameraDisabled || !isCameraReady}
                className="gap-2"
              >
                <Camera className="h-5 w-5" />
                Capture photo
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={handleRetake}
                  disabled={isUploading}
                >
                  Retake
                </Button>
                <Button disabled className="gap-2">
                  <Spinner size="sm" className="border-white/30 border-t-white" />
                  {isUploading ? "Uploading..." : "Processing..."}
                </Button>
              </div>
            )}
          </div>

          <div className="text-center text-sm text-muted-foreground space-y-1">
            <p>Avoid strong backlight and keep your face clearly visible.</p>
            {capturedPreview && !isUploading && (
              <p className="text-green-600 dark:text-green-400">Photo captured. Uploading now...</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

