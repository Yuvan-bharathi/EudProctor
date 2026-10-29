import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { MOCK_ID_VERIFY_IMAGE } from "@/lib/mockData";

type CameraMode = "idle" | "requesting" | "live" | "simulated" | "denied";

export function CandidateIdentityPage() {
  usePageTitle("Identity Verification & Liveness Check");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examId = searchParams.get("examId") || "ut-3";

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraMode, setCameraMode] = useState<CameraMode>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Progressive verification checks (strictly false until explicitly run and passed)
  const [faceDetected, setFaceDetected] = useState(false);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [faceMatched, setFaceMatched] = useState(false);
  const [readyToContinue, setReadyToContinue] = useState(false);

  const [currentPrompt, setCurrentPrompt] = useState<string>(
    "Position your face inside the frame and start the verification scan."
  );
  const [progress, setProgress] = useState(0);

  // Cleanly stop webcam streams
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  // Run the automated 3-stage biometric check sequence
  const startBiometricSequence = () => {
    setIsVerifying(true);
    setFaceDetected(false);
    setLivenessPassed(false);
    setFaceMatched(false);
    setReadyToContinue(false);
    setProgress(15);
    setCurrentPrompt("Detecting face in frame · Look directly at camera...");

    // Stage 1: Face detection
    setTimeout(() => {
      setFaceDetected(true);
      setProgress(42);
      setCurrentPrompt("Face Centred · Please blink naturally for anti-spoof test...");

      // Stage 2: Liveness (blink)
      setTimeout(() => {
        setLivenessPassed(true);
        setProgress(75);
        setCurrentPrompt("Liveness confirmed · Verifying ArcFace biometric template...");

        // Stage 3: Biometric Match & Ready
        setTimeout(() => {
          setFaceMatched(true);
          setReadyToContinue(true);
          setProgress(100);
          setIsVerifying(false);
          setCurrentPrompt("Biometric identity verified · Ready to start assessment!");
        }, 1500);
      }, 1600);
    }, 1400);
  };

  // Start real webcam stream
  const startWebcam = async () => {
    stopWebcam();
    setCameraError(null);
    setCameraMode("requesting");
    setCurrentPrompt("Requesting browser camera permission...");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraMode("live");
      startBiometricSequence();
    } catch (err) {
      console.warn("Real webcam unavailable:", err);
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access in browser settings, or use simulated verification."
          : "Webcam not detected or could not be accessed. You can verify using the simulated camera below.";
      setCameraError(msg);
      setCameraMode("denied");
      setCurrentPrompt("Camera inactive. Click 'Test with Simulated Camera' to proceed.");
    }
  };

  // Simulated fallback for devices without webcam or during testing
  const startSimulatedCamera = () => {
    stopWebcam();
    setCameraError(null);
    setCameraMode("simulated");
    startBiometricSequence();
  };

  const steps = [
    { num: 1, label: "Instructions", active: false, done: true },
    { num: 2, label: "System check", active: false, done: true },
    { num: 3, label: "Identity verification", active: true, done: readyToContinue },
    { num: 4, label: "Camera setup", active: false, done: readyToContinue },
    { num: 5, label: "Start assessment", active: false, done: false },
  ];

  const handleContinue = () => {
    stopWebcam();
    navigate(`/candidate/exam?examId=${examId}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Link
          to={`/candidate/instructions?examId=${examId}`}
          onClick={stopWebcam}
          className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-surface-muted hover:text-text shadow-2xs"
          aria-label="Back to instructions"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-text">Identity Verification</h2>
          <p className="text-xs text-muted">Face verification with automated anti-spoof liveness check.</p>
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

        {/* Right Main Verification Area */}
        <div className="space-y-6 rounded-xl border border-border bg-surface p-6 shadow-2xs">
          <div>
            <h3 className="text-base font-bold text-text">Face verification and liveness check</h3>
            <p className="text-xs text-muted">Look at the camera and follow the instructions.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-[1.2fr_1fr] sm:items-center">
            {/* Webcam video frame */}
            <div className="space-y-2">
              <div className="relative aspect-4/3 overflow-hidden rounded-xl border-2 border-primary-500/30 bg-surface-muted shadow-sm flex items-center justify-center">
                {/* 1. Live Video Stream */}
                {cameraMode === "live" && (
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="size-full object-cover -scale-x-100"
                  />
                )}

                {/* 2. Simulated Camera Fallback Image */}
                {cameraMode === "simulated" && (
                  <img
                    src={MOCK_ID_VERIFY_IMAGE}
                    alt="Simulated verification camera"
                    className="size-full object-cover"
                  />
                )}

                {/* 3. Idle State (User must click to start camera) */}
                {cameraMode === "idle" && (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                      <Camera className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-text">Camera Not Started</p>
                      <p className="text-[11px] text-muted max-w-[220px]">
                        Click the button below to turn on your webcam and verify your identity.
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
                    <p className="text-xs font-medium text-text">Starting camera...</p>
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
                        <span>Use Simulation</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Oval face guide overlay */}
                {(cameraMode === "live" || cameraMode === "simulated") && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className={`h-44 w-36 rounded-[50%] border-2 border-dashed transition-all duration-300 ${
                        readyToContinue
                          ? "border-success-500 scale-105"
                          : "border-primary-500/80 animate-pulse"
                      }`}
                    />
                  </div>
                )}

                {/* Status prompt pill overlay */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1.5 rounded-md bg-text/80 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-xs">
                  <span className="flex items-center gap-1.5 truncate">
                    <span
                      className={`size-1.5 rounded-full shrink-0 ${
                        readyToContinue
                          ? "bg-success-400 animate-none"
                          : cameraMode === "denied"
                            ? "bg-danger-400"
                            : cameraMode === "idle"
                              ? "bg-muted"
                              : "bg-primary-400 animate-pulse"
                      }`}
                    />
                    <span className="truncate">{currentPrompt}</span>
                  </span>
                  {cameraMode === "live" && (
                    <span className="text-[9px] font-mono text-success-300 uppercase shrink-0">Live Cam</span>
                  )}
                  {cameraMode === "simulated" && (
                    <span className="text-[9px] font-mono text-primary-300 uppercase shrink-0">Simulated</span>
                  )}
                </div>
              </div>

              {/* Progress bar under video */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    readyToContinue ? "bg-success-500" : "bg-primary-600"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Bottom Test Controls if user wants to switch between real and simulated */}
              {cameraMode !== "idle" && (
                <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                  <span>Camera: <strong className="text-text capitalize">{cameraMode}</strong></span>
                  <div className="flex gap-2">
                    {cameraMode !== "live" && (
                      <button
                        type="button"
                        onClick={startWebcam}
                        className="text-primary-700 hover:underline font-medium"
                      >
                        Try Live Webcam
                      </button>
                    )}
                    {cameraMode !== "simulated" && (
                      <button
                        type="button"
                        onClick={startSimulatedCamera}
                        className="text-primary-700 hover:underline font-medium"
                      >
                        Run Simulated Test
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Checklist with progressive checkmarks on the right */}
            <div className="space-y-3 rounded-xl border border-border bg-surface-muted/40 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">System Checks</span>

              <div className="space-y-3">
                {/* 1. Face detected */}
                <div className="flex items-center gap-2.5 text-xs">
                  {faceDetected ? (
                    <CheckCircle2 className="size-4.5 text-success-700 shrink-0 animate-in zoom-in-75" />
                  ) : isVerifying ? (
                    <Loader2 className="size-4.5 animate-spin text-primary-600 shrink-0" />
                  ) : (
                    <div className="size-4.5 rounded-full border border-border-strong bg-surface flex items-center justify-center text-[10px] font-medium text-muted shrink-0">
                      1
                    </div>
                  )}
                  <span className={faceDetected ? "font-semibold text-text" : "text-muted"}>
                    Face detected
                  </span>
                </div>

                {/* 2. Liveness check */}
                <div className="flex items-center gap-2.5 text-xs">
                  {livenessPassed ? (
                    <CheckCircle2 className="size-4.5 text-success-700 shrink-0 animate-in zoom-in-75" />
                  ) : faceDetected && isVerifying ? (
                    <Loader2 className="size-4.5 animate-spin text-primary-600 shrink-0" />
                  ) : (
                    <div className="size-4.5 rounded-full border border-border-strong bg-surface flex items-center justify-center text-[10px] font-medium text-muted shrink-0">
                      2
                    </div>
                  )}
                  <span className={livenessPassed ? "font-semibold text-text" : "text-muted"}>
                    Liveness check (blink)
                  </span>
                </div>

                {/* 3. Face matched */}
                <div className="flex items-center gap-2.5 text-xs">
                  {faceMatched ? (
                    <CheckCircle2 className="size-4.5 text-success-700 shrink-0 animate-in zoom-in-75" />
                  ) : livenessPassed && isVerifying ? (
                    <Loader2 className="size-4.5 animate-spin text-primary-600 shrink-0" />
                  ) : (
                    <div className="size-4.5 rounded-full border border-border-strong bg-surface flex items-center justify-center text-[10px] font-medium text-muted shrink-0">
                      3
                    </div>
                  )}
                  <span className={faceMatched ? "font-semibold text-text" : "text-muted"}>
                    Face matched
                  </span>
                </div>

                {/* 4. Ready to continue */}
                <div className="flex items-center gap-2.5 text-xs">
                  {readyToContinue ? (
                    <CheckCircle2 className="size-4.5 text-success-700 shrink-0 animate-in zoom-in-75" />
                  ) : (
                    <div className="size-4.5 rounded-full border border-border-strong bg-surface flex items-center justify-center text-[10px] font-medium text-muted shrink-0">
                      4
                    </div>
                  )}
                  <span className={readyToContinue ? "font-semibold text-success-700" : "text-muted"}>
                    Ready to continue
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-[11px] text-muted leading-tight">
                  {readyToContinue
                    ? "Verification verified against enrolled ArcFace biometric template. Anti-spoof test passed."
                    : "Please activate your camera and stay inside the oval guide to verify your identity."}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-between border-t border-border pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                stopWebcam();
                navigate(`/candidate/instructions?examId=${examId}`);
              }}
            >
              Back
            </Button>
            <Button
              disabled={!readyToContinue}
              onClick={handleContinue}
              className={`transition-all ${
                readyToContinue
                  ? "bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
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
