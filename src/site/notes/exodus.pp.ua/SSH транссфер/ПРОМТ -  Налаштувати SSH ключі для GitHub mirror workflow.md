---
{"title":"ПРОМТ -  Налаштувати SSH ключі для GitHub mirror workflow","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/SSH транссфер/ПРОМТ -  Налаштувати SSH ключі для GitHub mirror workflow/","dgPassFrontmatter":true,"noteIcon":""}
---


## Контекст
Потрібно налаштувати mirror workflow між репозиторіями:
- Source: `vdykimppua/sweet-brains-share-ed5adc26`
- Target: `maxfraieho/garden-bloom`

## Частина 1: Додати Deploy Key в target репо

1. Відкрий https://github.com/maxfraieho/garden-bloom/settings/keys
2. Натисни кнопку "Add deploy key"
3. Заповни форму:
   - **Title:** `mirror-sweet-brains`
   - **Key:**
     ```
     ssh-ed25519 ****************************************** mirror-sweet-brains
     ```
   - **Allow write access:** УВІМКНУТИ (поставити галочку)
4. Натисни "Add key"
5. Переконайся, що ключ з'явився в списку

## Частина 2: Додати секрети в source репо

### Секрет 1: SSH_PRIVATE_KEY

1. Відкрий https://github.com/vdykimppua/sweet-brains-share-ed5adc26/settings/secrets/actions
2. Натисни "New repository secret"
3. Заповни:
   - **Name:** `SSH_PRIVATE_KEY`
   - **Secret:**
     ```
     -----BEGIN OPENSSH PRIVATE KEY-----
     *****************************
     -----END OPENSSH PRIVATE KEY-----
     ```
4. Натисни "Add secret"

### Секрет 2: SSH_KNOWN_HOSTS

1. На тій же сторінці натисни "New repository secret"
2. Заповни:
   - **Name:** `SSH_KNOWN_HOSTS`
   - **Secret:**
     ```
     github.com ssh-rsa A**************************     ```
1. Натисни "Add secret"

## Частина 3: Перевірити workflow

1. Відкрий https://github.com/vdykimppua/sweet-brains-share-ed5adc26/actions/workflows/mirror.yml
2. Натисни "Run workflow" (справа)
3. Вибери branch: `main`
4. Натисни зелену кнопку "Run workflow"
5. Дочекайся завершення і перевір, що статус ✅ (зелений)

## Критерії успіху
- [ ] Deploy key додано в `maxfraieho/garden-bloom` з write access
- [ ] Секрет `SSH_PRIVATE_KEY` додано в `sweet-brains-share-ed5adc26`
- [ ] Секрет `SSH_KNOWN_HOSTS` додано в `sweet-brains-share-ed5adc26`
- [ ] Workflow запущено і завершено успішно (зелена галочка)
