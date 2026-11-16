let personagemDoTurno = null;
let ultimoPersonagemDaRodada = null;
let rodadaAtual = 0;
let proximaOrdemPersonagem = 0;
let eventosAventura = [];
let historicoTurnos = [];

const turnStatus = document.getElementById('turnStatus');
const tabelaDano = {
    inconveniente: { nome: 'Inconveniente', cd: '10–11', bonusMin: 3, bonusMax: 5, dadosPorNivel: [1, 2, 4, 10] },
    perigosa: { nome: 'Perigosa', cd: '12–15', bonusMin: 6, bonusMax: 8, dadosPorNivel: [2, 4, 10, 18] },
    mortal: { nome: 'Mortal', cd: '16–20', bonusMin: 9, bonusMax: 12, dadosPorNivel: [4, 10, 18, 24] }
};
const faixasDeNivelDano = [
    { maximo: 4, descricao: '1–4' },
    { maximo: 10, descricao: '5–10' },
    { maximo: 16, descricao: '11–16' },
    { maximo: 20, descricao: '17–20' }
];

function obterRegraDano(gravidade, nivel) {
    const regra = tabelaDano[gravidade];
    const indiceNivel = faixasDeNivelDano.findIndex(faixa => nivel <= faixa.maximo);
    return {
        ...regra,
        faixaNivel: faixasDeNivelDano[indiceNivel].descricao,
        quantidadeDados: regra.dadosPorNivel[indiceNivel]
    };
}

function rolarDadosDano(gravidade, nivel) {
    const regra = obterRegraDano(gravidade, nivel);
    const rolagens = Array.from(
        { length: regra.quantidadeDados },
        () => Math.floor(Math.random() * 10) + 1
    );
    return {
        regra,
        rolagens,
        total: rolagens.reduce((soma, resultado) => soma + resultado, 0)
    };
}

function limparResultadoAtaque() {
    document.querySelector('#damageAttackRollResult .attack-roll-calculation').textContent = '';
    document.querySelector('#damageAttackRollResult .attack-roll-total').textContent = '';
}

function atualizarPreviaCalculadoraDano() {
    const nivelInput = document.getElementById('damageCalculatorLevel');
    const gravidade = document.getElementById('damageCalculatorSeverity').value;
    const nivel = Number(nivelInput.value);
    const resultado = document.getElementById('damageCalculatorResult');
    const resultadoAtaque = document.getElementById('damageAttackResult');
    const bonusSelect = document.getElementById('damageAttackBonusSelect');

    resultado.hidden = true;
    document.getElementById('damageRollResult').textContent = '';
    resultadoAtaque.hidden = true;
    limparResultadoAtaque();
    if (!Number.isSafeInteger(nivel) || nivel < 1 || nivel > 20) {
        document.getElementById('damageResistanceDc').textContent = '—';
        document.getElementById('damageAttackBonus').textContent = '—';
        document.getElementById('damageDiceFormula').textContent = '—';
        bonusSelect.innerHTML = '';
        bonusSelect.disabled = true;
        document.getElementById('rollAttackButton').disabled = true;
        return;
    }

    const regra = obterRegraDano(gravidade, nivel);
    document.getElementById('damageResistanceDc').textContent = regra.cd;
    document.getElementById('damageAttackBonus').textContent = `+${regra.bonusMin} até +${regra.bonusMax}`;
    document.getElementById('damageDiceFormula').textContent = `${regra.quantidadeDados}d10 (nível ${regra.faixaNivel})`;

    const bonusAnterior = Number(bonusSelect.value);
    bonusSelect.innerHTML = '';
    for (let bonus = regra.bonusMin; bonus <= regra.bonusMax; bonus++) {
        const opcao = document.createElement('option');
        opcao.value = String(bonus);
        opcao.textContent = `+${bonus}`;
        bonusSelect.appendChild(opcao);
    }
    bonusSelect.value = String(
        Number.isInteger(bonusAnterior) && bonusAnterior >= regra.bonusMin && bonusAnterior <= regra.bonusMax
            ? bonusAnterior
            : regra.bonusMin
    );
    bonusSelect.disabled = false;
    document.getElementById('rollAttackButton').disabled = false;
}

