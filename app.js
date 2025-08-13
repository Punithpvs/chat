/* app.js - P❤️S Chat (Firestore, Anonymous Auth, no Storage) */
/* Replace firebaseConfig with your project details */
const firebaseConfig = {
 apiKey: "AIzaSyBsEfun4555Y1TaBqxFEBz-7vmjKYcDCqg",
  authDomain: "ps-chat-5699a.firebaseapp.com",
  projectId: "ps-chat-5699a",
  storageBucket: "ps-chat-5699a.firebasestorage.app",
  messagingSenderId: "1087992118523",
  appId: "1:1087992118523:web:5ca154a66ca6a917fb845e"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

/* DOM refs */
const presenceEl = document.getElementById('presence');
const chatBody = document.getElementById('chatBody');
const messageBox = document.getElementById('messageBox');
const sendBtn = document.getElementById('sendBtn');

const videoBtn = document.getElementById('videoBtn');
const videoModal = document.getElementById('videoModal');
const localPreview = document.getElementById('localPreview');
const endVideo = document.getElementById('endVideo');

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

/* --- Auth --- */
auth.signInAnonymously().catch(console.error);
auth.onAuthStateChanged(u => {
  currentUser = u;
  presenceEl.textContent = u ? 'Online' : 'Offline';
});

/* --- Tabs --- */
tabChat.addEventListener('click', ()=> {
  tabChat.classList.add('active'); tabStatus.classList.remove('active');
  panelChat.classList.remove('hidden'); panelStatus.classList.add('hidden');
});
tabStatus.addEventListener('click', ()=> {
  tabStatus.classList.add('active'); tabChat.classList.remove('active');
  panelStatus.classList.remove('hidden'); panelChat.classList.add('hidden');
});

/* --- input placeholder --- */
messageBox.addEventListener('focus', ()=>{ if(messageBox.innerText.trim()==='Message') messageBox.innerText=''; });
messageBox.addEventListener('blur', ()=>{ if(messageBox.innerText.trim()==='') messageBox.innerText='Message'; });

/* --- send message --- */
async function sendMessage(){
  if(!currentUser) return alert('Still signing in...');
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
}

/* click and Enter key handling */
sendBtn.addEventListener('click', sendMessage);
messageBox.addEventListener('keydown', (e)=>{
  // send when user presses Enter (without Shift)
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    sendMessage();
  }
});

/* --- realtime listen + client-side deletion older than 24h --- */
db.collection('messages').orderBy('createdAt','asc').onSnapshot(async snap => {
  chatBody.innerHTML = '';
  const cutoff = Date.now() - DAY_MS;
  const deletions = [];

  snap.forEach(doc => {
    const data = doc.data();
    const t = data.createdAt ? data.createdAt.toDate().getTime() : 0;
    if(t && t < cutoff){
      deletions.push(doc.ref.delete().catch(()=>{}));
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'msg' + (currentUser && data.uid === currentUser.uid ? ' me' : '');
    const textHtml = data.text ? `<div class="body">${escapeHtml(data.text)}</div>` : '';
    const meta = `<div class="meta">${currentUser && data.uid === currentUser.uid ? 'Me' : 'User'} • ${fmtTime(data.createdAt)}</div>`;
    wrap.innerHTML = textHtml + meta;
    chatBody.appendChild(wrap);
  });

  if(deletions.length) Promise.allSettled(deletions);
  chatBody.scrollTop = chatBody.scrollHeight;
});

/* --- statuses (text + external image url) --- */
postStatusBtn.addEventListener('click', async ()=>{
  if(!currentUser) return alert('Signing in...');
  const text = statusText.value.trim();
  const img = statusImageUrl.value.trim() || null;
  if(!text && !img) return alert('Write something or add image URL');
  const now = firebase.firestore.Timestamp.now();
  const expiresAt = firebase.firestore.Timestamp.fromMillis(now.toMillis() + DAY_MS);
  await db.collection('statuses').add({
    uid: currentUser.uid,
    text: text || null,
    imageUrl: img || null,
    createdAt: now,
    expiresAt: expiresAt
  });
  statusText.value=''; statusImageUrl.value='';
});

/* listen statuses & client-delete after 24h */
db.collection('statuses').orderBy('createdAt','desc').onSnapshot(async snap=>{
  statusList.innerHTML = '';
  const cutoff = Date.now() - DAY_MS;
  const dels = [];
  snap.forEach(doc=>{
    const s = doc.data();
    const t = s.createdAt ? s.createdAt.toDate().getTime() : 0;
    if(t && t < cutoff){
      dels.push(doc.ref.delete().catch(()=>{}));
      return;
    }
    const card = document.createElement('div');
    card.className = 'status-card';
    const imgHtml = s.imageUrl ? `<img src="${escapeHtml(s.imageUrl)}" alt="status">` : '';
    const textHtml = s.text ? `<div class="text">${escapeHtml(s.text)}</div>` : '<div class="text" style="color:#666">No text</div>';
    card.innerHTML = (imgHtml || '') + textHtml;
    card.addEventListener('click', ()=>{
      modalMedia.innerHTML = s.imageUrl ? `<img src="${escapeHtml(s.imageUrl)}" style="max-width:100%;">` : '';
      modalCaption.textContent = s.text || '';
      statusModal.classList.remove('hidden');
    });
    statusList.appendChild(card);
  });
  if(dels.length) Promise.allSettled(dels);
});

/* modal close */
closeModal.addEventListener('click', ()=> statusModal.classList.add('hidden'));

/* helper functions */
function escapeHtml(s=''){ return s.replace(/[&<>"]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function fmtTime(ts){ if(!ts) return ''; return ts.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }

/* --- Video preview (local only) --- */
let localStream = null;
videoBtn.addEventListener('click', async ()=>{
  // open modal and start getUserMedia preview
  videoModal.classList.remove('hidden');
  try{
    localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    localPreview.srcObject = localStream;
    localPreview.play().catch(()=>{});
  }catch(e){
    alert('Cannot access camera/mic: ' + e.message);
  }
});
endVideo.addEventListener('click', ()=>{
  if(localStream){
    localStream.getTracks().forEach(t=>t.stop());
    localPreview.srcObject = null;
    localStream = null;
  }
  videoModal.classList.add('hidden');
});

/* accessibility: close video modal on Escape key */
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ videoModal.classList.add('hidden'); if(localStream){ localStream.getTracks().forEach(t=>t.stop()); localPreview.srcObject=null; localStream=null; } } });
