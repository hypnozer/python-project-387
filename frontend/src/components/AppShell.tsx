import { CalendarDays, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label="Окно — на главную">
            <span className="brand-mark" aria-hidden="true">
              <CalendarDays size={20} strokeWidth={2.2} />
            </span>
            <span>окно</span>
          </Link>

          <button
            className="menu-button"
            type="button"
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Основная навигация">
            <NavLink to="/" onClick={() => setMenuOpen(false)}>
              Выбрать встречу
            </NavLink>
            <NavLink to="/owner" onClick={() => setMenuOpen(false)}>
              Кабинет владельца
            </NavLink>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="brand brand-small"><span className="brand-mark"><CalendarDays size={16} /></span><span>окно</span></div>
          <p>Встречи без долгой переписки.</p>
        </div>
      </footer>
    </div>
  );
}