function renderizarEventosAventura() {
    const lista = document.getElementById('eventList');
    const alerta = document.getElementById('pendingEventAlert');
    lista.innerHTML = '';
    alerta.hidden = eventosAventura.length === 0;

    if (eventosAventura.length === 0) {
        alerta.textContent = '⚠';
        alerta.setAttribute('aria-label', 'Nenhum evento aguardando');
        alerta.title = 'Nenhum evento aguardando';
        const vazio = document.createElement('li');
        vazio.textContent = 'Nenhum evento agendado.';
        lista.appendChild(vazio);
        return;
    }

    const menorContagem = Math.min(...eventosAventura.map(evento => evento.rodadasRestantes));
    const unidade = menorContagem === 1 ? 'volta' : 'voltas';
    alerta.textContent = `⚠ ${menorContagem}`;
    alerta.setAttribute(
        'aria-label',
        `Menor contagem: ${menorContagem} ${unidade}; ${eventosAventura.length} eventos pendentes. Clique para ver detalhes.`
    );
    alerta.title = `Menor contagem: ${menorContagem} ${unidade}; ${eventosAventura.length} eventos pendentes.`;

    [...eventosAventura]
        .sort((a, b) => a.rodadasRestantes - b.rodadasRestantes)
        .forEach(evento => {
            const item = document.createElement('li');
            const descricao = document.createElement('span');
            const voltas = evento.rodadasRestantes === 1 ? 'volta' : 'voltas';
            descricao.textContent = `${evento.nome} — faltam ${evento.rodadasRestantes} ${voltas} até ${descreverIniciativa(evento.personagemAncora)}`;

            const remover = document.createElement('button');
            remover.className = 'event-remove';
            remover.type = 'button';
            remover.dataset.id = evento.id;
            remover.textContent = 'Remover';
            remover.setAttribute('aria-label', `Remover evento: ${evento.nome}`);

            item.append(descricao, remover);
            lista.appendChild(item);
        });
}

function renderizarAvisoEventos(eventos) {
    const mensagens = document.getElementById('eventMessages');
    mensagens.innerHTML = '';
    eventos.forEach(evento => {
        const item = document.createElement('li');
        item.textContent = evento.nome;
        mensagens.appendChild(item);
    });
    document.getElementById('eventNoticeDialog').showModal();
}

function descreverIniciativa(personagem) {
    if (!personagem) return 'a próxima iniciativa';
    const iniciativa = Number.parseInt(personagem.querySelector('.iniciativa-input').value, 10);
    const nome = personagem.querySelector('input:not(.iniciativa-input):not(.ca-input):not(.hp-input)').value.trim() || 'Personagem';
    return `${nome} (iniciativa ${iniciativa})`;
}

function processarEventosNaIniciativa(personagemAtivo) {
    const container = document.getElementById('charactersContainer');
    const eventosDisparados = [];

    eventosAventura.forEach(evento => {
        if (!evento.personagemAncora || !container.contains(evento.personagemAncora)) {
            evento.personagemAncora = personagemAtivo;
            evento.aguardandoInicio = true;
        }

        if (evento.personagemAncora !== personagemAtivo) return;
        if (evento.aguardandoInicio) {
            evento.aguardandoInicio = false;
            return;
        }

        evento.rodadasRestantes -= 1;
        if (evento.rodadasRestantes <= 0) eventosDisparados.push(evento);
    });

    if (eventosDisparados.length === 0) {
        renderizarEventosAventura();
        return [];
    }
    const idsDisparados = new Set(eventosDisparados.map(evento => evento.id));
    eventosAventura = eventosAventura.filter(evento => !idsDisparados.has(evento.id));
    renderizarEventosAventura();
    renderizarAvisoEventos(eventosDisparados);
    return eventosDisparados;
}

