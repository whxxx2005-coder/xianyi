
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

// 使用更稳定的同步中转服务 (KV存储)
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

  getSyncCode: () => localStorage.getItem(STORAGE_KEYS.SYNC_CODE) || '',
  setSyncCode: (code: string) => localStorage.setItem(STORAGE_KEYS.SYNC_CODE, code),
  
  // 电脑端：发布资源
  pushToCloud: async (onProgress?: (msg: string) => void): Promise<void> => {
    const syncCode = storageService.getSyncCode();
    if (!syncCode) throw new Error('未设置同步码');

    onProgress?.('打包本地已上传资源...');
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
        onProgress?.(`转换资源格式: ${key}`);
        assets[key] = await blobToBase64(data);
      } else {
        assets[key] = data;
      }
    }

    onProgress?.('同步至云端 (可能需要数秒)...');
    await fetch(`${CLOUD_SYNC_API}${syncCode}`, {
      method: 'PUT',
      body: JSON.stringify(assets),
      headers: { 'Content-Type': 'application/json' }
    });
    onProgress?.('云端发布成功！手机端现可同步');
  },

  // 手机端：拉取资源
  performAutoSync: async (onProgress?: (msg: string) => void): Promise<void> => {
    const syncCode = storageService.getSyncCode();
    if (!syncCode) return;

    onProgress?.('连接云端同步库...');
    try {
      // 使用 cache: 'no-store' 确保手机拉取的是电脑刚刚发布的最新版
      const response = await fetch(`${CLOUD_SYNC_API}${syncCode}`, { cache: 'no-store' });
      
      if (response.status === 404) {
        onProgress?.('云端暂无数据，请先在电脑端点击“发布”。');
        await new Promise(r => setTimeout(r, 2000));
        return;
      }

      if (!response.ok) throw new Error('网络连接异常');
      
      const assets: Record<string, string> = await response.json();
      const keys = Object.keys(assets);
      
      onProgress?.(`正在下载 ${keys.length} 项最新资源...`);
      for (const key of keys) {
        const data = assets[key];
        if (data.startsWith('data:')) {
          const blob = await base64ToBlob(data);
          await storageService.saveAsset(key, blob);
        } else {
          await storageService.saveAsset(key, data);
        }
      }
      onProgress?.('同步成功：资源已完全加载');
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.error(e);
      onProgress?.('同步连接失败，请检查手机网络');
      await new Promise(r => setTimeout(r, 2000));
    }
  },

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
