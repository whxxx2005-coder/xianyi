
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

const ImageWithFallback = ({ assetKey, cloudUrl, alt, className, title }: { assetKey: string, cloudUrl: string, alt: string, className?: string, title?: string }) => {
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

  // 加载优先级：1. 同步数据库缓存 2. 项目本地 assets 文件夹 3. 传入的 cloudUrl 
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
  const [playedTypes, setPlayedTypes] = useState<AudienceTypeValue[]>([]);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  const [tempSyncCode, setTempSyncCode] = useState('');
  const [isSyncingFromHome, setIsSyncingFromHome] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  useEffect(() => {
    const syncCode = storageService.getSyncCode();
    if (syncCode) {
      storageService.performAutoSync();
    }
  }, []);

  const handleSyncFromHome = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (tempSyncCode === '123456') {
      setIsSyncingFromHome(true);
      storageService.setSyncCode(tempSyncCode);
      await storageService.performAutoSync(setSyncStatusMsg);
      setIsSyncingFromHome(false);
      setCurrentPage(Page.QUIZ);
    } else {
      alert('同步码错误。请输入 123456。');
    }
  };

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
    alert('感谢参与！数据已保存。');
  };

  const handleOpenRelic = (relic: Relic) => {
    setSelectedRelic(relic);
    setPlayedTypes([]);
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
          <div className="font-serif font-black text-[#D32F2F] tracking-tighter text-lg">鲜衣怒马少年时</div>
          <div className="flex gap-2 items-center">
            {session.type && (
              <div className="flex items-center gap-1.5 bg-[#A7C438]/10 px-2 py-0.5 rounded-full border border-[#A7C438]/20">
                <span className="text-xs">{(MBTI_PROFILES as any)[session.type].icon}</span>
                <span className="text-[10px] text-[#A7C438] font-black uppercase">{session.type}</span>
              </div>
            )}
            <button onClick={() => setCurrentPage(Page.ADMIN)} className="p-1.5 text-stone-200 hover:text-[#D32F2F] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </nav>
      )}

      <main className={currentPage === Page.POSTER ? "" : "pt-14"}>
        {currentPage === Page.POSTER && (
          <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-y-auto">
            {/* 上部：海报红色区域 */}
            <div className="relative flex-none bg-[#D32F2F] h-[50%] w-full flex flex-col px-8 pt-12 pb-6 text-white overflow-hidden">
               <div className="text-[10px] font-bold leading-tight opacity-90 z-10">廣州藝術博物院<br/>Guangzhou Museum of Art</div>
               <div className="absolute top-12 right-6 w-24 h-24 rounded-full border border-white/40 flex flex-col items-center justify-center text-white/80 scale-90 z-10">
                  <div className="text-[14px] font-black border-b border-white/30 mb-0.5 leading-none">2026</div>
                  <div className="text-[10px] font-black uppercase tracking-tight mt-1 text-center leading-none">Youth In<br/>Splendor</div>
               </div>
               <div className="flex-1 flex flex-col items-center justify-center text-center z-10">
                  <h1 className="text-7xl md:text-8xl font-serif font-black tracking-widest leading-none">鲜衣怒<span className="text-[#A7C438]">马</span></h1>
                  <h1 className="text-7xl md:text-8xl font-serif font-black tracking-widest leading-none mt-4">少年时</h1>
                  <p className="text-[9px] font-black tracking-[0.2em] uppercase opacity-70 mt-8 max-w-xs mx-auto">Steed-themed Special Exhibition</p>
                  <h2 className="text-xl md:text-2xl font-serif font-black mt-4 tracking-[0.4em]">骏马题材作品贺岁特展</h2>
               </div>
            </div>

            {/* 中部：装饰区域（替换为真实海报素材） */}
            <div className="relative flex-none h-[27%] w-full bg-[#F5F2EA] overflow-hidden border-y-2 border-white">
              <ImageWithFallback 
                assetKey="horses_deco" 
                cloudUrl="https://test.fukit.cn/autoupload/fr/Z0kP2aHjOyh4mYQwuvMqmUkZ6Uj704Ca6zDbmEjt8qyyl5f0KlZfm6UsKj-HyTuv/20260212/3zmC/2269X4026/9ba825bd7f08c479caf3fb1b19c52a4c.jpeg" 
                alt="鲜衣怒马少年时海报" 
                className="w-full h-full object-cover object-top opacity-90" 
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#D32F2F]/10 via-transparent to-white/10" />
            </div>

            {/* 底部：交互与资讯 */}
            <div className="flex-1 bg-white p-8 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 bg-[#D32F2F] shadow-sm rounded-sm" />
                    <span className="text-[9px] font-black text-stone-500">牡丹红</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 bg-[#A7C438] shadow-sm rounded-sm" />
                    <span className="text-[9px] font-black text-stone-500">鹦哥绿</span>
                  </div>
                </div>
                <div className="text-[8px] text-stone-400 font-bold uppercase tracking-wider text-right space-y-1">
                  <p>GUANGZHOU MUSEUM OF ART RESEARCH PROJECT</p>
                  <p>2026.01.22 - 2026.03.22</p>
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center gap-4">
                <form onSubmit={handleSyncFromHome} className="w-full max-w-sm flex gap-2">
                   <input 
                    type="text" 
                    value={tempSyncCode}
                    onChange={(e) => setTempSyncCode(e.target.value)}
                    placeholder="输入同步码 123456"
                    className="flex-1 bg-stone-100 border-2 border-transparent focus:border-[#D32F2F] rounded-2xl px-5 py-4 text-sm font-black outline-none transition-all placeholder:text-stone-300"
                  />
                  <button type="submit" className="bg-[#D32F2F] text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase shadow-xl active:scale-95">激活</button>
                </form>
                <div className="flex items-center gap-4 opacity-40">
                  <p className="text-[9px] font-black tracking-[0.3em] text-stone-400 uppercase">LOCAL ASSETS READY / DISCOVER MORE</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentPage === Page.QUIZ && (
          <div className="px-6 py-12 max-w-lg mx-auto">
            <div className="mb-14 text-center">
              <span className="text-[#D32F2F] font-black text-[10px] uppercase tracking-[0.4em] block mb-3">观众人格探索</span>
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
              <h3 className="text-[10px] font-black text-[#D32F2F] tracking-[0.4em] mb-3 uppercase">您的导览人格是</h3>
              <h2 className="text-4xl font-serif font-black mb-1">{session.type}</h2>
            </div>
            <div className="bg-stone-50 p-8 rounded-[2.5rem] mb-12 text-left">
              <h4 className="text-lg font-bold mb-3 text-[#A7C438]">{(MBTI_PROFILES as any)[session.type].title}</h4>
              <p className="text-stone-600 leading-relaxed text-sm font-medium">{(MBTI_PROFILES as any)[session.type].desc}</p>
            </div>
            <button onClick={() => setCurrentPage(Page.GALLERY)} className="w-full py-5 bg-[#D32F2F] text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all text-lg tracking-widest">进入虚拟展厅</button>
          </div>
        )}

        {currentPage === Page.GALLERY && (
          <div className="px-4 py-8 max-w-7xl mx-auto space-y-10">
            <header className="flex flex-col items-center text-center px-6">
              <div className="w-8 h-8 bg-[#D32F2F] rounded-lg flex items-center justify-center text-white text-lg mb-4">🐎</div>
              <h2 className="text-2xl font-serif font-black tracking-tight mb-2">展厅：鲜衣怒马少年时</h2>
              <p className="text-[9px] text-stone-400 font-bold uppercase tracking-[0.3em] font-bold leading-tight max-w-[200px]">GUANGZHOU MUSEUM OF ART SPECIAL RESEARCH</p>
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
              <button onClick={() => setCurrentPage(Page.SURVEY)} className="absolute top-4 left-4 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 shadow-lg">
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
                onPlay={(type) => {}}
              />
            </div>
          </div>
        )}

        {currentPage === Page.SURVEY && (
          <div className="px-6 py-12 max-w-lg mx-auto flex flex-col justify-center min-h-[85vh]">
             <div className="text-center mb-8">
               <h2 className="text-2xl font-serif font-black text-gray-900">听后感调研</h2>
               <div className="flex justify-center gap-1 mt-4">
                 {[0, 1, 2].map(step => (
                   <div key={step} className={`h-1 rounded-full transition-all ${surveyStep === step ? 'w-8 bg-[#D32F2F]' : 'w-4 bg-stone-200'}`} />
                 ))}
               </div>
             </div>
             
             <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-stone-100 flex flex-col min-h-[400px]">
               {surveyStep === 0 && (
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="font-black text-xl text-stone-800 mb-8 text-center">1. 您对该解说词的满意程度？</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[1,2,3,4,5].map(v => (
                      <button key={v} onClick={() => { setEvaluation({...evaluation, satisfactionScore: v}); setSurveyStep(1); }} className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${evaluation.satisfactionScore === v ? 'border-[#D32F2F] bg-[#D32F2F] text-white' : 'border-stone-50 bg-stone-50 text-stone-400'}`}>
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
              <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-[2.5rem] shadow-2xl text-center">
                <h2 className="text-xl font-black text-gray-900 mb-6">管理人员身份验证</h2>
                <input type="password" placeholder="请输入密码" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full p-5 bg-stone-50 rounded-2xl text-center font-black outline-none mb-4" />
                <button onClick={checkAdminPassword} className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black">确认进入</button>
              </div>
            ) : (
              <div>
                <button onClick={() => setIsAdminAuthenticated(false)} className="mb-4 text-xs font-bold text-stone-400">退出管理</button>
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
