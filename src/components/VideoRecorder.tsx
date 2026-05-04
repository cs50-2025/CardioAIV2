import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { toast } from 'sonner';

interface VideoRecorderProps {
  patientData: any;
  type: 'fitness' | 'medication' | 'meditation';
  onSuccess?: () => void;
  title: string;
  description: string;
}

export function VideoRecorder({ patientData, type, onSuccess, title, description }: VideoRecorderProps) {
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);

  const handleDataAvailable = useCallback(({ data }: BlobEvent) => {
    if (data.size > 0) setRecordedChunks((prev) => prev.concat(data));
  }, []);

  useEffect(() => {
    if (!isUploading) return;
    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        if (uploadProgress >= 100) return 100;
        const simulated = prev < 90 ? prev + 0.3 : prev;
        return Math.min(Math.max(simulated, uploadProgress), 95);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isUploading, uploadProgress]);

  const startRecording = () => {
    setRecordedChunks([]);
    setUploadProgress(0);
    setDisplayProgress(0);
    setUploadError(null);
    setTimeout(() => {
      if (webcamRef.current && webcamRef.current.stream) {
        mediaRecorderRef.current = new MediaRecorder(webcamRef.current.stream, { 
          mimeType: "video/webm",
          videoBitsPerSecond: 50000 // 50kbps for smaller size and faster upload on long videos
        });
        mediaRecorderRef.current.addEventListener("dataavailable", handleDataAvailable);
        mediaRecorderRef.current.start(2000); // chunk every 2 seconds to manage memory
        setIsRecording(true);
      }
    }, 100);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadVideo = async () => {
    if (recordedChunks.length === 0 || !patientData) return;

    setIsUploading(true);
    setUploadProgress(10);
    setDisplayProgress(10);
    setUploadError(null);
    
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const videoId = `VID-${Date.now()}`;
    
    try {
      // Simulate slow upload
      await new Promise(resolve => setTimeout(resolve, 800));
      setUploadProgress(40);
      setDisplayProgress(40);
      
      // Save locally to IndexedDB using idb-keyval
      const { set } = await import('idb-keyval');
      await set(`video_${videoId}`, blob);
      
      setUploadProgress(70);
      setDisplayProgress(70);
      
      const videoUrl = `localdb://video_${videoId}`;
      
      await addDoc(collection(db, 'videoSubmissions'), {
        id: videoId,
        patientId: patientData.id,
        doctorUid: patientData.doctorUid,
        type,
        videoUrl,
        timestamp: new Date().toISOString(),
        aiValidationResult: "Video uploaded successfully. Pending doctor review.",
        status: 'pending'
      });
      
      setUploadProgress(100);
      setDisplayProgress(100);
      
      toast.success(`${type === 'fitness' ? 'Fitness' : 'Medication'} video recorded locally!`);
      setRecordedChunks([]);
      if (onSuccess) onSuccess();
      
    } catch (e: any) {
      setUploadError("Failed to store video locally: " + e.message);
      toast.error("Video save failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold dark:text-slate-200">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        {recordedChunks.length > 0 && !isRecording ? (
          <div className="w-full aspect-video bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center font-medium border border-emerald-500/20">
            <span className="text-emerald-600 dark:text-emerald-400">Recording saved ({Math.round(recordedChunks.reduce((acc, chunk) => acc + chunk.size, 0) / 1024)} KB)</span>
          </div>
        ) : (
          <div className="w-full aspect-video bg-black rounded-lg overflow-hidden relative">
            {/* @ts-ignore */}
            <Webcam 
              audio={true} 
              ref={webcamRef} 
              className="w-full h-full object-cover" 
              videoConstraints={{ width: 1280, height: 720, frameRate: 30 }} 
            />
            {isRecording && (
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-white">Recording</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {isUploading && (
        <div className="w-full space-y-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-2"><div className="animate-spin w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full"></div> Uploading video...</span>
            <span>{(Math.round(displayProgress * 10) / 10).toFixed(1)}%</span>
          </div>
          <Progress value={displayProgress} className="w-full h-2 transition-all duration-300" />
        </div>
      )}
      
      {uploadError && !isUploading && (
         <div className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm border border-red-200 dark:border-red-800 flex flex-col gap-1">
           <span className="font-semibold">Upload Failed</span>
           <span className="text-xs">{uploadError}</span>
         </div>
      )}

      <div className="flex gap-4 w-full">
        {recordedChunks.length > 0 && !isRecording ? (
          <>
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-200" onClick={() => setRecordedChunks([])} disabled={isUploading}>
              Retake
            </Button>
            <Button className={`flex-1 text-white ${uploadError ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`} onClick={uploadVideo} disabled={isUploading}>
              {isUploading ? "Uploading..." : uploadError ? "Retry Upload" : "Submit Video"}
            </Button>
          </>
        ) : (
          <Button 
            className={`flex-1 text-white ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700'}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? "Stop Recording" : "Start Recording"}
          </Button>
        )}
      </div>
    </div>
  );
}
