# Настройка Firebase Custom Claims и CORS

## 1. Настройка Custom Claims для управления ролями

Вместо хранения ролей в Firestore, теперь используются Firebase Custom Claims. Это более безопасный и производительный подход.

### Шаг 1: Создание Cloud Function для установки Custom Claims

Создайте файл `functions/setCustomClaims.js` в вашем проекте Firebase:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// HTTP функция для установки кастомных claims
exports.setCustomUserClaims = functions.https.onCall(async (data, context) => {
  // Проверка что вызывающий - админ
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Только администраторы могут устанавливать роли');
  }

  const { uid, role } = data;
  
  if (!['admin', 'employee'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Неверная роль');
  }

  // Установка custom claims
  await admin.auth().setCustomUserClaims(uid, {
    [role]: true
  });

  return {
    message: `Роль ${role} успешно установлена для пользователя ${uid}`
  };
});

// Функция для удаления всех claims
exports.removeCustomUserClaims = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Только администраторы могут изменять роли');
  }

  const { uid } = data;

  await admin.auth().setCustomUserClaims(uid, {});

  return {
    message: `Все роли удалены для пользователя ${uid}`
  };
});
```

### Шаг 2: Скрипт для назначения ролей через Firebase Admin SDK

Создайте скрипт `scripts/setUserRole.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('../path-to-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setUserRole(email, role) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    
    await admin.auth().setCustomUserClaims(user.uid, {
      [role]: true
    });
    
    console.log(`Роль ${role} успешно установлена для ${email}`);
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

// Пример использования:
// node scripts/setUserRole.js admin@example.com admin
const email = process.argv[2];
const role = process.argv[3];

if (email && role) {
  setUserRole(email, role);
} else {
  console.log('Использование: node scripts/setUserRole.js <email> <role>');
  console.log('Роли: admin, employee');
}
```

### Шаг 3: Обновление токена на клиенте

После установки Custom Claims, пользователь должен переподключиться для получения обновленного токена.

Добавьте в ваш код авторизации проверку и обновление токена:

```javascript
import { getAuth, getIdTokenResult } from 'firebase/auth';

const auth = getAuth();

// Функция для проверки и обновления токена
async function refreshUserToken() {
  const user = auth.currentUser;
  if (user) {
    const idTokenResult = await getIdTokenResult(user);
    console.log('Custom claims:', idTokenResult.claims);
    return idTokenResult.claims;
  }
  return null;
}
```

## 2. Настройка Authorized Domains в Firebase Console

### Шаг 1: Откройте Firebase Console

1. Перейдите на https://console.firebase.google.com/
2. Выберите ваш проект
3. Перейдите в **Authentication** → **Settings** → **Authorized domains**

### Шаг 2: Добавьте домены

Добавьте следующие домены:

- `localhost` (для локальной разработки)
- Ваш продакшен домен (например, `yourapp.vercel.app`)
- Любой другой домен, где будет работать приложение

### Шаг 3: Проверка CORS настроек

Для Firebase Functions добавьте CORS заголовки:

```javascript
const cors = require('cors')({ origin: true });

exports.yourFunction = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    // Ваша логика
  });
});
```

## 3. Применение правил Firestore

Разверните новые правила безопасности:

```bash
firebase deploy --only firestore:rules
```

## 4. Проверка работы

### Для администратора:

```javascript
// Назначить роль админа
await fetch('https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/setCustomUserClaims', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    uid: 'USER_UID',
    role: 'admin'
  })
});
```

### Для сотрудника:

```javascript
// Назначить роль сотрудника
await fetch('https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/setCustomUserClaims', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    uid: 'USER_UID',
    role: 'employee'
  })
});
```

## 5. Миграция существующих пользователей

Если у вас уже есть пользователи с ролями в Firestore, выполните миграцию:

```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

async function migrateUserRoles() {
  const usersSnapshot = await db.collection('users').get();
  
  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const email = doc.id;
    const role = userData.role;
    
    try {
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(user.uid, {
        [role]: true
      });
      console.log(`Мигрирован пользователь ${email} с ролью ${role}`);
    } catch (error) {
      console.error(`Ошибка миграции для ${email}:`, error);
    }
  }
}

migrateUserRoles();
```

## 6. Middleware защита (Next.js)

Middleware автоматически проверяет cookies `user_role` и `is_authenticated`:

- `/admin/*` - доступно только администраторам
- `/employee/*` - доступно сотрудникам и администраторам
- `/login` - перенаправляет авторизованных пользователей в зависимости от роли

## Важные замечания

1. **Custom Claims имеют лимит**: максимальный размер claims - 1000 байт
2. **Токен обновляется при переподключении**: после изменения claims пользователь должен выйти и зайти снова, или принудительно обновить токен
3. **Безопасность**: никогда не доверяйте клиентским данным для проверки прав доступа, всегда используйте серверную валидацию
