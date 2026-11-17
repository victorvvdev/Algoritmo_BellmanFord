(() => {
  "use strict";

  const api = window.BellmanFord;
  if (!api) {
    throw new Error("Não foi possível carregar a API BellmanFord de script.js.");
  }

  const { bellmanFord, rota, vertices, arestasOriginais } = api;
  let edges = arestasOriginais.map((edge) => ({ ...edge }));

  const sourceSelect = document.querySelector("#source-select");
  const pathTarget = document.querySelector("#path-target");
  const edgeFrom = document.querySelector("#edge-from");
  const edgeTo = document.querySelector("#edge-to");
  const edgeList = document.querySelector("#edge-list");
  const edgeCount = document.querySelector("#edge-count");
  const edgeForm = document.querySelector("#edge-form");
  const edgeWeight = document.querySelector("#edge-weight");
  const resultsList = document.querySelector("#results-list");
  const statusBanner = document.querySelector("#status-banner");
  const statusMessage = document.querySelector("#status-message");
  const feedback = document.querySelector("#feedback");
  const graphSvg = document.querySelector("#graph-map");
  const cycleAlert = document.querySelector("#cycle-alert");
  const routeAlert = document.querySelector("#route-alert");

  const nodePositions = {
    S: { x: 58, y: 132 },
    A: { x: 190, y: 58 },
    B: { x: 190, y: 205 },
    C: { x: 358, y: 58 },
    D: { x: 475, y: 183 },
    E: { x: 556, y: 48 },
  };
  const svgNamespace = "http://www.w3.org/2000/svg";
  let latestResult = null;

  function makeOption(value) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    return option;
  }

  function populateVertexSelects() {
    for (const select of [sourceSelect, edgeFrom, edgeTo]) {
      select.replaceChildren(...vertices.map(makeOption));
    }
    pathTarget.replaceChildren(...vertices.map(makeOption));
    sourceSelect.value = vertices[0];
    pathTarget.value = vertices.find((vertex) => vertex !== sourceSelect.value) || vertices[0];
  }

  function svgElement(tag, attributes = {}) {
    const element = document.createElementNS(svgNamespace, tag);
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, String(value));
    }
    return element;
  }

  function edgePath(edge, index) {
    const from = nodePositions[edge.origem];
    const to = nodePositions[edge.destino];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const curve = 8 + (index % 3) * 5;
    const control = {
      x: (from.x + to.x) / 2 - uy * curve,
      y: (from.y + to.y) / 2 + ux * curve,
    };
    const start = { x: from.x + ux * 23, y: from.y + uy * 23 };
    const end = { x: to.x - ux * 27, y: to.y - uy * 27 };
    const label = {
      x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
      y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
    };

    return {
      d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
      label,
    };
  }

  function negativeCycleEdges(result) {
    if (!result || !result.temCicloNegativo) return new Set();
    const cycleEdges = new Set();

    for (const start of vertices.filter((vertex) => result.dist[vertex] === -Infinity)) {
      let current = start;
      for (let step = 0; step < vertices.length; step += 1) {
        current = result.pred[current];
        if (current === null) break;
      }
      if (current === null) continue;

      const seen = new Map();
      const chain = [];
      while (current !== null && !seen.has(current) && chain.length <= vertices.length) {
        seen.set(current, chain.length);
        chain.push(current);
        current = result.pred[current];
      }
      if (current !== null && seen.has(current)) {
        const cycle = chain.slice(seen.get(current));
        for (const vertex of cycle) {
          const predecessor = result.pred[vertex];
          const edgeIndex = edges.findIndex(
            (edge) => edge.origem === predecessor && edge.destino === vertex
          );
          if (edgeIndex !== -1) cycleEdges.add(edgeIndex);
        }
      }
    }
    return cycleEdges;
  }

  function renderGraph(result = latestResult) {
    graphSvg.replaceChildren();

    const defs = svgElement("defs");
    for (const [id, color] of [
      ["arrow-route", "#aab6ad"],
      ["arrow-negative", "#d78869"],
      ["arrow-path", "#24835c"],
      ["arrow-trap", "#cf6258"],
    ]) {
      const marker = svgElement("marker", {
        id,
        markerWidth: 8,
        markerHeight: 8,
        refX: 6,
        refY: 3,
        orient: "auto",
        markerUnits: "strokeWidth",
      });
      marker.append(svgElement("path", { d: "M0,0 L0,6 L7,3 z", fill: color }));
      defs.append(marker);
    }
    graphSvg.append(defs);

    const source = sourceSelect.value;
    const target = pathTarget.value;
    const pathNodes = new Set();
    const pathEdges = new Set();
    if (result && result.dist[target] !== Infinity && result.dist[target] !== -Infinity) {
      let current = target;
      pathNodes.add(current);
      for (let step = 0; current !== source && step < vertices.length; step += 1) {
        const predecessor = result.pred[current];
        if (predecessor === null) break;
        const edgeIndex = edges.findIndex(
          (edge) => edge.origem === predecessor && edge.destino === current
        );
        if (edgeIndex === -1) break;
        pathEdges.add(edgeIndex);
        current = predecessor;
        pathNodes.add(current);
      }
    }

    const trapNodes = new Set(
      result ? vertices.filter((vertex) => result.dist[vertex] === -Infinity) : []
    );
    const trapEdges = negativeCycleEdges(result);
    const edgeLayer = svgElement("g", { "aria-hidden": "true" });

    edges.forEach((edge, index) => {
      const geometry = edgePath(edge, index);
      const isTrap = trapEdges.has(index);
      const isPath = pathEdges.has(index) && !isTrap;
      const isNegative = edge.custo < 0;
      const classes = ["graph-edge"];
      if (isNegative) classes.push("negative");
      if (isPath) classes.push("is-path");
      if (isTrap) classes.push("is-trap");
      const marker = isTrap
        ? "arrow-trap"
        : isPath
          ? "arrow-path"
          : isNegative
            ? "arrow-negative"
            : "arrow-route";
      const group = svgElement("g", { class: "graph-edge-group" });
      const title = svgElement("title");
      title.textContent = `${edge.origem} para ${edge.destino}, peso ${edge.custo}`;
      const path = svgElement("path", {
        d: geometry.d,
        class: classes.join(" "),
        "marker-end": `url(#${marker})`,
      });
      const label = svgElement("g", {
        transform: `translate(${geometry.label.x} ${geometry.label.y})`,
      });
      const labelText = svgElement("text", {
        class: `edge-label${isNegative ? " negative" : ""}${isPath ? " is-path" : ""}${isTrap ? " is-trap" : ""}`,
        y: 0,
      });
      labelText.textContent = String(edge.custo);
      const labelBackground = svgElement("rect", {
        class: "edge-label-bg",
        x: -14,
        y: -9,
        width: 28,
        height: 18,
        rx: 6,
      });
      label.append(labelBackground, labelText);
      group.append(title, path, label);
      edgeLayer.append(group);
    });
    graphSvg.append(edgeLayer);

    const nodeLayer = svgElement("g");
    for (const vertex of vertices) {
      const position = nodePositions[vertex];
      const isTrap = trapNodes.has(vertex);
      const isPath = pathNodes.has(vertex) && !isTrap;
      const classes = ["graph-node"];
      if (vertex === source) classes.push("is-source");
      if (isPath) classes.push("is-path");
      if (isTrap) classes.push("is-trap");
      const group = svgElement("g", {
        class: classes.join(" "),
        transform: `translate(${position.x} ${position.y})`,
      });
      const title = svgElement("title");
      const distance = result ? result.dist[vertex] : null;
      title.textContent = result
        ? `${vertex}: distância ${distance === Infinity ? "infinita" : distance === -Infinity ? "menos infinita" : distance}`
        : `Vértice ${vertex}`;
      group.append(title, svgElement("circle", { r: 21 }), svgElement("text", { y: 1 }));
      group.querySelector("text").textContent = vertex;
      nodeLayer.append(group);
    }
    graphSvg.append(nodeLayer);
    graphSvg.setAttribute(
      "aria-label",
      `Mapa do grafo com ${vertices.length} vértices e ${edges.length} rotas.${trapNodes.size ? ` Ciclo negativo afetando ${[...trapNodes].join(", ")}.` : ""}`
    );

    const affectedTarget = result && result.dist[target] === -Infinity;
    cycleAlert.hidden = !result || !result.temCicloNegativo;
    document.querySelector("#cycle-alert-message").textContent = result && result.temCicloNegativo
      ? affectedTarget
        ? `Ciclo negativo detectado. ${target} é afetado pela armadilha; o caminho mínimo não está definido.`
        : `Ciclo negativo detectado. O loop está destacado em vermelho; ${target} não é afetado.`
      : "";
    routeAlert.hidden = !result || result.dist[target] !== Infinity;
    routeAlert.textContent = result && result.dist[target] === Infinity
      ? `Não existe caminho orientado de ${source} até ${target}. Confira o sentido das arestas; o algoritmo foi executado normalmente.`
      : "";
    if (result) {
      if (result.temCicloNegativo) {
        setStatus("Ciclo negativo detectado. Distâncias afetadas exibidas como −∞.", true);
      } else if (result.dist[target] === Infinity) {
        setStatus(`Análise concluída: não há caminho orientado de ${source} até ${target}.`);
      } else {
        setStatus(`Análise concluída. Caminho mínimo até ${target} atualizado.`);
      }
    }
  }

  function renderEdges() {
    edgeList.replaceChildren();
    edges.forEach((edge, index) => {
      const row = document.createElement("tr");
      const originCell = document.createElement("td");
      const arrowCell = document.createElement("td");
      const destinationCell = document.createElement("td");
      const weightCell = document.createElement("td");
      const actionCell = document.createElement("td");
      const removeButton = document.createElement("button");

      originCell.textContent = edge.origem;
      arrowCell.textContent = "→";
      arrowCell.className = "edge-arrow";
      destinationCell.textContent = edge.destino;
      weightCell.textContent = String(edge.custo);
      weightCell.className = `weight-value${edge.custo < 0 ? " weight-negative" : ""}`;
      removeButton.type = "button";
      removeButton.className = "remove-edge";
      removeButton.textContent = "×";
      removeButton.setAttribute("aria-label", `Remover aresta ${edge.origem} para ${edge.destino}`);
      removeButton.addEventListener("click", () => {
        edges.splice(index, 1);
        renderEdges();
        clearResults();
        setStatus("Grafo atualizado. Execute novamente para recalcular.");
      });

      actionCell.append(removeButton);
      row.append(originCell, arrowCell, destinationCell, weightCell, actionCell);
      edgeList.append(row);
    });

    document.querySelector("#empty-edges").hidden = edges.length > 0;
    edgeCount.textContent = `${edges.length} ${edges.length === 1 ? "aresta" : "arestas"}`;
  }

  function setStatus(message, warning = false) {
    statusMessage.textContent = message;
    statusBanner.classList.toggle("is-warning", warning);
  }

  function clearFeedback() {
    feedback.hidden = true;
    feedback.textContent = "";
  }

  function clearResults() {
    latestResult = null;
    renderGraph(null);
    resultsList.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    row.className = "placeholder-row";
    cell.colSpan = 3;
    cell.textContent = "Execute o algoritmo para ver os resultados.";
    row.append(cell);
    resultsList.append(row);
    document.querySelector("#reachable-count").textContent = "—";
    document.querySelector("#cycle-status").textContent = "—";
    document.querySelector("#minimum-risk").textContent = "—";
    document.querySelector("#maximum-risk").textContent = "—";
    document.querySelector("#trap-list").textContent = "—";
  }

  function renderResults(result, source) {
    latestResult = result;
    resultsList.replaceChildren();

    for (const vertex of vertices) {
      const row = document.createElement("tr");
      const vertexCell = document.createElement("td");
      const distanceCell = document.createElement("td");
      const pathCell = document.createElement("td");
      const badge = document.createElement("span");
      const distance = result.dist[vertex];
      const path = rota(result.pred, result.dist, vertex);

      badge.className = `vertex-badge${vertex === source ? " vertex-source" : ""}`;
      badge.textContent = vertex;
      vertexCell.append(badge);
      distanceCell.textContent = distance === Infinity ? "∞" : distance === -Infinity ? "−∞" : String(distance);
      distanceCell.className = "distance-value";
      pathCell.textContent = path;
      pathCell.className = "path-value";
      if (distance === -Infinity) pathCell.classList.add("path-negative");
      if (distance === Infinity) pathCell.classList.add("path-unreachable");
      row.append(vertexCell, distanceCell, pathCell);
      resultsList.append(row);
    }

    const reachable = vertices.filter((vertex) => result.dist[vertex] !== Infinity).length;
    document.querySelector("#reachable-count").textContent = `${reachable} / ${vertices.length}`;
    document.querySelector("#cycle-status").textContent = result.temCicloNegativo ? "Detectado" : "Não";
    const finiteDestinations = vertices.filter(
      (vertex) => vertex !== source && Number.isFinite(result.dist[vertex])
    );
    if (finiteDestinations.length) {
      const minimum = finiteDestinations.reduce((best, vertex) =>
        result.dist[vertex] < result.dist[best] ? vertex : best
      );
      const maximum = finiteDestinations.reduce((best, vertex) =>
        result.dist[vertex] > result.dist[best] ? vertex : best
      );
      document.querySelector("#minimum-risk").textContent = `${minimum} · ${result.dist[minimum]}`;
      document.querySelector("#maximum-risk").textContent = `${maximum} · ${result.dist[maximum]}`;
    } else {
      document.querySelector("#minimum-risk").textContent = "Nenhum";
      document.querySelector("#maximum-risk").textContent = "Nenhum";
    }
    const traps = vertices.filter((vertex) => result.dist[vertex] === -Infinity);
    document.querySelector("#trap-list").textContent = traps.length ? traps.join(", ") : "Nenhuma";
    renderGraph(result);
  }

  document.querySelector("#run-button").addEventListener("click", () => {
    clearFeedback();
    try {
      const result = bellmanFord(vertices, edges, sourceSelect.value, false);
      renderResults(result, sourceSelect.value);
    } catch (error) {
      latestResult = null;
      renderGraph(null);
      feedback.textContent = `${error.name}: ${error.message}`;
      feedback.hidden = false;
      setStatus("Não foi possível analisar o grafo.", true);
    }
  });

  edgeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFeedback();
    if (!edgeWeight.value.trim()) {
      feedback.textContent = "Informe um peso numérico para a aresta.";
      feedback.hidden = false;
      return;
    }

    const weight = Number(edgeWeight.value);
    if (!Number.isFinite(weight)) {
      feedback.textContent = "O peso deve ser um número finito.";
      feedback.hidden = false;
      return;
    }

    edges.push({ origem: edgeFrom.value, destino: edgeTo.value, custo: weight });
    edgeWeight.value = "";
    renderEdges();
    clearResults();
    setStatus("Aresta adicionada. Execute novamente para recalcular.");
  });

  document.querySelector("#reset-button").addEventListener("click", () => {
    edges = arestasOriginais.map((edge) => ({ ...edge }));
    populateVertexSelects();
    renderEdges();
    clearResults();
    clearFeedback();
    setStatus("Exemplo original restaurado.");
  });

  pathTarget.addEventListener("change", () => renderGraph());
  sourceSelect.addEventListener("change", () => {
    clearResults();
    setStatus("Origem alterada. Execute novamente para recalcular.");
  });

  populateVertexSelects();
  renderEdges();
  renderGraph(null);
})();