function abrirModalEvento() {
    const modal = document.getElementById('eventDialog');
    if (modal.open) return;
    renderizarEventosAventura();
    modal.showModal();
}

document.getElementById('generateEventButton').addEventListener('click', abrirModalEvento);
document.getElementById('pendingEventAlert').addEventListener('click', abrirModalEvento);
document.getElementById('openDamageCalculatorButton').addEventListener('click', function() {
    atualizarPreviaCalculadoraDano();
    document.getElementById('damageCalculatorDialog').showModal();
});

document.getElementById('damageCalculatorSeverity').addEventListener('change', atualizarPreviaCalculadoraDano);
document.getElementById('damageCalculatorLevel').addEventListener('input', function() {
    this.setCustomValidity('');
    atualizarPreviaCalculadoraDano();
});

document.getElementById('damageAttackBonusSelect').addEventListener('change', function() {
    document.getElementById('damageAttackResult').hidden = true;
    limparResultadoAtaque();
});

document.getElementById('rollAttackButton').addEventListener('click', function() {
    const bonusSelect = document.getElementById('damageAttackBonusSelect');
    const bonus = Number(bonusSelect.value);
    if (!Number.isSafeInteger(bonus)) {
        bonusSelect.setCustomValidity('Selecione um bônus de ataque válido.');
        bonusSelect.reportValidity();
        return;
    }
    bonusSelect.setCustomValidity('');

    const resultadoD20 = Math.floor(Math.random() * 20) + 1;
    const total = resultadoD20 + bonus;
    document.querySelector('#damageAttackRollResult .attack-roll-calculation').textContent =
        `(D20: ${resultadoD20} + ${bonus})`;
    document.querySelector('#damageAttackRollResult .attack-roll-total').textContent = String(total);
    document.getElementById('damageAttackResult').hidden = false;
});

document.getElementById('damageCalculatorForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const nivelInput = document.getElementById('damageCalculatorLevel');
    const nivel = Number(nivelInput.value);
    if (!Number.isSafeInteger(nivel) || nivel < 1 || nivel > 20) {
        nivelInput.setCustomValidity('Informe um nível inteiro entre 1 e 20.');
        nivelInput.reportValidity();
        return;
    }
    nivelInput.setCustomValidity('');

    const gravidade = document.getElementById('damageCalculatorSeverity').value;
    const { total } = rolarDadosDano(gravidade, nivel);
    const resultado = document.getElementById('damageCalculatorResult');
    document.getElementById('damageRollResult').textContent = String(total);
    resultado.hidden = false;
});

document.getElementById('closeDamageCalculator').addEventListener('click', function() {
    document.getElementById('damageCalculatorDialog').close();
});

document.getElementById('closeEventDialog').addEventListener('click', function() {
    document.getElementById('eventDialog').close();
});

document.getElementById('closeDamageCalculatorTop').addEventListener('click', function() {
    document.getElementById('damageCalculatorDialog').close();
});

document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;
    const dialog = document.querySelector('#eventDialog[open], #damageCalculatorDialog[open]');
    if (!dialog) return;
    event.preventDefault();
    dialog.close();
});

document.getElementById('eventForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const nome = document.getElementById('eventName');
    const atraso = document.getElementById('eventDelay');
    const quantidade = Number(atraso.value);

    if (!nome.value.trim()) {
        nome.setCustomValidity('Informe o que vai acontecer.');
        nome.reportValidity();
        return;
    }
    nome.setCustomValidity('');

    if (!Number.isSafeInteger(quantidade) || quantidade < 1) {
        atraso.setCustomValidity('Informe um número inteiro de rodadas válido.');
        atraso.reportValidity();
        return;
    }
    atraso.setCustomValidity('');

    let id = Date.now();
    while (eventosAventura.some(eventoAgendado => eventoAgendado.id === id)) {
        id += 1;
    }
    const container = document.getElementById('charactersContainer');
    const turnoAtivo = personagemDoTurno && container.contains(personagemDoTurno)
        ? personagemDoTurno
        : null;
    const personagemAncora = turnoAtivo || obterPersonagensOrdenados()[0]?.elemento || null;
    const novoEvento = {
        id,
        nome: nome.value.trim(),
        rodadasRestantes: quantidade,
        personagemAncora,
        aguardandoInicio: !turnoAtivo
    };
    eventosAventura.push(novoEvento);
    historicoTurnos.forEach(estado => {
        if (!estado.eventosAventura.some(evento => evento.id === id)) {
            estado.eventosAventura.push({ ...novoEvento });
        }
    });
    renderizarEventosAventura();
    this.reset();
    document.getElementById('eventDialog').close();
});

