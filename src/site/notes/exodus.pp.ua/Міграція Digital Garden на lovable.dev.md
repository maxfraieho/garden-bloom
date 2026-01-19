---
{"title":"Міграція Digital Garden на lovable.dev","dg-publish":true,"dg-metatags":null,"dg-home":true,"permalink":"/exodus.pp.ua/Міграція Digital Garden на lovable.dev/","tags":["gardenEntry"],"dgPassFrontmatter":true,"noteIcon":""}
---


# **Стратегічний Майстер-План: Архітектурна трансформація та міграція Digital Garden на AI-Native екосистему Lovable.dev**

## **1\. Виконавче резюме та стратегічна візія**

Цей документ є вичерпним архітектурним звітом, розробленим для технічних лідерів та архітекторів систем, що деталізує стратегію переходу від статичної моделі публікації знань (Static Site Generation — SSG) до динамічної, керованої штучним інтелектом архітектури на платформі Lovable.dev. У ролі Lead AI Systems Architect, проведено глибокий аналіз існуючого стеку (Obsidian/11ty/Cloudflare) та розроблено цільову архітектуру, що базується на генеративному підході до розробки інтерфейсів та серверної логіки.

Трансформація "Digital Garden" (Цифрового саду) з набору статичних файлів у живу, інтерактивну систему має на меті вирішення фундаментальних обмежень поточної архітектури: відсутності динамічної авторизації, складності реалізації семантичного пошуку та неможливості інтерактивної взаємодії з графом знань у реальному часі. Використання Lovable.dev дозволяє абстрагуватися від низькорівневого кодингу, зосередившись на бізнес-логіці та архітектурі даних, використовуючи природну мову як основний інструмент оркестрації розробки.1

### **1.1. Парадигмальний зсув: Від "File-Based" до "Vector-Native"**

Існуюча система покладається на файлову систему як на базу даних, де зв'язки (wikilinks) існують лише як текстові посилання, що обробляються під час білду. Цільова архітектура передбачає перехід до реляційно-векторної моделі (PostgreSQL \+ pgvector), де кожен вузол знань є багатовимірним вектором. Це дозволяє системі не просто відображати зв'язки, створені людиною, а й автоматично генерувати нові асоціативні шляхи, виявляючи приховані патерни у масиві даних.3

Впровадження AI-first підходу на платформі Lovable.dev означає подвійну інтеграцію:

1. **AI як Архітектор (Builder AI):** Використання генеративних можливостей Lovable для створення React-компонентів, налаштування Supabase та написання Edge Functions. Це змінює роль розробника з "автора коду" на "автора промптів" (Prompt Architect).5  
2. **AI як Функціонал (Runtime AI):** Інтеграція RAG (Retrieval-Augmented Generation) пайплайнів безпосередньо в ядро системи для забезпечення функціоналу "спілкування з базою знань" та контекстної навігації.6

### **1.2. Бізнес-цілі та технічні імперативи**

Перехід на Lovable.dev дозволяє досягти наступних стратегічних цілей:

* **Гіпер-персоналізація:** Впровадження системи авторизації (Supabase Auth) та RLS (Row Level Security) дозволяє створити гібридний простір, де публічні знання доступні всім, а приватні чернетки та експериментальні ідеї захищені на рівні бази даних, а не на рівні фільтрації файлів під час білду.8  
* **Зниження когнітивного навантаження:** Автоматизація рутинних процесів (тегування, лінкування, генерація summary) через Edge Functions та LLM-моделі звільняє автора для творчої роботи.10  
* **Інтерактивність Графу:** Заміна статичних зображень графу на динамічні візуалізації (Force-Directed Graph), що дозволяють навігацію та фільтрацію в реальному часі.11

## ---

**2\. Аналіз поточного стану (AS-IS) та обмеження**

Для побудови ефективної стратегії міграції необхідно чітко декомпозувати існуючу систему та ідентифікувати "вузькі місця", які стримують еволюцію Digital Garden.

### **2.1. Технологічний стек та його архітектурні межі**

Поточна архітектура базується на принципах JAMstack (JavaScript, APIs, Markup):

* **Obsidian:** Виступає як локальна IDE та CMS. Дані зберігаються у Markdown.  
* **11ty (Eleventy):** Статичний генератор сайтів, що компілює .md файли в HTML.  
* **GitHub:** Система контролю версій та джерело правди (Source of Truth).  
* **Cloudflare Pages:** Хостинг та CDN.

**Таблиця 2.1. Аналіз обмежень поточної архітектури**

