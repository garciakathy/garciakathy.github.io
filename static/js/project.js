/* Interactive components for project pages. Each component is opt-in via markup. */
(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onVisible(el, fn) {
    if (!('IntersectionObserver' in window)) return fn();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { io.disconnect(); fn(); } });
    }, { threshold: 0.25 });
    io.observe(el);
  }

  // ── Reading progress ───────────────────────────────────────────────
  function initProgress() {
    var bar = document.createElement('div');
    bar.className = 'progress';
    document.body.appendChild(bar);
    function update() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ── Table of contents + scrollspy ──────────────────────────────────
  function initToc() {
    var list = $('.toc ol');
    if (!list) return;
    var sections = $$('.p-section[id]');
    sections.forEach(function (sec) {
      var h = $('h2', sec);
      var label = sec.getAttribute('data-toc') || (h ? h.childNodes[h.childNodes.length - 1].textContent.trim() : sec.id);
      var li = document.createElement('li');
      li.innerHTML = '<a href="#' + sec.id + '">' + label + '</a>';
      list.appendChild(li);
    });
    var links = $$('a', list);
    function spy() {
      var current = sections[0];
      sections.forEach(function (sec) { if (sec.getBoundingClientRect().top < 140) current = sec; });
      links.forEach(function (a) { a.classList.toggle('active', current && a.getAttribute('href') === '#' + current.id); });
    }
    window.addEventListener('scroll', spy, { passive: true });
    spy();
  }

  // ── Lightbox ──────────────────────────────────────────────────────
  function initLightbox() {
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<button class="lightbox-close" aria-label="Close"><i class="fas fa-xmark"></i></button><img alt="">';
    document.body.appendChild(box);
    var img = $('img', box);
    function close() { box.classList.remove('open'); document.body.style.overflow = ''; }
    box.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    $$('.fig-frame img, .p-teaser img').forEach(function (el) {
      var frame = el.closest('.fig-frame, .p-teaser');
      frame.setAttribute('tabindex', '0');
      frame.setAttribute('role', 'button');
      frame.setAttribute('aria-label', 'Enlarge figure: ' + (el.alt || ''));
      function open() {
        img.src = el.getAttribute('data-full') || el.currentSrc || el.src;
        img.alt = el.alt;
        box.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
      frame.addEventListener('click', open);
      frame.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  // ── Tabs ──────────────────────────────────────────────────────────
  function initTabs() {
    $$('.tabs').forEach(function (tabs) {
      var buttons = $$('.tab', tabs);
      var panels = $$('.tab-panel', tabs);
      function select(i) {
        buttons.forEach(function (b, j) { b.setAttribute('aria-selected', i === j); b.tabIndex = i === j ? 0 : -1; });
        panels.forEach(function (p, j) { p.hidden = i !== j; });
      }
      buttons.forEach(function (b, i) {
        b.setAttribute('role', 'tab');
        b.addEventListener('click', function () { select(i); });
        b.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            var n = (i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
            select(n); buttons[n].focus();
          }
        });
      });
      select(0);
    });
  }

  // ── Stat counters ─────────────────────────────────────────────────
  function initCounters() {
    $$('.stat-num[data-count]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var pre = el.getAttribute('data-prefix') || '';
      var suf = el.getAttribute('data-suffix') || '';
      function fmt(v) { return pre + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; }
      if (reduceMotion) { el.textContent = fmt(target); return; }
      el.textContent = fmt(0);
      onVisible(el, function () {
        var t0 = null, dur = 1200;
        function step(t) {
          if (!t0) t0 = t;
          var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(target * e);
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    });
  }

  // ── Bar chart ─────────────────────────────────────────────────────
  // <div class="chart-card" data-chart="json-id"> … <div class="bars"></div> </div>
  function initBarCharts() {
    $$('.chart-card[data-chart]').forEach(function (card) {
      var cfg = JSON.parse(document.getElementById(card.getAttribute('data-chart')).textContent);
      var bars = $('.bars', card);
      var legend = $('.chart-legend', card);
      var seg = $('.seg', card);
      var metricKeys = Object.keys(cfg.metrics);
      var state = { metric: metricKeys[0], hidden: {} };

      if (legend) {
        Object.keys(cfg.groups).forEach(function (g) {
          var lab = document.createElement('label');
          lab.innerHTML = '<input type="checkbox" checked> <span class="swatch" style="background:' + cfg.groups[g].color + '"></span>' + cfg.groups[g].label;
          $('input', lab).addEventListener('change', function (e) { state.hidden[g] = !e.target.checked; render(); });
          legend.appendChild(lab);
        });
      }
      if (seg) {
        metricKeys.forEach(function (m) {
          var b = document.createElement('button');
          b.textContent = cfg.metrics[m].label;
          b.setAttribute('aria-pressed', m === state.metric);
          b.addEventListener('click', function () {
            state.metric = m;
            $$('button', seg).forEach(function (o) { o.setAttribute('aria-pressed', o === b); });
            render();
          });
          seg.appendChild(b);
        });
      }

      var ref = document.createElement('div');
      ref.className = 'ref-line';
      bars.appendChild(ref);
      var rows = cfg.rows.map(function (r) {
        var row = document.createElement('div');
        row.className = 'bar-row' + (r.hl ? ' hl' : '');
        row.innerHTML = '<span class="lbl" title="' + r.label + '">' + r.label + '</span><span class="track"><span class="fill" style="width:0;background:' +
          cfg.groups[r.group].color + '"></span></span><span class="val"></span>';
        row._data = r;
        bars.appendChild(row);
        return row;
      });

      var drawn = false;
      function render() {
        var m = cfg.metrics[state.metric];
        var min = m.min || 0, span = m.max - min;
        var visible = rows.filter(function (row) { return !state.hidden[row._data.group]; });
        visible.sort(function (a, b) { return b._data[state.metric] - a._data[state.metric]; });
        rows.forEach(function (row) { row.style.display = state.hidden[row._data.group] ? 'none' : ''; });
        visible.forEach(function (row) {
          bars.appendChild(row);
          var v = row._data[state.metric];
          $('.fill', row).style.width = drawn ? Math.max(0, (v - min) / span * 100) + '%' : 0;
          $('.val', row).textContent = m.fmt === 'pct' ? v.toFixed(1) + '%' : v.toFixed(m.decimals || 3);
        });
        var track = $('.track', visible[0] || rows[0]);
        if (m.ref && track) {
          ref.style.display = '';
          var left = track.offsetLeft + track.offsetWidth * (m.ref.value - min) / span;
          ref.style.left = left + 'px';
          ref.innerHTML = '<span>' + m.ref.label + '</span>';
        } else {
          ref.style.display = 'none';
        }
        var note = $('.chart-note', card);
        if (note && m.note) note.textContent = m.note;
      }
      render();
      onVisible(card, function () { drawn = true; render(); });
      window.addEventListener('resize', render);
    });
  }

  // ── Stacked before/after comparison ───────────────────────────────
  // <div data-compare> <div class="seg"><button data-state="before">… </div> … <div class="stack"><div data-before="20" data-after="40">…
  function initCompare() {
    $$('[data-compare]').forEach(function (box) {
      var buttons = $$('.seg button', box);
      function set(st) {
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-state') === st); });
        $$('.stack > div', box).forEach(function (d) {
          var w = parseFloat(d.getAttribute('data-' + st)) || 0;
          d.style.width = w + '%';
          var lab = d.getAttribute('data-label-' + st);
          if (lab !== null) d.textContent = lab;
        });
        $$('[data-show]', box).forEach(function (el) { el.hidden = el.getAttribute('data-show') !== st; });
      }
      buttons.forEach(function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-state')); }); });
      set(buttons[0].getAttribute('data-state'));
      if (box.hasAttribute('data-autoplay') && !reduceMotion) {
        onVisible(box, function () { setTimeout(function () { set(buttons[buttons.length - 1].getAttribute('data-state')); }, 900); });
      }
    });
  }

  // ── Chips with explanation panel ──────────────────────────────────
  function initChips() {
    $$('.chips[data-panel]').forEach(function (group) {
      var panel = document.getElementById(group.getAttribute('data-panel'));
      var chips = $$('.chip', group);
      function pick(chip) {
        chips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip); });
        var tpl = document.getElementById(chip.getAttribute('data-target'));
        if (tpl && panel) panel.innerHTML = tpl.innerHTML;
        var img = document.getElementById(group.getAttribute('data-img-target') || '');
        if (img && chip.hasAttribute('data-img')) {
          img.src = chip.getAttribute('data-img');
          img.alt = chip.textContent.trim() + ' results';
        }
      }
      chips.forEach(function (c) { c.addEventListener('click', function () { pick(c); }); });
      pick(chips[0]);
    });
  }

  // ── Odd-one-out demo ──────────────────────────────────────────────
  function initOddOneOut() {
    $$('.ooo[data-videos]').forEach(function (box) {
      var pool = box.getAttribute('data-videos').split(',').map(function (s) { return s.trim(); });
      var grid = $('.ooo-grid', box);
      var result = $('.ooo-result', box);
      var countEl = $('.ooo-count', box);
      var total = parseInt(box.getAttribute('data-total') || '0', 10);
      var mine = 0, last = [];

      function shuffle(a) {
        for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
        return a;
      }
      function deal() {
        var options = shuffle(pool.slice());
        var pick = options.filter(function (v) { return last.indexOf(v) === -1; }).slice(0, 3);
        if (pick.length < 3) pick = options.slice(0, 3);
        last = pick;
        grid.innerHTML = '';
        pick.forEach(function (src, i) {
          var b = document.createElement('button');
          b.className = 'ooo-item';
          b.setAttribute('aria-label', 'Video ' + 'ABC'[i] + ': choose as odd-one-out');
          b.innerHTML = '<video src="' + src + '" muted loop playsinline autoplay preload="metadata"></video><span class="tag">' + 'ABC'[i] + '</span>';
          b.addEventListener('click', function () { choose(i); });
          grid.appendChild(b);
        });
        result.innerHTML = 'Watch the three clips, then click the one that is the <b>odd-one-out</b>.';
      }
      function choose(i) {
        var items = $$('.ooo-item', grid);
        if (items[0].classList.contains('odd') || items[0].classList.contains('sim')) return;
        var others = [0, 1, 2].filter(function (k) { return k !== i; });
        items.forEach(function (it, k) {
          it.classList.add(k === i ? 'odd' : 'sim');
          $('.tag', it).textContent = k === i ? 'odd-one-out' : 'similar';
        });
        mine++;
        result.innerHTML = 'You just told us clips <b>' + 'ABC'[others[0]] + '</b> and <b>' + 'ABC'[others[1]] +
          '</b> are more alike, and that <b>' + 'ABC'[i] + '</b> differs from both — three pairwise similarity judgments from one click. ' +
          'Aggregating thousands of these choices gives a full human similarity matrix.';
        if (countEl) countEl.textContent = 'Your judgments: ' + mine + (total ? ' · in the dataset: ' + total.toLocaleString('en-US') : '');
      }
      var again = $('.ooo-next', box);
      if (again) again.addEventListener('click', deal);
      if (countEl && total) countEl.textContent = 'In the dataset: ' + total.toLocaleString('en-US') + ' judgments';
      onVisible(box, deal);
    });
  }


  // ── Scroll-driven story ───────────────────────────────────────────
  function initStory() {
    $$('.story').forEach(function (story) {
      var steps = $$('.story-step', story);
      var stage = $('.story-stage', story);
      var panels = $$('.stage-panel', story);
      var narrow = window.matchMedia('(max-width: 900px)');
      function panelFor(step) { return panels.filter(function (p) { return p.getAttribute('data-step') === step.getAttribute('data-step'); })[0]; }
      function layout() {
        steps.forEach(function (step) {
          var panel = panelFor(step);
          if (!panel) return;
          if (narrow.matches) { panel.classList.add('inline-panel', 'active'); step.appendChild(panel); }
          else { panel.classList.remove('inline-panel', 'active'); stage.appendChild(panel); }
        });
        if (!narrow.matches) { activate(steps[0]); onScroll(); }
      }
      var current = null;
      function activate(step) {
        if (!step || step === current) return;
        current = step;
        steps.forEach(function (s) { s.classList.toggle('active', s === step); });
        var panel = panelFor(step);
        panels.forEach(function (p) { if (!p.classList.contains('inline-panel')) p.classList.toggle('active', p === panel); });
        if (panel) panel.dispatchEvent(new CustomEvent('stageenter'));
      }
      // Activate the step whose center is closest to the middle of the viewport
      var ticking = false;
      function onScroll() {
        if (ticking || narrow.matches) return;
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          var mid = window.innerHeight / 2, best = null, bestD = Infinity;
          steps.forEach(function (s) {
            var r = s.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid);
            if (d < bestD) { bestD = d; best = s; }
          });
          activate(best);
        });
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      layout();
      if (narrow.addEventListener) narrow.addEventListener('change', function () { current = null; layout(); });
      // Inline (mobile) panels still fire their enter event when scrolled into view
      panels.forEach(function (p) {
        onVisible(p, function () { if (p.classList.contains('inline-panel')) p.dispatchEvent(new CustomEvent('stageenter')); });
      });
    });
  }

  // ── Before/after wipe ─────────────────────────────────────────────
  function initWipes() {
    $$('.wipe').forEach(function (w) {
      var range = $('input[type=range]', w);
      if (!range) return;
      function set() { w.style.setProperty('--pos', range.value + '%'); }
      range.addEventListener('input', set);
      set();
    });
  }

  // ── BibTeX copy ───────────────────────────────────────────────────
  function initCopy() {
    $$('.copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = $('pre', btn.parentElement).textContent;
        function done() { btn.innerHTML = '<i class="fas fa-check"></i> Copied'; setTimeout(function () { btn.innerHTML = '<i class="far fa-copy"></i> Copy'; }, 1800); }
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
          ta.remove();
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initProgress();
    initToc();
    initLightbox();
    initTabs();
    initCounters();
    initBarCharts();
    initCompare();
    initChips();
    initOddOneOut();
    initCopy();
    initStory();
    initWipes();
  });
})();
