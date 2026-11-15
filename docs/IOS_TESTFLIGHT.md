# QADA на iPhone через TestFlight

Сборка и загрузка выполняются автоматически в GitHub Actions (workflow **«iOS → TestFlight»**).
Mac не нужен. Нужно один раз подготовить аккаунт Apple и добавить 4 секрета в GitHub.

## 1. Аккаунт Apple Developer
1. Зарегистрируйтесь: https://developer.apple.com/programs/enroll/ ($99 в год). Проверка — от нескольких часов до 2 дней.
2. **Team ID**: https://developer.apple.com/account → **Membership details** → *Team ID* (10 символов, например `AB12CD34EF`).

## 2. Идентификатор приложения
https://developer.apple.com/account/resources/identifiers/list → **+** → *App IDs* → *App* →
- Description: `QADA`
- Bundle ID: **Explicit** → `com.ajyma.qada`
- Capabilities: ничего не отмечать → **Register**.

## 3. Приложение в App Store Connect
https://appstoreconnect.apple.com/apps → **+** → *New App*:
- Platforms: **iOS**
- Name: `QADA — Када намазы` (имя должно быть уникальным в App Store; если занято — например `QADA: Када намазы`)
- Primary Language: Russian
- Bundle ID: `com.ajyma.qada`
- SKU: `qada`
- User Access: Full Access → **Create**.

## 4. Ключ App Store Connect API
https://appstoreconnect.apple.com/access/integrations/api → вкладка **Team Keys** → **+** (Generate API Key):
- Name: `GitHub Actions`
- Access: **Admin** (нужен, чтобы Apple автоматически создала сертификат подписи)
- Нажмите **Download** — файл `AuthKey_XXXXXXXXXX.p8` можно скачать **только один раз**, сохраните его.
- Запишите **Key ID** (в строке ключа) и **Issuer ID** (над таблицей).

## 5. Секреты в GitHub
https://github.com/ajyma316-crypto/kada/settings/secrets/actions → **New repository secret** (4 штуки):

| Name | Значение |
|---|---|
| `APPLE_TEAM_ID` | Team ID из шага 1 |
| `ASC_KEY_ID` | Key ID из шага 4 |
| `ASC_ISSUER_ID` | Issuer ID из шага 4 |
| `ASC_KEY_P8` | всё содержимое файла `.p8`, включая строки `-----BEGIN PRIVATE KEY-----` и `-----END PRIVATE KEY-----` |

Ключ хранится в зашифрованных секретах GitHub и не попадает в код или журналы сборки.

## 6. Сборка
https://github.com/ajyma316-crypto/kada/actions/workflows/ios-testflight.yml → **Run workflow** → **Run workflow**.
Сборка занимает ~10–15 минут. Каждый запуск получает новый номер сборки автоматически.

## 7. Установка на iPhone
1. Через 5–30 минут сборка появится в App Store Connect → ваше приложение → **TestFlight**.
   При первом появлении может понадобиться ответить на вопрос о шифровании — в приложении он уже отмечен (используется только HTTPS).
2. **Internal Testing** → **+** → создайте группу, добавьте себя (и до 100 человек из команды).
   Для **External Testing** (до 10 000 человек по ссылке) Apple проводит короткую проверку (обычно 1 день).
3. На iPhone установите **TestFlight** из App Store и откройте приглашение из письма — установится QADA.

Сборки TestFlight работают 90 дней; новую версию загружает следующий запуск workflow.
