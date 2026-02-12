
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

  // --- 资产管理（跨设备同步核心） ---
  saveAsset: async (key: string, data: Blob | string): Promise<void> => {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // 模拟将资源标记为“已上传云端”
    const syncCode = storageService.getSyncCode();
    if (syncCode) {
      console.log(`[CloudSync] 资源 [${key}] 已上传至研究员云端库 (Code: ${syncCode})`);
    }
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

  // --- 跨设备同步逻辑 ---
  getSyncCode: () => localStorage.getItem(STORAGE_KEYS.SYNC_CODE) || '',
  setSyncCode: (code: string) => localStorage.setItem(STORAGE_KEYS.SYNC_CODE, code),
  
  performAutoSync: async (onProgress?: (msg: string) => void): Promise<void> => {
    const syncCode = storageService.getSyncCode();
    if (!syncCode) return;

    onProgress?.('正在连接研究员云端库...');
    await new Promise(r => setTimeout(r, 600));
    
    // 在真实应用中，这里会 fetch 一个 manifest.json，获取当前同步码关联的所有资产 URL
    onProgress?.('正在检索定制图片与音频资产...');
    await new Promise(r => setTimeout(r, 800));

    // 检查本地 IndexedDB 的完整性
    const existence = await storageService.getAssetExistenceMap();
    const assetsCount = Object.keys(existence).length;
    
    if (assetsCount > 0) {
      onProgress?.(`检测到 ${assetsCount} 项资源，正在同步更新...`);
      await new Promise(r => setTimeout(r, 600));
    } else {
      onProgress?.('正在初次激活该展厅的多媒体包...');
      await new Promise(r => setTimeout(r, 1000));
    }
    
    onProgress?.('同步完成：资源已就绪');
    await new Promise(r => setTimeout(r, 400));
  },

  // --- 数据统计 ---
  saveQuizResult: (result: QuizResult) => {
    const stored = localStorage.getItem(STORAGE_KEYS.QUIZ_RESULTS);
    const list = stored ? JSON.parse(stored) : [];
    list.push(result);
    localStorage.setItem(STORAGE_KEYS.QUIZ_RESULTS, JSON.stringify(list));
  },
  getAllQuizResults: (): QuizResult[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.QUIZ_RESULTS) || '[]'),
  saveEvaluation: (evaluation: Evaluation) => {
    const stored = localStorage.getItem(STORAGE_KEYS.EVALUATIONS);
    const list = stored ? JSON.parse(stored) : [];
    list.push(evaluation);
    localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(list));
  },
  getAllEvaluations: (): Evaluation[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.EVALUATIONS) || '[]'),
  trackPlayback: (event: PlaybackEvent) => {
    const stored = localStorage.getItem(STORAGE_KEYS.PLAYBACKS);
    const list = stored ? JSON.parse(stored) : [];
    list.push(event);
    localStorage.setItem(STORAGE_KEYS.PLAYBACKS, JSON.stringify(list));
  },
  getAllPlaybacks: (): PlaybackEvent[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYBACKS) || '[]'),
  trackView: (relicId: string) => {
    const stored = localStorage.getItem(STORAGE_KEYS.VIEWS);
    const list = stored ? JSON.parse(stored) : [];
    list.push({ relicId, timestamp: Date.now() });
    localStorage.setItem(STORAGE_KEYS.VIEWS, JSON.stringify(list));
  },
  getAllViews: (): { relicId: string; timestamp: number }[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.VIEWS) || '[]')
};
