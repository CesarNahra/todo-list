const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

let tarefas = [];

// MIME types dos arquivos estáticos suportados.
const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".ico": "image/x-icon"
};

// Envia uma resposta JSON ao cliente.
function enviarJSON(res, statusCode, dados) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });

    res.end(JSON.stringify(dados));
}

// Lê o corpo de uma requisição JSON.
function lerCorpo(req) {
    return new Promise((resolve, reject) => {
        let corpo = "";
        const limite = 1024 * 1024; // 1 MB

        req.on("data", (chunk) => {
            corpo += chunk.toString();

            if (Buffer.byteLength(corpo) > limite) {
                const erro = new Error("Corpo da requisição muito grande.");
                erro.statusCode = 413;

                reject(erro);
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(corpo ? JSON.parse(corpo) : {});
            } catch {
                const erro = new Error("JSON inválido.");
                erro.statusCode = 400;

                reject(erro);
            }
        });

        req.on("error", reject);
    });
}

// Disponibiliza os arquivos estáticos da pasta public.
function servirArquivo(req, res, pathname) {
    let caminhoRelativo;

    if (pathname === "/") {
        caminhoRelativo = "index.html";
    } else {
        try {
            caminhoRelativo = decodeURIComponent(pathname.slice(1));
        } catch {
            enviarJSON(res, 400, {
                erro: "Caminho inválido."
            });
            return;
        }
    }

    // Impede caminhos absolutos e tentativas de sair de public.
    const caminhoArquivo = path.resolve(PUBLIC_DIR, caminhoRelativo);
    const caminhoRelativoSeguro = path.relative(
        PUBLIC_DIR,
        caminhoArquivo
    );

    if (
        caminhoRelativoSeguro === ".." ||
        caminhoRelativoSeguro.startsWith(`..${path.sep}`) ||
        path.isAbsolute(caminhoRelativoSeguro)
    ) {
        enviarJSON(res, 403, {
            erro: "Acesso negado."
        });
        return;
    }

    fs.stat(caminhoArquivo, (erro, estatisticas) => {
        if (erro || !estatisticas.isFile()) {
            enviarJSON(res, 404, {
                erro: "Arquivo não encontrado."
            });
            return;
        }

        const extensao = path.extname(caminhoArquivo).toLowerCase();
        const contentType = MIME_TYPES[extensao];

        if (!contentType) {
            enviarJSON(res, 403, {
                erro: "Tipo de arquivo não permitido."
            });
            return;
        }

        res.writeHead(200, {
            "Content-Type": contentType,
            "X-Content-Type-Options": "nosniff"
        });

        const arquivo = fs.createReadStream(caminhoArquivo);

        arquivo.on("error", () => {
            if (!res.headersSent) {
                enviarJSON(res, 500, {
                    erro: "Erro ao ler o arquivo."
                });
            } else {
                res.destroy();
            }
        });

        arquivo.pipe(res);
    });
}

// Gerencia os endpoints da API.
async function gerenciarAPI(req, res, pathname) {
    // GET /api/tarefas
    if (pathname === "/api/tarefas" && req.method === "GET") {
        enviarJSON(res, 200, tarefas);
        return;
    }

    // POST /api/tarefas
    if (pathname === "/api/tarefas" && req.method === "POST") {
        const dados = await lerCorpo(req);

        if (
            typeof dados.titulo !== "string" ||
            !dados.titulo.trim()
        ) {
            enviarJSON(res, 400, {
                erro: "O título da tarefa é obrigatório."
            });
            return;
        }

        const titulo = dados.titulo.trim();

        if (titulo.length > 200) {
            enviarJSON(res, 400, {
                erro: "O título deve ter no máximo 200 caracteres."
            });
            return;
        }

        const novaTarefa = {
            id: randomUUID(),
            titulo,
            concluida: false
        };

        tarefas.push(novaTarefa);

        enviarJSON(res, 201, novaTarefa);
        return;
    }

    // PATCH /api/tarefas/:id
    const rotaTarefa = pathname.match(
        /^\/api\/tarefas\/([^/]+)$/
    );

    if (rotaTarefa) {
        const id = rotaTarefa[1];

        const indice = tarefas.findIndex(
            (tarefa) => tarefa.id === id
        );

        if (indice === -1) {
            enviarJSON(res, 404, {
                erro: "Tarefa não encontrada."
            });
            return;
        }

        // PATCH: alterna o status da tarefa.
        if (req.method === "PATCH") {
            tarefas[indice].concluida =
                !tarefas[indice].concluida;

            enviarJSON(res, 200, tarefas[indice]);
            return;
        }

        // DELETE /api/tarefas/:id
        if (req.method === "DELETE") {
            const [tarefaRemovida] = tarefas.splice(indice, 1);

            enviarJSON(res, 200, {
                mensagem: "Tarefa excluída com sucesso.",
                tarefa: tarefaRemovida
            });
            return;
        }
    }

    enviarJSON(res, 404, {
        erro: "Rota da API não encontrada."
    });
}

// Cria o servidor HTTP.
const servidor = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const pathname = url.pathname;

        if (pathname.startsWith("/api/")) {
            await gerenciarAPI(req, res, pathname);
            return;
        }

        if (req.method !== "GET" && req.method !== "HEAD") {
            enviarJSON(res, 405, {
                erro: "Método HTTP não permitido."
            });
            return;
        }

        servirArquivo(req, res, pathname);
    } catch (erro) {
        if (!res.headersSent && !res.destroyed) {
            enviarJSON(res, erro.statusCode || 500, {
                erro: erro.statusCode
                    ? erro.message
                    : "Erro interno do servidor."
            });
        }
    }
});

servidor.listen(PORT, () => {
    console.log(`Servidor iniciado em http://localhost:${PORT}`);
});