| Компонент | Функція | Обмеження AS-IS | Наслідки для UX/DX |
| :---- | :---- | :---- | :---- |
| **Сховище даних** | Файлова система (Git) | Відсутність індексації в реальному часі. Складність виконання складних запитів (наприклад, зворотні посилання другого рівня). | Повільний пошук, неможливість динамічної фільтрації контенту без клієнтського JS-навантаження. |
| **Auth/Security** | Відсутня (Static) | Неможливість розмежування доступу на рівні користувачів. "Безпека через непублікацію" (Security through obscurity) при виключенні файлів з білду. | Ризик витоку приватних даних. Відсутність персоналізованого контенту. |
| **Пошук** | Клієнтський індекс (Lunr.js/Fuse.js) | Завантаження всього індексу на клієнт. Відсутність семантичного розуміння запитів. | Зростання розміру бандлу зі збільшенням кількості нотаток. Пошук працює лише за точним співпадінням слів. |
| **Граф знань** | Статична візуалізація або важкий JSON | Важкі обчислення на клієнті для побудови графу. | "Лаги" інтерфейсу при великій кількості нотаток (\>1000). |
| **Інтеграція AI** | Відсутня або локальна | Відсутність доступу до серверних потужностей для запуску LLM. | Неможливість реалізації функцій "Chat with your notes" або авто-генерації інсайтів. |

### **2.2. Проблема "Статичного мислення" в динамічному світі**

Головна проблема поточної системи полягає в тому, що зв'язки між ідеями "заморожуються" в момент компіляції сайту. Якщо користувач хоче побачити "всі нотатки про архітектуру, створені в 2024 році, які посилаються на AI", статичний сайт вимагає попереднього створення відповідної сторінки таксономії або складного клієнтського скриптингу. У контексті Digital Garden, який має бути "живим організмом", це створює тертя (friction) між автором і читачем.

Крім того, 11ty, будучи чудовим інструментом для блогів, не має нативної підтримки складних інтерактивних інтерфейсів (Rich UI), таких як редаговані таблиці, інтерактивні діаграми Mermaid зі зворотним зв'язком або складні форми для введення даних.13

## ---

**3\. Цільова архітектура (TO-BE) на платформі Lovable.dev**

Цільова архітектура являє собою перехід до повноцінного Single Page Application (SPA), побудованого на сучасному стеку React, де Lovable виступає як оркестратор розробки, а Supabase забезпечує безсерверну (Serverless) серверну інфраструктуру.

### **3.1. Lovable.dev як AI-System Integrator**

Lovable.dev не є просто "конструктором сайтів" (no-code), а є AI-керованим середовищем розробки, що генерує чистий, експортований код. Це дозволяє уникнути vendor lock-in, оскільки згенерований проект є стандартним React-додатком на базі Vite.14

**Ключові компоненти Lovable-архітектури:**

1. **Frontend Core:** React \+ Vite \+ Tailwind CSS. Використання бібліотеки компонентів shadcn/ui забезпечує професійний вигляд та доступність (accessibility) "з коробки".17  
2. **Lovable Cloud (Backend-as-a-Service):** Інтеграція з Supabase, що автоматизується платформою. Lovable автоматично налаштовує з'єднання, змінні оточення та навіть схеми баз даних на основі промптів.18  
3. **Visual Editing & AI Refactoring:** Можливість візуального редагування компонентів (Piny editor) у поєднанні з текстовими промптами дозволяє швидко ітерувати дизайн, зберігаючи чистоту коду.20

### **3.2. Роль MCP (Model Context Protocol) в архітектурі**

Інтеграція Model Context Protocol (MCP) є критичною для успішної міграції. MCP дозволяє Lovable "бачити" зовнішні контексти даних під час розробки.21

* **Context Injection:** Через MCP можна підключити локальну базу Obsidian або документацію проекту як контекст для AI-агента Lovable. Це дозволяє агенту розуміти структуру ваших даних, специфічні синтаксичні конструкції (Callouts, Dataview queries) і генерувати відповідні обробники коду.21  
* **Workflow Automation:** Використання MCP-серверів для інтеграції з n8n або GitHub Actions дозволяє автоматизувати CI/CD процеси, наприклад, автоматичний деплой при зміні контенту в базі даних.23

### **3.3. Високорівнева діаграма компонентів**

Архітектура поділяється на три логічні шари:

1. **Client Layer (Browser):**  
   * **Router:** React Router DOM для клієнтської навігації.  
   * **State Management:** TanStack Query для кешування серверних даних (нотаток, графу).  
   * **Renderer:** Custom Markdown Engine (на базі react-markdown \+ remark плагінів).  
   * **Visualization:** react-force-graph-2d для інтерактивного графу.  
2. **Edge Layer (Supabase Edge Functions):**  
   * **Auth Handler:** Перевірка токенів, керування сесіями.  
   * **Search API:** Оркестрація повнотекстового та векторного пошуку.  
   * **AI Gateway:** Проксі-запити до OpenAI/Anthropic з ін'єкцією контексту (RAG).  
3. **Data Layer (Supabase Postgres):**  
   * **Tables:** notes, links, tags, embeddings.  
   * **Storage:** Зберігання зображень та медіа-файлів.  
   * **Vector Index:** HNSW індекси для швидкого пошуку найближчих сусідів.4

## ---

**4\. Проектування Бази Даних та Моделі Знань**

Перехід від файлів до реляційної бази даних вимагає ретельного проектування схеми, щоб зберегти гнучкість Obsidian і отримати потужність SQL.

### **4.1. Схема бази даних (Database Schema)**

