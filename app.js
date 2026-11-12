const ASSET_INFO = {
    BTC: 'Bitcoin', BNB: 'BNB', ETH: 'Ethereum', SOL: 'Solana', PEPE: 'Pepe', DOGE: 'Dogecoin',
    ADA: 'Cardano', XRP: 'XRP', ALGO: 'Algorand', SUI: 'Sui', TRX: 'TRON', USDT: 'Tether USD',
};

function formatUsd(n) {
    const sign = n < 0 ? '-' : '';
    const v = Math.abs(n);
    return sign + '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSignedUsd(n) {
    const fmt = formatUsd(n);
    if (n > 0) return '+' + fmt;
    return fmt;
}

function formatQty(q) {
    if (q >= 1e6) return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(q);
    if (q >= 1000) return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(q);
    if (q >= 1) return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(q);
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(q);
}

function formatPrice(p) {
    if (p == null || Number.isNaN(p)) return '\u2014';
    if (p >= 1000) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    if (p >= 0.0001) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    return '$' + p.toExponential(4);
}

function formatTradeDate(s) {
    if (!s) return '\u2014';
    return String(s).split(' ')[0];
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function api(path, opts = {}) {
    const res = await fetch(path, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        ...opts,
    });
    const ct = res.headers.get('content-type') || '';
    const body = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();
    if (!res.ok) {
        const msg = body && body.detail ? (Array.isArray(body.detail) ? body.detail[0].msg : body.detail) : res.statusText;
        throw new Error(typeof msg === 'string' ? msg : 'Request failed');
    }
    return body;
}

function showView(name) {
    document.getElementById('view-login').style.display = name === 'login' ? 'block' : 'none';
    document.getElementById('view-app').style.display = name === 'app' ? 'block' : 'none';
}

function setTab(name) {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.getElementById('tab-portfolio').style.display = name === 'portfolio' ? 'block' : 'none';
    document.getElementById('tab-admin').style.display = name === 'admin' ? 'block' : 'none';
}

function getViewMode() {
    const mobile = window.matchMedia('(max-width: 768px)').matches;
    if (!mobile) return 'desktop';
    return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
}

const COLUMN_SETS = {
    desktop: [
        { key: 'asset', label: 'Asset' },
        { key: 'value', label: 'Value' },
        { key: 'pnl', label: 'P&L' },
        { key: 'qty', label: 'Qty' },
        { key: 'avgBuy', label: 'Avg Buy' },
        { key: 'currentPrice', label: 'Current Price' },
        { key: 'invested', label: 'Invested' },
        { key: 'value2', label: 'Value' },
        { key: 'lastTradeDate', label: 'Last Trade Date' },
    ],
    portrait: [
        { key: 'asset', label: 'Asset' },
        { key: 'avgBuy', label: 'Avg Buy' },
        { key: 'value', label: 'Value' },
        { key: 'pnl', label: 'P&L' },
        { key: 'lastTradeDate', label: 'Last Trade Date' },
    ],
    landscape: [
        { key: 'asset', label: 'Coin' },
        { key: 'avgBuy', label: 'Avg Buy' },
        { key: 'currentPrice', label: 'Current Price' },
        { key: 'value', label: 'Total' },
        { key: 'pnl', label: 'P&L' },
        { key: 'lastTradeDate', label: 'Last Trade Date' },
    ],
};

function buildTradeDetailTable(symbol, tradesBySymbol) {
    const list = tradesBySymbol[symbol] || [];
    if (!list.length) return '';
    const body = list.map((t) => {
        const side = String(t.type || t.side || '').toUpperCase();
        const sideCls = side === 'SELL' ? 'side-sell' : 'side-buy';
        const feeStr = formatQty(Number(t.fee)) + ' ' + escapeHtml(t.fee_coin || '');
        const src = t.source ? ' <span class="muted">(' + escapeHtml(t.source) + ')</span>' : '';
        return (
            '<tr>' +
            '<td>' + escapeHtml(String(t.date || '')) + src + '</td>' +
            '<td class="' + sideCls + '">' + escapeHtml(side) + '</td>' +
            '<td>' + formatPrice(Number(t.price)) + '</td>' +
            '<td>' + formatQty(Number(t.amount)) + '</td>' +
            '<td>' + formatUsd(Number(t.total)) + '</td>' +
            '<td>' + feeStr + '</td>' +
            '</tr>'
        );
    }).join('');
    return (
        '<div class="trade-detail-inner"><table class="trade-detail-table">' +
        '<thead><tr>' +
        '<th>Date</th><th>Side</th><th>Price</th><th>Qty</th><th>Total (quote)</th><th>Fee</th>' +
        '</tr></thead><tbody>' + body + '</tbody></table></div>'
    );
}