document.getElementById('cancelEvent').addEventListener('click', function() {
    document.getElementById('eventDialog').close();
});

document.getElementById('eventDialog').addEventListener('close', function() {
    const form = document.getElementById('eventForm');
    form.reset();
    document.getElementById('eventName').setCustomValidity('');
    document.getElementById('eventDelay').setCustomValidity('');
});

document.getElementById('eventName').addEventListener('input', function() {
    this.setCustomValidity('');
});

document.getElementById('eventDelay').addEventListener('input', function() {
    this.setCustomValidity('');
});

document.getElementById('eventList').addEventListener('click', function(event) {
    const botao = event.target.closest('.event-remove');
    if (!botao) return;
    const id = Number(botao.dataset.id);
    eventosAventura = eventosAventura.filter(evento => evento.id !== id);
    historicoTurnos.forEach(estado => {
        estado.eventosAventura = estado.eventosAventura.filter(evento => evento.id !== id);
    });
    renderizarEventosAventura();
});

document.getElementById('closeEventNotice').addEventListener('click', function() {
    document.getElementById('eventNoticeDialog').close();
});

renderizarEventosAventura();

function atualizarDestaqueTopo() {
    const personagens = document.querySelectorAll('#charactersContainer .personagem');
    personagens.forEach((personagem, indice) => {
        personagem.classList.toggle('turno-atual', indice === 0);
    });
}

function obterPersonagensOrdenados() {
    const container = document.getElementById('charactersContainer');
    const botoesDiv = container.querySelector('.botoes-container');
    const personagens = Array.from(container.querySelectorAll('.personagem'))
        .map(personagem => ({
            elemento: personagem,
            iniciativa: Number.parseInt(personagem.querySelector('.iniciativa-input').value, 10),
            ordem: Number(personagem.dataset.ordemIniciativa)
        }))
        .sort((a, b) => {
            const aTemIniciativa = Number.isInteger(a.iniciativa);
            const bTemIniciativa = Number.isInteger(b.iniciativa);
            if (aTemIniciativa !== bTemIniciativa) {
                return aTemIniciativa ? -1 : 1;
            }
            return (aTemIniciativa ? b.iniciativa - a.iniciativa : 0) || a.ordem - b.ordem;
        });

    personagens.forEach(personagem => container.insertBefore(personagem.elemento, botoesDiv));
    atualizarDestaqueTopo();
    return personagens.filter(personagem => Number.isInteger(personagem.iniciativa));
}

function limparTurno() {
    if (personagemDoTurno) {
        personagemDoTurno.classList.remove('turno-atual');
    }
    personagemDoTurno = null;
    ultimoPersonagemDaRodada = null;
    rodadaAtual = 0;
    turnStatus.textContent = 'Preencha as iniciativas para começar.';
}

function atualizarBotaoVoltar() {
    document.getElementById('previousTurn').disabled = historicoTurnos.length === 0;
}

function guardarEstadoTurno(container) {
    return {
        personagens: Array.from(container.querySelectorAll('.personagem')),
        personagemDoTurno,
        ultimoPersonagemDaRodada,
        rodadaAtual,
        eventosAventura: eventosAventura.map(evento => ({ ...evento })),
        status: turnStatus.textContent
    };
}

