# 🔄 Налаштування автоматичного дзеркалювання Git-репозиторію

## 📋 Огляд

Цей документ містить повні інструкції з налаштування автоматичного дзеркалювання між:
- **Source**: `vdykimppua/share-sweet-brains`
- **Target**: `maxfraieho/garden-bloom`

---

## 🔑 Крок 1: Генерація SSH ключа

### 1.1 Створення нового SSH ключа ED25519 (без passphrase)

```bash
# Генерація SSH ключа ED25519 без passphrase для GitHub Actions
ssh-keygen -t ed25519 -C "github-actions-mirror" -f ~/.ssh/github_mirror_key -N ""
```

Це створить два файли:
- `~/.ssh/github_mirror_key` - приватний ключ (для GitHub Secrets)
- `~/.ssh/github_mirror_key.pub` - публічний ключ (для Deploy Keys)

### 1.2 Перегляд згенерованих ключів

```bash
# Приватний ключ (для копіювання в GitHub Secrets)
cat ~/.ssh/github_mirror_key

# Публічний ключ (для Deploy Keys)
cat ~/.ssh/github_mirror_key.pub
```

---

## 🔐 Крок 2: Налаштування Deploy Keys на GitHub

### 2.1 Source Repository (vdykimppua/share-sweet-brains)

1. Перейдіть до: `https://github.com/vdykimppua/share-sweet-brains/settings/keys`
2. Натисніть **"Add deploy key"**
3. Заповніть форму:
   - **Title**: `GitHub Actions Mirror - Read Access`
   - **Key**: Вставте вміст `~/.ssh/github_mirror_key.pub`
   - **Allow write access**: ❌ НЕ ставте галочку (тільки читання)
4. Натисніть **"Add key"**

### 2.2 Target Repository (maxfraieho/garden-bloom)

1. Перейдіть до: `https://github.com/maxfraieho/garden-bloom/settings/keys`
2. Натисніть **"Add deploy key"**
3. Заповніть форму:
   - **Title**: `GitHub Actions Mirror - Write Access`
   - **Key**: Вставте вміст `~/.ssh/github_mirror_key.pub`
   - **Allow write access**: ✅ ОБОВ'ЯЗКОВО поставте галочку (для запису)
4. Натисніть **"Add key"**

> ⚠️ **ВАЖЛИВО**: Один і той самий публічний ключ використовується для обох репозиторіїв, але з різними правами доступу.

---

## 🔒 Крок 3: Додавання Secrets до Source Repository

### 3.1 Генерація SSH_KNOWN_HOSTS

```bash
# Генерація known_hosts для GitHub
ssh-keyscan -H github.com > github_known_hosts.txt

# Перегляд вмісту для копіювання
cat github_known_hosts.txt
```

### 3.2 Додавання Secrets на GitHub

1. Перейдіть до: `https://github.com/vdykimppua/share-sweet-brains/settings/secrets/actions`
2. Натисніть **"New repository secret"**

#### Secret 1: SSH_PRIVATE_KEY

- **Name**: `SSH_PRIVATE_KEY`
- **Value**: Вставте ВЕСЬ вміст файлу `~/.ssh/github_mirror_key` (включно з рядками BEGIN і END)

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtz...
[весь вміст приватного ключа]
...AAAAAEC5lbm9uZQAAAAECAwQF
-----END OPENSSH PRIVATE KEY-----
```

Натисніть **"Add secret"**

#### Secret 2: SSH_KNOWN_HOSTS

- **Name**: `SSH_KNOWN_HOSTS`
- **Value**: Вставте вміст файлу `github_known_hosts.txt`

```
|1|AbC123...= ssh-rsa AAAAB3NzaC1yc2...
|1|XyZ789...= ecdsa-sha2-nistp256 AAAAE2VjZHNh...
|1|DeF456...= ssh-ed25519 AAAAC3NzaC1lZDI1NTE5...
```

Натисніть **"Add secret"**

### 3.3 Перевірка доданих Secrets

Після додавання ви побачите два secrets:
- ✅ `SSH_PRIVATE_KEY`
- ✅ `SSH_KNOWN_HOSTS`

---

## 📤 Крок 4: Завантаження Workflow файлу

### 4.1 Додавання файлу до репозиторію

```bash
# Переконайтеся, що ви в директорії source репозиторію
cd /path/to/share-sweet-brains

