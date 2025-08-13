/* ====== Replace firebaseConfig below with your project's config ====== */
const firebaseConfig = {
   apiKey: "AIzaSyBsEfun4555Y1TaBqxFEBz-7vmjKYcDCqg",
  authDomain: "ps-chat-5699a.firebaseapp.com",
  projectId: "ps-chat-5699a",
  storageBucket: "ps-chat-5699a.firebasestorage.app",
  messagingSenderId: "1087992118523",
  appId: "1:1087992118523:web:5ca154a66ca6a917fb845e"

};
/* ==================================================================== */

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* DOM refs */
const presenceEl = document.getElementById('presence');
const chatBody = document.getElementById('chatBody');
const messageBox = document.getElementById('messageBox');
const sendBtn = document.getElementById('sendBtn');

const tabChat = document.getElementById('tabChat');
const tabStatus = document.getElementById('tabStatus');
const panelChat = document.getElementById('panelChat');
const panelStatus = document.getElementById('panelStatus');

const statusText = document.getElementById('statusText');
const statusImageUrl = document.getElementById('statusImageUrl');
const postStatusBtn = document.getElementById('postStatusBtn');
const statusList = document.getElementById('statusList');

const statusModal = document.getElementById('statusModal');
const modalMedia = document.getElementById('modalMedia');
const modalCaption = document.getElementById('modalCaption');
const closeModal = document.getElementById('closeModal');

let currentUser = null;
const DAY_MS = 24 * 60 * 60 * 1000;

/* --- Auth (anonymous) --- */
auth.signInAnonymously().catch(console.error);
auth.onAuthStateChanged(u => {
  currentUser = u;
  presenceEl.textContent = u ? 'Online' : 'Offline';
});

/* --- Tabs --- */
tabChat.addEventListener('click', ()=> { tabChat.classList.add('active'); tabStatus.classList.remove('active'); panelChat.classList.remove('hidden'); panelStatus.classList.add('hidden'); });
tabStatus.addEventListener('click', ()=> { tabStatus.classList.add('active'); tabChat.classList.remove('active'); panelStatus.classList.remove('hidden'); panelChat.classList.add('hidden'); });

/* --- input placeholder behavior --- */
messageBox.addEventListener('focus', ()=>{ if(messageBox.innerText.trim()==='Message') messageBox.innerText=''; });
messageBox.addEventListener('blur',  ()=>{ if(messageBox.innerText.trim()==='') messageBox.innerText='Message'; });

/* --- helper to format time --- */
function fmtTime(ts){
  if(!ts) return '';
  return ts.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

/* --- render message --- */
function renderMessage(docData, mine=false){
  const wrap = document.createElement('div');
  wrap.className = 'msg' + (mine ? ' me' : '');
  const text = docData.text ? `<div class="body">${escapeHtml(docData.text)}</div>` : '';
  wrap.innerHTML = `${text}<div class="meta">${mine ? 'Me' : 'User'} • ${fmtTime(docData.createdAt)}</div>`;
  chatBody.appendChild(wrap);
  chatBody.scrollTop = chatBody.scrollHeight;
}

/* escape */
function escapeHtml(s=''){ return s.replace(/[&<>"]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* --- send message with createdAt and expiresAt --- */
sendBtn.addEventListener('click', async () => {
  if(!currentUser) return;
  const raw = messageBox.innerText.trim();
  if(!raw || raw==='Message') return;

  const now = firebase.firestore.Timestamp.now();
  const expiresAt = firebase.firestore.Timestamp.fromMillis(now.toMillis() + DAY_MS);

  await db.collection('messages').add({
    uid: currentUser.uid,
    text: raw,
    createdAt: now,
    expiresAt: expiresAt
  });

  messageBox.innerText = 'Message';
});

/* --- listen chat and client-side delete older than 24h --- */
db.collection('messages')
  .orderBy('createdAt','asc')
  .onSnapshot(async snap => {
    chatBody.innerHTML = '';
    const cutoff = Date.now() - DAY_MS;
    const deletions = [];

    snap.forEach(doc => {
      const data = doc.data();
      const t = data.createdAt ? data.createdAt.toDate().getTime() : 0;
      if(t && t < cutoff){
        // schedule deletion
        deletions.push(doc.ref.delete().catch(()=>{}));
        return;
      }
      renderMessage(data, currentUser && data.uid === currentUser.uid);
    });

    if(deletions.length) Promise.allSettled(deletions);
  });

/* ================== Statuses (Firestore only) ================== */
/* Post a status (text + optional external image URL). Stored in 'statuses' collection */
postStatusBtn.addEventListener('click', async () => {
  if(!currentUser) return;
  const text = statusText.value.trim();
  const img = statusImageUrl.value.trim() || null;
  if(!text && !img){ alert('Write something or paste an image URL'); return; }

  const now = firebase.firestore.Timestamp.now();
  const expiresAt = firebase.firestore.Timestamp.fromMillis(now.toMillis() + DAY_MS);

  await db.collection('statuses').add({
    uid: currentUser.uid,
    text: text || null,
    imageUrl: img || null,
    createdAt: now,
    expiresAt: expiresAt
  });

  statusText.value = '';
  statusImageUrl.value = '';
});

/* Render status card */
function renderStatusCard(docData, docRef){
  const card = document.createElement('div');
  card.className = 'status-card';

  const imgHtml = docData.imageUrl ? `<img src="${escapeHtml(docData.imageUrl)}" alt="status image">` : '';
  const textHtml = docData.text ? `<div class="text">${escapeHtml(docData.text)}</div>` : '<div class="text" style="color:#666">No text</div>';

  card.innerHTML = `${imgHtml}<div class="text">${textHtml}</div>`;
  card.addEventListener('click', ()=>{
    // open modal to view full
    modalMedia.innerHTML = docData.imageUrl ? `<img src="${escapeHtml(docData.imageUrl)}" style="max-width:100%;">` : '';
    modalCaption.textContent = docData.text || '';
    statusModal.classList.remove('hidden');
  });

  statusList.appendChild(card);
}

/* Statuses listener + client-side deletion older than 24h */
db.collection('statuses').orderBy('createdAt','desc')
  .onSnapshot(async snap => {
    statusList.innerHTML = '';
    const cutoff = Date.now() - DAY_MS;
    const deletions = [];

    snap.forEach(doc => {
      const data = doc.data();
      const t = data.createdAt ? data.createdAt.toDate().getTime() : 0;
      if(t && t < cutoff){
        deletions.push(doc.ref.delete().catch(()=>{}));
        return;
      }
      renderStatusCard(data, doc.ref);
    });

    if(deletions.length) Promise.allSettled(deletions);
  });

/* modal close */
closeModal.addEventListener('click', ()=> statusModal.classList.add('hidden'));

/* ===== Helpful dev firestore rules (use in console for testing) =====
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /messages/{msgId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete, update: if request.auth != null && request.auth.uid == resource.data.uid;
    }
    match /statuses/{stId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete, update: if request.auth != null && request.auth.uid == resource.data.uid;
    }
  }
}
===================================================================== */