function renderTable(rowData, totals, mode, tradesBySymbol, expandedSymbols) {
    const columns = COLUMN_SETS[mode];
    const colCount = columns.length;
    const thead = document.getElementById('holdings-head');
    const tbody = document.getElementById('holdings-body');
    thead.innerHTML = '<tr>' + columns.map((c) => '<th>' + c.label + '</th>').join('') + '</tr>';
    tbody.innerHTML = '';

    for (const row of rowData) {
        const tr = document.createElement('tr');
        tr.className = 'holding-row';
        tr.dataset.symbol = row.symbol;
        const open = expandedSymbols.has(row.symbol);
        const chevron = open ? '\u25BC' : '\u25B6';
        tr.innerHTML = columns.map((col) => {
            const key = col.key;
            const cls = key === 'pnl' ? row.pnlClass : '';
            if (key === 'asset') {
                return (
                    '<td><span class="asset-cell" style="display:flex;align-items:center">' +
                    '<span class="asset-toggle" role="button" tabindex="0" aria-expanded="' + open + '">' + chevron + '</span>' +
                    '<span>' + escapeHtml(row.symbol) + '</span>' +
                    '</span></td>'
                );
            }
            if (key === 'value2') return '<td class="' + cls + '">' + row.value + '</td>';
            return '<td class="' + cls + '">' + row[key] + '</td>';
        }).join('');
        tbody.appendChild(tr);
        if (open) {
            const detailTr = document.createElement('tr');
            detailTr.className = 'detail-row';
            const td = document.createElement('td');
            td.colSpan = colCount;
            td.innerHTML = buildTradeDetailTable(row.symbol, tradesBySymbol);
            detailTr.appendChild(td);
            tbody.appendChild(detailTr);
        }
    }

    const totalTr = document.createElement('tr');
    totalTr.className = 'total-row';
    const pnlClass = totals.has_value ? (totals.pnl >= 0 ? 'positive' : 'negative') : 'neutral';
    totalTr.innerHTML = columns.map((col, idx) => {
        const key = col.key;
        if (idx === 0) return '<td>TOTAL</td>';
        if (key === 'pnl') return '<td class="' + pnlClass + '">' + (totals.has_value ? formatSignedUsd(totals.pnl) : '\u2014') + '</td>';
        if (key === 'value' || key === 'value2') return '<td>' + (totals.has_value ? formatUsd(totals.value) : '\u2014') + '</td>';
        if (key === 'invested') return '<td>' + formatUsd(totals.invested) + '</td>';
        if (key === 'lastTradeDate') return '<td>' + formatTradeDate(totals.last_trade_date) + '</td>';
        return '<td>\u2014</td>';
    }).join('');
    tbody.appendChild(totalTr);
}

let portfolioCache = null;
const expandedSymbols = new Set();

function buildRowData(holdings, totals) {
    return holdings.map((row) => {
        const label = ASSET_INFO[row.symbol] || row.symbol;
        const px = row.price_usd;
        const value = row.value_usd;
        const pnl = row.pnl_usd;
        const pnlClass = pnl == null ? '' : (pnl >= 0 ? 'positive' : 'negative');
        return {
            symbol: row.symbol,
            asset: label,
            qty: formatQty(row.qty),
            avgBuy: formatPrice(row.avg_buy),
            currentPrice: px != null ? formatPrice(px) : '\u2014',
            invested: formatUsd(row.invested),
            value: value != null ? formatUsd(value) : '\u2014',
            pnl: pnl != null ? formatSignedUsd(pnl) : '\u2014',
            lastTradeDate: formatTradeDate(row.last_trade_date),
            pnlClass,
        };
    });
}

