
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList, Tooltip } from 'recharts';
import { storageService } from '../services/storageService.ts';
import { AudienceType, AudienceTypeValue, Evaluation, PlaybackEvent } from '../types.ts';
import { RELICS, QUIZ_QUESTIONS } from '../constants.tsx';

const COLORS = ['#CF4432', '#A7C438', '#2563EB', '#7C3AED', '#DB2777'];

const downloadCSV = (data: any[], filename: string, headers: string[]) => {
  if (data.length === 0) {
    alert('当前没有可导出的数据。');
    return;
  }
  const BOM = '\uFEFF';
  const csvRows = [headers.join(',')];
  data.forEach(item => {
    const values = headers.map(header => {
      const val = item[header] !== undefined ? item[header] : '';
      return `"${('' + val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });
  const blob = new Blob([BOM + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const DistributionChartBlock = ({ title, data, color }: any) => (
  <div className="space-y-4">
    <h3 className="text-xs font-black text-stone-400 uppercase text-center tracking-widest">{title}</h3>
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, bottom: 20 }}>
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: 'bold' }} />
          <Bar dataKey="val" fill={color} radius={[6, 6, 0, 0]} barSize={24}>
            <LabelList dataKey="val" position="top" style={{ fontSize: '10px', fontWeight: '900', fill: '#444' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const CombinationDistributions = ({ relicId, type, evaluations }: { relicId: string, type: AudienceTypeValue, evaluations: Evaluation[] }) => {
  const targetEvals = evaluations.filter(e => e.relicId === relicId && e.audienceType === type);
  const sDist = [1, 2, 3, 4, 5].map(v => ({ name: `${v}分`, val: targetEvals.filter(e => e.satisfactionScore === v).length }));
  const mDist = [1, 2, 3, 4, 5].map(v => ({ name: ['不符','较不','一般','比较','完全'][v-1], val: targetEvals.filter(e => e.matchingScore === v).length }));
  const rDist = [
    { name: '是', val: targetEvals.filter(e => e.recommendationScore === 1).length },
    { name: '否', val: targetEvals.filter(e => e.recommendationScore === 0).length }
  ];
  return (
    <>
      <DistributionChartBlock title="满意度分布 (1-5)" data={sDist} color="#CF4432" />
      <DistributionChartBlock title="符合度分布 (1-5)" data={mDist} color="#7C3AED" />
      <DistributionChartBlock title="推荐意愿 (是/否)" data={rDist} color="#2563EB" />
    </>
  );
};

const AssetRow = ({ title, sub, assetKey, exists, onUpload, onDelete }: any) => {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (exists && (assetKey === 'poster' || RELICS.some(r => r.id === assetKey))) {
      storageService.getAsset(assetKey).then(setPreview);
    } else {
      setPreview(null);
    }
  }, [exists, assetKey]);

  return (
    <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${exists ? 'bg-white border-[#A7C438]/30 shadow-sm' : 'bg-stone-50 border-stone-100'}`}>
      <div className="flex items-center gap-4">
        {preview ? (
          <div className="w-12 h-12 rounded-lg overflow-hidden border border-stone-100 shadow-sm flex-shrink-0">
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center text-stone-300 flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-xs font-black text-gray-800">{title}</span>
          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-tight">{sub}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {exists && (
          <button onClick={() => { if(confirm('确定要永久删除此资源吗？')) onDelete(assetKey); }} className="p-2 text-stone-300 hover:text-red-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        )}
        <div className="relative group">
          <input type="file" accept="image/*" onChange={(e) => onUpload(e, assetKey)} className="absolute inset-0 opacity-0 cursor-pointer" />
          <div className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${exists ? 'bg-[#A7C438]/10 text-[#A7C438] border border-[#A7C438]/20' : 'bg-stone-900 text-white shadow-sm'}`}>
            {exists ? '替换图片' : '上传图片'}
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stats' | 'assets'>('stats');
  const [assetSubTab, setAssetSubTab] = useState<'image' | 'audio'>('image');
  const [localAssetsExistence, setLocalAssetsExistence] = useState<Record<string, boolean>>({});
  const [selectedRelicId, setSelectedRelicId] = useState<string>(RELICS[1].id);
  const [selectedType, setSelectedType] = useState<AudienceTypeValue>(AudienceType.EXPLORER);

  const evaluations = storageService.getAllEvaluations();
  const quizResults = storageService.getAllQuizResults();
  
  const refreshAssets = () => { storageService.getAssetExistenceMap().then(setLocalAssetsExistence); };
  useEffect(() => { refreshAssets(); }, []);

  const quizStats = useMemo(() => {
    return QUIZ_QUESTIONS[0].options.map(opt => ({
      name: opt.label,
      count: quizResults.filter(r => r.optionLabel === opt.label).length
    }));
  }, [quizResults]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (file) {
      await storageService.saveAsset(key, file);
      refreshAssets();
      alert(`资源已安全保存至本地库：[${key}]`);
    }
  };

  const handleFileDelete = async (key: string) => {
    await storageService.deleteAsset(key);
    refreshAssets();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen pb-24">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">学术研究管理后台</h1>
          <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest mt-1">Research Data & Asset Management</p>
        </div>
        <div className="flex bg-stone-200 p-1 rounded-xl">
          <button onClick={() => setActiveTab('stats')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'stats' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>数据看板</button>
          <button onClick={() => setActiveTab('assets')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'assets' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>资源库管理</button>
        </div>
      </header>

      {activeTab === 'stats' && (
        <div className="space-y-10">
          <section className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
            <h2 className="text-xl font-black text-gray-900 mb-6">1. 观众画像测试分布</h2>
            <div className="h-48 w-full">
              <ResponsiveContainer>
                <BarChart data={quizStats} layout="vertical" margin={{ left: 20, right: 40 }}>
                  <CartesianGrid horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} style={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20}>
                    {quizStats.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                    <LabelList dataKey="count" position="right" style={{ fontSize: '11px', fontWeight: '900' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] border-2 border-stone-900 shadow-2xl">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
              <div className="space-y-6 flex-1 w-full">
                <h2 className="text-2xl font-black text-gray-900">2. 视角深度透视分析</h2>
                <div className="flex flex-wrap gap-2">
                  {RELICS.map(relic => (
                    <button key={relic.id} onClick={() => setSelectedRelicId(relic.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${selectedRelicId === relic.id ? 'bg-stone-900 text-white border-stone-900 shadow-lg' : 'bg-white text-stone-400 border-stone-50 hover:border-stone-200'}`}>{relic.title}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.values(AudienceType).map(type => (
                    <button key={type} onClick={() => setSelectedType(type)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${selectedType === type ? 'bg-[#CF4432] text-white border-[#CF4432] shadow-lg' : 'bg-white text-stone-400 border-stone-50 hover:border-stone-200'}`}>{type}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
               <CombinationDistributions relicId={selectedRelicId} type={selectedType} evaluations={evaluations} />
            </div>
          </section>
        </div>
      )}

      {activeTab === 'assets' && (
        <div className="bg-white rounded-[3rem] p-10 border border-stone-100 shadow-sm">
          <div className="flex justify-between items-center mb-12 border-b border-stone-50 pb-8">
            <h2 className="text-2xl font-black">资源库管理</h2>
            <div className="flex bg-stone-100 p-1 rounded-2xl">
              <button onClick={() => setAssetSubTab('image')} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${assetSubTab === 'image' ? 'bg-white shadow-sm text-[#CF4432]' : 'text-stone-400'}`}>图片资源</button>
              <button onClick={() => setAssetSubTab('audio')} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${assetSubTab === 'audio' ? 'bg-white shadow-sm text-[#CF4432]' : 'text-stone-400'}`}>讲解音频</button>
            </div>
          </div>
          
          <div className="space-y-4">
            {assetSubTab === 'image' ? (
              <div className="grid grid-cols-1 gap-3">
                <AssetRow 
                  title="首页入口海报 (System Poster)" 
                  sub="Key: poster" 
                  assetKey="poster" 
                  exists={localAssetsExistence['poster']} 
                  onUpload={handleFileUpload} 
                  onDelete={handleFileDelete}
                />
                <div className="h-px bg-stone-100 my-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {RELICS.map(relic => (
                    <AssetRow 
                      key={relic.id}
                      title={relic.title} 
                      sub={`ID: ${relic.id}`} 
                      assetKey={relic.id} 
                      exists={localAssetsExistence[relic.id]} 
                      onUpload={handleFileUpload} 
                      onDelete={handleFileDelete}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {RELICS.map(relic => (
                  <div key={relic.id} className="p-6 bg-stone-50 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 border border-stone-100">
                    <div className="flex flex-col items-center md:items-start">
                      <span className="text-sm font-black text-gray-800">{relic.title}</span>
                      <span className="text-[10px] text-stone-400 font-bold uppercase mt-1">Audio Packs</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      {Object.values(AudienceType).map(type => {
                        const audioKey = `audio_${relic.id}_${type}`;
                        const exists = localAssetsExistence[audioKey];
                        return (
                          <div key={type} className="flex flex-col items-center gap-2">
                            <label className={`relative w-12 h-12 flex items-center justify-center rounded-2xl border-2 transition-all cursor-pointer ${exists ? 'bg-white border-[#A7C438] text-[#A7C438] shadow-md' : 'bg-white border-dashed border-stone-200 text-stone-300 hover:border-stone-400'}`}>
                              <span className="text-[10px] font-black">{type[0]}</span>
                              {exists && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#A7C438] rounded-full border-2 border-white flex items-center justify-center text-white"><svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>}
                              <input type="file" className="hidden" accept="audio/*" onChange={(e) => handleFileUpload(e, audioKey)} />
                            </label>
                            <div className="flex items-center gap-1">
                               <span className="text-[8px] font-bold text-stone-400">{type}</span>
                               {exists && (
                                 <button onClick={() => { if(confirm('清除音频？')) handleFileDelete(audioKey); }} className="text-stone-300 hover:text-red-400 transition-colors">
                                   <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                 </button>
                               )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="mt-12 p-6 bg-amber-50 rounded-2xl border border-amber-100">
            <h4 className="text-amber-800 font-black text-xs mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              管理提示
            </h4>
            <p className="text-amber-700/80 text-[10px] font-medium leading-relaxed">
              1. 所有资源均保存在浏览器的本地数据库 (IndexedDB) 中，不会因刷新页面而丢失。<br/>
              2. 建议使用 Chrome 或 Edge 浏览器以获得最稳定的存储体验。<br/>
              3. 如需在多台设备间同步资源，请务必在每台设备上分别进行上传操作。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
