
import { Evaluation, PlaybackEvent, VisitorSession, AudienceType, AudienceTypeValue, QuizResult } from '../types.ts';

const STORAGE_KEYS = {
  SESSION: 'horse_exhibit_session',
  EVALUATIONS: 'horse_exhibit_evaluations',
  PLAYBACKS: 'horse_exhibit_playbacks',
  VIEWS: 'horse_exhibit_views',
  QUIZ_RESULTS: 'horse_exhibit_quiz_results',
  SYNC_CODE: 'horse_exhibit_sync_code',
};

const DB_NAME = 'HorseExhibitAssetsDB';
const STORE_NAME = 'assets';
const DB_VERSION = 2;

// 公共 KV 存储桶（仅用于研究演示同步，生产环境请更换为专用后端）
const CLOUD_SYNC_API = 'https://kvdb.io/A4r6u8N4W8hWfL5Z5Z5Z/'; 

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const base64ToBlob = async (base64: string): Promise<Blob> => {
  const res = await fetch(base64);
  return await res.blob();
};

export const storageService = {
  getOrCreateSession: (): VisitorSession => {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (stored) return JSON.parse(stored);
    const newSession: VisitorSession = {
      sessionId: crypto.randomUUID(),
      type: null,
      startedAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(newSession));
    return newSession;
  },

  updateSessionType: (type: AudienceTypeValue) => {
    const session = storageService.getOrCreateSession();
    session.type = type;
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  },

  // --- 资产管理 ---
  saveAsset: async (key: string, data: Blob | string): Promise<void> => {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  deleteAsset: async (key: string): Promise<void> => {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  getAsset: async (key: string): Promise<string | null> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (!result) return resolve(null);
        if (result instanceof Blob) {
          resolve(URL.createObjectURL(result));
        } else {
          resolve(result);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  getAssetExistenceMap: async (): Promise<Record<string, boolean>> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const results: Record<string, boolean> = {};
      const request = store.openKeyCursor();
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          results[cursor.key as string] = true;
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  // --- 云端同步核心 ---
  getSyncCode: () => localStorage.getItem(STORAGE_KEYS.SYNC_CODE) || '',
  setSyncCode: (code: string) => localStorage.setItem(STORAGE_KEYS.SYNC_CODE, code),
  
  // 管理员调用：将本地所有资源上传云端
  pushToCloud: async (onProgress?: (msg: string) => void): Promise<void> => {
    const syncCode = storageService.getSyncCode();
    if (!syncCode) throw new Error('未设置同步码');

    onProgress?.('准备打包本地资源...');
    const db = await getDB();
    const assets: Record<string, string> = {};
    
    const allKeys = await new Promise<string[]>((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result as string[]);
    });

    for (const key of allKeys) {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const data = await new Promise<any>((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
      });
      
      if (data instanceof Blob) {
        onProgress?.(`正在处理资源: ${key}`);
        assets[key] = await blobToBase64(data);
      } else {
        assets[key] = data;
      }
    }

    onProgress?.('正在上传至云端中转站...');
    await fetch(`${CLOUD_SYNC_API}${syncCode}`, {
      method: 'PUT',
      body: JSON.stringify(assets),
      headers: { 'Content-Type': 'application/json' }
    });
    onProgress?.('同步成功！资源已在云端激活');
  },

  // 访客调用：从云端拉取所有资源并存入本地
  performAutoSync: async (onProgress?: (msg: string) => void): Promise<void> => {
    const syncCode = storageService.getSyncCode();
    if (!syncCode) return;

    onProgress?.('正在连接研究员云端库...');
    try {
      const response = await fetch(`${CLOUD_SYNC_API}${syncCode}`);
      if (!response.ok) throw new Error('同步码未关联资源或网络错误');
      
      const assets: Record<string, string> = await response.json();
      const keys = Object.keys(assets);
      
      onProgress?.(`检测到 ${keys.length} 项资源，正在同步至本机...`);
      for (const key of keys) {
        const data = assets[key];
        if (data.startsWith('data:')) {
          const blob = await base64ToBlob(data);
          await storageService.saveAsset(key, blob);
        } else {
          await storageService.saveAsset(key, data);
        }
      }
      onProgress?.('同步完成：资源已就绪');
    } catch (e) {
      console.error(e);
      onProgress?.('同步失败：未找到云端资源包');
    }
  },

  // --- 数据统计 ---
  saveQuizResult: (result: QuizResult) => {
    const list = storageService.getAllQuizResults();
    list.push(result);
    localStorage.setItem(STORAGE_KEYS.QUIZ_RESULTS, JSON.stringify(list));
  },
  getAllQuizResults: (): QuizResult[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.QUIZ_RESULTS) || '[]'),
  saveEvaluation: (evaluation: Evaluation) => {
    const list = storageService.getAllEvaluations();
    list.push(evaluation);
    localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(list));
  },
  getAllEvaluations: (): Evaluation[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.EVALUATIONS) || '[]'),
  trackPlayback: (event: PlaybackEvent) => {
    const list = storageService.getAllPlaybacks();
    list.push(event);
    localStorage.setItem(STORAGE_KEYS.PLAYBACKS, JSON.stringify(list));
  },
  getAllPlaybacks: (): PlaybackEvent[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYBACKS) || '[]'),
  trackView: (relicId: string) => {
    const list = storageService.getAllViews();
    list.push({ relicId, timestamp: Date.now() });
    localStorage.setItem(STORAGE_KEYS.VIEWS, JSON.stringify(list));
  },
  getAllViews: (): { relicId: string; timestamp: number }[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.VIEWS) || '[]')
};