# Додавання workflow файлу
git add .github/workflows/mirror.yml

# Створення коміту
git commit -m "Add GitHub Actions workflow for automatic repository mirroring

- Auto-mirror to maxfraieho/garden-bloom on push/create/delete events
- SSH authentication with deploy keys
- Concurrency control to prevent parallel mirroring jobs"

# Відправка до GitHub
git push origin master
```

---

## 🚀 Крок 5: Перша синхронізація

### 5.1 Автоматичний запуск

Workflow автоматично запуститься після push коміту з файлом `mirror.yml`.

### 5.2 Ручний запуск (опціонально)

1. Перейдіть до: `https://github.com/vdykimppua/share-sweet-brains/actions`
2. Виберіть workflow **"Mirror Repository to Target"**
3. Натисніть **"Run workflow"** → **"Run workflow"**

### 5.3 Моніторинг виконання

1. Перейдіть до Actions: `https://github.com/vdykimppua/share-sweet-brains/actions`
2. Оберіть останній запуск workflow
3. Перегляньте логи кроків:
   - ✅ Checkout source repository
   - ✅ Setup SSH
   - ✅ Mirror to target repository
   - ✅ Cleanup

---

## ✅ Крок 6: Перевірка результатів

### 6.1 Перевірка target репозиторію

```bash
# Клонування target репозиторію для перевірки
git clone git@github.com:maxfraieho/garden-bloom.git
cd garden-bloom

# Перевірка всіх гілок
git branch -a

# Перевірка всіх тегів
git tag -l

# Перевірка останніх комітів
git log --oneline -10

# Порівняння з source репозиторієм
git remote add source git@github.com:vdykimppua/share-sweet-brains.git
git fetch source
git log --oneline --graph --all --decorate -20
```

### 6.2 Що очікувати після успішного дзеркалювання

✅ Всі гілки з source репозиторію скопійовані до target
✅ Всі теги скопійовані
✅ Вся історія комітів ідентична
✅ Refs синхронізовані

---

## 🧪 Крок 7: Тестування дзеркалювання

### 7.1 Тест 1: Push нового коміту

```bash
# В source репозиторії
cd /path/to/share-sweet-brains

# Створення тестового коміту
echo "Test mirror" >> test_mirror.txt
git add test_mirror.txt
git commit -m "Test: Mirror workflow verification"
git push origin master

# Очікування: GitHub Actions автоматично запуститься і задзеркалює зміни
# Перевірка через 1-2 хвилини в target репозиторії
```

### 7.2 Тест 2: Створення нової гілки

```bash
# В source репозиторії
git checkout -b feature/test-mirror
echo "Feature branch test" > feature_test.txt
git add feature_test.txt
git commit -m "Test: Feature branch mirroring"
git push origin feature/test-mirror

# Очікування: Нова гілка з'явиться в target репозиторії
```

### 7.3 Тест 3: Створення тегу

```bash
# В source репозиторії
git tag -a v1.0.0-mirror-test -m "Test tag for mirror verification"
git push origin v1.0.0-mirror-test

# Очікування: Тег з'явиться в target репозиторії
```

### 7.4 Перевірка результатів тестів

```bash
# В target репозиторії
cd /path/to/garden-bloom
git fetch --all

# Перевірка нового коміту
git log master --oneline -5

# Перевірка нової гілки
git branch -r | grep feature/test-mirror

# Перевірка тегу
git tag -l | grep v1.0.0-mirror-test
```

---

## 🔍 Troubleshooting

### Помилка: "Permission denied (publickey)"

**Причина**: Неправильно налаштовані SSH ключі або Deploy Keys.