Нижче наведено деталізовану SQL-схему, оптимізовану для Digital Garden з підтримкою графових зв'язків та версіонування. Ця схема має бути розгорнута в Supabase через SQL Editor.

SQL

\-- Розширення для векторного пошуку та триграмного пошуку  
CREATE EXTENSION IF NOT EXISTS vector;  
CREATE EXTENSION IF NOT EXISTS pg\_trgm;

\-- 1\. Таблиця Нотаток (Core Entity)  
CREATE TABLE public.notes (  
    id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
    user\_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,  
    slug TEXT NOT NULL,  
    title TEXT NOT NULL,  
    content TEXT NOT NULL, \-- "Сирий" Markdown контент  
    summary TEXT, \-- AI-згенероване резюме  
    is\_public BOOLEAN DEFAULT FALSE, \-- Прапорець для публічного доступу  
    metadata JSONB DEFAULT '{}'::jsonb, \-- Frontmatter (tags, aliases, status)  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),  
    embedding\_status TEXT DEFAULT 'pending', \-- Статус генерації ембеддінга  
      
    \-- Унікальність слага в межах користувача  
    UNIQUE(user\_id, slug)  
);

\-- Індекси для прискорення пошуку  
CREATE INDEX idx\_notes\_slug ON public.notes(slug);  
CREATE INDEX idx\_notes\_metadata ON public.notes USING gin (metadata);  
CREATE INDEX idx\_notes\_search ON public.notes USING gin(to\_tsvector('english', title |

| ' ' |  
| content));

\-- 2\. Таблиця Зв'язків (Knowledge Graph Edges)  
\-- Перетворення \[\[wikilinks\]\] у фізичні зв'язки бази даних  
CREATE TABLE public.links (  
    id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
    source\_note\_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,  
    target\_note\_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,  
    type VARCHAR(50) DEFAULT 'wikilink', \-- 'wikilink', 'embedding', 'parent-child'  
    context TEXT, \-- Контекстне речення, де знайдено посилання (для Contextual Backlinks)  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),  
      
    UNIQUE(source\_note\_id, target\_note\_id)  
);

CREATE INDEX idx\_links\_source ON public.links(source\_note\_id);  
CREATE INDEX idx\_links\_target ON public.links(target\_note\_id);

\-- 3\. Таблиця Векторів (Semantic Layer)  
CREATE TABLE public.note\_embeddings (  
    id UUID REFERENCES public.notes(id) ON DELETE CASCADE PRIMARY KEY,  
    embedding vector(1536) \-- Розмірність OpenAI text-embedding-3-small  
);

\-- HNSW індекс для надшвидкого векторного пошуку  
CREATE INDEX ON public.note\_embeddings USING hnsw (embedding vector\_cosine\_ops);

### **4.2. Графова топологія та Рекурсивні запити**

Однією з найскладніших задач є відображення "локального графу" (Local Graph) — тобто нотаток, що знаходяться на відстані 1-2 кроків від поточної. У файловій системі це вимагає парсингу всіх файлів. У PostgreSQL це вирішується елегантно за допомогою рекурсивних CTE (Common Table Expressions).24

Оптимізований запит для отримання сусідів другого порядку (2-hop neighbors):  
Цей запит значно ефективніший за використання спеціалізованих графових баз даних для даного масштабу (\<100k нотаток), оскільки уникає оверхеду на мережеві запити до зовнішньої DB.26

SQL

CREATE OR REPLACE FUNCTION get\_local\_graph(start\_slug TEXT, depth INT)  
RETURNS TABLE (source TEXT, target TEXT, link\_type TEXT, level INT) AS $$  
WITH RECURSIVE graph\_traversal AS (  
    \-- Базовий випадок: знайти ID стартової нотатки  
    SELECT   
        n.slug AS source\_slug,   
        t.slug AS target\_slug,   
        l.type,   
        1 AS level,  
        l.target\_note\_id AS next\_node\_id  
    FROM notes n  
    JOIN links l ON n.id \= l.source\_note\_id  
    JOIN notes t ON l.target\_note\_id \= t.id  
    WHERE n.slug \= start\_slug  
      
    UNION  
      
    \-- Рекурсивний крок  
    SELECT   
        n.slug AS source\_slug,   
        t.slug AS target\_slug,   
        l.type,   
        gt.level \+ 1,  
        l.target\_note\_id  
    FROM links l  
    JOIN notes n ON l.source\_note\_id \= n.id  
    JOIN notes t ON l.target\_note\_id \= t.id  
    JOIN graph\_traversal gt ON l.source\_note\_id \= gt.next\_node\_id  
    WHERE gt.level \< depth  
)  
SELECT source\_slug, target\_slug, type, level FROM graph\_traversal;  
$$ LANGUAGE sql;

### **4.3. Row Level Security (RLS) та Архітектура Авторизації**

Безпека в AI-native системах є критичною, оскільки LLM можуть випадково розкрити контекст. Використання RLS гарантує, що навіть якщо API-ендпоінт "забуде" перевірити права доступу, база даних відфільтрує дані на найнижчому рівні.9

