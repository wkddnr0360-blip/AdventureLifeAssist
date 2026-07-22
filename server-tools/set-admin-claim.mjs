import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'reader2-43b34';
const ADMIN_EMAIL = 'wkddnr0360@naver.com';
const remove = process.argv.includes('--remove');
const suppliedEmail = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const email = String(suppliedEmail || ADMIN_EMAIL).trim().toLowerCase();

if (email !== ADMIN_EMAIL) {
  throw new Error(`이 도구는 지정된 관리자 계정(${ADMIN_EMAIL})에만 사용할 수 있습니다.`);
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
const claims = { ...(user.customClaims || {}) };

if (remove) delete claims.admin;
else claims.admin = true;

await auth.setCustomUserClaims(user.uid, claims);
await auth.revokeRefreshTokens(user.uid);

console.log(JSON.stringify({
  ok: true,
  projectId: PROJECT_ID,
  uid: user.uid,
  email,
  admin: !remove,
  next: '대상 계정에서 로그아웃 후 다시 로그인해 새 ID 토큰을 발급받으세요.'
}, null, 2));
