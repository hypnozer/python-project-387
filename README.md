# Календарь звонков

[![hexlet-check](https://github.com/hypnozer/python-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/hypnozer/python-project-387/actions)
[![End-to-end tests](https://github.com/hypnozer/python-project-387/actions/workflows/e2e.yml/badge.svg)](https://github.com/hypnozer/python-project-387/actions/workflows/e2e.yml)

Продолжение учебного проекта Хекслета «Календарь звонков». Это сервис
бронирования слотов по мотивам Cal.com: владелец создаёт форматы встреч,
гость выбирает свободное время, а бронирование появляется в кабинете владельца.

В этом репозитории приложение используется для отработки командного процесса с
агентом в GitHub: issue, triage, pull request, ревью, доработки и регулярные
автоматические проверки. Исходный код перенесён из
[`python-project-386`](https://github.com/hypnozer/python-project-386).

План следующих задач с приоритетами и критериями готовности находится в
[`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md).

## Стек

- FastAPI и Pydantic, Python 3.12;
- React 19, TypeScript и Vite;
- TypeSpec и OpenAPI;
- Pytest и Playwright;
- Docker и GitHub Actions.

## Установка и запуск

Для проверки API-контракта:

```bash
git clone https://github.com/hypnozer/python-project-387.git
cd python-project-387
pnpm install --frozen-lockfile
pnpm run check
```

Для запуска backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[test]"
uvicorn app.main:app --reload
```

Для запуска frontend во втором терминале:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm run dev
```

Frontend откроется на `http://localhost:5173` и будет отправлять API-запросы на
`http://localhost:8000`. Другой адрес backend можно задать переменной
`VITE_API_BASE_URL`.

## Проверки

```bash
pnpm run check
cd backend && python -m pytest
cd ../frontend && pnpm run build && pnpm run test:e2e
```

## Docker

Production-образ содержит собранный frontend и backend. Приложение слушает порт
из переменной `PORT`.

```bash
docker build -t calendar-booking .
docker run --rm -e PORT=8080 -p 8080:8080 calendar-booking
```

Подробные правила предметной области описаны в
[`docs/domain.md`](./docs/domain.md), сквозные сценарии — в
[`docs/integration-scenarios.md`](./docs/integration-scenarios.md).

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл
`.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его,
ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы
обучения с практикой, поддержкой наставников и реальными проектами, которые
остаются в резюме.