function voltarTurno() {
    const estado = historicoTurnos.pop();
    if (!estado) return;

    const container = document.getElementById('charactersContainer');
    const botoesDiv = container.querySelector('.botoes-container');
    estado.personagens.forEach(personagem => container.insertBefore(personagem, botoesDiv));

    personagemDoTurno = estado.personagemDoTurno;
    ultimoPersonagemDaRodada = estado.ultimoPersonagemDaRodada;
    rodadaAtual = estado.rodadaAtual;
    const eventosAtuais = eventosAventura;
    eventosAventura = eventosAtuais.map(eventoAtual => {
        const eventoAnterior = estado.eventosAventura.find(evento => evento.id === eventoAtual.id);
        return eventoAnterior ? { ...eventoAnterior } : eventoAtual;
    });
    estado.eventosAventura.forEach(eventoAnterior => {
        if (!eventosAventura.some(eventoAtual => eventoAtual.id === eventoAnterior.id)) {
            eventosAventura.push({ ...eventoAnterior });
        }
    });
    turnStatus.textContent = estado.status;

    const avisoEventos = document.getElementById('eventNoticeDialog');
    if (avisoEventos.open) avisoEventos.close();
    renderizarEventosAventura();
    atualizarDestaqueTopo();
    atualizarBotaoVoltar();
}

document.getElementById('previousTurn').addEventListener('click', voltarTurno);
atualizarBotaoVoltar();

document.getElementById('advanceTurn').addEventListener('click', function() {
    const container = document.getElementById('charactersContainer');
    let personagens = Array.from(container.querySelectorAll('.personagem'))
        .map(elemento => ({
            elemento,
            iniciativa: Number.parseInt(elemento.querySelector('.iniciativa-input').value, 10)
        }))
        .filter(personagem => Number.isInteger(personagem.iniciativa));

    if (personagens.length === 0) {
        limparTurno();
        turnStatus.textContent = 'Preencha ao menos uma iniciativa válida.';
        historicoTurnos = [];
        atualizarBotaoVoltar();
        return;
    }

    const estadoAnterior = guardarEstadoTurno(container);
    const indiceAtual = personagens.findIndex(personagem => personagem.elemento === personagemDoTurno);
    if (indiceAtual === -1 || !container.contains(ultimoPersonagemDaRodada)) {
        personagens = obterPersonagensOrdenados();
        if (personagens.length === 0) {
            limparTurno();
            turnStatus.textContent = 'Preencha ao menos uma iniciativa válida.';
            return;
        }
        rodadaAtual = 1;
        ultimoPersonagemDaRodada = personagens[personagens.length - 1].elemento;
    } else {
        personagemDoTurno.classList.remove('turno-atual');
        const botoesDiv = container.querySelector('.botoes-container');
        container.insertBefore(personagemDoTurno, botoesDiv);
        if (personagemDoTurno === ultimoPersonagemDaRodada) {
            rodadaAtual++;
        }
    }

    personagemDoTurno = indiceAtual === -1
        ? personagens[0].elemento
        : personagens[(indiceAtual + 1) % personagens.length].elemento;
    container.insertBefore(personagemDoTurno, container.querySelector('.header').nextSibling);
    atualizarDestaqueTopo();

    const iniciativaAtual = Number.parseInt(personagemDoTurno.querySelector('.iniciativa-input').value, 10);
    const nomeAtual = personagemDoTurno.querySelector('input:not(.iniciativa-input):not(.ca-input):not(.hp-input)').value.trim() || 'Personagem';
    turnStatus.textContent = `Rodada ${rodadaAtual} — Vez de ${nomeAtual} (iniciativa ${iniciativaAtual})`;
    processarEventosNaIniciativa(personagemDoTurno);
    historicoTurnos.push(estadoAnterior);
    atualizarBotaoVoltar();
});

document.getElementById('sortInitiative').addEventListener('click', function() {
    historicoTurnos = [];
    atualizarBotaoVoltar();
    const personagens = obterPersonagensOrdenados();
    personagemDoTurno = personagens.length > 0 ? personagens[0].elemento : null;
    ultimoPersonagemDaRodada = personagens.length > 0
        ? personagens[personagens.length - 1].elemento
        : null;
    if (personagens.length > 0 && rodadaAtual === 0) {
        rodadaAtual = 1;
    }
    turnStatus.textContent = personagens.length > 0
        ? 'Lista organizada por iniciativa, da maior para a menor.'
        : 'Preencha ao menos uma iniciativa válida para organizar a lista.';
});

