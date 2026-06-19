// ===== SISTEMA DE SAVE/LOAD =====
const STORAGE_KEY = 'darkDashboard_ficha';

function salvarLocalData() {
    try {
        const dados = coletarDados();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
    } catch (e) {
        console.error('Erro ao salvar dados:', e);
    }
}

function carregarLocalData() {
    try {
        const dados = localStorage.getItem(STORAGE_KEY);
        if (dados) {
            preencherDados(JSON.parse(dados));
        }
    } catch (e) {
        console.error('Erro ao carregar dados:', e);
    }
}

function coletarDados() {
    const dados = {};

    // Informações básicas
    const inputs = document.querySelectorAll('input[type="text"], input[type="number"], textarea');
    inputs.forEach(input => {
        if (input.id) {
            dados[input.id] = input.value;
        }
    });

    // Selects
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
        if (select.id) {
            dados[select.id] = select.value;
        }
    });

    // Checkboxes
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        if (checkbox.id) {
            dados[checkbox.id] = checkbox.checked;
        }
    });

    // Boxes preenchidas
    const boxes = document.querySelectorAll('.box.filled');
    dados.boxesFilled = Array.from(boxes).map((box, i) => i);

    // Inventory
    const inventario = [];
    document.querySelectorAll('.inventory-item').forEach(item => {
        const nome = item.querySelector('.item-name')?.textContent || '';
        const peso = item.querySelector('.item-weight')?.textContent || '';
        const desc = item.querySelector('.item-desc')?.textContent || '';
        inventario.push({ nome, peso, desc });
    });
    dados.inventario = inventario;

    return dados;
}

function preencherDados(dados) {
    // Inputs e textareas
    Object.keys(dados).forEach(key => {
        if (key === 'boxesFilled' || key === 'inventario') return;

        const elemento = document.getElementById(key);
        if (!elemento) return;

        if (elemento.type === 'checkbox') {
            elemento.checked = dados[key] === true;
        } else if (elemento.tagName === 'SELECT' || elemento.tagName === 'TEXTAREA') {
            elemento.value = dados[key] || '';
        } else if (elemento.type === 'text' || elemento.type === 'number') {
            elemento.value = dados[key] || '';
        }
    });

    // Restaurar boxes preenchidas
    if (dados.boxesFilled) {
        document.querySelectorAll('.box').forEach((box, i) => {
            box.classList.remove('filled');
        });
        dados.boxesFilled.forEach(i => {
            const boxes = document.querySelectorAll('.box');
            if (boxes[i]) boxes[i].classList.add('filled');
        });
    }

    // Restaurar inventário
    if (dados.inventario && dados.inventario.length > 0) {
        const inventarioList = document.getElementById('inventoryList');
        inventarioList.innerHTML = '';
        dados.inventario.forEach(item => {
            const div = document.createElement('div');
            div.className = 'inventory-item';
            div.innerHTML = `
                <div class="item-header">
                    <div>
                        <div class="item-name">${item.nome}</div>
                        <div class="item-desc">${item.desc}</div>
                    </div>
                    <div class="item-weight">${item.peso}</div>
                </div>
                <button class="item-remove" onclick="this.parentElement.remove(); salvarLocalData()">REMOVER</button>
            `;
            inventarioList.appendChild(div);
        });
    }

    atualizarCalculos();
}

// ===== FUNÇÕES DE INTERFACE =====
function toggleBox(element) {
    element.classList.toggle('filled');
    salvarLocalData();
}

function toggleMinimize(button) {
    const panel = button.closest('.panel');
    panel.classList.toggle('collapsed');
}

function switchTab(tabId) {
    // Esconder todas as abas
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar aba selecionada
    const tab = document.getElementById(tabId);
    if (tab) {
        tab.classList.add('active');
    }

    // Marcar botão como ativo
    event.target.classList.add('active');
}

function setTheme(theme, button) {
    document.body.className = '';
    button.parentElement.querySelectorAll('.pref-btn').forEach(b => {
        b.classList.remove('active');
    });
    button.classList.add('active');

    if (theme === 'architect') {
        document.body.classList.add('theme-architect');
    } else if (theme === 'light') {
        document.body.classList.add('theme-light');
    }
    // 'default' não precisa adicionar classe
}

function setLayout(layout, button) {
    button.parentElement.querySelectorAll('.pref-btn').forEach(b => {
        b.classList.remove('active');
    });
    button.classList.add('active');

    if (layout === 'paginas') {
        document.body.classList.add('layout-pages');
    } else {
        document.body.classList.remove('layout-pages');
    }
}

function toggleCombatMode(button) {
    document.body.classList.toggle('theme-combat');
    button.classList.toggle('active');
}