function bindExpandHandlers(tradesBySymbol) {
    const tbody = document.getElementById('holdings-body');
    if (tbody.dataset.bound) return;
    tbody.dataset.bound = '1';
    function toggle(sym) {
        if (expandedSymbols.has(sym)) expandedSymbols.delete(sym);
        else expandedSymbols.add(sym);
        if (portfolioCache) paintPortfolio(portfolioCache);
    }
    tbody.addEventListener('click', (e) => {
        const t = e.target.closest('.asset-toggle');
        if (!t) return;
        e.preventDefault();
        const tr = t.closest('tr.holding-row');
        if (tr && tr.dataset.symbol) toggle(tr.dataset.symbol);
    });
    tbody.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const t = e.target.closest('.asset-toggle');
        if (!t) return;
        e.preventDefault();
        const tr = t.closest('tr.holding-row');
        if (tr && tr.dataset.symbol) toggle(tr.dataset.symbol);
    });
    tbody.addEventListener('dblclick', (e) => {
        if (e.target.closest('.asset-toggle')) return;
        const tr = e.target.closest('tr.holding-row');
        if (!tr || !tr.dataset.symbol) return;
        toggle(tr.dataset.symbol);
    });
}

function paintPortfolio(data) {
    portfolioCache = data;
    const err = document.getElementById('load-error');
    err.style.display = data.price_error ? 'block' : 'none';
    err.textContent = data.price_error ? ('Price data: ' + data.price_error) : '';

    const totals = data.totals;
    const rowData = buildRowData(data.holdings, totals);
    const tradesBySymbol = data.trades_by_symbol || {};
    bindExpandHandlers(tradesBySymbol);

    function apply() {
        const mode = getViewMode();
        renderTable(rowData, totals, mode, tradesBySymbol, expandedSymbols);
    }
    apply();
    window.onresize = apply;
}

async function refreshPortfolio() {
    const data = await api('/api/portfolio');
    const stamp = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    document.getElementById('last-updated').textContent = 'Loaded at ' + stamp + ' \u00b7 authenticated';

    document.getElementById('sum-invested').textContent = formatUsd(data.totals.invested);
    const tv = document.getElementById('sum-value');
    const tp = document.getElementById('sum-pnl');
    const tc = document.getElementById('sum-pnl-pct');
    const t = data.totals;
    if (t.has_value) {
        tv.textContent = formatUsd(t.value);
        tp.textContent = formatSignedUsd(t.pnl);
        tp.className = 'card-value ' + (t.pnl >= 0 ? 'positive' : 'negative');
        const pct = t.pnl_pct || 0;
        tc.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        tc.className = 'card-value ' + (pct >= 0 ? 'positive' : 'negative');
    } else {
        tv.textContent = '\u2014';
        tp.textContent = '\u2014';
        tc.textContent = '\u2014';
        tp.className = 'card-value neutral';
        tc.className = 'card-value neutral';
    }

    // Cash summary card (insert after summary-cards)
    const cashSection = document.getElementById('cash-summary');
    if (data.cash_summary) {
        const cs = data.cash_summary;
        if (!cashSection) {
            const sc = document.querySelector('.summary-cards');
            const div = document.createElement('div');
            div.className = 'card';
            div.id = 'cash-summary';
            div.innerHTML = buildCashSummaryHTML(cs);
            sc.parentNode.insertBefore(div, sc.nextSibling);
        } else {
            cashSection.innerHTML = buildCashSummaryHTML(cs);
        }
    } else if (cashSection) {
        cashSection.remove();
    }

    paintPortfolio(data);
}

function buildCashSummaryHTML(cs) {
    return '' +
        '<div class="card-label">USDT Cash Balance</div>' +
        '<div class="card-value positive" style="font-size:2rem">' + formatUsd(cs.balance) + '</div>' +
        '<div class="row2" style="margin-top:12px;gap:16px">' +
        '<div><span class="muted small" style="display:block">Total Deposited</span>' +
        '<span class="positive">' + formatUsd(cs.total_deposited) + '</span></div>' +
        '<div><span class="muted small" style="display:block">Withdrawn</span>' +
        '<span class="negative">' + formatUsd(cs.total_withdrawn) + '</span></div>' +
        '<div><span class="muted small" style="display:block">Fees Paid</span>' +
        '<span class="muted">' + formatUsd(cs.total_fees_paid) + '</span></div>' +
        '<div><span class="muted small" style="display:block">Events</span>' +
        '<span>' + cs.event_count + '</span></div>' +
        '</div>';
}

