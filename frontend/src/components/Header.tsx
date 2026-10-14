import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
// import logo from "../assets/logo.jpg"
import logo from "../assets/Informar.png"
import { logout } from "../lib/fetchWithAuth"

const USER_NAME_KEY = "user_name"
const USER_ROLE_KEY = "user_role"

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const user = {
    nome: localStorage.getItem(USER_NAME_KEY) || undefined,
    role: (localStorage.getItem(USER_ROLE_KEY) as string) || undefined,
  }

  const scrollToExercicios = () => {
    setTimeout(() => {
      const el = document.getElementById("exercicios")
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
      }
    }, 120)
  }

  const handleExerciciosClick = () => {
    const aulaMatch = location.pathname.match(/^\/aulas\/(\d+)/)
    if (aulaMatch) {
      scrollToExercicios()
      return
    }
    navigate("/aulas")
    setTimeout(() => {
      scrollToExercicios()
    }, 500)
  }

  const handleLogout = () => {
    logout(true)
  }

  const role = (user.role ?? "aluno").toLowerCase()

  const capitalize = (s?: string) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""

  return (
    <header className="w-full bg-black shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
              <img
                src={logo}
                alt="Logo"
                className="h-20 w-auto"
              />
            </Link>

            {/* Nav desktop */}
            <nav className="hidden md:flex items-center gap-2">
              <Link
                to="/aulas"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-200 hover:bg-gray-800 transition"
              >
                Aulas
              </Link>

              {role === "admin" && (
                <>
                  <Link
                    to="/usuarios"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-200 hover:bg-gray-800 transition"
                  >
                    Usuários
                  </Link>
                  <Link
                    to="/desempenho"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-200 hover:bg-gray-800 transition"
                  >
                    Desempenho
                  </Link>
                </>
              )}

              {role === "professor" && (
                <>
                  <Link
                    to="/desempenho"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-200 hover:bg-gray-800 transition"
                  >
                    Desempenho
                  </Link>
                </>
              )}
              {/* Plano de implementar */}
              {role === "aluno" && (
                <Link
                  to="/minhas-respostas"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-200 hover:bg-gray-800 transition"
                >
                  Minhas Respostas
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right mr-4">
              <span className="text-sm font-medium text-gray-100">
                {user.nome ? capitalize(user.nome) : "Visitante"}
              </span>
              <span className="text-xs text-gray-400">{capitalize(role)}</span>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition"
              >
                Sair
              </button>
            </div>

            {/* Mobile: hamburger */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-200 hover:bg-gray-800 transition"
                aria-expanded={mobileOpen}
                aria-label="Abrir menu"
              >
                {mobileOpen ? (
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-6 w-6"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden bg-black border-t border-gray-800 ${
          mobileOpen ? "block" : "hidden"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-1">
          <Link
            to="/aulas"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:bg-gray-800 transition"
          >
            Aulas
          </Link>

          <button
            onClick={() => {
              setMobileOpen(false)
              handleExerciciosClick()
            }}
            className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:bg-gray-800 transition"
          >
            Exercícios
          </button>

          {role === "admin" && (
            <>
              <Link
                to="/usuarios"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:bg-gray-800 transition"
              >
                Usuários
              </Link>
              <Link
                to="/desempenho"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:bg-gray-800 transition"
              >
                Desempenho
              </Link>
            </>
          )}

          {role === "professor" && (
            <Link
              to="/desempenho"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:bg-gray-800 transition"
            >
              Desempenho
            </Link>
          )}

          {role === "aluno" && (
            <Link
              to="/minhas-respostas"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:bg-gray-800 transition"
            >
              Minhas Respostas
            </Link>
          )}

          <div className="pt-2 border-t border-gray-700 mt-2">
            <div className="px-3">
              <div className="text-sm font-medium text-gray-100">
                {user.nome ? capitalize(user.nome) : "Visitante"}
              </div>
              <div className="text-xs text-gray-400 mb-2">{capitalize(role)}</div>
              <button
                onClick={() => {
                  setMobileOpen(false)
                  handleLogout()
                }}
                className="w-full bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