function toggleMute() {
    // Função para mute (opcional)
    console.log('Mute toggled');
}

// ===== ATRIBUTOS =====
function atualizarCalculos() {
    atualizarVitalStats();
    atualizarDefesa();
    atualizarCarga();
}

function atualizarVitalStats() {
    // VD
    const vdAtual = parseInt(document.getElementById('vd_atual')?.value) || 0;
    const vdMax = parseInt(document.getElementById('vd_max')?.value) || 0;
    const vdBonus = parseInt(document.getElementById('bonus_vd')?.value) || 0;

    // SAN
    const sanAtual = parseInt(document.getElementById('san_atual')?.value) || 0;
    const sanMax = parseInt(document.getElementById('san_max')?.value) || 0;
    const sanBonus = parseInt(document.getElementById('bonus_san')?.value) || 0;

    // PE
    const peAtual = parseInt(document.getElementById('pe_atual')?.value) || 0;
    const peMax = parseInt(document.getElementById('pe_max')?.value) || 0;
    const peBonus = parseInt(document.getElementById('bonus_pe')?.value) || 0;

    // Atualizar displays de bônus
    if (document.getElementById('vd_bonus_display')) {
        document.getElementById('vd_bonus_display').textContent = vdBonus > 0 ? `+${vdBonus}` : '';
    }
    if (document.getElementById('san_bonus_display')) {
        document.getElementById('san_bonus_display').textContent = sanBonus > 0 ? `+${sanBonus}` : '';
    }
    if (document.getElementById('pe_bonus_display')) {
        document.getElementById('pe_bonus_display').textContent = peBonus > 0 ? `+${peBonus}` : '';
    }

    // Atualizar status
    atualizarStatusBar('vd', vdAtual, vdMax + vdBonus);
    atualizarStatusBar('san', sanAtual, sanMax + sanBonus);
}

function atualizarStatusBar(tipo, atual, max) {
    const alertEl = document.getElementById(`${tipo}_status_display`);
    if (!alertEl) return;

    if (atual <= 0) {
        alertEl.textContent = `⚠️ CRÍTICO`;
        alertEl.style.color = 'var(--alert-color)';
    } else if (atual <= max * 0.25) {
        alertEl.textContent = `⚡ BAIXO`;
        alertEl.style.color = 'var(--gold-color)';
    } else {
        alertEl.textContent = '';
    }
}

function atualizarDefesa() {
    let def = 13; // valor base
    const vig = parseInt(document.getElementById('base_vig')?.value) || 0;
    def += Math.floor(vig / 2);

    // Penalidades de condições
    if (document.getElementById('cond_agarrado')?.checked) def -= 5;
    if (document.getElementById('cond_atordoado')?.checked) def -= 5;
    if (document.getElementById('cond_caido')?.checked) def -= 5;
    if (document.getElementById('cond_cego')?.checked) def -= 5;
    if (document.getElementById('cond_desprevenido')?.checked) def -= 5;
    if (document.getElementById('cond_enredado')?.checked) def -= 5;
    if (document.getElementById('cond_indefeso')?.checked) def -= 10;
    if (document.getElementById('cond_vulneravel')?.checked) def -= 5;

    const defBonus = parseInt(document.getElementById('bonus_def')?.value) || 0;
    def += defBonus;

    const defVal = document.getElementById('def_val');
    if (defVal) defVal.value = Math.max(0, def);
}

function atualizarCarga() {
    let cargaAtual = 0;
    document.querySelectorAll('.inventory-item').forEach(item => {
        const peso = parseFloat(item.querySelector('.item-weight')?.textContent) || 0;
        cargaAtual += peso;
    });

    const cargaDisplay = document.getElementById('cargaDisplay');
    if (cargaDisplay) {
        const cargaNormal = 4;
        const cargaMaxima = 8;
        cargaDisplay.textContent = `CARGA: ATUAL [ ${cargaAtual.toFixed(1)} ] | NORMAL [ ${cargaNormal} ] | MÁXIMA [ ${cargaMaxima} ]`;
        
        if (cargaAtual > cargaMaxima) {
            cargaDisplay.style.color = 'var(--alert-color)';
        } else if (cargaAtual > cargaNormal) {
            cargaDisplay.style.color = 'var(--gold-color)';
        } else {
            cargaDisplay.style.color = 'var(--accent-green)';
        }
    }
}

