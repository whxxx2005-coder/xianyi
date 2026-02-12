
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

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stats' | 'assets'>('stats');
  const [statsMode, setStatsMode] = useState<'dashboard' | 'report'>('dashboard');
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
      alert(`资源 [${key}] 已更新`);
    }
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
              <button onClick={() => setAssetSubTab('image')} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${assetSubTab === 'image' ? 'bg-white shadow-sm text-[#CF4432]' : 'text-stone-400'}`}>图片</button>
              <button onClick={() => setAssetSubTab('audio')} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${assetSubTab === 'audio' ? 'bg-white shadow-sm text-[#CF4432]' : 'text-stone-400'}`}>音频</button>
            </div>
          </div>
          <div className="space-y-6">
            {assetSubTab === 'image' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 系统海报项 */}
                <div className="flex items-center justify-between p-5 bg-stone-100/50 rounded-2xl border-2 border-dashed border-stone-200">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-stone-800">首页入口海报 (System)</span>
                    <span className="text-[10px] font-bold text-[#CF4432] uppercase mt-1">Key: poster</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {localAssetsExistence['poster'] && <span className="text-[9px] bg-[#A7C438] text-white px-1.5 py-0.5 rounded font-black">已就绪</span>}
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'poster')} className="text-[10px] w-48" />
                  </div>
                </div>
                {/* 文物列表项 */}
                {RELICS.map(relic => (
                  <div key={relic.id} className="flex items-center justify-between p-5 bg-stone-50 rounded-2xl border border-stone-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-black">{relic.title}</span>
                      <span className="text-[10px] font-medium text-stone-400 uppercase mt-1">ID: {relic.id}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {localAssetsExistence[relic.id] && <span className="text-[9px] bg-[#A7C438] text-white px-1.5 py-0.5 rounded font-black">已就绪</span>}
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, relic.id)} className="text-[10px] w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {RELICS.map(relic => (
                  <div key={relic.id} className="p-6 bg-stone-50 rounded-[2rem] flex items-center justify-between">
                    <span className="text-sm font-black text-gray-800">{relic.title}</span>
                    <div className="flex gap-2">
                      {Object.values(AudienceType).map(type => (
                        <label key={type} className="group relative w-10 h-10 flex flex-col items-center justify-center rounded-xl border-2 bg-white text-stone-300 cursor-pointer hover:border-[#CF4432] transition-colors">
                          <span className={`text-[9px] font-black ${localAssetsExistence[`audio_${relic.id}_${type}`] ? 'text-[#A7C438]' : ''}`}>
                            {type[0]}
                          </span>
                          {localAssetsExistence[`audio_${relic.id}_${type}`] && (
                             <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#A7C438] rounded-full border-2 border-white shadow-sm" />
                          )}
                          <input type="file" className="hidden" accept="audio/*" onChange={(e) => handleFileUpload(e, `audio_${relic.id}_${type}`)} />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
