(() => {
  'use strict';
  const D = window.FINTRON_DATA;
  if (!D) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = value => new Intl.NumberFormat('cs-CZ', {
    style: 'currency', currency: 'CZK', maximumFractionDigits: 0
  }).format(value);
  const formatDate = value => new Intl.DateTimeFormat('cs-CZ').format(new Date(`${value}T12:00:00`));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
  const signedAmount = tx => `${tx.direction === 'in' ? '+' : '−'}${money(tx.amount)}`;

  const people = Object.entries(D.persons).map(([id, person]) => ({
    id,
    name: person.name,
    role: person.role,
    accountId: person.account,
    account: D.accounts[person.account]
  }));

  function accountLabel(person) {
    return `${person.name} – ${person.account.number}`;
  }

  function readLoadedState() {
    try { return JSON.parse(sessionStorage.getItem('fintronLoaded') || '[]'); }
    catch (_) { return []; }
  }

  function writeLoadedState(ids) {
    try { sessionStorage.setItem('fintronLoaded', JSON.stringify(ids)); }
    catch (_) { /* Lokální režim může úložiště blokovat. */ }
  }

  function initUploadPage() {
    const grid = $('#uploadGrid');
    if (!grid) return;

    const readyFromUrl = new URLSearchParams(window.location.search).get('ready') === '1';
    const stored = readyFromUrl ? people.map(person => person.id) : readLoadedState();
    const loaded = new Set(stored.filter(id => D.persons[id]));

    grid.innerHTML = people.map((person, index) => `
      <button class="upload-card ${loaded.has(person.id) ? 'is-loaded' : ''}" data-person="${person.id}" type="button">
        <div class="upload-card-head">
          <span class="person-index">${String(index + 1).padStart(2, '0')}</span>
          <span class="upload-state">${loaded.has(person.id) ? 'VÝPIS NAHRÁN' : 'KLIKNUTÍM NAHRÁT'}</span>
        </div>
        <h3>${esc(person.name)}</h3>
        <p>${esc(person.role)}</p>
        <div class="account-preview">${esc(person.account.number)} <span>(${esc(person.account.bank)})</span></div>
        <div class="card-progress" aria-hidden="true"><i style="width:${loaded.has(person.id) ? '100%' : '0'}"></i></div>
        <div class="card-message">${loaded.has(person.id) ? 'Výpis nahrán k analýze.' : 'Výpis čeká na načtení.'}</div>
      </button>
    `).join('');

    function sync() {
      writeLoadedState([...loaded]);
      $('#loadedCount').textContent = `${loaded.size} ze 4 výpisů nahráno`;
      $('#goAnalysis').hidden = loaded.size !== people.length;
    }

    $$('.upload-card', grid).forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.person;
        if (loaded.has(id) || card.classList.contains('is-loading')) return;
        card.classList.add('is-loading');
        const state = $('.upload-state', card);
        const bar = $('.card-progress i', card);
        const message = $('.card-message', card);
        state.textContent = 'NAČÍTÁNÍ DAT';
        message.textContent = 'Ověřování a import bankovního výpisu…';

        let value = 0;
        const timer = setInterval(() => {
          value = Math.min(100, value + Math.floor(Math.random() * 13) + 7);
          bar.style.width = `${value}%`;
          if (value >= 100) {
            clearInterval(timer);
            setTimeout(() => {
              loaded.add(id);
              card.classList.remove('is-loading');
              card.classList.add('is-loaded');
              state.textContent = 'VÝPIS NAHRÁN';
              message.textContent = 'Výpis nahrán k analýze.';
              sync();
            }, 260);
          }
        }, 90);
      });
    });

    $('#goAnalysis').addEventListener('click', () => {
      if (loaded.size === people.length) window.location.href = 'analysis.html?ready=1';
    });
    sync();
  }

  function initAnalysisPage() {
    const results = $('#results');
    if (!results) return;

    const readyFromUrl = new URLSearchParams(window.location.search).get('ready') === '1';
    const loaded = readLoadedState();
    if (!readyFromUrl && loaded.length !== people.length) {
      window.location.replace('index.html');
      return;
    }

    const options = people.map(person => `<option value="${person.id}">${esc(accountLabel(person))}</option>`).join('');
    ['#highPerson', '#mutualFirst', '#mutualSecond', '#commonFirst', '#commonSecond'].forEach(id => {
      $(id).innerHTML = options;
    });
    $('#mutualSecond').selectedIndex = 1;
    $('#commonSecond').selectedIndex = 1;
    $('#backToUpload').addEventListener('click', () => { window.location.href = 'index.html?ready=1'; });

    function showModal(text) {
      $('#modalText').textContent = text;
      $('#messageModal').hidden = false;
      $('#modalClose').focus();
    }
    function closeModal() { $('#messageModal').hidden = true; }
    $('#modalClose').addEventListener('click', closeModal);
    $('#messageModal').addEventListener('click', event => {
      if (event.target.id === 'messageModal') closeModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal();
    });

    function animateAnalysis(done, type = 'comparison') {
      const area = $('#progressArea');
      const bar = $('#progressBar');
      const label = $('#progressLabel');
      const percent = $('#progressPercent');
      const phases = type === 'high' ? [
        'Ověřování zvoleného výpisu…',
        'Výpočet zůstatků ve zvoleném období…',
        'Filtrování transakcí nad 50 000 Kč…',
        'Sestavování výsledku analýzy…'
      ] : [
        'Ověřování načtených výpisů…',
        'Párování čísel účtů a protistran…',
        'Porovnávání transakčních záznamů…',
        'Sestavování výsledku analýzy…'
      ];
      results.innerHTML = '';
      area.hidden = false;
      let value = 0;
      bar.style.width = '0%';
      percent.textContent = '0 %';
      label.textContent = phases[0];
      const timer = setInterval(() => {
        value = Math.min(100, value + Math.floor(Math.random() * 10) + 6);
        if (value > 24) label.textContent = phases[1];
        if (value > 52) label.textContent = phases[2];
        if (value > 78) label.textContent = phases[3];
        bar.style.width = `${value}%`;
        percent.textContent = `${value} %`;
        if (value >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            area.hidden = true;
            done();
            results.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 320);
        }
      }, 85);
    }

    function pairData(firstId, secondId) {
      const first = people.find(person => person.id === firstId);
      const second = people.find(person => person.id === secondId);
      return {
        first,
        second,
        firstTx: D.transactions[first.accountId],
        secondTx: D.transactions[second.accountId]
      };
    }

    function resultHeading(title, first, second, subtitle) {
      return `
        <header class="result-heading">
          <span class="result-kicker">FINTRON / VÝSLEDEK AUTOMATIZOVANÉHO POROVNÁNÍ</span>
          <h2>${esc(title)}</h2>
          <p>${esc(subtitle)}</p>
          <div class="result-pair">
            <div><strong>${esc(first.name)}</strong><span>${esc(first.account.number)} (${esc(first.account.bank)})</span></div>
            <b>×</b>
            <div><strong>${esc(second.name)}</strong><span>${esc(second.account.number)} (${esc(second.account.bank)})</span></div>
          </div>
        </header>`;
    }

    function balanceAt(accountId, dateValue, inclusive) {
      const account = D.accounts[accountId];
      return D.transactions[accountId].reduce((balance, tx) => {
        const belongs = inclusive ? tx.date <= dateValue : tx.date < dateValue;
        if (!belongs) return balance;
        return balance + (tx.direction === 'in' ? tx.amount : -tx.amount);
      }, account.opening);
    }

    function renderHigh(personId) {
      const person = people.find(item => item.id === personId);
      const from = $('#highDateFrom').value;
      const to = $('#highDateTo').value;
      const direction = $('#highDirection').value;
      const query = $('#highSearch').value.trim().toLocaleLowerCase('cs-CZ');
      const threshold = D.meta.highValueThreshold || 50000;

      let transactions = D.transactions[person.accountId]
        .filter(tx => tx.amount > threshold)
        .filter(tx => tx.date >= from && tx.date <= to)
        .filter(tx => direction === 'all' || tx.direction === direction);

      if (query.length >= 3) {
        transactions = transactions.filter(tx => [
          tx.counterparty, tx.counterpartyAccount, tx.note, tx.type
        ].some(value => String(value || '').toLocaleLowerCase('cs-CZ').includes(query)));
      }

      transactions.sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
      const openingBalance = balanceAt(person.accountId, from, false);
      const closingBalance = balanceAt(person.accountId, to, true);
      const incoming = transactions.filter(tx => tx.direction === 'in').reduce((sum, tx) => sum + tx.amount, 0);
      const outgoing = transactions.filter(tx => tx.direction === 'out').reduce((sum, tx) => sum + tx.amount, 0);
      const directionLabel = direction === 'in' ? 'pouze příchozí' : direction === 'out' ? 'pouze odchozí' : 'příchozí i odchozí';

      results.innerHTML = `
        <header class="result-heading high-result-heading">
          <span class="result-kicker">FINTRON / VÝSLEDEK ANALÝZY JEDNOHO VÝPISU</span>
          <h2>ANALÝZA VYSOKÝCH TRANSAKCÍ</h2>
          <p>Transakce nad ${money(threshold)} · ${formatDate(from)}–${formatDate(to)} · ${directionLabel}${query.length >= 3 ? ` · hledaný výraz „${esc($('#highSearch').value.trim())}“` : ''}</p>
          <div class="single-account-result">
            <strong>${esc(person.name)}</strong>
            <span>${esc(person.account.number)} (${esc(person.account.bank)})</span>
          </div>
        </header>
        <div class="balance-summary">
          <div><span>Počáteční zůstatek období</span><strong>${money(openingBalance)}</strong></div>
          <div><span>Konečný zůstatek období</span><strong>${money(closingBalance)}</strong></div>
          <div><span>Nalezeno transakcí</span><strong>${transactions.length}</strong></div>
          <div><span>Příchozí ve výsledku</span><strong class="positive-value">${money(incoming)}</strong></div>
          <div><span>Odchozí ve výsledku</span><strong class="negative-value">${money(outgoing)}</strong></div>
        </div>
        <div class="balance-note">Počáteční a konečný zůstatek zohledňují všechny operace na účtu ve zvoleném období, nejen právě zobrazený filtr vysokých transakcí.</div>
        ${transactions.length ? `
          <div class="high-transaction-list">
            ${transactions.map((tx, index) => `
              <article class="high-transaction-row ${tx.direction === 'in' ? 'is-incoming' : 'is-outgoing'}">
                <div class="high-row-index">${String(index + 1).padStart(2, '0')}</div>
                <div class="high-row-date"><strong>${formatDate(tx.date)}</strong><span>${esc(tx.type || tx.channel)}</span></div>
                <div class="high-row-direction">
                  <span>${tx.direction === 'in' ? 'PŘÍCHOZÍ' : 'ODCHOZÍ'}</span>
                  <b>${tx.direction === 'in' ? '←' : '→'}</b>
                </div>
                <div class="high-row-party">
                  <strong>${esc(tx.counterparty || 'Neidentifikovaná protistrana')}</strong>
                  <span>${tx.counterpartyAccount ? `${esc(tx.counterpartyAccount)}${tx.counterpartyBank ? ` · ${esc(tx.counterpartyBank)}` : ''}` : esc(tx.location || 'Identifikátor karetního obchodníka')}</span>
                  <small>${esc(tx.note || 'Bez zprávy pro příjemce')}</small>
                </div>
                <div class="high-row-amount ${tx.direction === 'in' ? 'positive-value' : 'negative-value'}">${signedAmount(tx)}</div>
              </article>
            `).join('')}
          </div>` : `
          <div class="no-findings"><span>0</span><h3>Nebyly nalezeny odpovídající vysoké transakce</h3><p>Upravte období nebo některý z nastavených filtrů.</p></div>`}`;
    }

    function renderMutual(firstId, secondId) {
      const { first, second, firstTx, secondTx } = pairData(firstId, secondId);
      const transfers = [];
      firstTx.forEach(tx => {
        if (tx.counterpartyAccount !== second.account.number) return;
        transfers.push({
          date: tx.date, amount: tx.amount, note: tx.note, type: tx.type, variableSymbol: tx.variableSymbol,
          from: tx.direction === 'out' ? first : second,
          to: tx.direction === 'out' ? second : first
        });
      });
      secondTx.forEach(tx => {
        if (tx.counterpartyAccount !== first.account.number) return;
        transfers.push({
          date: tx.date, amount: tx.amount, note: tx.note, type: tx.type, variableSymbol: tx.variableSymbol,
          from: tx.direction === 'out' ? second : first,
          to: tx.direction === 'out' ? first : second
        });
      });

      const seen = new Set();
      const unique = transfers.filter(tx => {
        const key = `${tx.date}|${tx.amount}|${tx.from.id}|${tx.to.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);

      const total = unique.reduce((sum, tx) => sum + tx.amount, 0);
      results.innerHTML = resultHeading(
        'ANALÝZA VZÁJEMNÝCH TRANSAKCÍ', first, second,
        'Přímé platby evidované mezi zvolenými výpisy v období 1. 1. 2026–16. 6. 2026.'
      ) + (unique.length ? `
        <div class="result-stats">
          <div><span>Nalezeno převodů</span><strong>${unique.length}</strong></div>
          <div><span>Celkový objem</span><strong>${money(total)}</strong></div>
          <div><span>Porovnávané výpisy</span><strong>2</strong></div>
        </div>
        <div class="mutual-list">
          ${unique.map((tx, index) => `
            <article class="mutual-row">
              <div class="row-order">${String(index + 1).padStart(2, '0')}</div>
              <div class="mutual-main">
                <div class="mutual-date">${formatDate(tx.date)}</div>
                <div class="money-flow">
                  <div class="flow-party"><strong>${esc(tx.from.name)}</strong><span>${esc(tx.from.account.number)}</span></div>
                  <div class="flow-center"><strong>${money(tx.amount)}</strong><span>→</span></div>
                  <div class="flow-party flow-target"><strong>${esc(tx.to.name)}</strong><span>${esc(tx.to.account.number)}</span></div>
                </div>
                <div class="transaction-detail">
                  <span>${esc(tx.type || 'Bankovní převod')}</span>
                  <strong>${esc(tx.note || 'Bez zprávy pro příjemce')}</strong>
                  ${tx.variableSymbol ? `<span>VS ${esc(tx.variableSymbol)}</span>` : '<span>bez variabilního symbolu</span>'}
                </div>
              </div>
            </article>`).join('')}
        </div>` : `
        <div class="no-findings"><span>0</span><h3>Nebyly nalezeny žádné vzájemné transakce</h3><p>Zvolené výpisy v dostupném období neevidují žádný přímý převod.</p></div>`);
    }

    function counterpartyKey(tx) {
      return `ACC:${tx.counterpartyAccount}`;
    }

    function groupCounterparties(transactions, excludedAccounts) {
      const groups = new Map();
      transactions.forEach(tx => {
        if (!tx.counterparty || !tx.counterpartyAccount || excludedAccounts.has(tx.counterpartyAccount)) return;
        const key = counterpartyKey(tx);
        if (!groups.has(key)) groups.set(key, {
          name: tx.counterparty,
          account: tx.counterpartyAccount,
          bank: tx.counterpartyBank || '',
          txs: []
        });
        groups.get(key).txs.push(tx);
      });
      return groups;
    }

    function directionMatches(first, second) {
      const directions = [];
      if (first.some(tx => tx.direction === 'out') && second.some(tx => tx.direction === 'out')) directions.push('out');
      if (first.some(tx => tx.direction === 'in') && second.some(tx => tx.direction === 'in')) directions.push('in');
      return directions;
    }

    function directionTitle(directions) {
      if (directions.length === 2) return 'Společný příjemce i odesílatel';
      return directions[0] === 'out' ? 'Společný příjemce' : 'Společný odesílatel';
    }

    function transactionMini(person, party, tx, sharedDirection) {
      const outgoing = sharedDirection === 'out';
      return `
        <div class="mini-transaction">
          <div class="mini-direction">
            <strong>${esc(outgoing ? person.name : party)}</strong>
            <span>→</span>
            <strong>${esc(outgoing ? party : person.name)}</strong>
          </div>
          <div class="mini-data">
            <strong class="mini-amount">${money(tx.amount)}</strong>
            <span>${formatDate(tx.date)}</span>
            <span>${esc(tx.note || tx.type || 'Bez popisu')}</span>
          </div>
        </div>`;
    }

    function renderCommon(firstId, secondId) {
      const { first, second, firstTx, secondTx } = pairData(firstId, secondId);
      const excluded = new Set([first.account.number, second.account.number]);
      const firstGroups = groupCounterparties(firstTx, excluded);
      const secondGroups = groupCounterparties(secondTx, excluded);
      const matches = [...firstGroups.keys()].filter(key => secondGroups.has(key)).map(key => {
        const firstGroup = firstGroups.get(key);
        const secondGroup = secondGroups.get(key);
        return {
          firstGroup,
          secondGroup,
          directions: directionMatches(firstGroup.txs, secondGroup.txs)
        };
      }).filter(match => match.directions.length).sort((a, b) => {
        const firstAmount = [...a.firstGroup.txs, ...a.secondGroup.txs].reduce((sum, tx) => sum + tx.amount, 0);
        const secondAmount = [...b.firstGroup.txs, ...b.secondGroup.txs].reduce((sum, tx) => sum + tx.amount, 0);
        return secondAmount - firstAmount;
      });

      results.innerHTML = resultHeading(
        'ANALÝZA STEJNÝCH ODESÍLATELŮ A PŘÍJEMCŮ', first, second,
        'Společné třetí strany nalezené v obou bankovních výpisech.'
      ) + (matches.length ? `
        <div class="result-stats">
          <div><span>Nalezené shody</span><strong>${matches.length}</strong></div>
          <div><span>Porovnávané výpisy</span><strong>2</strong></div>
          <div><span>Období analýzy</span><strong>1. 1.–16. 6. 2026</strong></div>
        </div>
        <div class="common-results">
          ${matches.map((match, index) => {
            const party = match.firstGroup.name || match.secondGroup.name;
            const firstRelevant = match.firstGroup.txs.filter(tx => match.directions.includes(tx.direction)).sort((a, b) => b.date.localeCompare(a.date));
            const secondRelevant = match.secondGroup.txs.filter(tx => match.directions.includes(tx.direction)).sort((a, b) => b.date.localeCompare(a.date));
            return `
              <article class="common-result-card">
                <div class="match-number">SHODA ${String(index + 1).padStart(2, '0')}</div>
                <header class="counterparty-head">
                  <span>${esc(directionTitle(match.directions))}</span>
                  <h3>${esc(party)}</h3>
                  <p>${esc(match.firstGroup.account || match.secondGroup.account)}${(match.firstGroup.bank || match.secondGroup.bank) ? ` · ${esc(match.firstGroup.bank || match.secondGroup.bank)}` : ''}</p>
                </header>
                <div class="common-columns">
                  <section>
                    <h4>${esc(first.name)}<small>${esc(first.account.number)}</small></h4>
                    ${firstRelevant.map(tx => transactionMini(first, party, tx, tx.direction)).join('')}
                  </section>
                  <div class="common-node"><span>STEJNÁ<br>PROTISTRANA</span></div>
                  <section>
                    <h4>${esc(second.name)}<small>${esc(second.account.number)}</small></h4>
                    ${secondRelevant.map(tx => transactionMini(second, party, tx, tx.direction)).join('')}
                  </section>
                </div>
              </article>`;
          }).join('')}
        </div>` : `
        <div class="no-findings"><span>0</span><h3>Nebyly nalezeny žádné společné protistrany</h3><p>Výpisy neobsahují stejného příjemce ani stejného odesílatele.</p></div>`);
    }

    $$('.run-analysis').forEach(button => button.addEventListener('click', () => {
      const type = button.dataset.analysis;
      if (type === 'high') {
        const from = $('#highDateFrom').value;
        const to = $('#highDateTo').value;
        const query = $('#highSearch').value.trim();
        if (!from || !to || from > to) {
          showModal('Zvolené datum od nesmí být pozdější než datum do.');
          return;
        }
        if (query.length > 0 && query.length < 3) {
          showModal('Pro vyhledávání podle jména nebo názvu zadejte alespoň tři znaky.');
          return;
        }
        animateAnalysis(() => renderHigh($('#highPerson').value), 'high');
        return;
      }

      const firstId = $(`#${type}First`).value;
      const secondId = $(`#${type}Second`).value;
      if (firstId === secondId) {
        showModal('Nelze srovnávat stejný výpis.');
        return;
      }
      animateAnalysis(() => type === 'mutual' ? renderMutual(firstId, secondId) : renderCommon(firstId, secondId));
    }));
  }

  document.body.dataset.page === 'upload' ? initUploadPage() : initAnalysisPage();
})();
