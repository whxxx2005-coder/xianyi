
import React, { useState, useEffect } from 'react';
import { AudienceType, Relic, NarrativeVersion, VisitorSession, Evaluation, QuizResult, AudienceTypeValue } from './types';
import { QUIZ_QUESTIONS, RELICS, MBTI_PROFILES, RELIC_NARRATIVES } from './constants';
import { storageService } from './services/storageService';
import NarrativePlayer from './components/NarrativePlayer';
import AdminDashboard from './components/AdminDashboard';

enum Page {
  POSTER,
  QUIZ,
  RESULT,
  GALLERY,
  DETAIL,
  SURVEY,
  ADMIN
}

const ImageWithFallback = ({ assetKey, cloudUrl, alt, className, title }: { assetKey: string, cloudUrl: string, alt: string, className?: string, title?: string }) => {
  const [error, setError] = useState(false);
  const [localData, setLocalData] = useState<string | null>(null);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl: string | null = null;

    storageService.getAsset(assetKey).then(data => {
      if (isMounted) {
        currentBlobUrl = data;
        setLocalData(data);
        setIsLoadingLocal(false);
      } else if (data && data.startsWith('blob:')) {
        URL.revokeObjectURL(data);
      }
    }).catch(() => {
      if (isMounted) setIsLoadingLocal(false);
    });

    return () => { 
      isMounted = false; 
      if (currentBlobUrl && currentBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [assetKey]);

  if (isLoadingLocal) {
    return <div className={`${className} bg-stone-100 animate-pulse`} />;
  }

  if (localData) {
    return <img src={localData} alt={alt} className={className} />;
  }

  if (error) {
    return (
      <div className={`${className} bg-stone-100 flex flex-col items-center justify-center p-4 text-center border-2 border-stone-200`}>
        <div className="text-3xl mb-2">🐎</div>
        <div className="text-[#CF4432] font-serif font-black text-xs uppercase tracking-tighter leading-none">{title || alt}</div>
      </div>
    );
  }
  
  const finalSrc = cloudUrl || `./${assetKey === 'poster' ? 'poster.png' : assetKey + '.png'}`;

  return (
    <img 
      src={finalSrc} 
      alt={alt} 
      className={className} 
      onError={() => setError(true)} 
    />
  );
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.POSTER);
  const [session, setSession] = useState<VisitorSession>(storageService.getOrCreateSession());
  const [selectedRelic, setSelectedRelic] = useState<Relic | null>(null);
  const [surveyStep, setSurveyStep] = useState(0);
  const [evaluation, setEvaluation] = useState<Partial<Evaluation>>({ feedback: '' });
  
  // 新增：追踪当前文物下观众听过的音频类型
  const [playedTypes, setPlayedTypes] = useState<AudienceTypeValue[]>([]);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    if (currentPage === Page.POSTER) {
      const timer = setTimeout(() => setCurrentPage(Page.QUIZ), 3500);
      return () => clearTimeout(timer);
    }
  }, [currentPage]);

  const handleAnswer = (opt: { label: string, type: any }) => {
    storageService.updateSessionType(opt.type);
    const quizResult: QuizResult = {
      id: crypto.randomUUID(),
      sessionId: session.sessionId,
      selectedType: opt.type,
      optionLabel: opt.label,
      timestamp: Date.now()
    };
    storageService.saveQuizResult(quizResult);
    setSession({ ...session, type: opt.type });
    setCurrentPage(Page.RESULT);
  };

  const submitSurvey = (finalRecommendation?: number) => {
    if (!selectedRelic || !session.type) return;

    // 确定评价归属类型
    const uniquePlayed = Array.from(new Set(playedTypes));
    let targetType: AudienceTypeValue = session.type;
    
    if (uniquePlayed.length === 1) {
      targetType = uniquePlayed[0];
    } else {
      targetType = session.type;
    }

    const fullEval: Evaluation = {
      id: crypto.randomUUID(),
      sessionId: session.sessionId,
      relicId: selectedRelic.id,
      audienceType: targetType,
      matchingScore: evaluation.matchingScore || 0,
      satisfactionScore: evaluation.satisfactionScore || 0,
      recommendationScore: finalRecommendation !== undefined ? finalRecommendation : (evaluation.recommendationScore ?? 0),
      feedback: '',
      timestamp: Date.now()
    };
    storageService.saveEvaluation(fullEval);
    setSurveyStep(0);
    setEvaluation({ feedback: '' });
    setCurrentPage(Page.GALLERY);
    alert('感谢参与研究！数据已提交。');
  };

  const getNarrativeVersions = (relic: Relic): NarrativeVersion[] => {
    const narratives = RELIC_NARRATIVES[relic.id] || {};
    return Object.values(AudienceType).map(type => ({
      type,
      audioUrl: '',
      content: narratives[type] || `这里是《${relic.title}》。${relic.description}`
    }));
  };

  const handleOpenRelic = (relic: Relic) => {
    setSelectedRelic(relic);
    setPlayedTypes([]); // 切换文物时重置听过的类型
    setCurrentPage(Page.DETAIL);
    storageService.trackView(relic.id);
  };

  const handleExitDetail = () => {
    setCurrentPage(Page.SURVEY);
  };

  const checkAdminPassword = () => {
    if (adminPassword === '0526') {
      setIsAdminAuthenticated(true);
      setAdminPassword('');
    } else {
      alert('密码错误。');
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-amber-100 overflow-x-hidden">
      {currentPage !== Page.POSTER && (
        <nav className="fixed top-0 left-0 w-full h-14 bg-white/95 backdrop-blur-lg z-40 border-b border-stone-100 flex items-center px-4 justify-between">
          <div className="font-serif font-black text-[#CF4432] tracking-tighter text-lg">鲜衣怒马少年时</div>
          <div className="flex gap-2 items-center">
            {session.type && (
              <div className="flex items-center gap-1.5 bg-[#A7C438]/10 px-2 py-0.5 rounded-full border border-[#A7C438]/20">
                <span className="text-xs">{(MBTI_PROFILES as any)[session.type].icon}</span>
                <span className="text-[10px] text-[#A7C438] font-black uppercase">{session.type}</span>
              </div>
            )}
            <button onClick={() => setCurrentPage(Page.ADMIN)} className="p-1.5 text-stone-200 hover:text-[#CF4432] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </nav>
      )}

      <main className={currentPage === Page.POSTER ? "" : "pt-14"}>
        {currentPage === Page.POSTER && (
          <div className="fixed inset-0 bg-stone-950 flex flex-col items-center justify-center text-white z-50 overflow-hidden" onClick={() => setCurrentPage(Page.QUIZ)}>
            <ImageWithFallback assetKey="poster" cloudUrl="https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=1200" alt="鲜衣怒马少年时" className="absolute inset-0 w-full h-full object-cover opacity-60 scale-105" />
            <div className="relative z-10 text-center px-10">
               <h1 className="text-4xl font-serif font-black tracking-widest mb-4">鲜衣怒马少年时</h1>
               <div className="w-10 h-0.5 bg-[#CF4432] mx-auto mb-6" />
               <p className="text-[10px] font-bold tracking-[0.4em] opacity-80 uppercase leading-relaxed">美术馆个性化叙事导览系统<br/>Personalized Narrative AI Guide</p>
            </div>
          </div>
        )}

        {currentPage === Page.QUIZ && (
          <div className="px-6 py-12 max-w-lg mx-auto">
            <div className="mb-14 text-center">
              <span className="text-[#CF4432] font-black text-[10px] uppercase tracking-[0.4em] block mb-3">观众人格探索</span>
              <h2 className="text-3xl font-serif font-black text-gray-900">{QUIZ_QUESTIONS[0].question}</h2>
            </div>
            <div className="space-y-3">
              {QUIZ_QUESTIONS[0].options.map((opt, i) => (
                <button key={i} onClick={() => handleAnswer(opt)} className="w-full text-center px-6 py-5 rounded-2xl border border-stone-100 bg-stone-50/50 hover:bg-[#A7C438] hover:text-white transition-all shadow-sm group">
                  <span className="text-base font-black inline-block">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentPage === Page.RESULT && session.type && (
          <div className="px-6 py-10 max-w-lg mx-auto text-center flex flex-col justify-center min-h-[85vh]">
            <div className="mb-10">
              <div className="text-8xl mb-6">{(MBTI_PROFILES as any)[session.type].icon}</div>
              <h3 className="text-[10px] font-black text-[#CF4432] tracking-[0.4em] mb-3 uppercase">您的导览人格是</h3>
              <h2 className="text-4xl font-serif font-black mb-1">{session.type}</h2>
            </div>
            <div className="bg-stone-50 p-8 rounded-[2.5rem] mb-12 text-left">
              <h4 className="text-lg font-bold mb-3 text-[#A7C438]">{(MBTI_PROFILES as any)[session.type].title}</h4>
              <p className="text-stone-600 leading-relaxed text-sm font-medium">{(MBTI_PROFILES as any)[session.type].desc}</p>
            </div>
            <button onClick={() => setCurrentPage(Page.GALLERY)} className="w-full py-5 bg-[#CF4432] text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all text-lg tracking-widest">进入虚拟展厅</button>
          </div>
        )}

        {currentPage === Page.GALLERY && (
          <div className="px-4 py-8 max-w-7xl mx-auto space-y-10">
            <header className="flex flex-col items-center text-center px-6">
              <div className="w-8 h-8 bg-[#CF4432] rounded-lg flex items-center justify-center text-white text-lg mb-4">🐎</div>
              <h2 className="text-2xl font-serif font-black tracking-tight mb-2">展厅：鲜衣怒马少年时</h2>
              <p className="text-[9px] text-stone-400 font-bold uppercase tracking-[0.3em] leading-tight max-w-[200px]">GUANGZHOU MUSEUM OF ART SPECIAL RESEARCH</p>
            </header>
            <div className="grid grid-cols-2 gap-3">
              {RELICS.map(relic => (
                <div key={relic.id} className="group relative bg-white rounded-2xl overflow-hidden shadow-md active:scale-[0.97] transition-all border border-stone-100 cursor-pointer" onClick={() => handleOpenRelic(relic)}>
                  <div className="aspect-[3/4] overflow-hidden">
                    <ImageWithFallback assetKey={relic.id} cloudUrl={relic.imageUrl} alt={relic.title} className="w-full h-full object-cover" title={relic.title} />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 p-3 text-white">
                    <h3 className="text-xs font-black leading-tight line-clamp-1">{relic.title}</h3>
                    <p className="text-[8px] opacity-60 mt-1 uppercase font-bold">{relic.dynasty} {relic.author}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentPage === Page.DETAIL && selectedRelic && session.type && (
          <div className="pb-10">
            <div className="w-full aspect-[4/5] relative">
              <ImageWithFallback assetKey={selectedRelic.id} cloudUrl={selectedRelic.imageUrl} alt={selectedRelic.title} className="w-full h-full object-cover" title={selectedRelic.title} />
              <button onClick={handleExitDetail} className="absolute top-4 left-4 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-transform shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
              </button>
            </div>
            <div className="px-5 -mt-8 relative z-10 space-y-6">
              <div className="bg-white p-7 rounded-[2.5rem] shadow-2xl border border-stone-50 space-y-5">
                <div>
                  <div className="text-[10px] text-[#A7C438] font-black tracking-widest uppercase mb-1">{selectedRelic.dynasty} {selectedRelic.author}</div>
                  <h1 className="text-3xl font-serif font-black tracking-tight text-gray-900">{selectedRelic.title}</h1>
                </div>
                <p className="text-stone-500 leading-relaxed text-sm font-medium">{selectedRelic.description}</p>
              </div>
              <NarrativePlayer 
                relicId={selectedRelic.id}
                versions={getNarrativeVersions(selectedRelic)}
                selectedType={session.type}
                onComplete={() => {
                  storageService.trackPlayback({
                    id: crypto.randomUUID(), sessionId: session.sessionId, relicId: selectedRelic.id,
                    narrativeType: session.type as any, isCompleted: true, timestamp: Date.now()
                  });
                  setCurrentPage(Page.SURVEY);
                }}
                onPlay={(type) => {
                  setPlayedTypes(prev => [...prev, type]);
                  storageService.trackPlayback({
                    id: crypto.randomUUID(), sessionId: session.sessionId, relicId: selectedRelic.id,
                    narrativeType: type as any, isCompleted: false, timestamp: Date.now()
                  });
                }}
              />
            </div>
          </div>
        )}

        {currentPage === Page.SURVEY && (
          <div className="px-6 py-12 max-w-lg mx-auto flex flex-col justify-center min-h-[85vh]">
             <div className="text-center mb-8">
               <h2 className="text-2xl font-serif font-black text-gray-900 tracking-tight">听后感调研</h2>
               <div className="flex justify-center gap-1 mt-4">
                 {[0, 1, 2].map(step => (
                   <div key={step} className={`h-1 rounded-full transition-all ${surveyStep === step ? 'w-8 bg-[#CF4432]' : 'w-4 bg-stone-200'}`} />
                 ))}
               </div>
             </div>
             
             <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-stone-100 min-h-[400px] flex flex-col">
               {surveyStep === 0 && (
                <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="font-black text-xl text-stone-800 mb-8 text-center">1. 您对该解说词的满意程度？</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[1,2,3,4,5].map(v => (
                      <button key={v} onClick={() => { setEvaluation({...evaluation, satisfactionScore: v}); setSurveyStep(1); }} className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${evaluation.satisfactionScore === v ? 'border-[#CF4432] bg-[#CF4432] text-white' : 'border-stone-50 bg-stone-50 text-stone-400'}`}>
                        <span className="text-lg font-black">{v}</span>
                        <span className="text-[8px] font-bold">分</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {surveyStep === 1 && (
                <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="font-black text-xl text-stone-800 mb-8 text-center">2. 该段解说词符合您的观众类型吗？</h3>
                  <div className="space-y-2">
                    {[
                      { label: '完全符合', val: 5 },
                      { label: '比较符合', val: 4 },
                      { label: '一般符合', val: 3 },
                      { label: '比较不符合', val: 2 },
                      { label: '完全不符合', val: 1 }
                    ].map(opt => (
                      <button key={opt.val} onClick={() => { setEvaluation({...evaluation, matchingScore: opt.val}); setSurveyStep(2); }} className="w-full py-4 px-6 rounded-2xl border-2 border-stone-50 bg-stone-50 text-stone-600 font-black text-sm hover:border-[#A7C438] active:scale-98 transition-all">
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {surveyStep === 2 && (
                <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="font-black text-xl text-stone-800 mb-10 text-center">3. 您愿意向朋友推荐该版本吗？</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => submitSurvey(1)} className="py-8 rounded-3xl border-2 border-stone-50 bg-stone-50 flex flex-col items-center justify-center hover:border-[#A7C438] hover:text-[#A7C438] transition-all group">
                      <span className="text-4xl mb-2 group-hover:scale-110 transition-transform">👍</span>
                      <span className="text-lg font-black">是</span>
                    </button>
                    <button onClick={() => submitSurvey(0)} className="py-8 rounded-3xl border-2 border-stone-50 bg-stone-50 flex flex-col items-center justify-center hover:border-stone-300 transition-all group">
                      <span className="text-4xl mb-2 group-hover:scale-110 transition-transform">👎</span>
                      <span className="text-lg font-black">否</span>
                    </button>
                  </div>
                </div>
              )}
             </div>
          </div>
        )}

        {currentPage === Page.ADMIN && (
          <div className="px-4 py-8 bg-stone-50 min-h-screen">
            {!isAdminAuthenticated ? (
              <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-[2.5rem] shadow-2xl border border-stone-100 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="w-16 h-16 bg-[#CF4432]/10 rounded-2xl flex items-center justify-center text-[#CF4432] mx-auto mb-6">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-2">管理人员身份验证</h2>
                <div className="space-y-4">
                  <input type="password" placeholder="请输入管理密码" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && checkAdminPassword()} className="w-full p-5 bg-stone-50 rounded-2xl text-center font-black tracking-[0.5em] text-lg outline-none ring-2 ring-stone-50 focus:ring-[#CF4432] transition-all" />
                  <button onClick={checkAdminPassword} className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black shadow-lg hover:bg-black active:scale-95 transition-all text-sm tracking-widest">确认进入</button>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-700">
                <button onClick={() => { setCurrentPage(Page.GALLERY); setIsAdminAuthenticated(false); }} className="mb-8 flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest bg-white px-4 py-2 rounded-full shadow-sm hover:text-[#CF4432] transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>退出管理模式</button>
                <AdminDashboard />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
