import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MonitorSmartphone, Camera, Trash2, ArrowLeft, Loader2, Image as ImageIcon, Upload, Eye, X, ChevronLeft, ChevronRight, Download, MoreVertical, Folder as FolderIcon } from 'lucide-react';
import { logActivity } from '../lib/logger';
import ConfirmModal from '../components/ConfirmModal';

export default function FolderView({ user }: { user: User }) {
  const { folderId } = useParams();
  const [folder, setFolder] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [capturing, setCapturing] = useState(false);
  const [captureMode, setCaptureMode] = useState<'simulate' | 'hardware'>('hardware');
  const [uploading, setUploading] = useState(false);
  const [showStorageGuide, setShowStorageGuide] = useState(false);
  const [storageErrorText, setStorageErrorText] = useState('');
  const [viewingImageIndex, setViewingImageIndex] = useState<number | null>(null);
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  
  const [userFolders, setUserFolders] = useState<any[]>([]);
  const [activeMenuImageId, setActiveMenuImageId] = useState<string | null>(null);
  const [movingImageId, setMovingImageId] = useState<string | null>(null);
  const [destinationFolderId, setDestinationFolderId] = useState<string>('');

  const fetchFolderDetails = async () => {
    if (!folderId) return;
    const { data: fData } = await supabase.from('folders').select('*').eq('id', folderId).maybeSingle();
    if (fData) setFolder(fData);
  };

  const fetchImages = async () => {
    if (!folderId) return;
    const { data: iData } = await supabase.from('images').select('*').eq('folderId', folderId).eq('isDeleted', false);
    if (iData) {
      setImages([...iData].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }
  };

  const fetchDevices = async () => {
    const { data: dData } = await supabase.from('devices').select('*');
    if (dData) setDevices(dData);
  };

  const fetchUserFolders = async () => {
    const { data: fData } = await supabase.from('folders').select('*').eq('userId', user.id).eq('isDeleted', false);
    if (fData) setUserFolders(fData);
  };

  useEffect(() => {
    fetchFolderDetails();
    fetchImages();
    fetchDevices();
    fetchUserFolders();

    const imgChannel = supabase.channel(`images-${folderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'images', filter: `folderId=eq.${folderId}` }, () => {
        fetchImages();
        setCapturing(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(imgChannel);
    };
  }, [folderId]);

  // Listen for keyboard controls when image viewing modal is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewingImageIndex === null) return;
      if (e.key === 'Escape') setViewingImageIndex(null);
      if (e.key === 'ArrowRight' || e.key === 'Right') {
        if (viewingImageIndex > 0) setViewingImageIndex(viewingImageIndex - 1);
      }
      if (e.key === 'ArrowLeft' || e.key === 'Left') {
        if (viewingImageIndex < images.length - 1) setViewingImageIndex(viewingImageIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingImageIndex, images.length]);

  const generateMockCapturedPhoto = (): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Dark blueprint grid background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 640, 480);
        
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        const grid = 20;
        for (let x = 0; x < 640; x += grid) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 480);
          ctx.stroke();
        }
        for (let y = 0; y < 480; y += grid) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(640, y);
          ctx.stroke();
        }

        // Draw outline circle
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(320, 240, 100, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#a855f7';
        ctx.beginPath();
        ctx.rect(220, 140, 200, 200);
        ctx.stroke();

        // Title and notes
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('GLASS BOARD CAPTURE - OK', 40, 60);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        const activeDeviceName = devices.find(d => d.id === selectedDevice)?.name || 'Raspberry Pi Gateway';
        ctx.fillText(`Device Code: ${activeDeviceName}`, 40, 90);
        ctx.fillText(`Folder: ${folder?.name || folderId}`, 40, 110);
        ctx.fillText(`Timestamp: ${new Date().toLocaleString()}`, 40, 130);
        ctx.fillText('Relay Link: Active', 40, 150);
        ctx.fillText('Optics Mode: Calibration Standard', 40, 170);

        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(320, 240, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(320, 100); ctx.lineTo(320, 380);
        ctx.moveTo(180, 240); ctx.lineTo(460, 240);
        ctx.stroke();
      }
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/png');
    });
  };

  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !folderId) return;

    setUploading(true);
    setStorageErrorText('');
    try {
      try {
        await supabase.storage.createBucket('glassboard', { public: true });
      } catch (err) {}

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `${user.id}/${folderId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('glassboard')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        setStorageErrorText(uploadError.message);
        setShowStorageGuide(true);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('glassboard')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('images').insert({
        folderId: folderId,
        userId: user.id,
        imageUrl: publicUrl,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (dbError) throw dbError;

      // Log notification activity
      logActivity(user.id, user.email || 'user', 'upload_image', `Uploaded custom file '${file.name}' to folder '${folder?.name || 'Archive'}'`);

      alert('Image uploaded successfully and saved to your Supabase digital archive!');
      fetchImages();
    } catch (err: any) {
      console.error(err);
      if (!uploading && err.message) {
        setStorageErrorText(err.message || String(err));
        setShowStorageGuide(true);
      }
    } finally {
      setUploading(false);
    }
  };

  // Request hardware capture
  const handleCapture = async () => {
    if (!selectedDevice || !folderId) return;
    setCapturing(true);
    setStorageErrorText('');
    try {
      await supabase.from('captureRequests').insert({
        userId: user.id,
        deviceId: selectedDevice,
        folderId: folderId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const deviceObj = devices.find(d => d.id === selectedDevice);
      
      if (captureMode === 'simulate') {
        try {
          await supabase.storage.createBucket('glassboard', { public: true });
        } catch (err) {}

        const fileBlob = await generateMockCapturedPhoto();
        const fileName = `capture_${Date.now()}_${selectedDevice}.png`;
        const filePath = `${user.id}/${folderId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('glassboard')
          .upload(filePath, fileBlob, { contentType: 'image/png', cacheControl: '3600' });

        if (uploadError) {
          setStorageErrorText(uploadError.message);
          setShowStorageGuide(true);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('glassboard')
          .getPublicUrl(filePath);

        const { error: dbError } = await supabase.from('images').insert({
          folderId: folderId,
          userId: user.id,
          imageUrl: publicUrl,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        if (dbError) throw dbError;

        logActivity(user.id, user.email || 'user', 'capture_image_request', `Executed simulated camera capture on device '${deviceObj?.name || 'IoT Gateway'}' inside folder '${folder?.name || 'Archive'}'`);
        alert('Capture command sent! Simulated browser capture uploaded to Supabase Storage.');
        fetchImages();
        setCapturing(false);
      } else {
        logActivity(user.id, user.email || 'user', 'capture_image_request', `Dispatched physical action trigger event to hardware node '${deviceObj?.name || 'IoT Gateway'}'`);
        
        // Start offline safeguard fallback timeout (25 seconds)
        setTimeout(() => {
          setCapturing(current => {
            if (current) {
              alert(`The hardware device "${deviceObj?.name || 'Raspberry Pi'}" is taking longer than usual to respond. Please make sure your Python listener script is active and running on the Pi.`);
              return false;
            }
            return current;
          });
        }, 25000);
      }
    } catch(err: any) {
      console.error(err);
      if (err.message) {
        setStorageErrorText(err.message || String(err));
        setShowStorageGuide(true);
      }
      setCapturing(false);
    }
  };

  const handleDeleteImageClick = (imageId: string) => {
    setDeleteImageId(imageId);
  };

  const handleConfirmDeleteImage = async () => {
    if (!deleteImageId) return;
    const { error } = await supabase
      .from('images')
      .update({ isDeleted: true, updatedAt: new Date().toISOString() })
      .eq('id', deleteImageId);
    if (error) {
      alert("Error trashing image: " + error.message);
    } else {
      // Log notification activity
      logActivity(user.id, user.email || 'user', 'delete_image', `Moved archived image to trash bin`);
      fetchImages();
    }
    setDeleteImageId(null);
  };

  const handleConfirmMoveImage = async () => {
    if (!movingImageId || !destinationFolderId) return;
    const destFolder = userFolders.find(f => f.id === destinationFolderId);
    if (!destFolder) return;

    const { error } = await supabase
      .from('images')
      .update({ folderId: destinationFolderId, updatedAt: new Date().toISOString() })
      .eq('id', movingImageId);

    if (error) {
      alert("Error moving image: " + error.message);
    } else {
      logActivity(user.id, user.email || 'user', 'move_image', `Moved image to folder '${destFolder.name}'`);
      fetchImages();
    }
    setMovingImageId(null);
    setDestinationFolderId('');
  };

  if (!folder) return <p className="text-gray-500">Loading folder...</p>;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="p-2 -ml-2 text-slate-400 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Archives</span>
            <span>/</span>
            <span className="text-slate-900 font-medium">{folder.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-bold uppercase">IoT Gateway Status</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${selectedDevice ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
              <span className="text-xs font-medium text-slate-700">{selectedDevice ? 'Cloud Connected' : 'Waiting...'}</span>
            </div>
          </div>
          <div className="h-8 w-[1px] bg-slate-200"></div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-500 uppercase">Device Selection</label>
            <select 
               value={selectedDevice} 
               onChange={(e) => setSelectedDevice(e.target.value)}
               className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
             >
               <option value="" disabled>--- Select a connected Pi ---</option>
               {devices.map(d => (
                 <option key={d.id} value={d.id}>{d.name} {d.status === 'offline' ? '(Offline)' : ''}</option>
               ))}
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 p-8 grid grid-cols-12 gap-6 overflow-hidden">
        <section className="col-span-12 flex flex-col pr-4 pb-10 overflow-y-auto">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="text-lg font-semibold text-slate-800">Archive Contents</h2>
            <div className="flex gap-3 items-center">
              <label 
                className="cursor-pointer px-4 py-1.5 border border-slate-200 bg-white rounded text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-xs"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-slate-400" />}
                {uploading ? 'UPLOADING...' : 'UPLOAD IMAGE'}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLocalUpload} 
                  disabled={uploading} 
                  className="hidden" 
                />
              </label>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Capture Mode:</span>
                <select
                  value={captureMode}
                  onChange={(e) => setCaptureMode(e.target.value as 'simulate' | 'hardware')}
                  className="bg-white border border-slate-200 text-slate-700 rounded px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="hardware">Raspberry Pi (Real Hardware)</option>
                  <option value="simulate">Simulator (Browser Mock)</option>
                </select>
              </div>

              <button 
                onClick={handleCapture}
                disabled={!selectedDevice || capturing}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold shadow-xs flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                TRIGGER CAPTURE
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((img, idx) => (
              <div 
                key={img.id} 
                onClick={() => setViewingImageIndex(idx)}
                className="aspect-square bg-slate-200 rounded-lg overflow-hidden border border-slate-200 group relative cursor-pointer"
              >
                {img.imageUrl ? (
                  <img src={img.imageUrl} alt="Archived capture" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon className="w-8 h-8 mb-1 opacity-20" />
                    <span className="text-[10px] font-mono">Processing...</span>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingImageIndex(idx);
                    }}
                    title="View Full Size"
                    className="p-2.5 bg-white rounded-full text-slate-700 hover:text-indigo-600 shadow-lg hover:scale-110 transition-transform flex items-center justify-center cursor-pointer"
                  >
                    <Eye className="w-4.5 h-4.5" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuImageId(activeMenuImageId === img.id ? null : img.id);
                    }}
                    title="Actions"
                    className="p-2.5 bg-white rounded-full text-slate-700 hover:text-indigo-600 shadow-lg hover:scale-110 transition-transform flex items-center justify-center cursor-pointer"
                  >
                    <MoreVertical className="w-4.5 h-4.5" />
                  </button>

                  {/* Actions Dropdown inside the Card (so we don't overflow) */}
                  {activeMenuImageId === img.id && (
                    <div 
                      className="absolute inset-0 bg-slate-950/95 z-30 p-3 flex flex-col justify-center items-stretch gap-2 animate-in fade-in duration-150"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <div className="text-center font-bold text-white text-[10px] tracking-wider uppercase mb-1">
                        Archived Photo Options
                      </div>
                      <button
                        onClick={() => {
                          setActiveMenuImageId(null);
                          handleDeleteImageClick(img.id);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white rounded py-2 px-3 flex items-center justify-center gap-1.5 cursor-pointer text-xs font-semibold transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Move to Trash
                      </button>
                      <button
                        onClick={() => {
                          setActiveMenuImageId(null);
                          setMovingImageId(img.id);
                          setDestinationFolderId('');
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-100 rounded py-2 px-3 flex items-center justify-center gap-1.5 cursor-pointer text-xs font-semibold transition-colors border border-slate-700"
                      >
                        <FolderIcon className="w-3.5 h-3.5" />
                        Move Folder
                      </button>
                      <button
                        onClick={() => {
                          setActiveMenuImageId(null);
                        }}
                        className="text-slate-400 hover:text-white text-[10px] font-medium py-1 text-center cursor-pointer mt-1"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {images.length === 0 && (
               <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-lg">
                 <Camera className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                 <p className="text-slate-500 text-sm">No images captured in this folder yet.</p>
               </div>
            )}
          </div>
        </section>
      </div>

      {showStorageGuide && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold tracking-tight">Supabase Storage Setup Required</h3>
              <button 
                onClick={() => setShowStorageGuide(false)}
                className="text-slate-400 hover:text-white transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 mb-4 flex gap-2.5">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Storage Error Encountered</h4>
                  <p className="text-xs text-amber-700 mt-1">{storageErrorText || 'Bucket "glassboard" could not be requested or does not exist.'}</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-4 font-normal leading-relaxed">
                Supabase Storage bucket creation is restricted securely on client browsers. To allow image uploads, please configure your Supabase project with these steps:
              </p>

              <ol className="space-y-3.5 text-xs text-slate-700 list-decimal pl-4 mb-6 leading-relaxed">
                <li>
                  Go to your <strong className="text-slate-900">Supabase Console</strong> (<a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">supabase.com/dashboard</a>) and choose your project.
                </li>
                <li>
                  Select <strong className="text-slate-900">Storage</strong> from the left sidebar navigation menu.
                </li>
                <li>
                  Click the <strong className="text-slate-900">"New bucket"</strong> button.
                </li>
                <li>
                  Set the bucket name exactly to: <strong className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono">glassboard</strong>
                </li>
                <li>
                  Toggle the <strong className="text-red-600">Public bucket</strong> switch to <strong className="text-emerald-600 uppercase">ON</strong> (this allows the application to directly render your uploaded dashboard images).
                </li>
                <li>
                  Under <strong className="text-slate-900">Policies</strong>, click <strong className="text-slate-950">"New Policy"</strong> on your bucket, and choose <strong className="text-indigo-600">"Get started quickly"</strong>, then select <strong className="text-indigo-600 font-semibold">"Give users upload access"</strong> or <strong className="text-indigo-600 font-semibold">"Allow anonymous uploads"</strong> to authorize files.
                </li>
              </ol>

              <button 
                onClick={() => setShowStorageGuide(false)}
                className="w-full py-2 bg-indigo-600 text-white rounded font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 transition-colors"
              >
                GOT IT, RETRY AFTER CONFIGURING
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size Image Viewer Modal */}
      {viewingImageIndex !== null && images[viewingImageIndex] && (() => {
        const img = images[viewingImageIndex];
        return (
          <div 
            onClick={() => setViewingImageIndex(null)}
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-6 z-50 animate-in fade-in duration-200"
          >
            {/* Top Bar */}
            <div 
              onClick={(e) => e.stopPropagation()} 
              className="flex items-center justify-between text-white select-none z-10 w-full max-w-7xl mx-auto"
            >
              <div className="flex flex-col">
                <span className="text-xs text-slate-400 font-mono">Image {viewingImageIndex + 1} of {images.length}</span>
                <span className="text-sm font-semibold text-slate-200 uppercase tracking-wide mt-1">
                  {img.createdAt ? new Date(img.createdAt).toLocaleString() : 'Just now'}
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                <a 
                  href={img.imageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center justify-center"
                  title="Open source file in new tab"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button 
                  onClick={() => setViewingImageIndex(null)}
                  className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center justify-center font-bold"
                  title="Close viewer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Image + Navigation */}
            <div 
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex items-center justify-center relative my-4 max-w-7xl mx-auto w-full select-none"
            >
              {/* Previous Button */}
              {viewingImageIndex < images.length - 1 ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); setViewingImageIndex(viewingImageIndex + 1); }}
                  className="absolute left-4 p-3 bg-slate-900/80 hover:bg-slate-800 text-white hover:text-indigo-400 transition-colors rounded-full shadow-2xl z-20 cursor-pointer"
                  title="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              ) : (
                <div className="w-12"></div>
              )}

              {/* Central Image Container */}
              <div className="relative max-h-[75vh] max-w-[85vw] flex items-center justify-center">
                <img 
                  src={img.imageUrl} 
                  alt="Archived capture in full space" 
                  className="max-h-[75vh] max-w-[85vw] object-contain rounded-md shadow-2xl"
                />
              </div>

              {/* Next Button */}
              {viewingImageIndex > 0 ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); setViewingImageIndex(viewingImageIndex - 1); }}
                  className="absolute right-4 p-3 bg-slate-900/80 hover:bg-slate-800 text-white hover:text-indigo-400 transition-colors rounded-full shadow-2xl z-20 cursor-pointer"
                  title="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              ) : (
                <div className="w-12"></div>
              )}
            </div>

            {/* Bottom Info Status bar */}
            <div className="text-center text-slate-500 text-[11px] font-mono p-2">
              <span>Press Left/Right arrows to navigate. ESC to back out.</span>
            </div>
          </div>
        );
      })()}

      <ConfirmModal 
        isOpen={deleteImageId !== null}
        title="Move Image to Trash"
        message="Are you sure you want to move this archived capture to the trash? You can always view or recover it within your Trash Bin."
        confirmLabel="Move to Trash"
        cancelLabel="Keep Image"
        isDestructive={true}
        onConfirm={handleConfirmDeleteImage}
        onCancel={() => setDeleteImageId(null)}
      />

      {/* Move Image to Folder Modal */}
      {movingImageId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[999] p-4 transition-all animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <h3 className="text-white text-sm font-bold tracking-tight">Move Capture to Another Folder</h3>
              <button 
                onClick={() => setMovingImageId(null)}
                className="text-slate-400 hover:text-white transition-colors font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-600 mb-4">
                Select the target project folder where you'd like to transfer this digital capture:
              </p>

              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-700 uppercase">Select Destination Folder</label>
                <select
                  value={destinationFolderId}
                  onChange={(e) => setDestinationFolderId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="" disabled>--- Select target folder ---</option>
                  {userFolders
                    .filter(f => f.id !== folderId) // Don't allow moving to current folder
                    .map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))
                  }
                </select>

                {userFolders.filter(f => f.id !== folderId).length === 0 && (
                  <p className="text-[11px] text-amber-600 bg-amber-50 rounded p-2">
                    You have no other folders created. Please go back to your workspace dashboard to create more folders first.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 font-sans">
                <button
                  type="button"
                  onClick={() => setMovingImageId(null)}
                  className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMoveImage}
                  disabled={!destinationFolderId}
                  className="px-3.5 py-1.5 rounded text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Move Image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
