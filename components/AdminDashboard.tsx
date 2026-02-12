
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList, Tooltip } from 'recharts';
import { storageService } from '../services/storageService';
import { AudienceType, AudienceTypeValue, Evaluation, PlaybackEvent } from '../types';
import { RELICS, QUIZ_QUESTIONS } from '../constants';

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
      const escaped = ('' + val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  });
  
  const csvString = BOM + csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const CombinationDistributions = ({ relicId, type, evaluations }: { relicId: string, type: AudienceTypeValue, evaluations: Evaluation[] }) => {
  const targetEvals = evaluations.filter(e => e.relicId === relicId && e.audienceType === type);
  
  const sDist = [1, 2, 3, 4, 5].map(v => ({ 
    name: `${v}分`, 
    val: targetEvals.filter(e => e.satisfactionScore === v).length 
  }));

  const mDist = [1, 2, 3, 4, 5].map(v => ({ 
    name: ['不符','较不','一般','比较','完全'][v-1], 
    val: targetEvals.filter(e => e.matchingScore === v).length 
  }));

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

const CombinationReportCard = ({ relicTitle, type, evaluations }: any) => {
  const data = useMemo(() => {
    const s = [1, 2, 3, 4, 5].map(v => ({ name: `${v}分`, val: evaluations.filter((e: any) => e.satisfactionScore === v).length }));
    const m = [1, 2, 3, 4, 5].map(v => ({ name: ['不符','较不','一般','比较','完全'][v-1], val: evaluations.filter((e: any) => e.matchingScore === v).length }));
    const r = [{ name: '是', val: evaluations.filter((e: any) => e.recommendationScore === 1).length }, { name: '否', val: evaluations.filter((e: any) => e.recommendationScore === 0).length }];
    return { s, m, r, n: evaluations.length };
  }, [evaluations]);

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm mb-6 break-inside-avoid">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-black text-gray-900 leading-tight">{relicTitle}</h3>
          <p className="text-[9px] text-[#CF4432] font-black uppercase mt-1 tracking-tighter">{type}</p>
        </div>
        <div className="text-[10px] font-black text-stone-300">n={data.n}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 h-28">
        <MiniChart title="满意度" data={data.s} color="#CF4432" />
        <MiniChart title="符合度" data={data.m} color="#7C3AED" />
        <MiniChart title="推荐" data={data.r} color="#2563EB" />
      </div>
    </div>
  );
};

