"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Spinner } from "@/app/components/ui/spinner";

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
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsCameraReady(false);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
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

  const startCamera = async () => {
    try {
      setError(null);
      setIsCameraReady(false);
      
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      
      if (videoRef.current) {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        
        console.log("Stream set on video element");
        
        // For MediaStream, we need to explicitly play
        // Use a small delay to ensure srcObject is processed
        const playVideo = () => {
          if (videoRef.current && streamRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log("Video play() promise resolved");
                // Set ready state after a small delay to allow video to actually start
                setTimeout(() => {
                  if (videoRef.current && 
                      videoRef.current.videoWidth > 0 && 
                      videoRef.current.videoHeight > 0 &&
                      !videoRef.current.paused) {
                    console.log("Video confirmed ready after play()");
                    setIsCameraReady(true);
                  }
                }, 100);
              })
              .catch((err) => {
                console.error("Error playing video:", err);
                setError("Failed to start video playback");
              });
          }
        };
        
        // Try immediately
        playVideo();
        
        // Also try after a short delay in case it needs time
        setTimeout(playVideo, 50);
        setTimeout(playVideo, 200);
      }
    } catch (err: any) {
      setError(err.message || "Failed to access camera");
      console.error("Camera error:", err);
      setIsCameraReady(false);
    }
  };

  const stopCamera = () => {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full mx-4 p-0 overflow-hidden">
        <DialogHeader className="p-4 bg-gradient-to-r from-primary/10 to-accent/10">
          <DialogTitle>Take your photo for attendance</DialogTitle>
        </DialogHeader>

        {/* Camera View */}
        <div className="relative bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto max-h-[70vh] object-contain"
          />
          <canvas ref={canvasRef} className="hidden" />

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center p-6">
                <p className="text-red-400 text-lg font-semibold mb-2">Camera Error</p>
                <p className="text-white/80">{error}</p>
                <button
                  onClick={startCamera}
                  className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {!error && !isCameraReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center">
                <Spinner size="lg" className="border-white/30 border-t-white mx-auto mb-4" />
                <p className="text-white/80">Starting camera...</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 bg-background space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={capturePhoto}
              disabled={isUploading || !isCameraReady || !!error}
            >
              {isUploading ? (
                <>
                  <Spinner size="sm" className="mr-2 border-white/30 border-t-white" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5 mr-2" />
                  Capture & Submit
                </>
              )}
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Make sure your face is clearly visible in the frame
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

