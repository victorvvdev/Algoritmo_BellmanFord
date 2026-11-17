// criação do grafo
const vertices = ["S", "A", "B", "C", "D", "E"];

const arestasOriginais = [
  { origem: "S", destino: "A", custo: 3 },
  { origem: "S", destino: "B", custo: 5 },
  { origem: "A", destino: "B", custo: -2 },
  { origem: "A", destino: "C", custo: 6 },
  { origem: "B", destino: "C", custo: 3 },
  { origem: "B", destino: "D", custo: 7 },
  { origem: "C", destino: "D", custo: 2 },
];

// tratamento de erros
function validarEntrada(vertices, arestas, fonte) {
  if (!Array.isArray(vertices) || vertices.length === 0) {
    throw new TypeError("'vertices' deve ser um array não vazio.");
  }
  if (!Array.isArray(arestas)) {
    throw new TypeError("'arestas' deve ser um array.");
  }

  const conjunto = new Set(vertices);
  if (conjunto.size !== vertices.length) {
    throw new RangeError("'vertices' contém elementos duplicados.");
  }
  if (!conjunto.has(fonte)) {
    throw new RangeError(`Vértice de origem "${fonte}" não existe no grafo.`);
  }

  arestas.forEach((a, i) => {
    if (a === null || typeof a !== "object") {
      throw new TypeError(`Aresta #${i + 1} deve ser um objeto {origem, destino, custo}.`);
    }
    const { origem, destino, custo } = a;
    if (!conjunto.has(origem)) {
      throw new RangeError(`Aresta #${i + 1}: origem "${origem}" não existe no grafo.`);
    }
    if (!conjunto.has(destino)) {
      throw new RangeError(`Aresta #${i + 1}: destino "${destino}" não existe no grafo.`);
    }
    if (typeof custo !== "number" || !Number.isFinite(custo)) {
      throw new TypeError(
        `Aresta #${i + 1} (${origem}→${destino}): custo inválido (${String(custo)}); esperado número finito.`
      );
    }
  });
}

// algoritmo bellman-ford
function bellmanFord(vertices, arestas, fonte, verbose = true) {
  validarEntrada(vertices, arestas, fonte);

  // distância infinita para todos e zero para a origem
  const dist = {};
  const pred = {};
  for (const v of vertices) {
    dist[v] = Infinity;
    pred[v] = null;
  }
  dist[fonte] = 0;

  const fmt = (d) => (d === Infinity ? "∞" : d === -Infinity ? "-∞" : String(d));
  const linha = (rotulo) =>
    console.log(
      rotulo.padEnd(14) + vertices.map((v) => fmt(dist[v]).padStart(4)).join(" ")
    );

  if (verbose) {
    console.log("Iteração".padEnd(14) + vertices.map((v) => v.padStart(4)).join(" "));
    linha("Início");
  }

  // relaxa todas as arestas |V|-1 vezes e guarda o predecessor para montar a rota
  for (let i = 1; i <= vertices.length - 1; i++) {
    for (const { origem, destino, custo } of arestas) {
      if (dist[origem] !== Infinity && dist[origem] + custo < dist[destino]) {
        dist[destino] = dist[origem] + custo;
        pred[destino] = origem;
      }
    }
    if (verbose) linha(`Iteração ${i}`);
  }

  // passada extra: se ainda há relaxamento, existe ciclo de peso negativo
  const afetados = new Set();
  for (const { origem, destino, custo } of arestas) {
    if (dist[origem] !== Infinity && dist[origem] + custo < dist[destino]) {
      afetados.add(destino);
    }
  }
  const temCicloNegativo = afetados.size > 0;

  // marca -∞ nos vértices afetados e em todos os alcançáveis a partir deles
  if (temCicloNegativo) {
    const fila = [...afetados];
    while (fila.length) {
      const u = fila.shift();
      dist[u] = -Infinity;
      for (const { origem, destino } of arestas) {
        if (origem === u && dist[destino] !== -Infinity) {
          dist[destino] = -Infinity;
          fila.push(destino);
        }
      }
    }
  }

  return { dist, pred, temCicloNegativo };
}

// monta o caminho completo que é percorrido
function rota(pred, dist, destino) {
  if (dist[destino] === Infinity) return "inalcançável";
  if (dist[destino] === -Infinity) return "armadilha (ciclo negativo)";
  const caminho = [];
  for (let v = destino; v !== null; v = pred[v]) caminho.unshift(v);
  return caminho.join(" → ");
}

// executa o algoritmo no grafo criado e imprime os resultados
function relatorio(titulo, arestas) {
  console.log("\n" + "=".repeat(60));
  console.log(titulo);
  console.log("=".repeat(60));

  const { dist, pred, temCicloNegativo } = bellmanFord(vertices, arestas, "S");

  console.log(
    "\nCiclo negativo detectado?",
    temCicloNegativo ? "SIM" : "NÃO"
  );

  console.log("\nEsconderijo | Custo | Rota");
  console.log("-".repeat(50));
  for (const v of vertices) {
    const c = dist[v] === Infinity ? "∞" : dist[v] === -Infinity ? "-∞" : dist[v];
    console.log(`${v.padEnd(11)} | ${String(c).padEnd(5)} | ${rota(pred, dist, v)}`);
  }

  const finitos = vertices.filter(
    (v) => v !== "S" && Number.isFinite(dist[v])
  );
  if (finitos.length) {
    const menor = finitos.reduce((a, b) => (dist[a] <= dist[b] ? a : b));
    const maior = finitos.reduce((a, b) => (dist[a] >= dist[b] ? a : b));
    console.log(`\nMenor risco (excluindo S): ${menor} (${dist[menor]})`);
    console.log(`Maior risco (alcançável):  ${maior} (${dist[maior]})`);
  }

  const armadilhas = vertices.filter((v) => dist[v] === -Infinity);
  const isolados = vertices.filter((v) => dist[v] === Infinity);
  if (armadilhas.length) console.log(`Armadilhas: ${armadilhas.join(", ")}`);
  if (isolados.length) console.log(`Inalcançáveis: ${isolados.join(", ")}`);
}

// inicia a execução
function main() {
  relatorio("EXPERIMENTO 1 - Rede original", arestasOriginais);

  const arestasComArmadilha = [
    ...arestasOriginais,
    { origem: "D", destino: "B", custo: -6 },
  ];
  relatorio("EXPERIMENTO 2 - Com a aresta D → B (-6)", arestasComArmadilha);
}

if (typeof module !== "undefined" && module.exports) {
  if (require.main === module) {
    try {
      main();
    } catch (err) {
      console.error(`\n[ERRO] ${err.name}: ${err.message}`);
      process.exit(1);
    }
  }
  module.exports = { bellmanFord, validarEntrada, rota, vertices, arestasOriginais };
} else if (typeof window !== "undefined") {
  window.BellmanFord = { bellmanFord, validarEntrada, rota, vertices, arestasOriginais };
}