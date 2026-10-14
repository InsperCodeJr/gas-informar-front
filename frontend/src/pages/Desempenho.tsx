import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import Header from "../components/Header"
import { fetchJsonWithAuth, getToken } from "../lib/fetchWithAuth"
import { API_URL } from "../config"

type QuestaoDesempenho = {
  exercicio_id: number | string
  enunciado: string
  total_respondentes: number
  total_acertos: number
  taxa_acerto: number | string | null
  distribuicao_respostas?: Record<string, number> | null
}

type AlunoResumo = {
  aluno_id: number | string
  nome: string
  username: string
  turma?: string | null
  finalizada: boolean
  pontuacao_total: number
  percentual_nota: number
  respostas: number
  total_questoes: number
  percentual_questoes: number
}

type AulaDesempenho = {
  aula_id: number | string
  titulo?: string
  category?: string | null
  pontuacao_maxima: number
  total_alunos: number
  iniciaram: number
  respondentes: number
  media_pontuacao: number | string
  media_percentual: number | string
  percentual_conclusao: number | string
  questoes: QuestaoDesempenho[]
  alunos: AlunoResumo[]
}

type AulaItem = {
  id: number | string
  titulo: string
  category?: string | null
  publicada?: boolean
}

type DetalheAlunoResposta = {
  exercicio_id: number | string
  enunciado: string
  resposta_aluno?: string | null
  alternativa_escolhida_id?: number | null
  acertou: boolean
  pontuacao_obtida: number
  resposta_modelo?: string | null
  feedback_professor?: string | null
}

type DesempenhoAluno = {
  aluno_id: number | string
  nome: string
  username?: string
  pontuacao_total: number
  finalizada: boolean
  responses: DetalheAlunoResposta[]
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatPercent(value: unknown, digits = 0) {
  return `${toNumber(value).toFixed(digits)}%`
}

function shortText(text?: string, max = 90) {
  if (!text) return ""
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function audienceLabel(category?: string | null) {
  if (!category) return "Todas as turmas"
  return category.toLowerCase() === "webdev" ? "Web" : category
}

function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? "")).join(",")),
  ].join("\n")
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function StatusBadge({ finalizada, respostas }: { finalizada: boolean; respostas: number }) {
  if (finalizada) {
    return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Concluída</span>
  }
  if (respostas > 0) {
    return <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Em andamento</span>
  }
  return <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">Não iniciada</span>
}