document.getElementById('addCharacter').addEventListener('click', function() {
    const container = document.getElementById('charactersContainer');
    const personagensAtuais = container.querySelectorAll('.personagem');
    
    // Verificar se atingiu o limite de 100 personagens
    if (personagensAtuais.length >= 100) {
        alert('Limite de 100 personagens atingido!');
        return;
    }

    historicoTurnos = [];
    atualizarBotaoVoltar();

    const personagemDiv = document.createElement('div');
    personagemDiv.classList.add('personagem');
    personagemDiv.dataset.ordemIniciativa = proximaOrdemPersonagem++;

    const iniciativaInput = document.createElement('input');
    iniciativaInput.classList.add('iniciativa-input');
    iniciativaInput.type = 'text';
    iniciativaInput.placeholder = 'Ini';
    iniciativaInput.inputMode = 'numeric';
    iniciativaInput.maxLength = 2;
    iniciativaInput.addEventListener('input', function() {
        iniciativaInput.value = iniciativaInput.value.replace(/\D/g, '').slice(0, 2);
        historicoTurnos = [];
        atualizarBotaoVoltar();
    });

    const nomeInput = document.createElement('input');
    nomeInput.placeholder = 'Nome do Personagem';
    nomeInput.type = 'text';

    const caInput = document.createElement('input');
    caInput.classList.add('ca-input');
    caInput.placeholder = 'CA';
    caInput.type = 'text';

    const vidaInput = document.createElement('input');
    vidaInput.classList.add('hp-input');
    vidaInput.placeholder = 'Vida Base';
    vidaInput.type = 'number';
    vidaInput.value = 100; // Valor padrão

    const danoInput = document.createElement('input');
    danoInput.placeholder = 'Ex: -10 ou +5';
    danoInput.type = 'text';
    danoInput.value = '';

    const calcularButton = document.createElement('button');
    calcularButton.textContent = 'Aplicar';

    const vidaDisplay = document.createElement('span');

    let vidaBase = parseInt(vidaInput.value); // Vida base inicial
    let danoTotal = 0; // Dano total acumulado

    // Função para atualizar a exibição da vida
    const atualizarVida = () => {
        let vidaAtual = vidaBase - danoTotal;
        // Limita a vida máxima ao valor da vida base
        if (vidaAtual > vidaBase) {
            vidaAtual = vidaBase;
        }
        // Limita a vida mínima a 0
        if (vidaAtual < 0) {
            vidaAtual = 0;
        }
        // Se a vida chegou a zero, exibe mensagem de morte
        if (vidaAtual === 0) {
            vidaDisplay.textContent = '☠ MORREU';
            vidaDisplay.classList.add('vida-morreu');
        } else {
            vidaDisplay.textContent = `Vida: ${vidaAtual}`;
            vidaDisplay.classList.remove('vida-morreu');
        }
    };

    // Inicializar a exibição
    atualizarVida();

    // Evento de mudança na vida base
    vidaInput.addEventListener('change', function() {
        vidaBase = parseInt(vidaInput.value) || 0;
        danoTotal = 0; // Reinicia o dano total
        danoInput.value = 0; // Limpa o campo de dano sofrido
        atualizarVida();
    });

    // Evento de Enter na vida base
    vidaInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            vidaBase = parseInt(vidaInput.value) || 0;
            danoTotal = 0; // Reinicia o dano total
            danoInput.value = 0; // Limpa o campo de dano sofrido
            atualizarVida();
            event.preventDefault();
        }
    });

    // Função para calcular o dano
    const calcularVida = () => {
        const valor = parseInt(danoInput.value) || 0; // Valor inserido pelo usuário
        const novoTotal = danoTotal - valor; // Calcula o novo total
        
        // Limita o danoTotal para não ultrapassar a vida base
        if (novoTotal <= 0) {
            danoTotal = 0; // Se for negativo, limita a 0 (vida máxima)
        } else if (vidaBase - novoTotal < 0) {
            danoTotal = vidaBase; // Se a vida ficaria negativa, limita ao máximo de dano
        } else {
            danoTotal = novoTotal; // Caso contrário, aplica normalmente
        }
        
        atualizarVida(); // Atualiza a exibição
        danoInput.value = ''; // Limpa o campo após o cálculo
    };

    // Evento de clique no botão para calcular dano
    calcularButton.addEventListener('click', calcularVida);

    // Evento de tecla pressionada (Enter) para calcular dano
    danoInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            calcularVida();
            event.preventDefault(); // Impede o envio do formulário
        }
    });

    personagemDiv.appendChild(iniciativaInput);
    personagemDiv.appendChild(nomeInput);
    personagemDiv.appendChild(caInput);
    personagemDiv.appendChild(vidaInput);
    personagemDiv.appendChild(danoInput);
    personagemDiv.appendChild(calcularButton);
    personagemDiv.appendChild(vidaDisplay);
    container.appendChild(personagemDiv);
    atualizarDestaqueTopo();
});

