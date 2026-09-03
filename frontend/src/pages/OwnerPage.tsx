import { CalendarClock, CheckCircle2, Clock3, Globe2, Mail, Plus, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { ApiError, api } from "../api/client";
import type { CreateEventTypeRequest } from "../api/types";
import { ErrorState, LoadingState } from "../components/Feedback";
import { useApiData } from "../hooks/useApiData";
import { formatDateTime, formatDuration } from "../lib/format";

export function OwnerPage() {
  const { data, error, loading, reload } = useApiData(
    async () => {
      const [owner, bookings, eventTypes] = await Promise.all([
        api.getOwner(),
        api.getUpcomingBookings(),
        api.getEventTypes(),
      ]);
      return { owner, bookings, eventTypes };
    },
    [],
  );
  const [form, setForm] = useState<CreateEventTypeRequest>({ id: "", title: "", description: "", durationMinutes: 30 });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [createdTitle, setCreatedTitle] = useState("");

  function updateField<K extends keyof CreateEventTypeRequest>(key: K, value: CreateEventTypeRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError("");
    setCreatedTitle("");
  }

  async function createEventType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    setCreatedTitle("");
    try {
      const created = await api.createEventType({
        ...form,
        id: form.id.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
      });
      setCreatedTitle(created.title);
      setForm({ id: "", title: "", description: "", durationMinutes: 30 });
      await reload();
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "EVENT_TYPE_ID_EXISTS") {
        setFormError("Такой идентификатор уже используется. Выберите другой.");
      } else {
        setFormError(cause instanceof Error ? cause.message : "Не удалось создать формат встречи.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page-section container"><LoadingState label="Открываем кабинет…" /></div>;
  if (error) return <div className="page-section container"><ErrorState message={error.message} onRetry={() => void reload()} /></div>;
  if (!data) return null;

  return (
    <section className="owner-page">
      <div className="owner-hero">
        <div className="container owner-hero-inner">
          <div>
            <span className="kicker kicker-light">Кабинет владельца</span>
            <h1>Добрый день, {data.owner.name}</h1>
            <p>Все будущие встречи и форматы — в одном спокойном месте.</p>
          </div>
          <div className="owner-meta">
            <Globe2 size={20} />
            <div><span>Часовой пояс</span><strong>{data.owner.timeZone}</strong></div>
          </div>
        </div>
      </div>

      <div className="container owner-content">
        <div className="dashboard-stats">
          <div className="stat-card"><span>Будущих встреч</span><strong>{data.bookings.length}</strong><CalendarClock size={22} /></div>
          <div className="stat-card"><span>Форматов встречи</span><strong>{data.eventTypes.length}</strong><Clock3 size={22} /></div>
          <div className="stat-card"><span>Рабочих дней</span><strong>{data.owner.weeklyAvailability.filter((day) => day.intervals.length > 0).length}</strong><CalendarClock size={22} /></div>
        </div>

        <div className="dashboard-grid">
          <section className="dashboard-panel meetings-panel">
            <div className="dashboard-panel-heading">
              <div><span className="kicker">Расписание</span><h2>Предстоящие встречи</h2></div>
              <span className="count-pill">{data.bookings.length}</span>
            </div>

            {data.bookings.length === 0 ? (
              <div className="dashboard-empty"><CalendarClock size={30} /><h3>Встреч пока нет</h3><p>Новые бронирования появятся здесь автоматически.</p></div>
            ) : (
              <div className="meeting-list">
                {data.bookings.map((booking) => (
                  <article className="meeting-card" key={booking.id}>
                    <div className="meeting-date">
                      <strong>{new Intl.DateTimeFormat("ru-RU", { day: "2-digit", timeZone: data.owner.timeZone }).format(new Date(booking.startsAt))}</strong>
                      <span>{new Intl.DateTimeFormat("ru-RU", { month: "short", timeZone: data.owner.timeZone }).format(new Date(booking.startsAt))}</span>
                    </div>
                    <div className="meeting-main">
                      <h3>{booking.eventTypeTitle}</h3>
                      <p>{formatDateTime(booking.startsAt, data.owner.timeZone)} · {formatDuration(booking.durationMinutes)}</p>
                      <div className="guest-line"><UserRound size={15} /> {booking.guest.name}<span>·</span><Mail size={15} /> {booking.guest.email}</div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-panel create-panel">
            <div className="dashboard-panel-heading">
              <div><span className="kicker">Новый формат</span><h2>Добавить встречу</h2></div>
              <div className="round-icon"><Plus size={20} /></div>
            </div>
            <p className="panel-description">Укажите понятное название, описание и длительность. Формат сразу появится на публичной странице.</p>

            {createdTitle && <div className="success-alert" role="status"><CheckCircle2 size={19} /> Формат «{createdTitle}» создан.</div>}
            {formError && <div className="inline-alert" role="alert">{formError}</div>}

            <form className="owner-form" onSubmit={createEventType}>
              <label className="field">
                <span>Название</span>
                <input value={form.title} onChange={(event) => updateField("title", event.target.value)} minLength={1} maxLength={120} required placeholder="Например, знакомство" />
              </label>
              <label className="field">
                <span>Идентификатор</span>
                <input value={form.id} onChange={(event) => updateField("id", event.target.value.toLowerCase())} minLength={1} maxLength={64} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required placeholder="intro-call" aria-describedby="slug-help" />
                <small id="slug-help">Латинские буквы, цифры и дефисы</small>
              </label>
              <label className="field">
                <span>Описание</span>
                <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} minLength={1} maxLength={2000} required rows={4} placeholder="Коротко расскажите, чему посвящена встреча" />
              </label>
              <label className="field">
                <span>Длительность</span>
                <select value={form.durationMinutes} onChange={(event) => updateField("durationMinutes", Number(event.target.value))}>
                  <option value={15}>15 минут</option>
                  <option value={30}>30 минут</option>
                  <option value={45}>45 минут</option>
                  <option value={60}>1 час</option>
                  <option value={90}>1 час 30 минут</option>
                  <option value={120}>2 часа</option>
                </select>
              </label>
              <button className="button button-primary button-wide" type="submit" disabled={submitting}>
                {submitting ? "Создаём…" : "Создать формат"}<Plus size={18} />
              </button>
            </form>
          </section>
        </div>
      </div>
    </section>
  );
}
