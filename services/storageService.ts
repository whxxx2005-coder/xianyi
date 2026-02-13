
import { Evaluation, PlaybackEvent, VisitorSession, AudienceType, AudienceTypeValue, QuizResult } from '../types.ts';

const STORAGE_KEYS = {
  SESSION: 'horse_exhibit_session',
  EVALUATIONS: 'horse_exhibit_evaluations',
  PLAYBACKS: 'horse_exhibit_playbacks',
  VIEWS: 'horse_exhibit_views',
  QUIZ_RESULTS: 'horse_exhibit_quiz_results'
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
