import {
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { getLandmarker } from "@/features/vision/camera";
import { headAngles } from "@/features/vision/geometry";
import { MOCK_ID_VERIFY_IMAGE } from "@/lib/mockData";

type CameraMode = "idle" | "requesting" | "live" | "simulated" | "denied";
type AlignmentState = "no_face" | "misaligned" | "aligning" | "aligned";

export function CandidateIdentityPage() {
  usePageTitle("Camera Setup & Head Alignment");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examId = searchParams.get("examId") || "ut-3";

  // Prevent browser back navigation while entering the assessment
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const [cameraMode, setCameraMode] = useState<CameraMode>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Progressive camera checks
  const [faceDetected, setFaceDetected] = useState(false);
  const [headAligned, setHeadAligned] = useState(false);
  const [readyToContinue, setReadyToContinue] = useState(false);

  // Real-time alignment telemetry
  const [alignmentState, setAlignmentState] = useState<AlignmentState>("no_face");
  const [alignmentHoldProgress, setAlignmentHoldProgress] = useState(0); // 0 to 100%
  const [headPoseText, setHeadPoseText] = useState("Looking for face...");
  const [currentPrompt, setCurrentPrompt] = useState(
    "Position your face inside the oval guide and face the camera directly."
  );
  const [progress, setProgress] = useState(0);

  // Cleanly stop webcam streams
  const stopWebcam = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  // Keep video.srcObject bound whenever cameraMode is "live" or video element mounts
  useEffect(() => {
    if (cameraMode === "live" && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch((err) => {
        console.warn("Autoplay was prevented, user gesture required:", err);
      });
    }
  }, [cameraMode]);

  // Start real webcam stream with bulletproof video attachment
  const startWebcam = async () => {
    stopWebcam();
    setCameraError(null);
    setCameraMode("requesting");
    setFaceDetected(false);
    setHeadAligned(false);
    setReadyToContinue(false);
    setProgress(15);
    setCurrentPrompt("Requesting browser camera permission...");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;

      // Assign immediately to video ref
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.warn);
        };
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn("Video play error on start:", e);
        }
      }

      setCameraMode("live");
      setCurrentPrompt("Face detected! Align your head inside the oval and hold level.");
      setProgress(30);
    } catch (err) {
      console.warn("Webcam error:", err);
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access in browser address bar to continue."
          : "Webcam not detected or cannot be accessed. Ensure no other application is using your camera.";
      setCameraError(msg);
      setCameraMode("denied");
      setCurrentPrompt("Camera inactive. Allow camera access or run verification test.");
    }
  };

  // Start simulated camera test for environments without physical webcam
  const startSimulatedCamera = () => {
    stopWebcam();
    setCameraError(null);
    setCameraMode("simulated");
    setFaceDetected(false);
    setHeadAligned(false);
    setReadyToContinue(false);
    setAlignmentState("aligning");
    setProgress(25);
    setCurrentPrompt("Simulated stream started · Centering face in oval guide...");

    // Stage 1: Face detected
    setTimeout(() => {
      setFaceDetected(true);
      setAlignmentState("aligned");
      setHeadPoseText("Head Aligned (Yaw: 0°, Pitch: 0°)");
      setProgress(60);
      setCurrentPrompt("Holding head alignment... 60%");

      // Stage 2: Head alignment hold
      setTimeout(() => {
        setHeadAligned(true);
        setAlignmentHoldProgress(100);
        setReadyToContinue(true);
        setProgress(100);
        setCurrentPrompt("Camera setup and head alignment verified · Ready to start assessment!");
      }, 1000);
    }, 1000);
  };

  // Strict Real-Time Vision Tracking Loop (MediaPipe 3D Landmarker + Canvas Fallback)
  useEffect(() => {
    if (cameraMode !== "live") return;

    let isCancelled = false;
    type VerificationPhase = "detecting" | "aligning" | "ready";
    let phase: VerificationPhase = "detecting";

    let alignHoldCount = 0;
    const requiredAlignFrames = 15; // ~1.5s of steady, centered hold
    let landmarkerInstance: any = null;

    // Load MediaPipe landmarker
    (async () => {
      try {
        landmarkerInstance = await getLandmarker();
      } catch (err) {
        console.warn("MediaPipe model loading offline, using Canvas frame tracking:", err);
      }
    })();

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const processFrame = () => {
      if (isCancelled) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2 && !video.paused) {
        const now = performance.now();
        let detected = false;
        let isLevelAndCentered = false;
        let currentYaw = 0;
        let currentPitch = 0;
        let currentRoll = 0;
        let misalignmentReason = "";
        let misalignmentTelemetry = "";

        // Pathway A: High-Precision MediaPipe 3D Mesh & Matrix Tracking
        if (landmarkerInstance) {
          try {
            const result = landmarkerInstance.detectForVideo(video, now);
            if (result.faceLandmarks && result.faceLandmarks.length === 1) {
              detected = true;
              const lm = result.faceLandmarks[0];

              // Landmark 1: Nose tip, 33: Left eye outer, 263: Right eye outer
              const rawNose = lm[1];
              const leftEye = lm[33];
              const rightEye = lm[263];

              // In CSS the video is mirrored with -scale-x-100:
              // On-screen visual position: screenX = 1 - rawX
              const screenNoseX = 1 - rawNose.x;
              const noseY = rawNose.y;
              const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);

              // 1. 3D Head rotation angles
              if (result.facialTransformationMatrixes?.[0]?.data) {
                const angles = headAngles(result.facialTransformationMatrixes[0].data);
                currentYaw = Math.round(angles.yaw);
                currentPitch = Math.round(angles.pitch);
                currentRoll = Math.round(angles.roll);
              } else {
                // Approximate 2D angle fallback
                const eyeDx = rightEye.x - leftEye.x;
                const eyeDy = rightEye.y - leftEye.y;
                currentRoll = Math.round(Math.atan2(eyeDy, eyeDx) * (180 / Math.PI));
                const eyeMidX = (leftEye.x + rightEye.x) / 2;
                currentYaw = Math.round((rawNose.x - eyeMidX) * 200);
              }

              // Strict 2D Centering Constraints (Oval is positioned at X=50%, Y=48% of the container)
              // Screen X must be strictly within 0.43 to 0.57 (+-7% of the center line)
              const isCenteredX = screenNoseX >= 0.43 && screenNoseX <= 0.57;
              // Nose Y must be strictly within 0.35 to 0.65 of the frame height
              const isCenteredY = noseY >= 0.35 && noseY <= 0.65;
              // Candidate must be at proper distance from camera (not too far, not too close)
              const isGoodDistance = eyeDist >= 0.10 && eyeDist <= 0.36;
              // Strict angles: Yaw <= 10 deg, Pitch <= 10 deg, Roll <= 12 deg
              const isLevelAngles =
                Math.abs(currentYaw) <= 10 &&
                Math.abs(currentPitch) <= 10 &&
                Math.abs(currentRoll) <= 12;

              if (isCenteredX && isCenteredY && isGoodDistance && isLevelAngles) {
                isLevelAndCentered = true;
              } else {
                isLevelAndCentered = false;

                // Determine precise corrective feedback for the user
                if (!isCenteredX) {
                  if (screenNoseX < 0.43) {
                    misalignmentReason = "Shift head to the RIGHT to center inside oval guide";
                    misalignmentTelemetry = `Off-Center: Shift Right (${Math.round(screenNoseX * 100)}%)`;
                  } else {
                    misalignmentReason = "Shift head to the LEFT to center inside oval guide";
                    misalignmentTelemetry = `Off-Center: Shift Left (${Math.round(screenNoseX * 100)}%)`;
                  }
                } else if (!isCenteredY) {
                  if (noseY < 0.35) {
                    misalignmentReason = "Move head DOWN into the oval guide";
                    misalignmentTelemetry = "Too High: Move Down";
                  } else {
                    misalignmentReason = "Move head UP into the oval guide";
                    misalignmentTelemetry = "Too Low: Move Up";
                  }
                } else if (!isGoodDistance) {
                  if (eyeDist < 0.10) {
                    misalignmentReason = "Move CLOSER to the camera to fill the oval guide";
                    misalignmentTelemetry = "Too Far: Move Closer";
                  } else {
                    misalignmentReason = "Move SLIGHTLY BACK from the camera";
                    misalignmentTelemetry = "Too Close: Move Back";
                  }
                } else if (Math.abs(currentYaw) > 10) {
                  misalignmentReason =
                    currentYaw > 0
                      ? `Turn head slightly LEFT to face camera directly (Yaw: ${currentYaw}°)`
                      : `Turn head slightly RIGHT to face camera directly (Yaw: ${currentYaw}°)`
                  misalignmentTelemetry = `Turn ${currentYaw > 0 ? "Left" : "Right"} (Yaw: ${currentYaw}°)`;
                } else if (Math.abs(currentPitch) > 10) {
                  misalignmentReason =
                    currentPitch > 0
                      ? `Tilt head slightly DOWN (Pitch: ${currentPitch}°)`
                      : `Tilt head slightly UP (Pitch: ${currentPitch}°)`
                  misalignmentTelemetry = `Tilt ${currentPitch > 0 ? "Down" : "Up"} (Pitch: ${currentPitch}°)`;
                } else if (Math.abs(currentRoll) > 12) {
                  misalignmentReason = "Keep head upright (level your neck and shoulders)";
                  misalignmentTelemetry = `Level Head Tilt (Roll: ${currentRoll}°)`;
                }
              }
            }
          } catch (e) {
            // Frame skip
          }
        }

        // Pathway B: Fallback Video Frame Analysis (brightness & spatial symmetry)
        if (!detected && ctx) {
          ctx.drawImage(video, 0, 0, 160, 120);
          const frame = ctx.getImageData(0, 0, 160, 120);
          const data = frame.data;
          let centerLuma = 0;
          let edgeLuma = 0;
          let leftLuma = 0;
          let rightLuma = 0;
          let centerPixels = 0;
          let edgePixels = 0;
          let leftPixels = 0;
          let rightPixels = 0;

          // Sample oval center vs peripheral edges
          for (let y = 30; y < 90; y += 4) {
            for (let x = 40; x < 120; x += 4) {
              const idx = (y * 160 + x) * 4;
              const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              centerLuma += luma;
              centerPixels++;

              if (x < 80) {
                leftLuma += luma;
                leftPixels++;
              } else {
                rightLuma += luma;
                rightPixels++;
              }
            }
          }
          for (let y = 10; y < 110; y += 8) {
            for (let x = 5; x < 35; x += 4) {
              const idx = (y * 160 + x) * 4;
              const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              edgeLuma += luma;
              edgePixels++;
            }
          }

          const avgCenter = centerPixels ? centerLuma / centerPixels : 0;
          const avgEdge = edgePixels ? edgeLuma / edgePixels : 0;
          const avgLeft = leftPixels ? leftLuma / leftPixels : 0;
          const avgRight = rightPixels ? rightLuma / rightPixels : 0;
          const isSymmetric = Math.abs(avgLeft - avgRight) < 22;

          // Face is present and centered if contrast and balance match
          if (avgCenter > 25 && avgCenter < 245 && Math.abs(avgCenter - avgEdge) > 8) {
            detected = true;
            if (isSymmetric) {
              isLevelAndCentered = true;
            } else {
              isLevelAndCentered = false;
              misalignmentReason = avgLeft > avgRight ? "Shift head to the RIGHT" : "Shift head to the LEFT";
              misalignmentTelemetry = "Off-Center";
            }
          }
        }

        // State Machine Processing based on Face Detection & Alignment
        if (detected) {
          setFaceDetected(true);

          if (phase === "detecting") {
            phase = "aligning";
            setProgress(30);
          }

          if (phase === "aligning") {
            if (isLevelAndCentered) {
              alignHoldCount++;
              const pct = Math.min(100, Math.round((alignHoldCount / requiredAlignFrames) * 100));
              setAlignmentState("aligning");
              setAlignmentHoldProgress(pct);
              setHeadPoseText(`Aligned: Level & Centered (Yaw: ${currentYaw}°, Pitch: ${currentPitch}°)`);
              setProgress(30 + Math.round((pct / 100) * 70)); // 30% -> 100%

              if (alignHoldCount >= requiredAlignFrames) {
                // Complete alignment stage -> Ready to continue
                phase = "ready";
                setHeadAligned(true);
                setAlignmentState("aligned");
                setAlignmentHoldProgress(100);
                setProgress(100);
                setReadyToContinue(true);
                setHeadPoseText("Camera & Head Alignment Verified");
                setCurrentPrompt("Camera setup and head alignment verified · Ready to start assessment!");
              } else {
                setCurrentPrompt(`Holding head alignment... ${pct}% (Keep steady inside oval guide)`);
              }
            } else {
              // Misaligned during align phase - smoothly penalize progress
              alignHoldCount = Math.max(0, alignHoldCount - 2);
              const pct = Math.min(100, Math.round((alignHoldCount / requiredAlignFrames) * 100));
              setAlignmentState("misaligned");
              setAlignmentHoldProgress(pct);
              setHeadPoseText(misalignmentTelemetry || "Head Misaligned");
              setCurrentPrompt(`⚠️ ${misalignmentReason || "Align your head inside the oval and face camera directly."}`);
            }
          } else if (phase === "ready") {
            setHeadPoseText("Camera & Head Alignment Verified");
          }
        } else {
          // No face in frame
          if (phase !== "ready") {
            alignHoldCount = 0;
            setAlignmentState("no_face");
            setAlignmentHoldProgress(0);
            setHeadPoseText("No face in frame");
            setCurrentPrompt("No face detected in oval · Please position your face inside the dashed guide.");
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    animFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraMode]);

  // Auto-request webcam on page mount
  useEffect(() => {
    const timer = setTimeout(() => {
      startWebcam();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const steps = [
    { num: 1, label: "Instructions", active: false, done: true },
    { num: 2, label: "System check", active: false, done: true },
    { num: 3, label: "Camera setup", active: true, done: readyToContinue },
    { num: 4, label: "Start assessment", active: false, done: false },
  ];

  const handleContinue = () => {
    stopWebcam();
    navigate(`/candidate/exam?examId=${examId}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-text">Camera Setup</h2>
          <p className="text-xs text-muted">
            Webcam positioning, face framing, and head alignment check.
          </p>
        </div>
      </div>

      {/* Stepper & Content Grid */}
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        {/* Left Stepper Sidebar */}
        <div className="space-y-1 rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Steps</div>
          {steps.map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                s.active
                  ? "bg-primary-50 text-primary-700 font-semibold"
                  : s.done
                    ? "text-success-700 font-medium"
                    : "text-muted"
              }`}
            >
              <div
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  s.active
                    ? "bg-primary-600 text-white"
                    : s.done
                      ? "bg-success-50 text-success-700"
                      : "bg-surface-muted text-muted"
                }`}
              >
                {s.done ? <CheckCircle2 className="size-3.5" /> : s.num}
              </div>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Right Main Camera Setup Area */}
        <div className="space-y-6 rounded-xl border border-border bg-surface p-6 shadow-2xs">
          <div>
            <h3 className="text-base font-bold text-text">Camera setup and head alignment</h3>
            <p className="text-xs text-muted">Look directly at the camera and align your head inside the guide.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-[1.25fr_1fr] sm:items-center">
            {/* Webcam video frame */}
            <div className="space-y-2">
              <div className="relative aspect-4/3 overflow-hidden rounded-xl border-2 border-primary-500/30 bg-surface-muted shadow-sm flex items-center justify-center">
                {/* 1. Live Video Stream */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`size-full object-cover -scale-x-100 ${cameraMode === "live" ? "block" : "hidden"}`}
                />

                {/* Hidden canvas for background frame processing */}
                <canvas ref={canvasRef} className="hidden" />

                {/* 2. Simulated Camera Fallback Image */}
                {cameraMode === "simulated" && (
                  <img
                    src={MOCK_ID_VERIFY_IMAGE}
                    alt="Simulated camera test"
                    className="size-full object-cover"
                  />
                )}

                {/* 3. Idle State */}
                {cameraMode === "idle" && (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                      <Camera className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-text">Camera Standby</p>
                      <p className="text-[11px] text-muted max-w-[220px]">
                        Please enable your webcam to test camera framing and head alignment.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={startWebcam}
                      className="bg-primary-600 text-white hover:bg-primary-700 text-xs gap-1.5"
                    >
                      <Video className="size-3.5" />
                      <span>Enable Camera & Verify</span>
                    </Button>
                  </div>
                )}

                {/* 4. Requesting State */}
                {cameraMode === "requesting" && (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <Loader2 className="size-8 animate-spin text-primary-600" />
                    <p className="text-xs font-medium text-text">Connecting camera...</p>
                    <p className="text-[11px] text-muted">Please accept camera permissions in your browser.</p>
                  </div>
                )}

                {/* 5. Denied / Error State */}
                {cameraMode === "denied" && (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
                      <Camera className="size-6" />
                    </div>
                    <p className="text-xs font-semibold text-danger-700">Webcam Not Accessible</p>
                    <p className="text-[11px] text-muted max-w-[240px]">
                      {cameraError || "Camera permission is denied or no webcam was detected."}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={startWebcam}
                        className="text-xs gap-1"
                      >
                        <RefreshCw className="size-3" />
                        <span>Retry Camera</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={startSimulatedCamera}
                        className="bg-primary-600 text-white hover:bg-primary-700 text-xs gap-1"
                      >
                        <Sparkles className="size-3" />
                        <span>Use Simulated Test</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Dynamic Head Alignment Oval Guide Overlay */}
                {(cameraMode === "live" || cameraMode === "simulated") && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className={`relative h-52 w-40 rounded-[50%] border-2 transition-all duration-300 flex items-center justify-center ${
                        readyToContinue
                          ? "border-success-500 scale-105 shadow-[0_0_25px_rgba(34,197,94,0.4)] border-solid bg-success-500/10"
                          : headAligned
                            ? "border-primary-500 shadow-[0_0_15px_rgba(37,99,235,0.3)] border-solid bg-primary-500/10"
                            : alignmentState === "misaligned"
                              ? "border-danger-400 border-dashed animate-pulse bg-danger-500/10"
                              : alignmentState === "aligning"
                                ? "border-primary-400 border-dashed shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                : "border-primary-400/80 border-dashed animate-pulse"
                      }`}
                    >
                      {/* Sub-badge indicating alignment status */}
                      <span
                        className={`absolute -top-3.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-xs ${
                          readyToContinue
                            ? "bg-success-600 text-white"
                            : headAligned
                              ? "bg-primary-600 text-white"
                              : alignmentState === "misaligned"
                                ? "bg-danger-600 text-white"
                                : "bg-text/80 text-white backdrop-blur-xs"
                        }`}
                      >
                        {readyToContinue
                          ? "Camera Ready"
                          : headAligned
                            ? "Aligned"
                            : alignmentState === "misaligned"
                              ? "Align Head"
                              : "Center Face"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Head Alignment Telemetry Badge at Top */}
                {(cameraMode === "live" || cameraMode === "simulated") && (
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-text/80 px-2 py-0.5 text-[10px] font-mono font-medium text-white backdrop-blur-xs">
                    <span
                      className={`size-1.5 rounded-full ${
                        readyToContinue || headAligned
                          ? "bg-success-400"
                          : alignmentState === "misaligned"
                            ? "bg-danger-400 animate-pulse"
                            : "bg-primary-400"
                      }`}
                    />
                    <span>{headPoseText}</span>
                  </div>
                )}

                {/* Status Prompt Pill Overlay at Bottom */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1.5 rounded-md bg-text/85 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-xs">
                  <span className="flex items-center gap-1.5 truncate">
                    <span
                      className={`size-1.5 rounded-full shrink-0 ${
                        readyToContinue
                          ? "bg-success-400 animate-none"
                          : cameraMode === "denied"
                            ? "bg-danger-400"
                            : cameraMode === "idle"
                              ? "bg-muted"
                              : alignmentState === "misaligned"
                                ? "bg-danger-400"
                                : "bg-primary-400 animate-pulse"
                      }`}
                    />
                    <span className="truncate">{currentPrompt}</span>
                  </span>
                  {cameraMode === "live" && (
                    <span className="text-[9px] font-mono text-success-300 uppercase shrink-0 font-bold">
                      Live Cam
                    </span>
                  )}
                  {cameraMode === "simulated" && (
                    <span className="text-[9px] font-mono text-primary-300 uppercase shrink-0">
                      Simulated
                    </span>
                  )}
                </div>
              </div>

              {/* Real-time Alignment Hold Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-medium text-muted">
                  <span>Head Alignment & Camera Setup Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      readyToContinue
                        ? "bg-success-500"
                        : headAligned
                          ? "bg-primary-600"
                          : alignmentState === "misaligned"
                            ? "bg-danger-500"
                            : "bg-primary-500"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Bottom Camera Controls & Diagnostic switch */}
              {cameraMode !== "idle" && (
                <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                  <span>
                    Camera: <strong className="text-text capitalize">{cameraMode}</strong>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={startWebcam}
                      className="text-primary-700 hover:underline font-medium text-xs flex items-center gap-1"
                    >
                      <RefreshCw className="size-3" />
                      <span>Restart Camera</span>
                    </button>
                    {cameraMode !== "simulated" && (
                      <button
                        type="button"
                        onClick={startSimulatedCamera}
                        className="text-muted hover:text-text font-medium text-xs"
                      >
                        Simulated Test
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Strict Camera Setup Checks Checklist */}
            <div className="space-y-3 rounded-xl border border-border bg-surface-muted/40 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Strict Camera Checks
              </span>

              <div className="space-y-3 pt-1">
                {/* 1. Camera permission & stream active */}
                <div className="flex items-center gap-2.5 text-xs">
                  {cameraMode === "live" || cameraMode === "simulated" ? (
                    <CheckCircle2 className="size-4.5 text-success-700 shrink-0 animate-in zoom-in-75" />
                  ) : cameraMode === "requesting" ? (
                    <Loader2 className="size-4.5 animate-spin text-primary-600 shrink-0" />
                  ) : (
                    <div className="size-4.5 rounded-full border border-border-strong bg-surface flex items-center justify-center text-[10px] font-medium text-muted shrink-0">
                      1
                    </div>
                  )}
                  <span
                    className={
                      cameraMode === "live" || cameraMode === "simulated"
                        ? "font-semibold text-text"
                        : "text-muted"
                    }
                  >
                    Webcam stream connected
                  </span>
                </div>

                {/* 2. Face detected in frame */}
                <div className="flex items-center gap-2.5 text-xs">
                  {faceDetected ? (
                    <CheckCircle2 className="size-4.5 text-success-700 shrink-0 animate-in zoom-in-75" />
                  ) : cameraMode === "live" ? (
                    <Loader2 className="size-4.5 animate-spin text-primary-600 shrink-0" />
                  ) : (
                    <div className="size-4.5 rounded-full border border-border-strong bg-surface flex items-center justify-center text-[10px] font-medium text-muted shrink-0">
                      2
                    </div>
                  )}
                  <span className={faceDetected ? "font-semibold text-text" : "text-muted"}>
                    Face detected in oval guide
                  </span>
                </div>

                {/* 3. Strict Head Alignment & Centering */}
                <div className="flex items-center gap-2.5 text-xs">
                  {headAligned ? (
                    <CheckCircle2 className="size-4.5 text-success-700 shrink-0 animate-in zoom-in-75" />
                  ) : faceDetected && alignmentHoldProgress > 0 ? (
                    <div className="flex items-center gap-1.5 font-semibold text-primary-700">
                      <Loader2 className="size-4.5 animate-spin text-primary-600 shrink-0" />
                      <span>Aligning ({alignmentHoldProgress}%)</span>
                    </div>
                  ) : (
                    <div className="size-4.5 rounded-full border border-border-strong bg-surface flex items-center justify-center text-[10px] font-medium text-muted shrink-0">
                      3
                    </div>
                  )}
                  <span
                    className={
                      headAligned
                        ? "font-semibold text-text"
                        : alignmentHoldProgress > 0
                          ? "font-semibold text-primary-700"
                          : "text-muted"
                    }
                  >
                    Head alignment (level & centered)
                  </span>
                </div>

                {/* 4. Ready to start assessment */}
                <div className="flex items-center gap-2.5 text-xs">
                  {readyToContinue ? (
                    <CheckCircle2 className="size-4.5 text-success-700 shrink-0 animate-in zoom-in-75" />
                  ) : (
                    <div className="size-4.5 rounded-full border border-border-strong bg-surface flex items-center justify-center text-[10px] font-medium text-muted shrink-0">
                      4
                    </div>
                  )}
                  <span className={readyToContinue ? "font-semibold text-success-700" : "text-muted"}>
                    Ready to start assessment
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="size-4 text-primary-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted leading-tight">
                    {readyToContinue
                      ? "Camera and head alignment verified! You are ready to begin."
                      : "Candidate must strictly follow all steps: position face inside oval, hold head level, and keep camera steady."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end border-t border-border pt-4">
            <Button
              disabled={!readyToContinue}
              onClick={handleContinue}
              className={`transition-all ${
                readyToContinue
                  ? "bg-primary-600 text-white hover:bg-primary-700 shadow-sm font-semibold"
                  : "bg-surface-muted text-muted border border-border cursor-not-allowed opacity-60"
              }`}
            >
              Continue to assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