// ===== INVENTÁRIO =====
function adicionarItem() {
    const nome = document.getElementById('newItemName')?.value || '';
    const peso = document.getElementById('newItemWeight')?.value || '0';
    const desc = document.getElementById('newItemDesc')?.value || '';

    if (!nome) {
        alert('Digite o nome do equipamento!');
        return;
    }

    const item = document.createElement('div');
    item.className = 'inventory-item';
    item.innerHTML = `
        <div class="item-header">
            <div>
                <div class="item-name">${nome}</div>
                <div class="item-desc">${desc}</div>
            </div>
            <div class="item-weight">${peso}</div>
        </div>
        <button class="item-remove" onclick="this.parentElement.remove(); salvarLocalData()">REMOVER</button>
    `;

    document.getElementById('inventoryList').appendChild(item);

    // Limpar formulário
    document.getElementById('newItemName').value = '';
    document.getElementById('newItemWeight').value = '';
    document.getElementById('newItemDesc').value = '';

    atualizarCarga();
    salvarLocalData();
}

// ===== BÔNUS =====
function definirBonus(tipo) {
    const bonusEl = document.getElementById(`bonus_${tipo}`);
    if (!bonusEl) return;

    const bonusAtual = parseInt(bonusEl.value) || 0;
    const novoBonus = prompt(`${tipo.toUpperCase()} - Bônus atual: ${bonusAtual}\n\nDigite o novo bônus (ou deixe em branco para 0):`, bonusAtual);

    if (novoBonus !== null) {
        const valor = parseInt(novoBonus) || 0;
        bonusEl.value = valor;
        atualizarCalculos();
        salvarLocalData();
    }
}

// ===== IMPORT/EXPORT =====
function exportarFicha() {
    const dados = coletarDados();
    const json = JSON.stringify(dados, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ficha_personagem_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importarFicha(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const dados = JSON.parse(e.target.result);
            preencherDados(dados);
            salvarLocalData();
            alert('Ficha importada com sucesso!');
        } catch (erro) {
            alert('Erro ao importar ficha: ' + erro.message);
        }
    };
    reader.readAsText(file);
}

function resetarFicha() {
    if (confirm('Tem certeza que deseja resetar a ficha? Esta ação não pode ser desfeita.')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}

// ===== EXPORT PDF =====
function exportarParaPDF() {
    document.body.classList.add('theme-print');
    window.print();
    setTimeout(() => {
        document.body.classList.remove('theme-print');
    }, 100);
}

// ===== CLASSES E SUBCLASSES =====
const classesData = {
    brutalista: {
        subclasses: ['Berserker', 'Sentinela'],
        descricao: 'Especialista em combate direto e força bruta.'
    },
    tecnico: {
        subclasses: ['Hacker', 'Engenheiro'],
        descricao: 'Mestre da tecnologia e inovação.'
    },
    paranormalista: {
        subclasses: ['Místico', 'Vidente'],
        descricao: 'Controlador de poderes paranormais.'
    }
};

function handleClasseChange() {
    const classe = document.getElementById('classeSelect')?.value || '';
    const subclasseSelect = document.getElementById('subclasseSelect');
    const classDetails = document.getElementById('classDetails');

    if (!classe) {
        subclasseSelect.innerHTML = '<option value="">-- SELECIONE CLASSE PRIMEIRO --</option>';
        classDetails.style.display = 'none';
        return;
    }

    const data = classesData[classe];
    subclasseSelect.innerHTML = '<option value="">-- SELECIONE --</option>';
    
    if (data && data.subclasses) {
        data.subclasses.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.toLowerCase();
            opt.textContent = sub;
            subclasseSelect.appendChild(opt);
        });
    }

    if (data && classDetails) {
        classDetails.style.display = 'block';
        classDetails.innerHTML = `<span class="highlight">${classe.toUpperCase()}</span><br>${data.descricao}`;
    }

    salvarLocalData();
}

function handleSubclasseChange() {
    salvarLocalData();
}

// ===== DANO SANIDADE =====
function danoSanidade() {
    const san = parseInt(document.getElementById('san_atual')?.value) || 0;
    const dano = Math.max(1, Math.floor(Math.random() * 6) + 1);
    document.getElementById('san_atual').value = Math.max(0, san - dano);
    atualizarCalculos();
    salvarLocalData();
    alert(`Dano de Sanidade: -${dano}`);
}

function efeitoInstavel() {
    const efeitos = [
        'Abalado',
        'Apavorado',
        'Frustrado'
    ];
    const efeito = efeitos[Math.floor(Math.random() * efeitos.length)];
    alert(`Efeito Instável: ${efeito}`);
}

// ===== TESTES AUTOMATIZADOS =====
function runAutomatedTests() {
    alert('Sistema de testes ainda não implementado. Funcionalidades básicas estão operacionais!');
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    carregarLocalData();
    atualizarCalculos();
    
    // Auto-save a cada 30 segundos
    setInterval(salvarLocalData, 30000);
});