**Рішення**:
1. Перевірте, що публічний ключ доданий як Deploy Key в обох репозиторіях
2. Переконайтеся, що для target репозиторію ввімкнено "Allow write access"
3. Перевірте, що приватний ключ правильно доданий в GitHub Secrets

### Помилка: "Host key verification failed"

**Причина**: Відсутній або невірний SSH_KNOWN_HOSTS.

**Рішення**:
```bash
# Перегенеруйте known_hosts
ssh-keyscan -H github.com > github_known_hosts.txt

# Оновіть secret SSH_KNOWN_HOSTS на GitHub
cat github_known_hosts.txt
```

### Workflow не запускається

**Причина**: Workflow файл може мати синтаксичні помилки.

**Рішення**:
1. Перевірте YAML синтаксис: `https://www.yamllint.com/`
2. Переконайтеся, що файл знаходиться в `.github/workflows/mirror.yml`
3. Перевірте права доступу до Actions в налаштуваннях репозиторію

### Дзеркалювання виконується повільно

**Причина**: Великий розмір репозиторію або багато refs.

**Рішення**: Це нормально для першого запуску. Наступні синхронізації будуть швидшими, оскільки передаються лише зміни.

---

## 📊 Моніторинг та обслуговування

### Регулярна перевірка

```bash
# Скрипт для автоматичної перевірки синхронізації
#!/bin/bash

echo "🔍 Checking repository sync status..."

# Клонування обох репозиторіїв
git clone git@github.com:vdykimppua/share-sweet-brains.git source_repo
git clone git@github.com:maxfraieho/garden-bloom.git target_repo

# Перевірка останніх комітів
cd source_repo
SOURCE_COMMIT=$(git rev-parse HEAD)
cd ../target_repo
TARGET_COMMIT=$(git rev-parse HEAD)

if [ "$SOURCE_COMMIT" == "$TARGET_COMMIT" ]; then
    echo "✅ Repositories are in sync!"
    echo "   Latest commit: $SOURCE_COMMIT"
else
    echo "⚠️  Repositories are OUT OF SYNC!"
    echo "   Source: $SOURCE_COMMIT"
    echo "   Target: $TARGET_COMMIT"
fi

# Очищення
cd ..
rm -rf source_repo target_repo
```

### Логи GitHub Actions

Регулярно переглядайте логи Actions для виявлення проблем:
`https://github.com/vdykimppua/share-sweet-brains/actions`

---

## 🔄 Альтернативний варіант: Використання готового Action

Якщо виникають проблеми з власною конфігурацією, можна використати готовий action:

```yaml
name: Mirror Repository

on:
  push:
    branches: ['**']
    tags: ['**']
  delete:
    branches: ['**']
    tags: ['**']

jobs:
  mirror:
    runs-on: ubuntu-latest
    steps:
      - uses: wearerequired/git-mirror-action@v1
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
        with:
          source-repo: git@github.com:vdykimppua/share-sweet-brains.git
          destination-repo: git@github.com:maxfraieho/garden-bloom.git
```

---

## 📝 Важливі примітки

1. **Безпека**: Ніколи не публікуйте приватні SSH ключі в коді або логах
2. **Concurrency**: Налаштований `concurrency group` запобігає конфліктам при одночасних push
3. **Повне дзеркалювання**: `--mirror` копіює ВСЕ (включно з видаленими гілками)
4. **Односторонність**: Зміни в target репозиторії НЕ синхронізуються назад до source
5. **Затримка**: Дзеркалювання відбувається через 10-30 секунд після push (залежно від завантаження GitHub Actions)

---

## 🎯 Висновок

Після виконання всіх кроків у вас буде:

✅ Автоматичне дзеркалювання при кожному push/create/delete
✅ Безпечна SSH аутентифікація через Deploy Keys
✅ Захист від паралельного виконання через concurrency groups
✅ Повна копія всіх гілок, тегів і історії
✅ Можливість ручного запуску через GitHub UI

**Успішного дзеркалювання! 🚀**
