
import React, { useState, useEffect } from 'react';
import { AudienceType, Relic, NarrativeVersion, VisitorSession, Evaluation, QuizResult, AudienceTypeValue } from './types.ts';
import { QUIZ_QUESTIONS, RELICS, MBTI_PROFILES, RELIC_NARRATIVES } from './constants.tsx';
import { storageService } from './services/storageService.ts';
import NarrativePlayer from './components/NarrativePlayer.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';

enum Page {
  POSTER,
  QUIZ,
  RESULT,
  GALLERY,
  DETAIL,
  SURVEY,
  ADMIN
}

const ImageWithFallback = ({ assetKey, cloudUrl, alt, className }: { assetKey: string, cloudUrl: string, alt: string, className?: string }) => {
  const [error, setError] = useState(false);
  const [localData, setLocalData] = useState<string | null>(null);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl: string | null = null;

    storageService.getAsset(assetKey).then(data => {
      if (isMounted) {
        if (data) {
          currentBlobUrl = data;
          setLocalData(data);
        }
        setIsLoadingLocal(false);
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

  const localFilePath = `./assets/images/${assetKey === 'poster' ? 'poster.png' : assetKey + '.png'}`;
  const finalSrc = localData || (error ? cloudUrl : localFilePath);

  return (
    <img 
      src={finalSrc} 
      alt={alt} 
      className={className} 
      onError={() => {
        if (!error && cloudUrl) {
          setError(true);
        }
      }} 
    />
  );
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.POSTER);
  const [session, setSession] = useState<VisitorSession>(storageService.getOrCreateSession());
  const [selectedRelic, setSelectedRelic] = useState<Relic | null>(null);
  const [surveyStep, setSurveyStep] = useState(0);
  const [evaluation, setEvaluation] = useState<Partial<Evaluation>>({ feedback: '' });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const submitSurvey = (finalRecommendation?: number) => {
    if (!selectedRelic || !session.type) return;
    const fullEval: Evaluation = {
      id: crypto.randomUUID(),
      sessionId: session.sessionId,
      relicId: selectedRelic.id,
      audienceType: session.type,
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
  };

  const handleOpenRelic = (relic: Relic) => {
    setSelectedRelic(relic);
    setCurrentPage(Page.DETAIL);
    storageService.trackView(relic.id);
  };

  const checkAdminPassword = () => {
    if (adminPassword === '0526') {
      setIsAdminAuthenticated(true);
      setAdminPassword('');
    } else {
      alert('密码错误');
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </nav>
      )}

      <main className={currentPage === Page.POSTER ? "" : "pt-14"}>
        {currentPage === Page.POSTER && (
          <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center overflow-hidden">
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {/* 直接使用 CDN 链接，避免 Fallback 逻辑在某些设备上失效 */}
              <img 
                src="https://cdn.jsdelivr.net/gh/whxxx2005-coder/xianyinuma/1.jpg" 
                alt="鲜衣怒马少年时展览海报" 
                className="w-full h-full object-contain"
                loading="eager"
              />
              <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-32 flex flex-col items-center">
                <button 
                  onClick={() => setCurrentPage(Page.QUIZ)}
                  className="w-full max-w-xs bg-white text-black py-5 rounded-2xl text-lg font-black tracking-widest uppercase shadow-2xl active:scale-95 transition-all hover:bg-stone-100"
                >
                  进入展厅
                </button>
                <p className="mt-6 text-[9px] font-black tracking-[0.4em] text-white/50 uppercase">Research Narratives Research Project v2.7</p>
              </div>
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
                <button key={i} onClick={() => {
                  storageService.updateSessionType(opt.type);
                  setSession({ ...session, type: opt.type });
                  setCurrentPage(Page.RESULT);
                }} className="w-full text-center px-6 py-5 rounded-2xl border border-stone-100 bg-stone-50/50 hover:bg-[#A7C438] hover:text-white transition-all shadow-sm">
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
            <button onClick={() => setCurrentPage(Page.GALLERY)} className="w-full py-5 bg-[#CF4432] text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all text-lg tracking-widest">确认进入</button>
          </div>
        )}

        {currentPage === Page.GALLERY && (
          <div className="px-4 py-8 max-w-7xl mx-auto space-y-10">
            <header className="flex flex-col items-center text-center px-6">
              <div className="w-8 h-8 bg-[#CF4432] rounded-lg flex items-center justify-center text-white text-lg mb-4">🐎</div>
              <h2 className="text-2xl font-serif font-black tracking-tight mb-2">虚拟展厅：鲜衣怒马少年时</h2>
              <p className="text-[9px] text-stone-400 font-bold uppercase tracking-[0.3em] leading-tight max-w-[200px]">GUANGZHOU MUSEUM OF ART SPECIAL RESEARCH</p>
            </header>
            <div className="grid grid-cols-2 gap-3">
              {RELICS.map(relic => (
                <div key={relic.id} className="group relative bg-white rounded-2xl overflow-hidden shadow-md active:scale-[0.97] transition-all border border-stone-100 cursor-pointer" onClick={() => handleOpenRelic(relic)}>
                  <div className="aspect-[3/4] overflow-hidden">
                    <ImageWithFallback assetKey={relic.id} cloudUrl={relic.imageUrl} alt={relic.title} className="w-full h-full object-cover" />
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
            <div className="w-full aspect-[4/5] relative bg-stone-100">
              <ImageWithFallback assetKey={selectedRelic.id} cloudUrl={selectedRelic.imageUrl} alt={selectedRelic.title} className="w-full h-full object-contain" />
              <button onClick={() => setCurrentPage(Page.GALLERY)} className="absolute top-4 left-4 w-10 h-10 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
              </button>
            </div>
            <div className="px-5 -mt-8 relative z-10 space-y-6">
              <div className="bg-white p-7 rounded-[2.5rem] shadow-2xl border border-stone-50">
                <div className="text-[10px] text-[#A7C438] font-black tracking-widest uppercase mb-1">{selectedRelic.dynasty} {selectedRelic.author}</div>
                <h1 className="text-3xl font-serif font-black text-gray-900">{selectedRelic.title}</h1>
                <p className="text-stone-500 mt-4 leading-relaxed text-sm font-medium">{selectedRelic.description}</p>
              </div>
              <NarrativePlayer 
                relicId={selectedRelic.id}
                versions={Object.values(AudienceType).map(t => ({ type: t, audioUrl: '', content: RELIC_NARRATIVES[selectedRelic.id]?.[t] || '' }))}
                selectedType={session.type}
                onComplete={() => setCurrentPage(Page.SURVEY)}
                onPlay={() => {}}
              />
            </div>
          </div>
        )}

        {currentPage === Page.SURVEY && (
          <div className="px-6 py-12 max-w-lg mx-auto flex flex-col justify-center min-h-[85vh]">
             <div className="text-center mb-8">
               <h2 className="text-2xl font-serif font-black text-gray-900">学术调研</h2>
               <div className="flex justify-center gap-1 mt-4">
                 {[0, 1, 2].map(step => (
                   <div key={step} className={`h-1 rounded-full transition-all ${surveyStep === step ? 'w-8 bg-[#CF4432]' : 'w-4 bg-stone-200'}`} />
                 ))}
               </div>
             </div>
             
             <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-stone-100 flex flex-col min-h-[400px]">
               {surveyStep === 0 && (
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="font-black text-xl text-stone-800 mb-8 text-center">1. 您对该解说词的满意程度？</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[1,2,3,4,5].map(v => (
                      <button key={v} onClick={() => { setEvaluation({...evaluation, satisfactionScore: v}); setSurveyStep(1); }} className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${evaluation.satisfactionScore === v ? 'border-[#CF4432] bg-[#CF4432] text-white' : 'border-stone-50 bg-stone-50 text-stone-400'}`}>
                        <span className="text-lg font-black">{v}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {surveyStep === 1 && (
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="font-black text-xl text-stone-800 mb-8 text-center">2. 该段解说词符合您的观众类型吗？</h3>
                  <div className="space-y-2">
                    {['完全符合', '比较符合', '一般符合', '比较不符合', '完全不符合'].map((label, idx) => (
                      <button key={idx} onClick={() => { setEvaluation({...evaluation, matchingScore: 5-idx}); setSurveyStep(2); }} className="w-full py-4 px-6 rounded-2xl border-2 border-stone-50 bg-stone-50 text-stone-600 font-black text-sm">
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {surveyStep === 2 && (
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="font-black text-xl text-stone-800 mb-10 text-center">3. 您愿意向朋友推荐该版本吗？</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => submitSurvey(1)} className="py-8 rounded-3xl border-2 border-stone-50 bg-stone-50 flex flex-col items-center justify-center hover:border-[#A7C438] transition-all">
                      <span className="text-4xl mb-2">👍</span>
                      <span className="text-lg font-black">是</span>
                    </button>
                    <button onClick={() => submitSurvey(0)} className="py-8 rounded-3xl border-2 border-stone-50 bg-stone-50 flex flex-col items-center justify-center hover:border-stone-300 transition-all">
                      <span className="text-4xl mb-2">👎</span>
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
              <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-[2.5rem] shadow-2xl text-center border border-stone-100">
                <h2 className="text-xl font-black text-gray-900 mb-6">管理人员身份验证</h2>
                <input type="password" placeholder="请输入密码" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full p-5 bg-stone-50 rounded-2xl text-center font-black outline-none mb-4 ring-2 ring-stone-50 focus:ring-[#CF4432] transition-all" />
                <button onClick={checkAdminPassword} className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black shadow-lg">确认进入</button>
              </div>
            ) : (
              <div>
                <button onClick={() => setIsAdminAuthenticated(false)} className="mb-4 text-xs font-bold text-stone-400 uppercase tracking-widest hover:text-[#CF4432]">退出管理</button>
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
