// Roda no robô do GitHub (GitHub Actions) a cada 5 minutos.
// Lê config.json, verifica o hotel e grava o resultado em status.json.
const fs = require("fs");

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
let anterior = {};
try { anterior = JSON.parse(fs.readFileSync("status.json", "utf8")); } catch {}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function verificar() {
  try {
    const resp = await fetch(config.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });
    const urlFinal = resp.url.toLowerCase();
    const html = (await resp.text()).toLowerCase();
    if (!resp.ok) return { noAr: false, motivo: `Fora do ar (HTTP ${resp.status})` };
    if (urlFinal.includes("manuten") || urlFinal.includes("maintenance"))
      return { noAr: false, motivo: "Redirecionando para a página de manutenção" };
    const achada = config.palavrasManutencao.find((p) => html.includes(p.toLowerCase()));
    if (achada) return { noAr: false, motivo: `Em manutenção (encontrado: "${achada}")` };
    return { noAr: true, motivo: "Página normal carregou" };
  } catch (e) {
    const nome = e.name === "TimeoutError" ? "tempo esgotado" : e.cause?.code || e.message;
    return { noAr: false, motivo: `Sem resposta (${nome})` };
  }
}

(async () => {
  let r = await verificar();
  if (r.noAr) {
    // confirma de novo depois de 20s para evitar alarme falso
    await esperar(20000);
    r = await verificar();
  }

  const agora = new Date().toISOString();
  const status = r.noAr ? "online" : "manutencao";
  const voltouEm =
    status === "online" ? (anterior.status === "online" ? anterior.voltouEm : agora) : null;

  const historico = [{ hora: agora, noAr: r.noAr, motivo: r.motivo }, ...(anterior.historico || [])].slice(0, 20);

  const novo = { url: config.url, status, motivo: r.motivo, verificadoEm: agora, voltouEm, historico };
  fs.writeFileSync("status.json", JSON.stringify(novo, null, 2));
  console.log(`${status.toUpperCase()} - ${r.motivo}`);
})();