Стратегія "Public Read / Private Write":  
Для Digital Garden ми застосовуємо гібридну модель доступу.  
**Таблиця 4.1. Матриця доступу RLS**

| Роль (Role) | Дія (Action) | Умова (Condition) | Політика (Policy SQL) |
| :---- | :---- | :---- | :---- |
| **anon** (Гість) | SELECT | is\_public \= true | auth.role() \= 'anon' AND is\_public \= true |
| **anon** | INSERT/UPDATE | Заборонено | (Implicit Deny) |
| **authenticated** (Власник) | ALL | user\_id \= auth.uid() | auth.uid() \= user\_id |
| **service\_role** (AI Agent) | SELECT | Завжди дозволено | true (Bypass RLS for indexing) |

**Реалізація політики для читання:**

SQL

CREATE POLICY "Public Access Policy"  
ON public.notes FOR SELECT  
TO anon, authenticated  
USING (is\_public \= true OR auth.uid() \= user\_id);

Ця політика елегантно вирішує проблему: автор бачить всі свої нотатки (і приватні, і публічні), а гості — лише публічні.

## ---

**5\. Архітектура AI-First: RAG та Векторний Пошук**

Цей розділ описує інтеграцію "інтелекту" в систему. Ми відходимо від простого збереження тексту до створення семантичного індексу.

### **5.1. Пайплайн генерації ембеддінгів (Embedding Pipeline)**

Замість того, щоб покладатися на зовнішні скрипти, ми використовуємо архітектуру, керовану подіями (Event-Driven Architecture) всередині Supabase.29

1. **Тригер:** Коли запис у таблиці notes оновлюється або створюється.  
2. **Webhook/Edge Function:** Database Webhook викликає функцію generate-embedding.  
3. **Processing:** Функція очищує Markdown (видаляє спецсимволи), розбиває на чанки (якщо нотатка велика) і відправляє в OpenAI API.  
4. **Storage:** Вектор зберігається в note\_embeddings.

**Перевага:** Цей підхід забезпечує консистентність даних. Нотатка стає доступною для семантичного пошуку через секунди після збереження.

### **5.2. Гібридний пошук (Hybrid Search Implementation)**

Чистий векторний пошук іноді дає неточні результати для специфічних термінів (наприклад, кодових назв проектів). Тому ми використовуємо гібридний підхід: комбінацію pg\_trgm (fuzzy keyword match) та pgvector (semantic match) з алгоритмом переранжування (RRF \- Reciprocal Rank Fusion).3

Функція пошуку (виклик через Supabase RPC):

SQL

CREATE OR REPLACE FUNCTION hybrid\_search(  
  query\_text TEXT,   
  query\_embedding vector(1536),   
  match\_threshold FLOAT,   
  match\_count INT  
)  
RETURNS TABLE (id UUID, title TEXT, similarity FLOAT) AS $$  
BEGIN  
  RETURN QUERY  
  SELECT notes.id, notes.title,   
         (note\_embeddings.embedding \<=\> query\_embedding) as similarity  
  FROM note\_embeddings  
  JOIN notes ON notes.id \= note\_embeddings.id  
  WHERE 1 \- (note\_embeddings.embedding \<=\> query\_embedding) \> match\_threshold  
  ORDER BY note\_embeddings.embedding \<=\> query\_embedding ASC  
  LIMIT match\_count;  
END;  
$$ LANGUAGE plpgsql;

### **5.3. Сценарії використання RAG (Use Cases)**

* **Chat with Garden:** Користувач задає питання "Яка моя позиція щодо використання LLM в освіті?". Система знаходить 5 найбільш релевантних нотаток і формує відповідь, посилаючись на них.6  
* **Smart Backlinks:** Автоматичне пропонування посилань. Коли ви пишете нову нотатку, система сканує векторний простір і пропонує "Дивись також: \[Назва нотатки\]", навіть якщо спільних ключових слів немає, але є спільний контекст.

## ---

**6\. UX/UI Дизайн та Компонентна Архітектура**

Успіх міграції залежить від того, наскільки якісно Lovable зможе відтворити (і покращити) досвід роботи з Obsidian.

### **6.1. Кастомний рендеринг Markdown**

Оскільки Obsidian використовує нестандартний Markdown, стандартні бібліотеки React потребують значної кастомізації.31

**Архітектура компонента NoteViewer:**

* **Core:** react-markdown з плагіном remark-gfm (таблиці, автолінки).  
* **Wikilinks:** Кастомний плагін remark-wiki-link. Він повинен перетворювати \[\[slug\]\] на \<Link to="/note/slug" className="text-primary hover:underline" /\>.  
  * *Важливо:* Необхідно реалізувати перевірку "бітих" посилань. Якщо слаг не знайдено в списку нотаток (переданому через React Query), посилання рендериться сірим кольором (Ghost Link).  