async function loadAdminLists() {
    const [manual, initial, cashResp] = await Promise.all([
        api('/api/manual-trades'),
        api('/api/initial-balances'),
        api('/api/cash-events'),
    ]);
    const ml = document.getElementById('manual-list');
    ml.innerHTML =
        '<table><thead><tr><th>ID</th><th>Date</th><th>Pair</th><th>Side</th><th>Qty</th><th>Total</th><th>Note</th><th></th></tr></thead><tbody>' +
        manual.items.map((m) => (
            '<tr><td>' + m.id + '</td><td>' + escapeHtml(m.date) + '</td><td>' + escapeHtml(m.pair) + '</td><td>' + escapeHtml(m.side) +
            '</td><td>' + formatQty(m.amount) + '</td><td>' + formatUsd(m.total) + '</td><td>' + escapeHtml(m.note || '') +
            '</td><td><button type="button" class="btn ghost btn-del-manual" data-id="' + m.id + '">Delete</button></td></tr>'
        )).join('') +
        '</tbody></table>';
    ml.querySelectorAll('.btn-del-manual').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!confirm('Delete manual trade ' + btn.dataset.id + '?')) return;
            await api('/api/manual-trades/' + btn.dataset.id, { method: 'DELETE' });
            await loadAdminLists();
            await refreshPortfolio();
        });
    });

    const il = document.getElementById('initial-list');
    il.innerHTML =
        '<table><thead><tr><th>ID</th><th>Asset</th><th>Qty</th><th>Cost USDT</th><th></th></tr></thead><tbody>' +
        initial.items.map((r) => (
            '<tr data-id="' + r.id + '">' +
            '<td>' + r.id + '</td>' +
            '<td>' + escapeHtml(r.asset) + '</td>' +
            '<td><input class="inline-num" data-k="quantity" value="' + r.quantity + '"></td>' +
            '<td><input class="inline-num" data-k="cost_usdt" value="' + r.cost_usdt + '"></td>' +
            '<td><button type="button" class="btn primary btn-save-initial" data-id="' + r.id + '">Save</button> ' +
            '<button type="button" class="btn ghost btn-del-initial" data-id="' + r.id + '">Delete</button></td></tr>'
        )).join('') +
        '</tbody></table>';

    il.querySelectorAll('.btn-save-initial').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const tr = btn.closest('tr');
            const q = tr.querySelector('input[data-k="quantity"]').value;
            const c = tr.querySelector('input[data-k="cost_usdt"]').value;
            await api('/api/initial-balances/' + btn.dataset.id, {
                method: 'PATCH',
                body: JSON.stringify({ quantity: Number(q), cost_usdt: Number(c) }),
            });
            await refreshPortfolio();
        });
    });
    il.querySelectorAll('.btn-del-initial').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!confirm('Delete initial balance row?')) return;
            await api('/api/initial-balances/' + btn.dataset.id, { method: 'DELETE' });
            await loadAdminLists();
            await refreshPortfolio();
        });
    });

    // Cash events admin section
    const cl = document.getElementById('cash-events-list');
    if (cl) {
        cl.innerHTML =
            '<table><thead><tr><th>ID</th><th>Time</th><th>Operation</th><th>Change</th><th>Remark</th><th>Source</th><th></th></tr></thead><tbody>' +
            cashResp.items.map((c) => (
                '<tr><td>' + c.id + '</td><td>' + escapeHtml(c.time) + '</td><td>' + escapeHtml(c.operation) +
                '</td><td class="' + (c.change >= 0 ? 'positive' : 'negative') + '">' + formatSignedUsd(c.change) +
                '</td><td>' + escapeHtml(c.remark || '') + '</td><td>' + escapeHtml(c.imported_from) +
                '</td><td><button type="button" class="btn ghost btn-del-cash" data-id="' + c.id + '">Delete</button></td></tr>'
            )).join('') +
            '</tbody></table>';
        cl.querySelectorAll('.btn-del-cash').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete cash event ' + btn.dataset.id + '?')) return;
                await api('/api/cash-events/' + btn.dataset.id, { method: 'DELETE' });
                await loadAdminLists();
                await refreshPortfolio();
            });
        });
    }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const err = document.getElementById('login-error');
    err.style.display = 'none';
    try {
        await api('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }),
        });
        await onLoggedIn();
    } catch (ex) {
        err.textContent = ex.message || 'Login failed';
        err.style.display = 'block';
    }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    showView('login');
});

