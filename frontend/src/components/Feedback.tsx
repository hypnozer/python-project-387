import { AlertCircle, CalendarX2, LoaderCircle, RotateCcw } from "lucide-react";

export function LoadingState({ label = "Загружаем…" }: { label?: string }) {
  return (
    <div className="feedback-state" role="status">
      <LoaderCircle className="spin" size={28} />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="feedback-state feedback-error" role="alert">
      <AlertCircle size={30} />
      <div>
        <h2>Что-то пошло не так</h2>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button className="button button-secondary" type="button" onClick={onRetry}>
          <RotateCcw size={17} /> Повторить
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="feedback-state feedback-empty">
      <CalendarX2 size={34} />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