// Evento para reiniciar a lista
document.getElementById('resetButton').addEventListener('click', function() {
    const container = document.getElementById('charactersContainer');
    limparTurno();
    eventosAventura = [];
    historicoTurnos = [];
    atualizarBotaoVoltar();
    renderizarEventosAventura();
    const avisoEventos = document.getElementById('eventNoticeDialog');
    if (avisoEventos.open) avisoEventos.close();
    // Remove todos os personagens, mantendo apenas o header
    const personagens = container.querySelectorAll('.personagem');
    personagens.forEach(personagem => personagem.remove());
    // Remove os botões de deletar e adicionar
    const botoesDiv = container.querySelector('.botoes-container');
    if (botoesDiv) {
        botoesDiv.remove();
    }
});

// Função para atualizar a visibilidade do botão de deletar último
function atualizarBotaoDelete() {
    const container = document.getElementById('charactersContainer');
    let botoesDiv = container.querySelector('.botoes-container');
    const personagens = container.querySelectorAll('.personagem');

    // Remove o container antigo se existir
    if (botoesDiv) {
        botoesDiv.remove();
        botoesDiv = null;
    }

    // Cria novo container com botões se houver personagens
    if (personagens.length > 0) {
        botoesDiv = document.createElement('div');
        botoesDiv.classList.add('botoes-container');

        // Botão de deletar último
        const deleteLastBtn = document.createElement('button');
        deleteLastBtn.classList.add('deleteLastCharacter');
        deleteLastBtn.textContent = '-';
        deleteLastBtn.title = 'Deletar último personagem';
        deleteLastBtn.setAttribute('aria-label', 'Remover último personagem');

        deleteLastBtn.addEventListener('click', function() {
            const personagensAtuais = container.querySelectorAll('.personagem');
            if (personagensAtuais.length > 0) {
                historicoTurnos = [];
                atualizarBotaoVoltar();
                personagensAtuais[personagensAtuais.length - 1].remove();
                atualizarDestaqueTopo();
                atualizarBotaoDelete();
            }
        });

        // Botão de adicionar novo
        const addMoreBtn = document.createElement('button');
        addMoreBtn.classList.add('addMoreCharacter');
        addMoreBtn.textContent = '+';
        addMoreBtn.title = 'Adicionar novo personagem';
        addMoreBtn.setAttribute('aria-label', 'Adicionar personagem');

        addMoreBtn.addEventListener('click', function() {
            document.getElementById('addCharacter').click();
        });

        botoesDiv.appendChild(deleteLastBtn);
        botoesDiv.appendChild(addMoreBtn);
        container.appendChild(botoesDiv);
    }
}

// Atualizar botão quando adicionar personagem
document.getElementById('addCharacter').addEventListener('click', function() {
    setTimeout(atualizarBotaoDelete, 0);
}, true);