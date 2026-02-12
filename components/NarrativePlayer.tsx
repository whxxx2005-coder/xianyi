
import React, { useState, useRef, useEffect } from 'react';
import { AudienceType, NarrativeVersion, AudienceTypeValue } from '../types';
import { storageService } from '../services/storageService';

interface NarrativePlayerProps {
  relicId: string;
  versions: NarrativeVersion[];
  selectedType: AudienceTypeValue;
  onComplete: () => void;
  onPlay: (type: AudienceTypeValue) => void;
}

const PLAYBACK_SPEEDS = [1.0, 1.25, 1.5, 2.0, 0.75];

const NarrativePlayer: React.FC<NarrativePlayerProps> = ({ 
  relicId,
  versions, 
  selectedType, 
  onComplete,
  onPlay 
}) => {
  const [activeType, setActiveType] = useState<AudienceTypeValue>(selectedType);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const prevUrlRef = useRef<string | null>(null);
  
  const activeVersion = versions.find(v => v.type === activeType) || versions[0];

  // 音频获取逻辑
  useEffect(() => {
    let isMounted = true;
    const key = `audio_${relicId}_${activeType}`;
    
    setIsLoading(true);
    
    // 获取新资源
    storageService.getAsset(key).then(url => {
      if (!isMounted) {
        if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
        return;
      }
      
      // 在设置新 URL 前，不立即释放旧 URL，防止 React 渲染间隙导致的资源中断
      const newUrl = url || activeVersion.audioUrl || '';
      
      if (!newUrl) {
        setIsLoading(false);
      }
      
      setResolvedAudioUrl(newUrl);
    });

    return () => { 
      isMounted = false; 
    };
  }, [relicId, activeType, activeVersion.audioUrl]);

  // 专门管理 URL 释放，确保在 resolvedAudioUrl 改变后且新 audio 挂载后操作
  useEffect(() => {
    const currentUrl = resolvedAudioUrl;
    
    // 当 resolvedAudioUrl 改变时，手动触发 audio 元素的 load
    if (audioRef.current && currentUrl) {
      audioRef.current.load();
    }

    return () => {
      // 仅在组件卸载或 URL 真正被替换时，才延迟释放
      if (currentUrl && currentUrl.startsWith('blob:')) {
        // 使用 setTimeout 确保浏览器已经处理完当前资源的断开连接
        setTimeout(() => URL.revokeObjectURL(currentUrl), 1000);
      }
    };
  }, [resolvedAudioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handlePlayPause = () => {
    if (!audioRef.current || !resolvedAudioUrl) {
      alert("当前版本尚未上传音频文件，请在管理后台上传后再试。");
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
          onPlay(activeType);
        }).catch(error => {
          console.error("音频播放失败:", error);
          // 增加更友好的提示
          if (error.name === 'NotAllowedError') {
            alert("由于浏览器限制，请先点击页面任意位置后再试。");
          } else {
            alert(`播放失败: ${error.message}`);
          }
          setIsPlaying(false);
        });
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      setCurrentTime(cur);
      setDuration(dur);
      setProgress((cur / dur) * 100);
    }
  };

  const onAudioError = (e: any) => {
    const error = e.target.error;
    console.error("Audio Element Error:", error);
    setIsLoading(false);
    setIsPlaying(false);
    
    let msg = "音频加载失败。";
    if (error) {
      switch (error.code) {
        case 1: msg = "加载被终止 (MEDIA_ERR_ABORTED)"; break;
        case 2: msg = "网络错误 (MEDIA_ERR_NETWORK)"; break;
        case 3: msg = "解码失败，文件可能已损坏 (MEDIA_ERR_DECODE)"; break;
        case 4: msg = "不支持的音频格式 (MEDIA_ERR_SRC_NOT_SUPPORTED)"; break;
      }
    }
    if (resolvedAudioUrl) alert(msg);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current && audioRef.current.duration) {
      const newTime = (val / 100) * audioRef.current.duration;
      audioRef.current.currentTime = newTime;
      setProgress(val);
      setCurrentTime(newTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(100);
    onComplete();
  };

  const cycleSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackRate(PLAYBACK_SPEEDS[nextIndex]);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-stone-200 p-6 border border-stone-100">
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
        {Object.values(AudienceType).map((type) => (
          <button
            key={type}
            onClick={() => {
              if (activeType !== type) {
                setActiveType(type);
                setIsPlaying(false);
              }
            }}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all border-2 flex-shrink-0 whitespace-nowrap ${
              activeType === type 
                ? 'bg-[#CF4432] text-white border-[#CF4432] shadow-md' 
                : 'bg-stone-50 text-stone-400 border-stone-50'
            }`}
          >
            {type} {type === selectedType && '✨'}
          </button>
        ))}
      </div>

      <div className="mt-4 mb-6 text-center">
        <div className="text-[9px] text-[#CF4432] mb-1 uppercase tracking-[0.3em] font-black">AI NARRATIVE AUDIO</div>
        <h3 className="text-xl font-black text-gray-900">{activeType}视角解说</h3>
      </div>

      <div className="mb-6 px-1">
        <div className="relative group">
          <input 
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={handleSeek}
            disabled={!duration}
            className="absolute top-0 left-0 w-full h-1.5 opacity-0 cursor-pointer z-20"
          />
          <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#A7C438] transition-all duration-100 relative" 
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#A7C438] rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform" />
            </div>
          </div>
        </div>
        <div className="flex justify-between mt-2 px-0.5">
          <span className="text-[10px] font-bold text-stone-400">{formatTime(currentTime)}</span>
          <span className="text-[10px] font-bold text-stone-400">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 mb-8">
        <button 
          onClick={cycleSpeed}
          className="w-12 h-8 rounded-lg bg-stone-50 text-[#CF4432] text-[10px] font-black border border-stone-100 active:scale-95 transition-all"
        >
          {playbackRate.toFixed(1)}x
        </button>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={() => { if(audioRef.current) audioRef.current.currentTime -= 10; }}
            className="text-stone-300 p-2 hover:text-[#CF4432] transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><path d="M10 15V9.5h-1v.5h.5V15h.5zm4-2.5c0-1.1-.9-2-2-2v4c1.1 0 2-.9 2-2z"/></svg>
          </button>
          
          <button 
            onClick={handlePlayPause}
            disabled={isLoading || !resolvedAudioUrl}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all ${isLoading || !resolvedAudioUrl ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-[#CF4432] text-white shadow-[#CF4432]/30'}`}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-stone-300 border-t-white rounded-full animate-spin" />
            ) : isPlaying ? (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 9v6m4-6v6" /></svg>
            ) : (
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
            )}
          </button>

          <button 
            onClick={() => { if(audioRef.current) audioRef.current.currentTime += 10; }}
            className="text-stone-300 p-2 hover:text-[#CF4432] transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><path d="M12 11.5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
        </div>

        <div className="w-12" />
      </div>

      {/* 强制 Key 重置，配合完善的事件回调 */}
      <audio 
        key={resolvedAudioUrl || 'empty'}
        ref={audioRef} 
        src={resolvedAudioUrl} 
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedData={() => setIsLoading(false)}
        onCanPlay={() => {
          setIsLoading(false);
          handleTimeUpdate(); // 初始化时长
        }}
        onError={onAudioError}
        preload="auto"
        hidden
      />

      <div className="bg-stone-50 p-5 rounded-2xl border border-stone-100">
        <p className="text-gray-500 text-xs leading-relaxed italic font-medium">
          “{activeVersion.content}”
        </p>
      </div>
    </div>
  );
};

export default NarrativePlayer;
