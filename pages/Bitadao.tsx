import React, { useState, useRef } from 'react';
import { Upload, Film, Play, Download, AlertCircle, FileText, Music, Trash2, Edit, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Save, Images } from 'lucide-react';
import { sliceVideoIntoImages, captureFrame } from '@/services/imageService';
import { ffmpegService, fps } from '@/services/ffmpegService';
import { ImageSlot, TimelineEntry } from '../types';
import { DEFAULT_TIMELINE } from '../constants';

const SLOTS_COUNT = 14;

const Bitadao: React.FC = () => {
  // Drag state for audio
  const [dragOverAudio, setDragOverAudio] = useState(false);

  // Extract audio from video file
  const handleExtractAudioFromVideo = async (file: File) => {
    setIsProcessing(true);
    setProgressMsg('Extracting audio from video...');
    try {
      // Use ffmpegService to extract audio
      if (!window.FFmpeg) throw new Error('FFmpeg not loaded');
      await ffmpegService.load();
      // @ts-ignore
      const ffmpeg = ffmpegService.ffmpeg;
      const { fetchFile } = window.FFmpeg;
      const videoData = await fetchFile(file);
      ffmpeg.FS('writeFile', 'input_video', videoData);
      await ffmpeg.run('-i', 'input_video', '-vn', '-acodec', 'copy', 'output_audio.m4a');
      const audioData = ffmpeg.FS('readFile', 'output_audio.m4a');
      const audioBlob = new Blob([audioData.buffer], { type: 'audio/mp4' });
      setAudioFile(new File([audioBlob], 'extracted_audio.m4a', { type: 'audio/mp4' }));
      // Cleanup
      ffmpeg.FS('unlink', 'input_video');
      ffmpeg.FS('unlink', 'output_audio.m4a');
      setProgressMsg('');
    } catch (err) {
      setError('Failed to extract audio from video.');
      setProgressMsg('');
    } finally {
      setIsProcessing(false);
    }
  };
  const [slots, setSlots] = useState<ImageSlot[]>(
    Array.from({ length: SLOTS_COUNT }, (_, i) => ({ id: i + 1, file: null, previewUrl: null }))
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [timelineText, setTimelineText] = useState(DEFAULT_TIMELINE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drag and drop state
  const [dragOverSlotId, setDragOverSlotId] = useState<number | null>(null);

  // Frame Editor State
  const [editingSlot, setEditingSlot] = useState<ImageSlot | null>(null);
  const [editorTime, setEditorTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Parse timeline text to structured data
  const parseTimeline = (text: string): TimelineEntry[] => {
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const idStr = parts[0];
          const countStr = parts[1];
          const idMatch = idStr.match(/^(\d+)/);
          const id = idMatch ? parseInt(idMatch[1], 10) : 1;
          const count = parseInt(countStr, 10);
          return { imageId: id, frameCount: isNaN(count) ? 1 : count };
        }
        return null;
      })
      .filter((entry): entry is TimelineEntry => entry !== null);
  };

  const handleImageUpload = (index: number, file: File) => {
    const newSlots = [...slots];
    if (newSlots[index].previewUrl) URL.revokeObjectURL(newSlots[index].previewUrl!);
    newSlots[index] = {
      ...newSlots[index],
      file: file,
      previewUrl: URL.createObjectURL(file),
      sourceVideo: null,
      timestamp: undefined
    };
    setSlots(newSlots);
  };

  const handleBatchUpload = (files: File[], startIndex: number = 0) => {
    // Sort files naturally (1.jpg, 2.jpg, 10.jpg)
    const sortedFiles = [...files].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    
    const newSlots = [...slots];
    sortedFiles.forEach((file, i) => {
      const targetIndex = startIndex + i;
      if (targetIndex < SLOTS_COUNT) {
        if (newSlots[targetIndex].previewUrl) URL.revokeObjectURL(newSlots[targetIndex].previewUrl!);
        newSlots[targetIndex] = {
           ...newSlots[targetIndex],
           file: file,
           previewUrl: URL.createObjectURL(file),
           sourceVideo: null,
           timestamp: undefined
        };
      }
    });
    setSlots(newSlots);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProgressMsg("Slicing video into 14 images...");
    try {
      const results = await sliceVideoIntoImages(file, SLOTS_COUNT);
      const newSlots = [...slots];
      results.forEach((item, i) => {
        if (i < SLOTS_COUNT) {
          if (newSlots[i].previewUrl) URL.revokeObjectURL(newSlots[i].previewUrl!);
          newSlots[i] = {
            ...newSlots[i],
            file: item.file,
            previewUrl: URL.createObjectURL(item.file),
            sourceVideo: file, // Store source video reference
            timestamp: item.timestamp
          };
        }
      });
      setSlots(newSlots);
      setProgressMsg("");
    } catch (err) {
      setError("Failed to process video. Please try another file.");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    setDragOverSlotId(id);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSlotId(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverSlotId(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      // Filter for images
      const imageFiles: any = files.filter((f: File) => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        handleBatchUpload(imageFiles, index);
      }
    }
  };

  const openFrameEditor = (slot: ImageSlot) => {
    if (slot.sourceVideo && typeof slot.timestamp === 'number') {
      setEditingSlot(slot);
      setEditorTime(slot.timestamp);
    }
  };

  const closeFrameEditor = () => {
    setEditingSlot(null);
  };

  const updateEditorTime = (newTime: number) => {
    if (!videoRef.current) return;
    const time = Math.max(0, Math.min(newTime, videoRef.current.duration));
    setEditorTime(time);
    videoRef.current.currentTime = time;
  };

  const saveFrameEdit = async () => {
    if (!editingSlot || !editingSlot.sourceVideo) return;
    console.log(`Saving frame edit for slot ${editingSlot.id} at time ${editorTime}`);
    setIsProcessing(true);
    try {
      const newFile = await captureFrame(editingSlot.sourceVideo, editorTime, fps);
      const index = slots.findIndex(s => s.id === editingSlot.id);
      if (index !== -1) {
        const newSlots = [...slots];
        if (newSlots[index].previewUrl) URL.revokeObjectURL(newSlots[index].previewUrl!);
        newSlots[index] = {
          ...newSlots[index],
          file: newFile,
          previewUrl: URL.createObjectURL(newFile),
          timestamp: editorTime
        };
        setSlots(newSlots);
      }
      closeFrameEditor();
    } catch (err) {
      console.error("Failed to capture frame", err);
      setError("Failed to capture frame. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerate = async () => {
    const activeSlots = slots.filter(s => s.file !== null);
    if (activeSlots.length === 0) {
      setError("Please upload at least one image or a video.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setGeneratedVideoUrl(null);

    try {
      const timeline = parseTimeline(timelineText);
      const imagesPayload = activeSlots.map(s => ({ id: s.id, file: s.file! }));
      
      const url = await ffmpegService.createBitadaoVideo(
        imagesPayload,
        audioFile,
        timeline,
        (p, msg) => setProgressMsg(`${msg} ${p > 0 ? `(${Math.round(p)}%)` : ''}`)
      );
      
      setGeneratedVideoUrl(url);
    } catch (err: any) {
      setError(err.message || "An error occurred during video generation. (Check SharedArrayBuffer support)");
      console.error(err);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  const clearAll = () => {
    slots.forEach(s => {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    });
    setSlots(Array.from({ length: SLOTS_COUNT }, (_, i) => ({ id: i + 1, file: null, previewUrl: null })));
    setAudioFile(null);
    setGeneratedVideoUrl(null);
    setError(null);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 relative pb-24">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Bitadao Meme</h2>
          <p className="text-zinc-400">Upload 14 images or a video to start. Images map to IDs 1-14 in the timeline.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button 
            onClick={clearAll}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-700 hover:border-zinc-600 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Reset
          </button>
          
          <label className="px-4 py-2 text-sm font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700 cursor-pointer flex items-center gap-2">
            <Images className="w-4 h-4" />
            Batch Upload Images
            <input 
              type="file" 
              accept="image/*" 
              multiple
              className="hidden" 
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleBatchUpload(Array.from(e.target.files));
                }
              }}
            />
          </label>

          <label className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center gap-2">
            <Film className="w-4 h-4" />
            Auto-fill from Video
            <input 
              type="file" 
              accept="video/*" 
              className="hidden" 
              onChange={handleVideoUpload}
              disabled={isProcessing}
            />
          </label>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {slots.map((slot, index) => (
          <div 
            key={slot.id} 
            className="relative group aspect-square"
            onDragOver={(e) => handleDragOver(e, slot.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
          >
            <label 
              className={`
                w-full h-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative
                ${dragOverSlotId === slot.id 
                    ? 'border-indigo-400 bg-indigo-500/20' 
                    : slot.file 
                      ? 'border-indigo-500/50 bg-zinc-900' 
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-900'
                }
              `}
            >
              {slot.previewUrl ? (
                <>
                  <img src={slot.previewUrl} alt={`Slot ${slot.id}`} className="w-full h-full object-cover" />
                  
                  {/* Timestamp Indicator */}
                  {slot.timestamp !== undefined && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-mono text-indigo-300 pointer-events-none z-10">
                      {slot.timestamp.toFixed(2)}s
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Replace</span>
                    {slot.sourceVideo && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          openFrameEditor(slot);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium flex items-center gap-1.5 w-full justify-center shadow-lg"
                      >
                        <Edit className="w-3 h-3" /> Adjust
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-zinc-600 mb-2 group-hover:text-zinc-400 transition-colors" />
                  <span className="text-xs font-mono text-zinc-600 group-hover:text-zinc-400">IMG_{slot.id}</span>
                </>
              )}
              <input 
                type="file" 
                accept="image/*" 
                multiple
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                     // Check if multiple files selected
                     if (e.target.files.length > 1) {
                        handleBatchUpload(Array.from(e.target.files), index);
                     } else {
                        handleImageUpload(index, e.target.files[0]);
                     }
                  }
                }}
              />
            </label>
            <div className="absolute -top-2 -left-2 w-6 h-6 bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-400 shadow-sm z-10">
              {slot.id}
            </div>
          </div>
        ))}
      </div>

      {/* Frame Editor Modal */}
      {editingSlot && editingSlot.sourceVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-4xl flex flex-col gap-6 shadow-2xl max-h-[90vh]">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-400" />
                Adjust Frame {editingSlot.id}
              </h3>
              <button onClick={closeFrameEditor} className="text-zinc-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Maintain aspect ratio and height even if video is not loaded */}
            <div className="flex-1 min-h-0 bg-black rounded-lg overflow-hidden relative border border-zinc-800 flex items-center justify-center" style={{ minHeight: 480, minWidth: 720 }}>
              {editingSlot.sourceVideo ? (
                <video
                  ref={videoRef}
                  src={URL.createObjectURL(editingSlot.sourceVideo)}
                  className="max-w-full max-h-full object-contain"
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = editorTime;
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black text-zinc-700" style={{ minHeight: 480, minWidth: 720 }}>
                  Loading video...
                </div>
              )}
            </div>

            {/* Seek Buttons Centered */}
            <div className="flex flex-col items-center w-full gap-4">
              <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800 justify-center">
                {/* Step size: 1 frame = 1/fps seconds */}
                <button onClick={() => updateEditorTime(editorTime - 10)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="-10 Seconds">-10s</button>
                <button onClick={() => updateEditorTime(editorTime - 5)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="-5 Seconds">-5s</button>
                <button onClick={() => updateEditorTime(editorTime - 1)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="-1 Second">-1s</button>
                <button onClick={() => updateEditorTime(editorTime - (10 / fps))} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="-10 Frames"><ChevronsLeft className="w-5 h-5" /></button>
                <button onClick={() => updateEditorTime(editorTime - (1 / fps))} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="Previous Frame (-1)"><ChevronLeft className="w-5 h-5" /></button>
                <div className="relative group">
                  <input type="number" step="0.01" value={editorTime} onChange={(e) => updateEditorTime(parseFloat(e.target.value))} className="w-28 bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-3 pr-8 text-center text-sm font-mono text-white focus:outline-none focus:border-indigo-500 transition-all" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none font-bold">s</span>
                </div>
                <button onClick={() => updateEditorTime(editorTime + (1 / fps))} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="Next Frame (+1)"><ChevronRight className="w-5 h-5" /></button>
                <button onClick={() => updateEditorTime(editorTime + (10 / fps))} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="+10 Frames"><ChevronsRight className="w-5 h-5" /></button>
                <button onClick={() => updateEditorTime(editorTime + 1)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="+1 Second">+1s</button>
                <button onClick={() => updateEditorTime(editorTime + 5)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="+5 Seconds">+5s</button>
                <button onClick={() => updateEditorTime(editorTime + 10)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors" title="+10 Seconds">+10s</button>
              </div>

              {/* Seekbar below buttons */}
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden cursor-pointer mt-2"
                onClick={(e) => {
                  if (!videoRef.current) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const perc = x / rect.width;
                  updateEditorTime(perc * videoRef.current.duration);
                }}
              >
                <div className="h-full bg-indigo-500 transition-all duration-100 ease-linear" style={{ width: `${(editorTime / (videoRef.current?.duration || 1)) * 100}%` }} />
              </div>

              {/* Cancel/Save Frame buttons spaced left/right */}
              <div className="flex w-full justify-between mt-4">
                <button onClick={closeFrameEditor} className="px-4 py-2 text-zinc-400 hover:text-white text-sm font-medium hover:bg-zinc-800 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={saveFrameEdit} disabled={isProcessing} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
                  {isProcessing ? 'Saving...' : <><Save className="w-4 h-4" /> Save Frame</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Timeline & Audio */}
        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-zinc-200">Timeline Configuration</h3>
            </div>
            <textarea
              value={timelineText}
              onChange={(e) => setTimelineText(e.target.value)}
              className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-400 focus:outline-none focus:border-indigo-500/50 resize-none"
              placeholder="ID Count (e.g., '4 1')"
            />
            <p className="text-[10px] text-zinc-500 mt-2">
              Format: <code>ImageID FrameCount</code>. One entry per line.
            </p>
          </div>

          <div
            className={`bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 ${dragOverAudio ? 'border-pink-400 bg-pink-500/10' : ''}`}
            onDragOver={e => {
              e.preventDefault();
              setDragOverAudio(true);
            }}
            onDragLeave={e => {
              e.preventDefault();
              setDragOverAudio(false);
            }}
            onDrop={e => {
              e.preventDefault();
              setDragOverAudio(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('audio/')) {
                  setAudioFile(file);
                } else if (file.type.startsWith('video/')) {
                  handleExtractAudioFromVideo(file);
                }
              }
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-pink-400" />
                <h3 className="text-sm font-bold text-zinc-200">Audio Track</h3>
              </div>
              {audioFile && (
                <button 
                  onClick={() => setAudioFile(null)} 
                  className="text-[10px] text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              )}
            </div>
            <label className="flex items-center justify-center w-full h-20 border border-dashed border-zinc-700 hover:border-zinc-600 rounded-lg cursor-pointer bg-zinc-950/50 transition-colors">
              <div className="text-center">
                {audioFile ? (
                   <span className="text-sm text-indigo-300 font-medium truncate max-w-[200px] block">
                     {audioFile.name}
                   </span>
                ) : (
                  <span className="text-xs text-zinc-500">
                    Click or drag MP3/WAV/Video here
                  </span>
                )}
              </div>
              <input 
                type="file" 
                accept="audio/*,video/*" 
                className="hidden" 
                onChange={e => {
                  if (e.target.files?.[0]) {
                    const file = e.target.files[0];
                    if (file.type.startsWith('audio/')) {
                      setAudioFile(file);
                    } else if (file.type.startsWith('video/')) {
                      handleExtractAudioFromVideo(file);
                    }
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* Output Action */}
        <div className="flex flex-col justify-end space-y-4">
          {generatedVideoUrl ? (
            <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95">
              <video 
                src={generatedVideoUrl} 
                controls 
                className="w-full aspect-video bg-black"
                autoPlay
                loop
              />
              <div className="p-4 flex gap-3">
                 <a 
                   href={generatedVideoUrl} 
                   download="meme.mp4"
                   className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-colors"
                 >
                   <Download className="w-4 h-4" />
                   Download MP4
                 </a>
                 <button 
                   onClick={() => setGeneratedVideoUrl(null)}
                   className="px-4 text-zinc-400 hover:text-white"
                 >
                   Close
                 </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-8 border border-zinc-800 border-dashed rounded-xl bg-zinc-900/20">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
                  <Play className="w-8 h-8 text-zinc-600 ml-1" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-zinc-300 font-medium">Ready to Generate?</h3>
                  <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                    Video processing happens locally in your browser using FFmpeg WASM.
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isProcessing}
                  className={`
                    w-full py-3 px-6 rounded-lg font-bold text-white shadow-lg transition-all
                    ${isProcessing 
                      ? 'bg-zinc-700 cursor-wait' 
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/20 hover:shadow-indigo-500/30'
                    }
                  `}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                       <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"/>
                       {progressMsg || 'Processing...'}
                    </span>
                  ) : (
                    'Generate Meme'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Bitadao;