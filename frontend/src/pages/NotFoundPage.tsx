import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="not-found">
      <div className="not-found-number">404</div>
      <span className="kicker">Страница не найдена</span>
      <h1>Кажется, это окно уже закрылось</h1>
      <p>Вернитесь на главную и выберите подходящий формат встречи.</p>
      <Link className="button button-primary" to="/"><ArrowLeft size={18} /> На главную</Link>
    </section>
  );
}
