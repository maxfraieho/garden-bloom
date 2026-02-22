# Agent Registry

Визначення агентів системи Garden Bloom.

Кожен агент — окремий .md файл з frontmatter та описом поведінки.
Управляється через UI: /agents (owner only).

## Структура

| Поле | Тип | Опис |
|------|-----|------|
| id | string | Унікальний kebab-case ідентифікатор |
| name | string | Назва агента |
| zone | string | Делегована папка в knowledge base |
| order | number | Порядок виконання в pipeline |
| status | active/inactive/draft | Поточний стан |
| behavior | markdown | Псевдокод поведінки |

## Пов'язані документи

- [[КОНТРАКТ_АГЕНТА_V1]] — канонічний контракт агента
- [[КАНОНІЧНИЙ_КОНВЕЄР_ВИКОНАННЯ]] — execution pipeline
- [[АБСТРАКЦІЯ_РІВНЯ_ОРКЕСТРАЦІЇ]] — координація агентів
