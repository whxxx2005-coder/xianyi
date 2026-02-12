
import React, { useState, useRef, useEffect } from 'react';
import { AudienceType, NarrativeVersion, AudienceTypeValue } from '../types.ts';
import { storageService } from '../services/storageService.ts';

interface NarrativePlayerProps {
  relicId: string;
  versions: NarrativeVersion[];
  selectedType: AudienceTypeValue;
  onComplete: () => void;
  onPlay: (type: AudienceTypeValue) => void;
}

// 辅助函数：转换中文人格名为英文标识，用于文件匹配
const getTypeKey = (type: AudienceTypeValue): string => {
  const map: Record<string, string> = {
    '促进型': 'facilitator',
    '探索者': 'explorer',
    '专业研究者': 'professional',
    '灵感寻求者': 'inspiration',
    '体验追寻者': 'experience'
  };
  return map[type] || 'default';
};

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
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeVersion = versions.find(v => v.type === activeType) || versions[0];

  useEffect(() => {
    let isMounted = true;
    const dbKey = `audio_${relicId}_${activeType}`;
    
    setIsLoading(true);

    // 加载链：1. 浏览器数据库缓存 -> 2. 本地项目 assets 文件夹 -> 3. 云端备份 (如有)
    storageService.getAsset(dbKey).then(url => {
      if (!isMounted) return;
      
      if (url) {
        setResolvedAudioUrl(url);
      } else {
        // 构建本地项目文件路径，例如 ./assets/audio/rel-1_explorer.mp3
        const localPath = `./assets/audio/${relicId}_${getTypeKey(activeType)}.mp3`;
        setResolvedAudioUrl(localPath);
      }
      setIsLoading(false);
    });

    return () => { isMounted = false; };
  }, [relicId, activeType]);

  useEffect(() => {
    if (audioRef.current && resolvedAudioUrl) {
      audioRef.current.load();
    }
  }, [resolvedAudioUrl]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        onPlay(activeType);
      }).catch(err => {
        console.warn("Audio playback failed, possibly file missing in assets/audio/", err);
        alert(`未找到该版本音频，请确保文件已放入 assets/audio 文件夹。\n命名格式需为: ${relicId}_${getTypeKey(activeType)}.mp3`);
      });
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-xl p-6 border border-stone-100">
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
        {Object.values(AudienceType).map((type) => (
          <button
            key={type}
            onClick={() => { setActiveType(type); setIsPlaying(false); }}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all border-2 flex-shrink-0 ${
              activeType === type ? 'bg-[#D32F2F] text-white border-[#D32F2F]' : 'bg-stone-50 text-stone-400 border-stone-50'
            }`}
          >
            {type} {type === selectedType && '✨'}
          </button>
        ))}
      </div>

      <div className="mt-4 mb-6 text-center">
        <h3 className="text-xl font-black text-gray-900">{activeType}视角解说</h3>
      </div>

      <div className="mb-6">
        <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#A7C438] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] font-bold text-stone-400">{formatTime(currentTime)}</span>
          <span className="text-[10px] font-bold text-stone-400">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 mb-8">
        <button onClick={() => {if(audioRef.current) audioRef.current.currentTime -= 10}} className="text-stone-300">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
        </button>
        <button 
          onClick={handlePlayPause}
          className="w-16 h-16 rounded-2xl bg-[#D32F2F] text-white flex items-center justify-center shadow-lg active:scale-90 transition-all"
        >
          {isPlaying ? <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 9v6m4-6v6" /></svg> : <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg>}
        </button>
        <button onClick={() => {if(audioRef.current) audioRef.current.currentTime += 10}} className="text-stone-300">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>
        </button>
      </div>

      <audio 
        ref={audioRef} 
        src={resolvedAudioUrl} 
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration);
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
          }
        }}
        onEnded={() => { setIsPlaying(false); onComplete(); }}
        hidden
      />

      <div className="bg-stone-50 p-5 rounded-2xl border border-stone-100">
        <p className="text-gray-500 text-xs leading-relaxed italic">“{activeVersion.content}”</p>
      </div>
    </div>
  );
};

export default NarrativePlayer;
