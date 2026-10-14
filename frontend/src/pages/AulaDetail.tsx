// src/pages/AulaDetail.tsx
import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import Header from "../components/Header"
import { fetchJsonWithAuth } from "../lib/fetchWithAuth"
import { API_URL } from "../config"
import { uploadImageFile } from "../utils/upload"

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function absUrl(u?: string) {
  if (!u) return undefined
  if (u.startsWith("http://") || u.startsWith("https://")) return u
  return `${API_URL.replace(/\/$/, "")}${u.startsWith("/") ? "" : "/"}${u}`
}

// function extractYouTubeId(urlOrId?: string | null) {
//   if (!urlOrId) return null
//   const s = urlOrId.trim()

//   // já é só o id (11 chars) — heurística
//   if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s

//   // tentar extrair de URLs comuns
//   try {
//     const u = new URL(s.includes("://") ? s : `https://${s}`)
//     // v param
//     if (u.searchParams.has("v")) return u.searchParams.get("v")
//     // youtu.be short
//     if (u.hostname.includes("youtu.be")) {
//       const p = u.pathname.split("/").filter(Boolean)
//       if (p.length > 0) return p[0]
//     }
//     // /embed/{id}
//     const m = u.pathname.match(/\/(embed|v)\/([A-Za-z0-9_-]{11})/)
//     if (m) return m[2]
//   } catch (e) {
//     // não é URL, cairá no retorno null
//   }
//   return null
// }

// function youtubeEmbedUrl(urlOrId?: string | null) {
//   const id = extractYouTubeId(urlOrId)
//   return id ? `https://www.youtube.com/embed/${id}` : null
// }


type ConteudoBlocoCreate = {
  id?: number
  localId?: string
  titulo?: string | null
  texto?: string | null
  ordem?: number
  imagem_url?: string | null
  // youtube_url?: string | null 
}

type AlternativaEditable = {
  id?: number
  texto: string
  is_correta?: boolean
}

type ExercicioCreate = {
  localId?: string
  id?: number
  titulo?: string | null
  enunciado: string
  tipo: "text" | "multiple_choice"
  resposta_modelo?: string | null
  pontos?: number
  ordem?: number
  alternativas?: AlternativaEditable[] | null
  alternativas_certas?: number[] | null
  feedback_professor?: string | null
}

type AlternativaFromServer = { id?: number | string; texto: string; is_correta?: boolean }

type ExercicioFromServer = {
  id: number
  titulo?: string | null
  enunciado: string
  tipo: string
  resposta_modelo?: string | null
  pontos?: number
  alternativas?: AlternativaFromServer[] | null
  correct_alternativas?: (number | string)[] | null
  ordem?: number
  feedback_professor?: string | null
}

type BlocoFromServer = { id: number; titulo?: string | null; texto?: string | null; ordem?: number; imagem_url?: string | null}
// type BlocoFromServer = { id: number; titulo?: string | null; texto?: string | null; ordem?: number; imagem_url?: string | null;youtube_url?: string | null }

type AulaOut = {
  id: number
  titulo: string
  descricao?: string
  blocos?: BlocoFromServer[]
  exercicios?: ExercicioFromServer[]
  autor_id?: number
  created_at?: string
  category?: string | null
  publicada?: boolean
}

const USER_ROLE_KEY = "user_role"

