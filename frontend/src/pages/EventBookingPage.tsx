import { ArrowLeft, CalendarDays, Check, Clock3, Globe2, Mail, UserRound } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api } from "../api/client";
import type { Booking, EventType, Slot, SlotWindow } from "../api/types";
import { ErrorState, LoadingState } from "../components/Feedback";
import { useApiData } from "../hooks/useApiData";
import { formatDate, formatDateTime, formatDuration, formatTime, slotDateKey } from "../lib/format";

type BookingPageData = { eventType: EventType; window: SlotWindow };

function slotCountLabel(count: number): string {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} окон`;
  const last = count % 10;
  if (last === 1) return `${count} окно`;
  if (last >= 2 && last <= 4) return `${count} окна`;
  return `${count} окон`;
}

export function EventBookingPage() {
  const { eventTypeId = "" } = useParams();
  const { data, error, loading, reload, setData } = useApiData<BookingPageData>(
    async () => {
      const [eventType, window] = await Promise.all([
        api.getEventType(eventTypeId),
        api.getSlots(eventTypeId),
      ]);
      return { eventType, window };
    },
    [eventTypeId],
  );
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);

  const groupedSlots = useMemo(() => {
    if (!data) return [];
    const groups = new Map<string, Slot[]>();
    for (const slot of data.window.slots) {
      const key = slotDateKey(slot.startsAt, data.window.ownerTimeZone);
      groups.set(key, [...(groups.get(key) ?? []), slot]);
    }
    return [...groups.entries()];
  }, [data]);

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot || !data) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      const created = await api.createBooking({
        eventTypeId: data.eventType.id,
        startsAt: selectedSlot.startsAt,
        guest: { name: name.trim(), email: email.trim() },
      });
      setBooking(created);
      setData({
        ...data,
        window: {
          ...data.window,
          slots: data.window.slots.filter((slot) => slot.startsAt !== selectedSlot.startsAt),
        },
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      if (cause instanceof ApiError && ["SLOT_UNAVAILABLE", "SLOT_OUTSIDE_BOOKING_WINDOW", "SLOT_NOT_OFFERED"].includes(cause.code ?? "")) {
        setSelectedSlot(null);
        setSubmitError("Это время уже недоступно. Мы обновили список — выберите другое окно.");
        await reload();
      } else {
        setSubmitError(cause instanceof Error ? cause.message : "Не удалось создать бронирование.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page-section container"><LoadingState label="Проверяем свободное время…" /></div>;
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="page-section container">
        <ErrorState message={notFound ? "Такого формата встречи больше нет." : error.message} onRetry={notFound ? undefined : () => void reload()} />
        <Link className="text-link back-link" to="/"><ArrowLeft size={17} /> Вернуться к форматам</Link>
      </div>
    );
  }
  if (!data) return null;

  if (booking) {
    return (
      <section className="confirmation-section">
        <div className="confirmation-card">
          <div className="success-mark"><Check size={34} strokeWidth={2.5} /></div>
          <span className="kicker">Встреча забронирована</span>
          <h1>До встречи!</h1>
          <p>Мы сохранили запись. Детали встречи указаны ниже.</p>
          <div className="confirmation-details">
            <div><span>Формат</span><strong>{booking.eventTypeTitle}</strong></div>
            <div><span>Когда</span><strong>{formatDateTime(booking.startsAt, data.window.ownerTimeZone)}</strong></div>
            <div><span>Длительность</span><strong>{formatDuration(booking.durationMinutes)}</strong></div>
            <div><span>Гость</span><strong>{booking.guest.name}</strong></div>
          </div>
          <Link className="button button-primary" to="/">Выбрать другую встречу</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="booking-page">
      <div className="container">
        <Link className="text-link back-link" to="/"><ArrowLeft size={17} /> Все форматы</Link>
        <div className="booking-layout">
          <aside className="booking-summary">
            <span className="kicker">Вы выбрали</span>
            <h1>{data.eventType.title}</h1>
            <p>{data.eventType.description}</p>
            <div className="meta-list">
              <div><Clock3 size={19} /><span>{formatDuration(data.eventType.durationMinutes)}</span></div>
              <div><Globe2 size={19} /><span>{data.window.ownerTimeZone}</span></div>
              <div><CalendarDays size={19} /><span>Запись на ближайшие 14 дней</span></div>
            </div>
          </aside>

          <div className="slot-panel">
            <div className="panel-heading">
              <span className="step-label">Шаг 1 из 2</span>
              <h2>Выберите дату и время</h2>
              <p>Время указано в часовом поясе {data.window.ownerTimeZone}.</p>
            </div>

            {submitError && <div className="inline-alert" role="alert">{submitError}</div>}

            {groupedSlots.length === 0 ? (
              <div className="inline-empty">
                <CalendarDays size={28} />
                <h3>Свободных окон пока нет</h3>
                <p>На ближайшие 14 дней всё занято. Попробуйте заглянуть позже.</p>
              </div>
            ) : (
              <div className="slot-groups">
                {groupedSlots.map(([date, slots]) => (
                  <div className="slot-day" key={date}>
                    <div className="slot-date">
                      <strong>{formatDate(slots[0]!.startsAt, data.window.ownerTimeZone)}</strong>
                      <span>{slotCountLabel(slots.length)}</span>
                    </div>
                    <div className="slot-buttons">
                      {slots.map((slot) => {
                        const selected = selectedSlot?.startsAt === slot.startsAt;
                        return (
                          <button
                            className={selected ? "slot-button is-selected" : "slot-button"}
                            type="button"
                            key={slot.startsAt}
                            aria-pressed={selected}
                            onClick={() => { setSelectedSlot(slot); setSubmitError(""); }}
                          >
                            {formatTime(slot.startsAt, data.window.ownerTimeZone)}
                            {selected && <Check size={16} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedSlot && (
              <form className="guest-form" onSubmit={submitBooking}>
                <div className="form-divider" />
                <div className="panel-heading compact">
                  <span className="step-label">Шаг 2 из 2</span>
                  <h2>Расскажите, как с вами связаться</h2>
                  <p>{formatDateTime(selectedSlot.startsAt, data.window.ownerTimeZone)}</p>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Ваше имя</span>
                    <span className="input-wrap"><UserRound size={18} /><input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required autoComplete="name" placeholder="Алексей" /></span>
                  </label>
                  <label className="field">
                    <span>Электронная почта</span>
                    <span className="input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required autoComplete="email" placeholder="alex@example.com" /></span>
                  </label>
                </div>
                <button className="button button-primary button-wide" type="submit" disabled={submitting}>
                  {submitting ? "Подтверждаем…" : "Подтвердить встречу"}
                  {!submitting && <Check size={18} />}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