export default function DesempenhoPage() {
  const [aulas, setAulas] = useState<AulaItem[]>([])
  const [selectedAulaId, setSelectedAulaId] = useState<number | string | null>(null)
  const [desempenho, setDesempenho] = useState<AulaDesempenho | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingAulas, setLoadingAulas] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [studentQuery, setStudentQuery] = useState("")
  const [studentStatus, setStudentStatus] = useState<"todos" | "concluidos" | "andamento" | "nao-iniciados">("todos")

  const [alunoDetail, setAlunoDetail] = useState<DesempenhoAluno | null>(null)
  const [loadingAlunoId, setLoadingAlunoId] = useState<number | string | null>(null)
  const [showAlunoModal, setShowAlunoModal] = useState(false)

  async function fetchAulas() {
    setLoadingAulas(true)
    try {
      const data: unknown = await fetchJsonWithAuth(`${API_URL}/aulas`)
      const list = Array.isArray(data) ? data : []
      const mapped = list.map((item: any) => ({
        id: item.id ?? item.aula_id ?? item._id,
        titulo: item.titulo ?? item.nome ?? "Aula sem título",
        category: item.category ?? null,
        publicada: item.publicada ?? true,
      }))
      setAulas(mapped)
      if (mapped.length > 0) setSelectedAulaId((current) => current ?? mapped[0].id)
    } catch (err) {
      console.error(err)
      setError("Não foi possível carregar as aulas.")
    } finally {
      setLoadingAulas(false)
    }
  }

  async function fetchDesempenho(aulaId: number | string | null) {
    if (!aulaId) {
      setDesempenho(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res: any = await fetchJsonWithAuth(`${API_URL}/aulas/${aulaId}/desempenho`)
      setDesempenho({
        aula_id: res.aula_id ?? aulaId,
        titulo: res.titulo ?? "",
        category: res.category ?? null,
        pontuacao_maxima: toNumber(res.pontuacao_maxima),
        total_alunos: toNumber(res.total_alunos),
        iniciaram: toNumber(res.iniciaram),
        respondentes: toNumber(res.respondentes),
        media_pontuacao: toNumber(res.media_pontuacao),
        media_percentual: toNumber(res.media_percentual),
        percentual_conclusao: toNumber(res.percentual_conclusao),
        questoes: Array.isArray(res.questoes) ? res.questoes : [],
        alunos: Array.isArray(res.alunos) ? res.alunos : [],
      })
    } catch (err: any) {
      console.error(err)
      setDesempenho(null)
      setError(err?.message || "Não foi possível carregar o desempenho desta aula.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!getToken()) {
      setError("Usuário não autenticado.")
      setLoadingAulas(false)
      return
    }
    fetchAulas()
  }, [])

  useEffect(() => {
    setStudentQuery("")
    setStudentStatus("todos")
    setAlunoDetail(null)
    setShowAlunoModal(false)
    fetchDesempenho(selectedAulaId)
  }, [selectedAulaId])

  const chartData = useMemo(() => {
    if (!desempenho) return []
    return desempenho.questoes.map((question, index) => ({
      name: `Q${index + 1}`,
      enunciado: question.enunciado,
      taxa_acerto: toNumber(question.taxa_acerto),
      respondentes: toNumber(question.total_respondentes),
    }))
  }, [desempenho])

  const filteredStudents = useMemo(() => {
    const students = desempenho?.alunos ?? []
    const query = studentQuery.trim().toLowerCase()
    return students.filter((student) => {
      const matchesQuery = !query || `${student.nome} ${student.username}`.toLowerCase().includes(query)
      if (!matchesQuery) return false
      if (studentStatus === "concluidos") return student.finalizada
      if (studentStatus === "andamento") return !student.finalizada && student.respostas > 0
      if (studentStatus === "nao-iniciados") return !student.finalizada && student.respostas === 0
      return true
    })
  }, [desempenho, studentQuery, studentStatus])

  async function openStudentDetail(alunoId: number | string) {
    if (!selectedAulaId) return
    setLoadingAlunoId(alunoId)
    try {
      const res: any = await fetchJsonWithAuth(`${API_URL}/aulas/${selectedAulaId}/desempenho/${alunoId}`)
      setAlunoDetail({
        aluno_id: res.aluno_id ?? alunoId,
        nome: res.nome ?? "Aluno",
        username: res.username,
        pontuacao_total: toNumber(res.pontuacao_total),
        finalizada: Boolean(res.finalizada),
        responses: Array.isArray(res.responses) ? res.responses : [],
      })
      setShowAlunoModal(true)
    } catch (err: any) {
      console.error(err)
      alert(err?.message || "Não foi possível abrir o desempenho do aluno.")
    } finally {
      setLoadingAlunoId(null)
    }
  }

  function exportStudentsCsv() {
    if (!desempenho?.alunos.length) return alert("Não há alunos para exportar.")
    const rows = desempenho.alunos.map((student) => ({
      aluno_id: student.aluno_id,
      nome: student.nome,
      username: student.username,
      turma: student.turma ?? "",
      status: student.finalizada ? "Concluída" : student.respostas > 0 ? "Em andamento" : "Não iniciada",
      respostas: `${student.respostas}/${student.total_questoes}`,
      pontuacao: student.pontuacao_total,
      percentual_nota: student.percentual_nota,
    }))
    exportToCsv(`desempenho_aula_${desempenho.aula_id}_alunos.csv`, rows)
  }

  function exportQuestionsCsv() {
    if (!desempenho?.questoes.length) return alert("Não há questões para exportar.")
    const rows = desempenho.questoes.map((question, index) => ({
      questao: index + 1,
      exercicio_id: question.exercicio_id,
      enunciado: question.enunciado,
      respondentes: question.total_respondentes,
      acertos: question.total_acertos,
      taxa_acerto: toNumber(question.taxa_acerto),
      distribuicao: question.distribuicao_respostas ? JSON.stringify(question.distribuicao_respostas) : "",
    }))
    exportToCsv(`desempenho_aula_${desempenho.aula_id}_questoes.csv`, rows)
  }

  function exportStudentDetailCsv() {
    if (!alunoDetail?.responses.length) return alert("Não há respostas para exportar.")
    const rows = alunoDetail.responses.map((response) => ({
      aluno_id: alunoDetail.aluno_id,
      aluno_nome: alunoDetail.nome,
      exercicio_id: response.exercicio_id,
      enunciado: response.enunciado,
      resposta: response.resposta_aluno ?? response.alternativa_escolhida_id ?? "",
      acertou: response.acertou ? "Sim" : "Não",
      pontuacao: response.pontuacao_obtida ?? 0,
    }))
    exportToCsv(`desempenho_aluno_${alunoDetail.aluno_id}.csv`, rows)
  }

  const completion = toNumber(desempenho?.percentual_conclusao)

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="text-sm font-medium text-slate-500 transition hover:text-slate-800">
          ← Voltar para o dashboard
        </Link>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Desempenho das aulas</h1>
            <p className="mt-1 text-sm text-slate-600">Acompanhe participação, conclusão e acertos sem precisar procurar alunos por ID.</p>
          </div>

          <div className="w-full lg:w-[420px]">
            <label htmlFor="performance-class" className="mb-1.5 block text-sm font-medium text-slate-700">Aula analisada</label>
            <div className="flex gap-2">
              <select
                id="performance-class"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-[#083D77] focus:ring-2 focus:ring-blue-100"
                value={selectedAulaId ?? ""}
                disabled={loadingAulas}
                onChange={(event) => setSelectedAulaId(event.target.value ? Number(event.target.value) : null)}
              >
                {loadingAulas && <option value="">Carregando aulas...</option>}
                {!loadingAulas && aulas.length === 0 && <option value="">Nenhuma aula encontrada</option>}
                {aulas.map((aula) => (
                  <option key={String(aula.id)} value={aula.id}>
                    {aula.publicada === false ? "[Rascunho] " : ""}{aula.titulo}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => fetchDesempenho(selectedAulaId)}
                disabled={!selectedAulaId || loading}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Atualizando..." : "Atualizar"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && !desempenho && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Carregando indicadores...</div>
        )}

        {desempenho && (
          <div className="mt-6 space-y-6">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900">{desempenho.titulo || "Resumo da aula"}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Público: {audienceLabel(desempenho.category)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={exportStudentsCsv} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50">Exportar alunos</button>
                    <button onClick={exportQuestionsCsv} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50">Exportar questões</button>
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Alunos da turma</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{desempenho.total_alunos}</p>
                  <p className="mt-1 text-xs text-slate-500">elegíveis para esta aula</p>
                </div>
                <div className="bg-white p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Iniciaram</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{desempenho.iniciaram}</p>
                  <p className="mt-1 text-xs text-slate-500">com ao menos uma resposta</p>
                </div>
                <div className="bg-white p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Concluíram</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{desempenho.respondentes}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatPercent(completion)} da turma</p>
                </div>
                <div className="bg-white p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Média da turma</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{formatPercent(desempenho.media_percentual)}</p>
                  <p className="mt-1 text-xs text-slate-500">{toNumber(desempenho.media_pontuacao).toFixed(1)} de {toNumber(desempenho.pontuacao_maxima).toFixed(0)} pontos</p>
                </div>
              </div>

              <div className="px-5 py-4 sm:px-6">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Conclusão da turma</span>
                  <span className="font-semibold text-slate-700">{formatPercent(completion)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#083D77] transition-all" style={{ width: `${Math.min(100, Math.max(0, completion))}%` }} />
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-slate-900">Taxa de acerto por questão</h2>
                  <p className="mt-1 text-sm text-slate-500">Passe o mouse sobre uma barra para ver o enunciado e a quantidade de respostas.</p>
                </div>
                {chartData.length === 0 ? (
                  <div className="flex h-72 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">Esta aula ainda não possui questões.</div>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                        <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                        <Tooltip
                          cursor={{ fill: "#f8fafc" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const data = payload[0].payload as { name: string; enunciado: string; taxa_acerto: number; respondentes: number }
                            return (
                              <div className="max-w-xs rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
                                <div className="font-semibold text-slate-800">{data.name} · {formatPercent(data.taxa_acerto, 1)}</div>
                                <div className="mt-1 text-slate-600">{shortText(data.enunciado, 150)}</div>
                                <div className="mt-2 text-slate-400">{data.respondentes} resposta(s)</div>
                              </div>
                            )
                          }}
                        />
                        <Bar dataKey="taxa_acerto" fill="#083D77" radius={[6, 6, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-semibold text-slate-900">Leitura rápida das questões</h2>
                <p className="mt-1 text-sm text-slate-500">Questões com menor acerto aparecem primeiro.</p>
                <div className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1">
                  {[...(desempenho.questoes || [])]
                    .sort((a, b) => toNumber(a.taxa_acerto) - toNumber(b.taxa_acerto))
                    .map((question) => (
                      <div key={String(question.exercicio_id)} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-slate-800">{shortText(question.enunciado, 110)}</p>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${toNumber(question.taxa_acerto) >= 70 ? "bg-emerald-50 text-emerald-700" : toNumber(question.taxa_acerto) >= 40 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                            {formatPercent(question.taxa_acerto)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{question.total_acertos} acerto(s) em {question.total_respondentes} resposta(s)</p>
                      </div>
                    ))}
                  {desempenho.questoes.length === 0 && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Sem questões para analisar.</div>}
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Acompanhamento por aluno</h2>
                    <p className="mt-1 text-sm text-slate-500">Pesquise pelo nome ou usuário e abra o detalhamento com um clique.</p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <input
                      value={studentQuery}
                      onChange={(event) => setStudentQuery(event.target.value)}
                      placeholder="Buscar aluno..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#083D77] focus:ring-2 focus:ring-blue-100 sm:w-64"
                    />
                    <select
                      value={studentStatus}
                      onChange={(event) => setStudentStatus(event.target.value as typeof studentStatus)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#083D77]"
                    >
                      <option value="todos">Todos os status</option>
                      <option value="concluidos">Concluídos</option>
                      <option value="andamento">Em andamento</option>
                      <option value="nao-iniciados">Não iniciados</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold sm:px-6">Aluno</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Questões</th>
                      <th className="px-4 py-3 font-semibold">Nota</th>
                      <th className="px-5 py-3 text-right font-semibold sm:px-6">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => (
                      <tr key={String(student.aluno_id)} className="transition hover:bg-slate-50">
                        <td className="px-5 py-4 sm:px-6">
                          <div className="font-medium text-slate-900">{student.nome}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{student.username}{student.turma ? ` · ${audienceLabel(student.turma)}` : ""}</div>
                        </td>
                        <td className="px-4 py-4"><StatusBadge finalizada={student.finalizada} respostas={student.respostas} /></td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-700">{student.respostas}/{student.total_questoes}</div>
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-slate-400" style={{ width: `${Math.min(100, student.percentual_questoes)}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-800">{formatPercent(student.percentual_nota)}</div>
                          <div className="text-xs text-slate-500">{student.pontuacao_total}/{desempenho.pontuacao_maxima} pts</div>
                        </td>
                        <td className="px-5 py-4 text-right sm:px-6">
                          <button
                            onClick={() => openStudentDetail(student.aluno_id)}
                            disabled={loadingAlunoId === student.aluno_id}
                            className="rounded-lg px-3 py-2 text-xs font-semibold text-[#083D77] transition hover:bg-blue-50 disabled:opacity-50"
                          >
                            {loadingAlunoId === student.aluno_id ? "Abrindo..." : "Ver detalhes"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredStudents.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">Nenhum aluno corresponde aos filtros.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5 sm:px-6">
                <h2 className="text-lg font-semibold text-slate-900">Detalhamento das questões</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold sm:px-6">Questão</th>
                      <th className="px-4 py-3 font-semibold">Respostas</th>
                      <th className="px-4 py-3 font-semibold">Acertos</th>
                      <th className="px-4 py-3 font-semibold">Taxa</th>
                      <th className="px-5 py-3 font-semibold sm:px-6">Distribuição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {desempenho.questoes.map((question, index) => (
                      <tr key={String(question.exercicio_id)}>
                        <td className="max-w-lg px-5 py-4 sm:px-6">
                          <div className="text-xs font-semibold text-slate-400">Q{index + 1}</div>
                          <div className="mt-1 font-medium text-slate-800">{shortText(question.enunciado, 180)}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{question.total_respondentes}</td>
                        <td className="px-4 py-4 text-slate-700">{question.total_acertos}</td>
                        <td className="px-4 py-4 font-semibold text-slate-800">{formatPercent(question.taxa_acerto)}</td>
                        <td className="px-5 py-4 sm:px-6">
                          {question.distribuicao_respostas ? (
                            <div className="flex max-w-md flex-wrap gap-1.5">
                              {Object.entries(question.distribuicao_respostas).map(([answer, count]) => (
                                <span key={answer} title={answer} className="max-w-[220px] truncate rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{answer}: {count}</span>
                              ))}
                            </div>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                    {desempenho.questoes.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Sem questões nesta aula.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>

      {showAlunoModal && alunoDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Fechar" className="absolute inset-0 bg-slate-900/50" onClick={() => setShowAlunoModal(false)} />
          <div className="relative z-10 max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{alunoDetail.nome}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{alunoDetail.username ? `@${alunoDetail.username} · ` : ""}ID {alunoDetail.aluno_id}</p>
              </div>
              <button onClick={() => setShowAlunoModal(false)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar modal">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-3">
              <div className="bg-white p-4">
                <div className="text-xs text-slate-500">Status</div>
                <div className="mt-1 font-semibold text-slate-900">{alunoDetail.finalizada ? "Concluída" : "Não concluída"}</div>
              </div>
              <div className="bg-white p-4">
                <div className="text-xs text-slate-500">Pontuação</div>
                <div className="mt-1 font-semibold text-slate-900">{alunoDetail.pontuacao_total}</div>
              </div>
              <div className="col-span-2 bg-white p-4 sm:col-span-1">
                <button onClick={exportStudentDetailCsv} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Exportar respostas</button>
              </div>
            </div>

            <div className="max-h-[58vh] space-y-3 overflow-y-auto p-5 sm:p-6">
              {alunoDetail.responses.map((response, index) => {
                const answered = response.resposta_aluno !== null && response.resposta_aluno !== undefined
                  ? response.resposta_aluno
                  : response.alternativa_escolhida_id
                const hasAnswer = answered !== null && answered !== undefined && String(answered).trim() !== ""
                return (
                  <div key={String(response.exercicio_id)} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-400">QUESTÃO {index + 1}</div>
                        <p className="mt-1 text-sm font-medium text-slate-800">{response.enunciado}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${!hasAnswer ? "bg-gray-100 text-gray-600" : response.acertou ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        {!hasAnswer ? "Não respondeu" : response.acertou ? "Acertou" : "Errou"}
                      </span>
                    </div>
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      <span className="font-medium">Resposta:</span> {answered ?? "Não respondeu"}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">Pontuação obtida: {response.pontuacao_obtida ?? 0}</div>
                    {response.feedback_professor && (
                      <div className="mt-3 border-l-2 border-[#083D77] pl-3 text-xs text-slate-600">{response.feedback_professor}</div>
                    )}
                  </div>
                )
              })}
              {alunoDetail.responses.length === 0 && <div className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Este aluno ainda não possui respostas.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
