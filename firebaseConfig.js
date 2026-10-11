import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAAm9xmnoinVRc9wr6JDO9Iowji5yf2DU',
  authDomain: 'avatarframeapp.firebaseapp.com',
  projectId: 'avatarframeapp',
  storageBucket: 'avatarframeapp.firebasestorage.app',
  messagingSenderId: '129885315679',
  appId: '1:129885315679:web:eba5e5f803031e6ef071ea',
  measurementId: 'G-CRW1P04RYK',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
