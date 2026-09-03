import { ArrowRight, CalendarCheck2, Clock3, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { useApiData } from "../hooks/useApiData";
import { formatDuration } from "../lib/format";

export function HomePage() {
  const { data: eventTypes, error, loading, reload } = useApiData(api.getEventTypes, []);

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={15} /> Простая запись онлайн</div>
            <h1>Найдём удобное <em>окно</em> для встречи</h1>
            <p className="hero-lead">
              Выберите формат, посмотрите свободное время на ближайшие две недели и подтвердите встречу — без регистрации и переписки.
            </p>
            <a className="button button-primary" href="#event-types">
              Выбрать встречу <ArrowRight size={18} />
            </a>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="date-card date-card-back">
              <span>чт</span><strong>18</strong><small>сентября</small>
            </div>
            <div className="date-card date-card-front">
              <span>ср</span><strong>17</strong><small>сентября</small>
              <div className="date-slot">14:30</div>
            </div>
            <div className="hero-note">
              <CalendarCheck2 size={22} />
              <div><strong>Встреча подтверждена</strong><span>Ссылка придёт на почту</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="event-types">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="kicker">Форматы встреч</span>
              <h2>С чего начнём?</h2>
            </div>
            <p>Каждая встреча проходит один на один. Выберите подходящий формат — дальше покажем только свободное время.</p>
          </div>

          {loading && <LoadingState label="Загружаем форматы встреч…" />}
          {error && <ErrorState message={error.message} onRetry={() => void reload()} />}
          {!loading && !error && eventTypes?.length === 0 && (
            <EmptyState title="Пока нет доступных встреч" text="Владелец календаря ещё не добавил форматы. Загляните позже." />
          )}
          {!loading && !error && eventTypes && eventTypes.length > 0 && (
            <div className="event-grid">
              {eventTypes.map((eventType, index) => (
                <article className="event-card" key={eventType.id}>
                  <div className={`event-card-accent accent-${(index % 3) + 1}`} />
                  <div className="event-number">0{index + 1}</div>
                  <h3>{eventType.title}</h3>
                  <p>{eventType.description}</p>
                  <div className="event-card-footer">
                    <span><Clock3 size={17} /> {formatDuration(eventType.durationMinutes)}</span>
                    <Link className="text-link" to={`/event-types/${eventType.id}`}>
                      Выбрать время <ArrowRight size={17} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="how-it-works">
        <div className="container steps-row">
          <div className="steps-intro"><span className="kicker kicker-light">Как это работает</span><h2>Три шага — и встреча в календаре</h2></div>
          <div className="step"><span>1</span><div><strong>Выберите формат</strong><p>Задача, длительность и удобный способ общения.</p></div></div>
          <div className="step"><span>2</span><div><strong>Найдите время</strong><p>Покажем только свободные окна на 14 дней.</p></div></div>
          <div className="step"><span>3</span><div><strong>Оставьте контакты</strong><p>Имя и почта — аккаунт создавать не нужно.</p></div></div>
        </div>
      </section>
    </>
  );
}