document.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => {
        setTab(b.dataset.tab);
        if (b.dataset.tab === 'admin') loadAdminLists();
    });
});

document.getElementById('form-import').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const file = fd.get('file');
    if (!file || !file.size) return;
    const up = new FormData();
    up.append('file', file);
    const res = await fetch('/api/import/excel', { method: 'POST', body: up, credentials: 'same-origin' });
    const body = await res.json().catch(() => ({}));
    const pre = document.getElementById('import-result');
    pre.style.display = 'block';
    if (!res.ok) {
        pre.textContent = 'Error: ' + (body.detail || res.statusText);
        return;
    }
    pre.textContent = JSON.stringify(body, null, 2);
    e.target.reset();
    await refreshPortfolio();
});

document.getElementById('form-manual').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
        date: fd.get('date'),
        pair: fd.get('pair'),
        base_asset: fd.get('base_asset'),
        quote_asset: fd.get('quote_asset'),
        type: fd.get('type'),
        side: fd.get('side'),
        price: Number(fd.get('price')),
        amount: Number(fd.get('amount')),
        total: Number(fd.get('total')),
        fee: Number(fd.get('fee') || 0),
        fee_coin: fd.get('fee_coin'),
        note: fd.get('note') || null,
    };
    await api('/api/manual-trades', { method: 'POST', body: JSON.stringify(payload) });
    e.target.reset();
    await loadAdminLists();
    await refreshPortfolio();
});

document.getElementById('form-initial').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/api/initial-balances', {
        method: 'POST',
        body: JSON.stringify({
            asset: fd.get('asset'),
            quantity: Number(fd.get('quantity')),
            cost_usdt: Number(fd.get('cost_usdt') || 0),
        }),
    });
    e.target.reset();
    await loadAdminLists();
    await refreshPortfolio();
});

document.getElementById('form-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const msg = document.getElementById('pw-msg');
    msg.style.display = 'block';
    try {
        await api('/api/change-password', {
            method: 'POST',
            body: JSON.stringify({ current_password: fd.get('current'), new_password: fd.get('next') }),
        });
        msg.textContent = 'Password updated.';
        e.target.reset();
    } catch (ex) {
        msg.textContent = ex.message || 'Failed';
    }
});

// CSV import handler
document.getElementById('form-import-csv')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const file = fd.get('file');
    if (!file || !file.size) return;
    const up = new FormData();
    up.append('file', file);
    const res = await fetch('/api/import/transactions', { method: 'POST', body: up, credentials: 'same-origin' });
    const body = await res.json().catch(() => ({}));
    const pre = document.getElementById('import-csv-result');
    pre.style.display = 'block';
    if (!res.ok) {
        pre.textContent = 'Error: ' + (body.detail || res.statusText);
        return;
    }
    pre.textContent = 'Added ' + body.added + ', skipped ' + body.skipped + ' USDT rows.';
    e.target.reset();
    await loadAdminLists();
    await refreshPortfolio();
});

async function onLoggedIn() {
    showView('app');
    setTab('portfolio');
    document.getElementById('user-label').textContent = '';
    try {
        const me = await api('/api/me');
        document.getElementById('user-label').textContent = me.username || '';
    } catch (_) { /* ignore */ }
    await refreshPortfolio();
}

(async function init() {
    const me = await fetch('/api/me', { credentials: 'same-origin' }).then((r) => r.json());
    if (me.logged_in) {
        await onLoggedIn();
    } else {
        showView('login');
    }
})();