const MiniChart = ({ title, data, color }: any) => (
  <div className="flex flex-col h-full">
    <div className="text-[7px] font-black text-stone-300 text-center uppercase mb-1 tracking-tighter">{title}</div>
    <div className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, bottom: 12, left: 0, right: 0 }}>
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            interval={0}
            style={{ fontSize: '6px', fontWeight: 'bold', fill: '#bbb' }} 
          />
          <Bar dataKey="val" fill={color} radius={[1, 1, 0, 0]}>
            <LabelList 
              dataKey="val" 
              position="top" 
              style={{ fontSize: '7px', fontWeight: '900', fill: '#666' }} 
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stats' | 'assets'>('stats');
  const [statsMode, setStatsMode] = useState<'dashboard' | 'report'>('dashboard');
  const [assetSubTab, setAssetSubTab] = useState<'image' | 'audio'>('image');
  const [localAssetsExistence, setLocalAssetsExistence] = useState<Record<string, boolean>>({});
  
  const [selectedRelicId, setSelectedRelicId] = useState<string>(RELICS[1].id);
  const [selectedType, setSelectedType] = useState<AudienceTypeValue>(AudienceType.EXPLORER);

  const evaluations = storageService.getAllEvaluations();
  const quizResults = storageService.getAllQuizResults();
  const playbacks = storageService.getAllPlaybacks();

  const refreshAssets = () => {
    storageService.getAssetExistenceMap().then(setLocalAssetsExistence);
  };

  useEffect(() => {
    refreshAssets();
  }, []);

  const quizStats = useMemo(() => {
    return QUIZ_QUESTIONS[0].options.map(opt => ({
      name: opt.label,
      type: opt.type,
      count: quizResults.filter(r => r.optionLabel === opt.label).length
    }));
  }, [quizResults]);

  const playbackStats = useMemo(() => {
    const data: any[] = [];
    RELICS.forEach(relic => {
      Object.values(AudienceType).forEach(type => {
        const events = playbacks.filter(p => p.relicId === relic.id && p.narrativeType === type);
        const completedCount = events.filter(e => e.isCompleted).length;
        const totalStarts = events.filter(e => !e.isCompleted).length;
        const completionRate = totalStarts > 0 ? (completedCount / totalStarts) * 100 : 0;

        data.push({
          fullName: `${relic.title}+${type}`,
          relic: relic.title,
          type: type,
          count: totalStarts,
          completionRate: parseFloat(completionRate.toFixed(1))
        });
      });
    });
    return data;
  }, [playbacks]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (file) {
      await storageService.saveAsset(key, file);
      refreshAssets();
    }
  };

  const handleExportQuizData = () => {
    const data = quizResults.map(r => ({
      'ID': r.id,
      '会话ID': r.sessionId,
      '分配类型': r.selectedType,
      '选择项文本': r.optionLabel,
      '提交时间': new Date(r.timestamp).toLocaleString()
    }));
    downloadCSV(data, '画像测试原始数据', ['ID', '会话ID', '分配类型', '选择项文本', '提交时间']);
  };

  const handleExportEvaluationData = () => {
    const data = evaluations.map(e => {
      const relic = RELICS.find(r => r.id === e.relicId);
      return {
        'ID': e.id,
        '会话ID': e.sessionId,
        '文物名称': relic?.title || '未知',
        '观众类型': e.audienceType,
        '满意度评分': e.satisfactionScore,
        '符合度评分': e.matchingScore,
        '推荐意愿': e.recommendationScore === 1 ? '是' : '否',
        '提交时间': new Date(e.timestamp).toLocaleString()
      };
    });
    downloadCSV(data, '讲解评价原始数据', ['ID', '会话ID', '文物名称', '观众类型', '满意度评分', '符合度评分', '推荐意愿', '提交时间']);
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
          <div className="flex items-center justify-between bg-white px-6 py-4 rounded-3xl border border-stone-100 shadow-sm">
             <div className="flex items-center gap-3">
               <div className={`w-3 h-3 rounded-full ${statsMode === 'dashboard' ? 'bg-[#A7C438]' : 'bg-stone-200'}`} />
               <span className="text-xs font-black text-gray-900 uppercase">统计模式</span>
             </div>
             <div className="flex bg-stone-100 p-1 rounded-xl">
               <button onClick={() => setStatsMode('dashboard')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${statsMode === 'dashboard' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-400'}`}>交互式看板</button>
               <button onClick={() => setStatsMode('report')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${statsMode === 'report' ? 'bg-[#CF4432] text-white shadow-md' : 'text-stone-400'}`}>全量报告</button>
             </div>
          </div>

          {statsMode === 'dashboard' ? (
            <>
              <section className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-gray-900">1. 观众画像测试分布</h2>
                  <button onClick={handleExportQuizData} className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-[#A7C438] hover:text-white rounded-lg transition-all text-[10px] font-black uppercase text-stone-600">下载原始数据</button>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer>
                    <BarChart data={quizStats} layout="vertical" margin={{ left: 20, right: 40 }}>
                      <CartesianGrid horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} style={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20}>
                        {quizStats.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        <LabelList dataKey="count" position="right" style={{ fontSize: '11px', fontWeight: '900' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
              </section>

              <section className="bg-white p-10 rounded-[3rem] border-2 border-stone-900 shadow-2xl overflow-hidden">
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
                  <div className="bg-stone-50 p-8 rounded-3xl text-right min-w-[160px] border border-stone-100">
                    <div className="text-6xl font-black text-gray-900 tabular-nums leading-none">{evaluations.filter(e => e.relicId === selectedRelicId && e.audienceType === selectedType).length}</div>
                    <div className="text-[10px] font-black text-stone-400 uppercase mt-3 tracking-widest">样本量 (n)</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                   <CombinationDistributions relicId={selectedRelicId} type={selectedType} evaluations={evaluations} />
                </div>
              </section>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {RELICS.map(relic => 
                Object.values(AudienceType).map(type => (
                  <CombinationReportCard 
                    key={`${relic.id}-${type}`}
                    relicTitle={relic.title}
                    type={type}
                    evaluations={evaluations.filter(e => e.relicId === relic.id && e.audienceType === type)}
                  />
                ))
              )}
            </div>
          )}
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
                <AssetRow label="海报" hasAsset={!!localAssetsExistence['poster']} onUpload={(e) => handleFileUpload(e, 'poster')} />
                {RELICS.map(relic => (
                  <AssetRow key={relic.id} label={relic.title} hasAsset={!!localAssetsExistence[relic.id]} onUpload={(e) => handleFileUpload(e, relic.id)} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {RELICS.map(relic => (
                  <div key={relic.id} className="p-6 bg-stone-50 rounded-[2rem] flex items-center justify-between">
                    <span className="text-sm font-black text-gray-800">{relic.title}</span>
                    <div className="flex gap-2">
                      {Object.values(AudienceType).map(type => {
                        const key = `audio_${relic.id}_${type}`;
                        const exists = !!localAssetsExistence[key];
                        return (
                          <label key={type} className={`w-10 h-10 flex flex-col items-center justify-center rounded-xl border-2 cursor-pointer transition-all ${exists ? 'bg-[#A7C438] text-white border-[#A7C438]' : 'bg-white text-stone-300 border-stone-100 hover:border-stone-200'}`}>
                            <span className="text-[9px] font-black">{type[0]}</span>
                            <input type="file" className="hidden" accept="audio/*" onChange={(e) => handleFileUpload(e, key)} />
                          </label>
                        );
                      })}
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

const AssetRow = ({ label, hasAsset, onUpload }: any) => (
  <div className="flex items-center justify-between p-5 bg-stone-50 rounded-2xl border border-stone-100">
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${hasAsset ? 'bg-[#A7C438]' : 'bg-stone-200'}`} />
      <span className="text-xs font-black text-gray-700">{label}</span>
    </div>
    <label className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-[10px] font-black text-stone-600 cursor-pointer hover:bg-stone-50 transition-colors">
      {hasAsset ? '重传' : '上传'}
      <input type="file" className="hidden" accept="image/*" onChange={onUpload} />
    </label>
  </div>
);

export default AdminDashboard;