export default function AulaDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [aula, setAula] = useState<AulaOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [blocos, setBlocos] = useState<ConteudoBlocoCreate[]>([])
  const [exercicios, setExercicios] = useState<ExercicioCreate[]>([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const [selectedAlternative, setSelectedAlternative] = useState<Record<number, number | null>>({})
  const [answerText, setAnswerText] = useState<Record<number, string>>({})
  const [lastResult, setLastResult] = useState<Record<number, { pontuacao: number; mensagem?: string }>>({})
  const [finalized, setFinalized] = useState<boolean>(false)
  const [totalScore, setTotalScore] = useState<number | null>(null)

  const role = (localStorage.getItem(USER_ROLE_KEY) || "aluno").toLowerCase()
  const isAdmin = role === "admin"
  const isProfessor = role === "professor"
  const canEdit = isAdmin || isProfessor

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      try {
        const data: AulaOut = await fetchJsonWithAuth(`${API_URL}/aulas/${id}`)
        setAula(data)

        // ===== inserir logo após setAula(data) dentro do useEffect =====
        const userIdStr = localStorage.getItem("user_id")
        const roleLocal = (localStorage.getItem(USER_ROLE_KEY) || "aluno").toLowerCase()

        // Se for aluno, tentar carregar o desempenho mais recente (isso revela se já finalizou)
        if (userIdStr && roleLocal !== "admin" && roleLocal !== "professor") {
          ;(async () => {
            try {
              const alunoIdNum = Number(userIdStr)
              const detalhe = await fetchJsonWithAuth(`${API_URL}/aulas/${data.id}/desempenho/${alunoIdNum}`)
              // detalhe.finalizada, detalhe.pontuacao_total, detalhe.responses (com pontuacao_obtida)
              setFinalized(Boolean(detalhe.finalizada))
              setTotalScore(detalhe.pontuacao_total ?? null)

              const newLast: Record<number, { pontuacao: number; mensagem?: string }> = {};
              (detalhe.responses || []).forEach((r: any) => {
                newLast[r.exercicio_id] = { pontuacao: r.pontuacao_obtida ?? 0, mensagem: r.acertou ? "Acertou" : "Errou" }
              })
              setLastResult(newLast)
            } catch (e) {
              // não crítico: se falhar, mantemos estado inicial (não finalizado)
              console.warn("Não foi possível buscar desempenho do aluno:", e)
            }
          })()
        }

        setBlocos(
          (data.blocos || []).map((b: BlocoFromServer, idx: number) => ({
            id: b.id,
            localId: b.id ? `srv-${b.id}` : makeId(),
            titulo: b.titulo ?? "",
            texto: b.texto ?? "",
            ordem: typeof b.ordem === "number" ? b.ordem : idx,
            imagem_url: b.imagem_url ? absUrl(b.imagem_url) : undefined,
            // youtube_url: b.youtube_url ?? undefined,
          }))
        )

        // mapear alternativas do servidor para o formato editável
        setExercicios(
          (data.exercicios || []).map((e: ExercicioFromServer, idx: number) => {
            const correctIdsRaw = (e as any).correct_alternativas || []
            const correctIds = new Set((correctIdsRaw || []).map((c: any) => (c !== null && c !== undefined ? Number(c) : c)))

            const alts: AlternativaEditable[] = (e.alternativas || []).map((a) => ({
              id: typeof a.id !== "undefined" && a.id !== null ? Number(a.id) : undefined,
              texto: a.texto,
              // se o servidor informar is_correta ou correct_alternativas, preferir isso
              is_correta: typeof a.is_correta !== "undefined" ? !!a.is_correta : (typeof a.id !== "undefined" && a.id !== null ? correctIds.has(Number(a.id)) : false),
            }))
            return {
              localId: e.id ? `srv-${e.id}` : makeId(),
              id: e.id,
              titulo: e.titulo ?? "",
              enunciado: e.enunciado ?? "",
              tipo: e.tipo === "multiple_choice" ? "multiple_choice" : "text",
              resposta_modelo: e.resposta_modelo ?? "",
              pontos: e.pontos ?? 1,
              ordem: typeof e.ordem === "number" ? e.ordem : idx,
              alternativas: alts,
              alternativas_certas: alts.map((a, ai) => (a.is_correta ? ai : -1)).filter((n) => n >= 0),
              feedback_professor: (e as any).feedback_professor ?? ""
            }
          })
        )
      } catch (err: any) {
        console.error(err)
        setError("Erro ao carregar aula.")
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  // blocos helpers
  function addBloco() {
    setBlocos((prev) => [...prev, { localId: makeId(), titulo: "", texto: "", ordem: prev.length }])
    setEditing(true)
  }
  function updateBloco(at: number, patch: Partial<ConteudoBlocoCreate>) {
    setBlocos((prev) => prev.map((b, i) => (i === at ? { ...b, ...patch } : b)))
    setEditing(true)
  }
  function removeBloco(at: number) {
    setBlocos((prev) => prev.filter((_, i) => i !== at))
    setEditing(true)
  }

  // exercícios helpers
  function addExercicio(type: "text" | "multiple_choice" = "text") {
    setExercicios((prev) => [
      ...prev,
      {
        localId: makeId(),
        titulo: "",
        enunciado: "",
        tipo: type,
        resposta_modelo: "",
        pontos: 1,
        ordem: prev.length,
        alternativas: type === "multiple_choice" ? [{ texto: "" }, { texto: "" }] : [],
        alternativas_certas: [],
        feedback_professor: "",
      },
    ])
    setEditing(true)
  }
  function updateExercicio(at: number, patch: Partial<ExercicioCreate>) {
    setExercicios((prev) => prev.map((e, i) => (i === at ? { ...e, ...patch } : e)))
    setEditing(true)
  }
  function removeExercicio(at: number) {
    setExercicios((prev) => prev.filter((_, i) => i !== at))
    setEditing(true)
  }

  function addAlternative(exIdx: number) {
    setExercicios((prev) =>
      prev.map((e, i) => (i === exIdx ? { ...e, alternativas: [...(e.alternativas ?? []), { texto: "" }] } : e))
    )
    setEditing(true)
  }
  function updateAlternative(exIdx: number, altIdx: number, text: string) {
    setExercicios((prev) =>
      prev.map((e, i) =>
        i === exIdx ? { ...e, alternativas: (e.alternativas ?? []).map((a, ai) => (ai === altIdx ? { ...a, texto: text } : a)) } : e
      )
    )
    setEditing(true)
  }
  function removeAlternative(exIdx: number, altIdx: number) {
    setExercicios((prev) =>
      prev.map((e, i) => (i === exIdx ? { ...e, alternativas: (e.alternativas ?? []).filter((_, ai) => ai !== altIdx) } : e))
    )
    setEditing(true)
  }
  function toggleAlternativeCorrect(exIdx: number, altIdx: number) {
    setExercicios((prev) =>
      prev.map((e, i) => {
        if (i !== exIdx) return e
        // Permite múltiplas corretas — se quiser única, zere as outras antes de marcar
        const alts = (e.alternativas ?? []).map((a, ai) => (ai === altIdx ? { ...a, is_correta: !a.is_correta } : a))
        return { ...e, alternativas: alts, alternativas_certas: alts.map((a, ai) => (a.is_correta ? ai : -1)).filter((n) => n >= 0) }
      })
    )
    setEditing(true)
  }

  // salvar via PATCH
  async function handleSaveAll() {
    if (!aula) return
    setSaving(true)
    setError(null)
    try {
      // construir payload convertendo alternativas para objetos { id?, texto, is_correta }
      const payload = {
        titulo: aula.titulo,
        descricao: aula.descricao ?? "",
        blocos: blocos.map((b, i) => ({
          ...(b.id ? { id: b.id } : {}),
          titulo: b.titulo ?? "",
          texto: b.texto ?? "",
          ordem: i,
          imagem_url: b.imagem_url ?? null,
          // youtube_url: b.youtube_url ?? null,
        })),
        exercicios: exercicios.map((ex, i) => {
          const alternativasObjs = (ex.alternativas ?? []).map((a) => ({
            ...(a.id ? { id: a.id } : {}),
            texto: a.texto ?? "",
            is_correta: !!a.is_correta,
          }))
          const corretasIndices = (ex.alternativas ?? []).map((a, ai) => (a.is_correta ? ai : -1)).filter((n) => n >= 0)
          return {
            ...(ex.id ? { id: ex.id } : {}),
            titulo: ex.titulo ?? undefined,
            enunciado: ex.enunciado,
            tipo: ex.tipo === "multiple_choice" ? "multiple_choice" : "text",
            resposta_modelo: ex.resposta_modelo ?? undefined,
            pontos: ex.pontos ?? 1,
            ordem: i,
            alternativas: alternativasObjs,
            alternativas_certas: corretasIndices,
            feedback_professor: ex.feedback_professor ?? null,
          }
        }),
      }

      const updated = (await fetchJsonWithAuth(`${API_URL}/aulas/${aula.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })) as AulaOut

      // atualizar estado local a partir do retorno do backend
      setAula(updated)

      setBlocos(
        (updated.blocos || []).map((b: BlocoFromServer, idx: number) => ({
          id: b.id,
          localId: b.id ? `srv-${b.id}` : makeId(),
          titulo: b.titulo ?? "",
          texto: b.texto ?? "",
          ordem: typeof b.ordem === "number" ? b.ordem : idx,
          imagem_url: b.imagem_url ? absUrl(b.imagem_url) : undefined,
          // youtube_url: b.youtube_url ?? undefined,
        }))
      )

      setExercicios(
        (updated.exercicios || []).map((e: ExercicioFromServer, idx: number) => {
          const correctIdsRaw = (e as any).correct_alternativas || []
          const correctIds = new Set((correctIdsRaw || []).map((c: any) => (c !== null && c !== undefined ? Number(c) : c)))

          const alts: AlternativaEditable[] = (e.alternativas || []).map((a) => ({
            id: typeof a.id !== "undefined" && a.id !== null ? Number(a.id) : undefined,
            texto: a.texto ?? "",
            is_correta: typeof a.is_correta !== "undefined" ? !!a.is_correta : (typeof a.id !== "undefined" && a.id !== null ? correctIds.has(Number(a.id)) : false),
          }))
          return {
            localId: e.id ? `srv-${e.id}` : makeId(),
            id: e.id,
            titulo: e.titulo ?? "",
            enunciado: e.enunciado ?? "",
            tipo: e.tipo === "multiple_choice" ? "multiple_choice" : "text",
            resposta_modelo: e.resposta_modelo ?? "",
            pontos: e.pontos ?? 1,
            ordem: typeof e.ordem === "number" ? e.ordem : idx,
            alternativas: alts,
            alternativas_certas: alts.map((a, ai) => (a.is_correta ? ai : -1)).filter((n) => n >= 0) || [],
            feedback_professor: (e as any).feedback_professor ?? "",
          }
        })
      )

      setEditing(false)
    } catch (err: any) {
      console.error(err)
      setError(err?.message ?? "Erro ao salvar aula")
    } finally {
      setSaving(false)
    }
  }

  async function handleTogglePublished() {
    if (!aula || !canEdit) return
    const nextValue = !(aula.publicada ?? true)
    setPublishing(true)
    try {
      const updated = await fetchJsonWithAuth(`${API_URL}/aulas/${aula.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicada: nextValue }),
      }) as AulaOut
      setAula(updated)
    } catch (err: any) {
      console.error(err)
      alert(err?.message ?? "Não foi possível alterar a visibilidade da aula.")
    } finally {
      setPublishing(false)
    }
  }

  // deletar aula
  async function handleDeleteAula() {
    if (!aula) return
    if (!confirm("Deletar esta aula? Esta ação é irreversível.")) return
    try {
      await fetchJsonWithAuth(`${API_URL}/aulas/${aula.id}`, { method: "DELETE" })
      navigate("/aulas")
    } catch (err) {
      console.error(err)
      alert("Erro ao deletar aula.")
    }
  }

  async function handleEnviarTudo() {
    if (!aula) return;
    if (!confirm("Confirma finalizar a tentativa e enviar todas as respostas? Você não poderá alterar depois.")) return;

    try {
      for (const ex of aula.exercicios || []) {
        if (ex.tipo === "multiple_choice") {
          const selIdx = selectedAlternative[ex.id];
          if (typeof selIdx === "undefined" || selIdx === null) continue;
          const alt = (ex.alternativas || [])[selIdx];
          if (!alt) continue;
          const altIdNum = typeof (alt as any).id !== "undefined" && (alt as any).id !== null ? Number((alt as any).id) : null
          if (altIdNum === null) continue;
          const payload = { exercicio_id: ex.id, alternativa_id: altIdNum };
          await fetchJsonWithAuth(`${API_URL}/aulas/responder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          const texto = (answerText[ex.id] ?? "").trim();
          if (!texto) continue;
          const payload = { exercicio_id: ex.id, resposta_texto: texto };
          await fetchJsonWithAuth(`${API_URL}/aulas/responder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }
      }

      const finalizeResp = await fetchJsonWithAuth(`${API_URL}/aulas/${aula.id}/finalizar`, { method: "POST" });
      const totalPontuacao = finalizeResp?.pontuacao ?? 0;
      setTotalScore(totalPontuacao);
      alert(`Tentativa finalizada. Pontuação total: ${totalPontuacao}`);

      const userIdStr = localStorage.getItem("user_id");
      if (userIdStr) {
        try {
          const alunoIdNum = Number(userIdStr);
          const detalhe = await fetchJsonWithAuth(`${API_URL}/aulas/${aula.id}/desempenho/${alunoIdNum}`);
          const newLast: Record<number, { pontuacao: number; mensagem?: string }> = {};
          detalhe.responses.forEach((r: any) => {
            newLast[r.exercicio_id] = { pontuacao: r.pontuacao_obtida ?? 0, mensagem: r.acertou ? "Acertou" : "Errou" };
          });
          setLastResult(newLast);
        } catch (e) {
          console.warn("Não conseguiu buscar detalhe do aluno:", e);
        }
      }

      setFinalized(true);

      try {
        const updated = await fetchJsonWithAuth(`${API_URL}/aulas/${aula.id}`);
        setAula(updated);
      } catch { /* ignore */ }

    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Erro ao enviar ou finalizar tentativa. Tente novamente.");
    }
  }



  if (loading) return <div className="p-8">Carregando...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!aula) return <div className="p-8">Aula não encontrada.</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link to="/aulas" className="text-sm text-gray-500 hover:underline">← Voltar para aulas</Link>
            <h1 className="text-2xl font-bold mt-4">{aula.titulo}</h1>
            {aula.descricao && <p className="mt-1 text-gray-600">{aula.descricao}</p>}
            {canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${(aula.publicada ?? true) ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {(aula.publicada ?? true) ? "Publicada" : "Em revisão · só equipe"}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                  {aula.category ? (aula.category.toLowerCase() === "webdev" ? "Turma Web" : `Turma ${aula.category}`) : "Todas as turmas"}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {canEdit && !editing && (
              <>
                <button
                  onClick={handleTogglePublished}
                  disabled={publishing}
                  className={`px-3 py-2 rounded font-medium transition w-full sm:w-auto ${(aula.publicada ?? true) ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                >
                  {publishing ? "Salvando..." : (aula.publicada ?? true) ? "Ocultar dos alunos" : "Publicar aula"}
                </button>
                <button onClick={() => setEditing(true)} className="px-3 py-2 rounded bg-yellow-50 text-yellow-700 hover:shadow-sm transition w-full sm:w-auto">
                  Editar Conteúdo
                </button>
              </>
            )}
            {canEdit && editing && (
              <>
                <button onClick={() => { setEditing(false); /* opcional: reload para descartar */ }} className="px-3 py-2 rounded border w-full sm:w-auto">
                  Cancelar
                </button>
                <button onClick={handleSaveAll} disabled={saving} className="px-3 py-2 rounded bg-[#083D77] text-white hover:bg-[#062f63] transition w-full sm:w-auto">
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </button>
              </>
            )}
            {isAdmin && (
              <button onClick={handleDeleteAula} className="px-3 py-2 rounded bg-red-50 text-red-700 hover:shadow-sm transition w-full sm:w-auto">
                Deletar Aula
              </button>
            )}
          </div>
        </div>

        {canEdit && !(aula.publicada ?? true) && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Esta aula está em revisão. Você pode compartilhar o conteúdo com os professores voluntários e continuar editando; os alunos só terão acesso depois de clicar em <strong>Publicar aula</strong>.
          </div>
        )}

        {editing ? (
          <div className="space-y-6">
            {/* EDIT MODE (conteúdo + edição de exercícios) */}
            <section className="bg-white p-4 rounded shadow">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Blocos</h2>
                <button onClick={addBloco} className="px-3 py-1 rounded bg-[#083D77] text-white">Adicionar Bloco</button>
              </div>

              <div className="mt-4 space-y-4">
                {blocos.map((b, i) => (
                  <div key={b.localId} className="border rounded p-3">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <label className="text-sm font-medium">Título</label>
                        <input value={b.titulo ?? ""} onChange={(e) => updateBloco(i, { titulo: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2" />

                        <label className="text-sm font-medium mt-2">Texto (HTML permitido)</label>
                        <textarea value={b.texto ?? ""} onChange={(e) => updateBloco(i, { texto: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2" rows={5} />
                      </div>

                      <div className="w-full sm:w-48 flex-shrink-0">
                        <div className="mt-2">
                          <label className="text-sm font-medium block">Imagem - opcional</label>

                          <div className="mt-2 flex flex-col items-center sm:items-stretch gap-2">
                            {b.imagem_url ? (
                              <>
                                <div className="w-full sm:w-44 h-36 sm:h-28 rounded overflow-hidden border">
                                  <img src={b.imagem_url} alt={`Bloco ${i}`} className="w-full h-full object-cover" />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => updateBloco(i, { imagem_url: undefined })}
                                  className="mt-1 px-3 py-2 rounded bg-red-50 text-red-700 hover:bg-red-100 w-full sm:w-auto"
                                >
                                  Remover imagem
                                </button>
                              </>
                            ) : (
                              <>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={async (ev) => {
                                    const file = ev.target.files?.[0]
                                    if (!file) return
                                    if (file.size > 5 * 1024 * 1024) { alert("Arquivo muito grande (max 5MB)"); return }
                                    try {
                                      const url = await uploadImageFile(file)
                                      updateBloco(i, { imagem_url: url })
                                    } catch (err) {
                                      console.error(err)
                                      alert("Erro ao enviar imagem")
                                    }
                                  }}
                                  className="block w-full text-sm"
                                />
                                <span className="text-sm text-gray-500">PNG/JPG/WebP — max 5MB</span>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Campo YouTube */}
                        {/* <div className="mt-3"> */}
                          {/* <label className="text-sm font-medium block">YouTube (URL ou ID) - opcional</label>
                          <input
                            value={b.youtube_url ?? ""}
                            onChange={(e) => updateBloco(i, { youtube_url: e.target.value })}
                            placeholder="https://youtu.be/XXXX ou https://www.youtube.com/watch?v=XXXX ou apenas o ID"
                            className="mt-1 block w-full border rounded px-3 py-2 text-sm"
                          /> */}
                          {/* <div className="text-xs text-gray-400 mt-1">Cole a URL do YouTube ou apenas o ID do vídeo. Será exibido um player embutido.</div> */}

                          {/* preview do embed local enquanto edita */}
                          {/* {youtubeEmbedUrl(b.youtube_url) && (
                            <div className="mt-2 w-full aspect-video rounded overflow-hidden border">
                              <iframe
                                src={youtubeEmbedUrl(b.youtube_url)!}
                                title={`youtube-preview-${b.localId}`}
                                className="w-full h-full"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )} */}
                        {/* </div> */}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button onClick={() => removeBloco(i)} className="px-3 py-2 rounded bg-red-50 text-red-700 w-full sm:w-auto">Remover Bloco</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white p-4 rounded shadow">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Exercícios</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => addExercicio("text")} className="px-3 py-1 rounded border">Adicionar Texto</button>
                  <button onClick={() => addExercicio("multiple_choice")} className="px-3 py-1 rounded bg-[#083D77] text-white">Adicionar Múltipla Escolha</button>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {exercicios.map((ex, i) => (
                  <div key={ex.localId} className="border rounded p-3">
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                      <div className="flex-1">
                        <label className="text-sm font-medium">Título (opcional)</label>
                        <input value={ex.titulo ?? ""} onChange={(e) => updateExercicio(i, { titulo: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2" />
                        <label className="text-sm font-medium mt-2">Enunciado</label>
                        <textarea value={ex.enunciado ?? ""} onChange={(e) => updateExercicio(i, { enunciado: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2" rows={3} />

                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-sm font-medium">Tipo</label>
                            <select value={ex.tipo} onChange={(e) => updateExercicio(i, { tipo: e.target.value as any })} className="mt-1 block w-full border rounded px-3 py-2">
                              <option value="text">Resposta em texto</option>
                              <option value="multiple_choice">Múltipla escolha</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Pontos</label>
                            <input type="number" value={ex.pontos ?? 1} onChange={(e) => updateExercicio(i, { pontos: Number(e.target.value) || 1 })} className="mt-1 block w-full border rounded px-3 py-2" />
                          </div>
                        </div>

                        {/* Feedback geral do professor (visível a todos os alunos) */}
                        <div className="mt-3">
                          <label className="text-sm font-medium">Feedback esperado (visível a todos)</label>
                          <textarea
                            value={ex.feedback_professor ?? ""}
                            onChange={(e) => updateExercicio(i, { feedback_professor: e.target.value })}
                            placeholder="Explique o que era esperado nesta questão..."
                            className="mt-1 block w-full border rounded px-3 py-2"
                            rows={3}
                            spellCheck={false}
                          />
                          <div className="text-xs text-gray-400 mt-1">Texto que será mostrado a todos os alunos como 'o que era esperado' para esta questão.</div>
                        </div>

                        {ex.tipo === "text" && (
                          <div className="mt-2">
                            <label className="text-sm font-medium">Resposta modelo (opcional)</label>
                            <input value={ex.resposta_modelo ?? ""} onChange={(e) => updateExercicio(i, { resposta_modelo: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2" />
                            <div className="text-xs text-gray-400 mt-1">Se preenchido, o sistema fará comparação simples (case-insensitive) ao submeter.</div>
                          </div>
                        )}

                        {ex.tipo === "multiple_choice" && (
                          <div className="mt-3">
                            <label className="text-sm font-medium">Alternativas</label>
                            <div className="mt-2 space-y-2">
                              {(ex.alternativas ?? []).map((alt, ai) => {
                                const key = alt.id ? `alt-${alt.id}` : `${ex.localId}-alt-${ai}`
                                return (
                                  <div key={key} className="flex flex-col sm:flex-row items-center gap-2">
                                    <input value={alt.texto ?? ""} onChange={(e) => updateAlternative(i, ai, e.target.value)} className="flex-1 border rounded px-3 py-2" />
                                    <div className="flex gap-2 items-center">
                                      <button onClick={() => toggleAlternativeCorrect(i, ai)} type="button" className={`px-3 py-1 rounded ${alt.is_correta ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                                        {alt.is_correta ? "Certa" : "Marcar"}
                                      </button>
                                      <button onClick={() => removeAlternative(i, ai)} type="button" className="px-3 py-1 rounded bg-red-50 text-red-700">Remover</button>
                                    </div>
                                  </div>
                                )
                              })}
                              <div>
                                <button onClick={() => addAlternative(i)} type="button" className="px-3 py-1 rounded border">Adicionar alternativa</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="w-full sm:w-auto flex-shrink-0 flex flex-col gap-2">
                        <button onClick={() => removeExercicio(i)} className="px-3 py-2 rounded bg-red-50 text-red-700 w-full sm:w-auto">Remover</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            {/* VIEW MODE */}
            {aula.blocos && aula.blocos.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Conteúdo</h2>
                <div className="space-y-4">
                  {aula.blocos.map((b) => (
                    <article key={b.id} className="bg-white p-4 rounded shadow">
                      {b.titulo && <div className="font-semibold">{b.titulo}</div>}
                      {b.imagem_url && (
                        <div className="mt-3">
                          <img src={b.imagem_url} alt={b.titulo ?? "Imagem do bloco"} className="w-full max-h-80 object-cover rounded" />
                        </div>
                      )}
                      {/* {b.youtube_url && youtubeEmbedUrl(b.youtube_url) && (
                        <div className="mt-3">
                          <div className="w-full aspect-video rounded overflow-hidden border">
                            <iframe
                              src={youtubeEmbedUrl(b.youtube_url)!}
                              title={`youtube-${b.id}`}
                              className="w-full h-full"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      )} */}
                      {b.texto && (
                        <div
                          className="mt-2 text-sm text-gray-700 whitespace-pre-line"
                          dangerouslySetInnerHTML={{ __html: b.texto ?? "" }}
                        />
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {aula.exercicios && aula.exercicios.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Exercícios</h2>
                <div className="space-y-4">
                  {aula.exercicios.map((ex) => (
                    <div key={ex.id} className="bg-white p-4 rounded shadow">
                      {ex.titulo && <div className="font-semibold">{ex.titulo}</div>}
                      <div className="mt-1 text-sm text-gray-700">{ex.enunciado}</div>
                      {/* Mostrar feedback somente se:
                          - usuário é professor/admin (sempre vê), OU
                          - tentativa do aluno foi finalizada (finalized === true)
                      */}
                      {((isAdmin || isProfessor) || finalized) && (ex as any).feedback_professor ? (
                        <div className="mt-3 p-3 bg-gray-50 border-l-4 border-gray-200 rounded">
                          <div className="text-sm text-gray-700">
                            <strong>Feedback do professor (o esperado):</strong>
                            <div className="mt-1 whitespace-pre-wrap">{(ex as any).feedback_professor}</div>
                          </div>
                        </div>
                      ) : null}

                      {ex.tipo === "multiple_choice" && ex.alternativas && (
                        <div className="mt-3 space-y-2">
                          {ex.alternativas.map((alt, ai) => {
                            // alternativa do servidor pode ser { id?, texto, is_correta? } ou string (edge-case)
                            const altId = typeof alt.id !== "undefined" && alt.id !== null ? Number(alt.id) : null
                            const texto = alt.texto ?? String((alt as any) ?? "")
                            const isCorreta = typeof alt.is_correta !== "undefined" ? !!alt.is_correta : false

                            const selected = selectedAlternative[ex.id] === ai
                            return (
                              <label key={altId !== null ? `alt-${altId}` : `${ex.id}-alt-${ai}`} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                                <input
                                  type="radio"
                                  name={`ex-${ex.id}`}
                                  checked={selected}
                                  onChange={() => setSelectedAlternative((s) => ({ ...s, [ex.id]: ai }))}
                                  className="w-4 h-4"
                                />
                                <span className="text-sm">{texto}</span>
                                {/* mostrar badge de 'Certa' apenas para professores/admins */}
                                {(isAdmin || isProfessor) && isCorreta && (
                                  <span className="ml-3 inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Certa</span>
                                )}
                              </label>
                            )
                          })}
                          <div className="mt-3">
                            {lastResult[ex.id] ? (
                              <div className="text-sm text-green-600">Pontuação: {lastResult[ex.id].pontuacao}</div>
                            ) : (
                              <div className="text-sm text-gray-400">Selecione a alternativa e finalize no bloco abaixo.</div>
                            )}
                          </div>
                        </div>
                      )}

                      {ex.tipo !== "multiple_choice" && (
                        <div className="mt-3">
                          <textarea
                            value={answerText[ex.id] ?? ""}
                            onChange={(e) => setAnswerText((t) => ({ ...t, [ex.id]: e.target.value }))}
                            className="w-full border rounded px-3 py-2"
                            rows={4}
                            spellCheck={false}
                          />
                          <div className="mt-2 text-sm text-gray-400">
                            Sua resposta será enviada quando você clicar em <strong>Enviar tudo</strong>.
                          </div>
                          {lastResult[ex.id] && <div className="mt-2 text-sm text-green-600">Pontuação: {lastResult[ex.id].pontuacao}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* mostrar botão "Enviar tudo" apenas se o usuário não puder editar e existirem exercícios */}
            {!canEdit && aula.exercicios && aula.exercicios.length > 0 && (
              <div className="mt-6 bg-white p-4 rounded shadow">
                <h3 className="text-lg font-semibold mb-2">Finalizar tentativa</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Ao clicar em <strong>Enviar tudo</strong>, sua tentativa será finalizada e você não poderá mais alterar respostas.
                </p>
                <div className="flex items-center gap-3">
                  {!finalized ? (
                    <>
                      <button
                        onClick={handleEnviarTudo}
                        className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                      >
                        Enviar tudo
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            const updated = await fetchJsonWithAuth(`${API_URL}/aulas/${aula?.id}`);
                            setAula(updated);
                            alert("Dados recarregados.");
                          } catch {
                            alert("Erro ao recarregar.");
                          }
                        }}
                        className="px-3 py-2 rounded border"
                      >
                        Recarregar
                      </button>
                    </>
                  ) : (
                    // quando finalizada: mostra apenas pontuação total (para aluno)
                    <div className="text-sm">
                      <div className="font-semibold text-green-700">Tentativa finalizada</div>
                      <div className="mt-1">Pontuação total: <span className="font-medium">{totalScore ?? "—"}</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  )
}