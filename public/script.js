const API_URL = "/api/tarefas";

// Elementos da interface.
const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const addButton = document.querySelector("#add-button");

const taskList = document.querySelector("#task-list");
const taskCount = document.querySelector("#task-count");
const totalCount = document.querySelector("#total-count");

const emptyState = document.querySelector("#empty-state");
const feedback = document.querySelector("#feedback");

// Guarda as tarefas carregadas do servidor.
let tarefas = [];

// Centraliza as requisições HTTP.
async function requisicaoAPI(url, options = {}) {
    const resposta = await fetch(url, options);

    const dados = await resposta.json();

    if (!resposta.ok) {
        throw new Error(
            dados.erro || "Não foi possível realizar a operação."
        );
    }

    return dados;
}

// Atualiza os contadores e o estado vazio.
function atualizarResumo() {
    const concluidas = tarefas.filter(
        (tarefa) => tarefa.concluida
    ).length;

    taskCount.textContent = concluidas;

    totalCount.textContent =
        `${tarefas.length} ${
            tarefas.length === 1 ? "tarefa" : "tarefas"
        }`;

    emptyState.hidden = tarefas.length > 0;
    taskList.hidden = tarefas.length === 0;
}

// Cria um elemento HTML para cada tarefa.
function criarElementoTarefa(tarefa) {
    const item = document.createElement("li");

    item.className = "task-item";

    if (tarefa.concluida) {
        item.classList.add("completed");
    }

    // Checkbox de conclusão.
    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = tarefa.concluida;

    checkbox.setAttribute(
        "aria-label",
        `Marcar "${tarefa.titulo}" como ${
            tarefa.concluida ? "não concluída" : "concluída"
        }`
    );

    checkbox.addEventListener("change", async () => {
        checkbox.disabled = true;

        try {
            await requisicaoAPI(
                `${API_URL}/${encodeURIComponent(tarefa.id)}`,
                {
                    method: "PATCH"
                }
            );

            await carregarTarefas();
            mostrarFeedback("");
        } catch (erro) {
            mostrarFeedback(erro.message);
            await carregarTarefas();
        } finally {
            checkbox.disabled = false;
        }
    });

    // Título da tarefa.
    const titulo = document.createElement("span");

    titulo.className = "task-title";

    // textContent impede que o título seja interpretado como HTML.
    titulo.textContent = tarefa.titulo;

    // Botão de exclusão.
    const botaoExcluir = document.createElement("button");

    botaoExcluir.type = "button";
    botaoExcluir.className = "delete-button";

    botaoExcluir.textContent = "×";
    botaoExcluir.setAttribute(
        "aria-label",
        `Excluir tarefa: ${tarefa.titulo}`
    );

    botaoExcluir.addEventListener("click", async () => {
        botaoExcluir.disabled = true;

        try {
            await requisicaoAPI(
                `${API_URL}/${encodeURIComponent(tarefa.id)}`,
                {
                    method: "DELETE"
                }
            );

            await carregarTarefas();
            mostrarFeedback("");
        } catch (erro) {
            mostrarFeedback(erro.message);
        } finally {
            botaoExcluir.disabled = false;
        }
    });

    item.append(checkbox, titulo, botaoExcluir);

    return item;
}

// Renderiza novamente a lista com os dados atuais.
function renderizarTarefas() {
    const fragmento = document.createDocumentFragment();

    tarefas.forEach((tarefa) => {
        fragmento.appendChild(criarElementoTarefa(tarefa));
    });

    taskList.replaceChildren(fragmento);

    atualizarResumo();
}

// Busca as tarefas armazenadas no servidor.
async function carregarTarefas() {
    try {
        tarefas = await requisicaoAPI(API_URL);

        renderizarTarefas();

        mostrarFeedback("");
    } catch (erro) {
        mostrarFeedback(
            `Não foi possível carregar as tarefas: ${erro.message}`
        );
    }
}

// Exibe mensagens de feedback.
function mostrarFeedback(mensagem) {
    feedback.textContent = mensagem;
}

// Envia uma nova tarefa.
taskForm.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const titulo = taskInput.value.trim();

    if (!titulo) {
        mostrarFeedback("Digite o título da tarefa.");
        taskInput.focus();
        return;
    }

    if (titulo.length > 200) {
        mostrarFeedback(
            "O título deve ter no máximo 200 caracteres."
        );
        return;
    }

    addButton.disabled = true;
    mostrarFeedback("");

    try {
        const novaTarefa = await requisicaoAPI(API_URL, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({ titulo })
        });

        tarefas.push(novaTarefa);

        renderizarTarefas();

        taskForm.reset();
        taskInput.focus();
    } catch (erro) {
        mostrarFeedback(erro.message);
    } finally {
        addButton.disabled = false;
    }
});

// Inicializa a aplicação.
carregarTarefas();