* **Callouts:** Трансформація blockquote елементів. Якщо перша лінія містить \[\!INFO\], рендериться компонент \<Alert variant="info"\> з бібліотеки Shadcn/UI.33  
* **Code Blocks:** Використання react-syntax-highlighter з підтримкою теми (Light/Dark mode) та кнопкою копіювання.  
* **Mermaid Diagrams:** Використання ленівого завантаження (Lazy Loading) для бібліотеки Mermaid, оскільки вона має великий розмір, але потрібна не на кожній сторінці.13

### **6.2. Інтерактивний Граф (Graph View 2.0)**

Використання react-force-graph-2d дозволяє створити граф, що перевершує стандартний Obsidian Graph View за можливостями взаємодії.11

* **Логіка Click-to-Navigate:** При кліку на вузол граф центрується на ньому, завантажує нових сусідів (через API get\_local\_graph) і оновлює URL.  
* **Візуалізація ваги:** Розмір вузла залежить від кількості вхідних посилань (PageRank). Це допомагає візуально виділяти "хаби" знань.

## ---

**7\. Архітектура Промптів для Lovable.dev (Prompt Engineering Strategy)**

Це ядро стратегії розробки. Оскільки ми використовуємо Lovable, якість коду прямо корелює з якістю промптів. Ми застосуємо підхід "Modular Prompting".5

### **7.1. Master Knowledge File (Контекстний файл)**

Цей файл необхідно завантажити в Lovable на початку проекту. Він задає "правила гри".

System Context: You are building a high-performance Digital Garden using React, Vite, Supabase, and Tailwind.  
Design Tokens:

* Font: 'Inter' (UI), 'Merriweather' (Content).  
* Colors: Slate-900 (Background), Zinc-100 (Text), Indigo-500 (Accents).  
  Architectural Invariants:  
1. **SPA Routing:** All internal links must use react-router-dom. No full page reloads.  
2. **AuthZ:** Check user.id against note.user\_id before enabling Edit Mode.  
3. **Performance:** Use react-query for all data fetching with a stale time of 5 minutes.  
4. **Error Handling:** All Supabase calls must be wrapped in try/catch with user-friendly Toast notifications.

### **7.2. Сценарій генерації компонентів (Prompt Sequence)**

**Крок 1: Каркас (Layout Shell)**

"Create a responsive AppLayout component using a Sidebar (collapsible on mobile) and a Main Content area. The Sidebar should utilize shadcn/ui ScrollArea and include a navigation menu. Implement a ThemeToggle for dark mode support immediately."

**Крок 2: Логіка даних (Data Fetching Hook)**

"Create a custom hook useNote(slug) using @tanstack/react-query. It should fetch the note content from Supabase table notes by slug. Also, fetch the 'backlinks' (notes that link TO this note) in a parallel query. Handle the 404 state if the note doesn't exist."

**Крок 3: Рендерер (The Complex Part)**

