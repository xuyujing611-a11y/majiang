// src/firebase.js

// 1. 引入兼容版 Firebase (这样你原来的 db.collection 写法才能继续用)
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// 2. 你的配置信息 (从你原来的 index.html 里复制过来的)
const firebaseConfig = {
    apiKey: "AIzaSyA9XeyMA9a3568YTOdLLghosSB9rNkrMo4",
    authDomain: "sichuan-majiang.firebaseapp.com",
    projectId: "sichuan-majiang",
    storageBucket: "sichuan-majiang.firebasestorage.app",
    messagingSenderId: "900131444790",
    appId: "1:900131444790:web:491e5b57c69d06d27e6097",
    measurementId: "G-QPJSQ4ZVY2"
};

// 3. 初始化并导出
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 4. 把 auth 和 db 暴露出去，给其他文件用
export { auth, db };