"Implement the NoteContent component. Use react-markdown.  
CRITICAL: Create a custom component for the a tag. Check if the href starts with /. If so, use Link.  
CRITICAL: Implement a remark plugin to parse \]. Transform them into links to /n/slug.  
Style blockquote elements as 'Callouts' based on the text content \`\`."

**Крок 4: Граф (Visualization)**

"Create a GraphView component using react-force-graph-2d. It should take nodes and links as props. Implement onNodeClick to navigate to the note using useNavigate. Color the nodes based on a group property (e.g., 'current', 'neighbor', 'distant')."

### **7.3. Meta-Prompting для налагодження**

Якщо Lovable генерує помилковий код (наприклад, галюцинує неіснуючі пропси бібліотеки), використовуйте "Repair Prompt":

"Review the usage of react-force-graph-2d. You passed a prop zoomToFit which does not exist. The correct method is to access the ref fgRef.current.zoomToFit(). Rewrite the component to use useRef and useEffect for initial zooming."

## ---

**8\. Стратегія Міграції та Сценарій Переходу**

Міграція даних є найбільш ризикованим етапом. Оскільки Lovable працює в браузері, він не має прямого доступу до вашої локальної файлової системи. Необхідний проміжний ETL-скрипт (Extract, Transform, Load).37

### **8.1. Python ETL Script**

Скрипт повинен вирішити проблему "Reference Resolution". В Obsidian посилання ведуть на *імена файлів*. У базі даних — на *UUID*.

**Алгоритм роботи скрипта:**

1. **Extract (Вилучення):**  
   * Рекурсивний обхід папки Vault.  
   * Парсинг кожного .md файлу бібліотекою python-frontmatter.  
   * Створення словника filename \-\> slug.  
2. **Transform (Трансформація):**  
   * **Content Sanitization:** Видалення Obsidian-специфічних коментарів ().  
   * **Asset Handling:** Пошук всіх зображень \!\[\[img.png\]\]. Завантаження їх у Supabase Storage Bucket public-assets. Заміна посилань у контенті на публічні URL https://project.supabase.co/storage/v1/object/public/assets/img.png.39  
   * **Metadata Normalization:** Конвертація YAML тегів у масив JSONB.  
3. **Load (Завантаження) — Двоетапний процес:**  
   * *Етап 1 (Nodes):* UPSERT всіх нотаток у таблицю notes. Збереження мапінгу slug \-\> UUID у пам'яті скрипта.  
   * *Етап 2 (Edges):* Повторний прохід по контенту. Використання Regex \\\[\\\[(.\*?)\\\]\\\] для знаходження посилань. Пошук UUID цільової нотатки у мапінгу. Вставка запису в таблицю links.

**Приклад коду (фрагмент для обробки посилань):**

Python

import re

\# Pattern to find \[\[link|alias\]\] or \[\[link\]\]  
link\_pattern \= re.compile(r'\\\[\\\[(.\*?)(?:\\|(.\*?))?\\\]\\\]')

def process\_links(content, source\_uuid, slug\_map):  
    matches \= link\_pattern.findall(content)  
    links\_to\_insert \=  
      
    for link\_slug, alias in matches:  
        \# Normalize slug (lowercase, replace spaces)  
        clean\_slug \= link\_slug.lower().replace(' ', '-')  
        target\_uuid \= slug\_map.get(clean\_slug)  
          
        if target\_uuid:  
            links\_to\_insert.append({  
                "source\_note\_id": source\_uuid,  
                "target\_note\_id": target\_uuid,  
                "type": "wikilink"  
            })  
              
    return links\_to\_insert

### **8.2. Валідація та Rollback план**

* **Dry Run:** Скрипт повинен мати режим \--dry-run, який лише логує дії без запису в БД.  
* **Identity Preservation:** Критично важливо, щоб slug (URL) залишалися незмінними для збереження SEO та зовнішніх посилань.  
* **Public/Private Audit:** Після міграції необхідно запустити SQL-запит для перевірки, чи не стали приватні нотатки публічними помилково (SELECT count(\*) FROM notes WHERE is\_public \= true AND metadata-\>\>'status' \= 'private').

## ---

**9\. Операційна стратегія, Ризики та Roadmap**

### **9.1. Управління ризиками**

**Ризик 1: Втрата контролю над кодом.**

* *Мітігація:* Lovable дозволяє експорт у GitHub. Рекомендується налаштувати GitHub Actions для автоматичного бекапу коду на незалежний репозиторій. Це забезпечує стратегію "Eject" в будь-який момент.15

**Ризик 2: Витрати на AI та БД.**

* *Мітігація:* Використання кешування (React Query) мінімізує запити до БД. Векторні ембеддінги генеруються лише при *зміні* нотатки, а не при читанні. Це робить вартість експлуатації співмірною зі статичним хостингом для read-heavy навантажень.

### **9.2. Етапи реалізації (Roadmap)**

**Фаза 1: Фундамент (Тиждень 1\)**

* Ініціалізація проекту в Lovable.  
* Налаштування Supabase (Schema, Auth, Storage).  
* Розгортання базового UI (Sidebar \+ Markdown Viewer).

**Фаза 2: Міграція даних (Тиждень 2\)**

* Розробка та тестування Python ETL скрипта.  
* Повна міграція Vault.  
* Верифікація цілісності посилань та зображень.

**Фаза 3: Функціональність (Тиждень 3\)**

* Реалізація Graph View.  
* Налаштування гібридного пошуку (Hybrid Search).  
* Імплементація Edit Mode для редагування нотаток у браузері.

**Фаза 4: AI & Optimization (Тиждень 4\)**

* Підключення RAG пайплайну (Chat interface).  
* Оптимізація продуктивності (Lighthouse score tuning).  
* Публічний запуск.

## **Висновки**

Запропонована архітектура на базі Lovable.dev та Supabase є значним еволюційним стрибком для концепції Digital Garden. Вона трансформує пасивний набір файлів у активну систему знань, здатну до самоорганізації та інтелектуальної взаємодії з користувачем. Використання AI-first підходу не лише спрощує розробку (скорочуючи час виходу на ринок з місяців до тижнів), а й створює нові користувацькі сценарії, які були неможливі в епоху статичних сайтів.

Це інвестиція в довгострокову масштабованість та цінність вашої бази знань.

---

Lead AI Systems Architect  
Січень 2026

#### **Джерела**

1. Lovable Documentation: Welcome, доступ отримано січня 9, 2026, [https://docs.lovable.dev/](https://docs.lovable.dev/)  
2. доступ отримано січня 9, 2026, [https://docs.lovable.dev/\#:\~:text=Lovable%20is%20an%20AI%2Dpowered,applications%20using%20natural%20language%20prompts.](https://docs.lovable.dev/#:~:text=Lovable%20is%20an%20AI%2Dpowered,applications%20using%20natural%20language%20prompts.)  
3. Hybrid search | Supabase Docs, доступ отримано січня 9, 2026, [https://supabase.com/docs/guides/ai/hybrid-search](https://supabase.com/docs/guides/ai/hybrid-search)  
4. Semantic search | Supabase Docs, доступ отримано січня 9, 2026, [https://supabase.com/docs/guides/ai/semantic-search](https://supabase.com/docs/guides/ai/semantic-search)  
5. The Lovable Prompting Bible: Complete Guide to AI Prompting in Lovable (2025), доступ отримано січня 9, 2026, [https://www.rapidevelopers.com/blog/the-lovable-prompting-bible-complete-guide-to-ai-prompting-in-lovable-2025](https://www.rapidevelopers.com/blog/the-lovable-prompting-bible-complete-guide-to-ai-prompting-in-lovable-2025)  
6. How to Build Semantic AI Search by Andriy Burkov \- MindsDB, доступ отримано січня 9, 2026, [https://mindsdb.com/blog/fast-track-knowledge-bases-how-to-build-semantic-ai-search-by-andriy-burkov](https://mindsdb.com/blog/fast-track-knowledge-bases-how-to-build-semantic-ai-search-by-andriy-burkov)  
7. AI Inference now available in Supabase Edge Functions, доступ отримано січня 9, 2026, [https://supabase.com/blog/ai-inference-now-available-in-supabase-edge-functions](https://supabase.com/blog/ai-inference-now-available-in-supabase-edge-functions)  
8. How Supabase auth, RLS and real-time works | Backend APIs, Web Apps, Bots & Automation | Hrekov, доступ отримано січня 9, 2026, [https://hrekov.com/blog/supabase-auth-rls-real-time](https://hrekov.com/blog/supabase-auth-rls-real-time)  
9. Row Level Security | Supabase Docs, доступ отримано січня 9, 2026, [https://supabase.com/docs/guides/database/postgres/row-level-security](https://supabase.com/docs/guides/database/postgres/row-level-security)  
10. Edge Functions | Supabase Docs, доступ отримано січня 9, 2026, [https://supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)  
11. Graph Data Visualization With GraphQL & react-force-graph \- William Lyon, доступ отримано січня 9, 2026, [https://lyonwj.com/blog/graph-visualization-with-graphql-react-force-graph](https://lyonwj.com/blog/graph-visualization-with-graphql-react-force-graph)  
12. How to traverse nodes efficiently in postgresql? \- Stack Overflow, доступ отримано січня 9, 2026, [https://stackoverflow.com/questions/64969212/how-to-traverse-nodes-efficiently-in-postgresql](https://stackoverflow.com/questions/64969212/how-to-traverse-nodes-efficiently-in-postgresql)  
13. How I Rendered Mermaid Diagrams in React (and Built a Library for It) \- DEV Community, доступ отримано січня 9, 2026, [https://dev.to/navdeepm20/how-i-rendered-mermaid-diagrams-in-react-and-built-a-library-for-it-c4d](https://dev.to/navdeepm20/how-i-rendered-mermaid-diagrams-in-react-and-built-a-library-for-it-c4d)  
14. Frontend Development Isn't Just UI \- Lovable Blog, доступ отримано січня 9, 2026, [https://lovable.dev/blog/frontend-development-with-lovable](https://lovable.dev/blog/frontend-development-with-lovable)  
15. Self-hosting: Run your Lovable Cloud project anywhere, доступ отримано січня 9, 2026, [https://docs.lovable.dev/tips-tricks/self-hosting](https://docs.lovable.dev/tips-tricks/self-hosting)  
16. What is Lovable AI? A Deep Dive into the Builder | UI Bakery Blog, доступ отримано січня 9, 2026, [https://uibakery.io/blog/what-is-lovable-ai](https://uibakery.io/blog/what-is-lovable-ai)  
17. Integrating Loveable-Generated Frontend with a Custom Node.js Backend (Vite \+ Tailwind \+ Mongoose) | by Faiz Ahamed Shaik | Medium, доступ отримано січня 9, 2026, [https://medium.com/@Faizahameds/integrating-loveable-generated-frontend-with-a-custom-node-js-backend-vite-tailwind-mongoose-12e3eb963d2e](https://medium.com/@Faizahameds/integrating-loveable-generated-frontend-with-a-custom-node-js-backend-vite-tailwind-mongoose-12e3eb963d2e)  
18. Lovable Cloud \+ Supabase: The Default Platform for AI Builders, доступ отримано січня 9, 2026, [https://supabase.com/blog/lovable-cloud-launch](https://supabase.com/blog/lovable-cloud-launch)  
19. Integrate a backend with Supabase \- Lovable Documentation, доступ отримано січня 9, 2026, [https://docs.lovable.dev/integrations/supabase](https://docs.lovable.dev/integrations/supabase)  
20. Lovable \+ Visual Editing with Piny: The Perfect React & Tailwind Workflow \- YouTube, доступ отримано січня 9, 2026, [https://www.youtube.com/watch?v=W81PTzspJtw](https://www.youtube.com/watch?v=W81PTzspJtw)  
21. How Lovable's Supabase Integration Changed the Game, доступ отримано січня 9, 2026, [https://lovable.dev/blog/lovable-supabase-integration-mcp](https://lovable.dev/blog/lovable-supabase-integration-mcp)  
22. What's new in Lovable: MCP servers and more design power, доступ отримано січня 9, 2026, [https://lovable.dev/blog/mcp-servers](https://lovable.dev/blog/mcp-servers)  
23. Lovable MCP Tutorial in 4 mins\! \- YouTube, доступ отримано січня 9, 2026, [https://www.youtube.com/watch?v=M8lXmXESUy0](https://www.youtube.com/watch?v=M8lXmXESUy0)  
24. Beyond Flat Tables: Model Hierarchical Data in Supabase with Recursive Queries, доступ отримано січня 9, 2026, [https://dev.to/roel\_peters\_8b77a70a08fdb/beyond-flat-tables-model-hierarchical-data-in-supabase-with-recursive-queries-4ndl](https://dev.to/roel_peters_8b77a70a08fdb/beyond-flat-tables-model-hierarchical-data-in-supabase-with-recursive-queries-4ndl)  
25. Recursive SQL Queries with PostgreSQL \- Towards Data Science, доступ отримано січня 9, 2026, [https://towardsdatascience.com/recursive-sql-queries-with-postgresql-87e2a453f1b/](https://towardsdatascience.com/recursive-sql-queries-with-postgresql-87e2a453f1b/)  
26. Postgres Recursive Query(CTE) or Recursive Function? | by Edison Wang | The Startup, доступ отримано січня 9, 2026, [https://medium.com/swlh/postgres-recursive-query-cte-or-recursive-function-3ea1ea22c57c](https://medium.com/swlh/postgres-recursive-query-cte-or-recursive-function-3ea1ea22c57c)  
27. It's possible with recursive CTEs, but very slow. https://stackoverflow.com/ques... | Hacker News, доступ отримано січня 9, 2026, [https://news.ycombinator.com/item?id=21005172](https://news.ycombinator.com/item?id=21005172)  
28. Authorization via Row Level Security | Supabase Features, доступ отримано січня 9, 2026, [https://supabase.com/features/row-level-security](https://supabase.com/features/row-level-security)  
29. Parallel Embedding Pipeline for RAG \- Database Triggers \+ pgflow : r/Supabase \- Reddit, доступ отримано січня 9, 2026, [https://www.reddit.com/r/Supabase/comments/1ppuvl6/parallel\_embedding\_pipeline\_for\_rag\_database/](https://www.reddit.com/r/Supabase/comments/1ppuvl6/parallel_embedding_pipeline_for_rag_database/)  
30. Hybrid search with Postgres : r/LangChain \- Reddit, доступ отримано січня 9, 2026, [https://www.reddit.com/r/LangChain/comments/1dvdnzc/hybrid\_search\_with\_postgres/](https://www.reddit.com/r/LangChain/comments/1dvdnzc/hybrid_search_with_postgres/)  
31. React Markdown Complete Guide 2025: Security & Styling Tips \- Strapi, доступ отримано січня 9, 2026, [https://strapi.io/blog/react-markdown-complete-guide-security-styling](https://strapi.io/blog/react-markdown-complete-guide-security-styling)  
32. Understanding the components prop in react-markdown \- Singlehanded, доступ отримано січня 9, 2026, [https://www.singlehanded.dev/blog/understanding-the-components-prop-in-react-markdown](https://www.singlehanded.dev/blog/understanding-the-components-prop-in-react-markdown)  
33. rehype-callouts \- NPM, доступ отримано січня 9, 2026, [https://www.npmjs.com/package/rehype-callouts](https://www.npmjs.com/package/rehype-callouts)  
34. Render custom components in React Markdown \- Stack Overflow, доступ отримано січня 9, 2026, [https://stackoverflow.com/questions/75404601/render-custom-components-in-react-markdown](https://stackoverflow.com/questions/75404601/render-custom-components-in-react-markdown)  
35. react-2d-force-graph \- Codesandbox, доступ отримано січня 9, 2026, [https://codesandbox.io/s/react-2d-force-graph-2z8dzm](https://codesandbox.io/s/react-2d-force-graph-2z8dzm)  
36. Prompt better in Lovable \- Lovable Documentation, доступ отримано січня 9, 2026, [https://docs.lovable.dev/prompting/prompting-one](https://docs.lovable.dev/prompting/prompting-one)  
37. Get started with the Supabase API using Python (download database table as CSV), доступ отримано січня 9, 2026, [https://www.youtube.com/watch?v=wyLjXouYjww](https://www.youtube.com/watch?v=wyLjXouYjww)  
38. Embedding content in PostgreSQL using Python: Combining markup chunking and token-aware chunking \- Fujitsu Enterprise Postgres, доступ отримано січня 9, 2026, [https://www.postgresql.fastware.com/blog/embedding-content-in-postgresql-using-python](https://www.postgresql.fastware.com/blog/embedding-content-in-postgresql-using-python)  
39. Storage Access Control | Supabase Docs, доступ отримано січня 9, 2026, [https://supabase.com/docs/guides/storage/security/access-control](https://supabase.com/docs/guides/storage/security/access-control)  
40. Lovable AI Deployment Tutorial, доступ отримано січня 9, 2026, [https://lovable.dev/video/lovable-ai-deployment-tutorial](https://lovable.dev/video/lovable-ai-deployment-tutorial)