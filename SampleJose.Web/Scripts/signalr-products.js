(function () {
    'use strict';

    var BAR_ID      = 'products-users-bar';
    var AVATARS_ID  = 'products-avatars';
    var STATUS_ID   = 'products-signalr-status';

    var COLORS = [
        '#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c',
        '#3498db','#9b59b6','#e91e63','#00bcd4','#8bc34a'
    ];

    function colorForName(name) {
        var hash = 0;
        for (var i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return COLORS[Math.abs(hash) % COLORS.length];
    }

    function initials(name) {
        var parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    }

    function createBar() {
        var bar = document.createElement('div');
        bar.id = BAR_ID;
        bar.style.cssText = [
            'background:linear-gradient(90deg,#1a6b3a 0%,#2e9957 100%)',
            'color:#fff',
            'padding:8px 20px',
            'font-family:Arial,sans-serif',
            'font-size:14px',
            'display:flex',
            'align-items:center',
            'gap:10px',
            'box-shadow:0 2px 6px rgba(0,0,0,0.20)',
            'border-radius:0 0 6px 6px',
            'position:relative',
            'z-index:1000',
            'margin-bottom:4px'
        ].join(';');

        bar.innerHTML =
            '<span style="font-size:15px;opacity:0.85;">Viendo Productos:</span>' +
            '<div id="' + AVATARS_ID + '" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"></div>' +
            '<span id="' + STATUS_ID + '" style="margin-left:auto;font-size:11px;opacity:0.70;"></span>';

        return bar;
    }

    function injectBar() {
        if (document.getElementById(BAR_ID)) return;
        var container =
            document.querySelector('.dxeContentCell') ||
            document.querySelector('.XafLayoutControl') ||
            document.querySelector('.ContentCell')     ||
            document.querySelector('.dxgvControl')     ||
            document.body;
        container.insertBefore(createBar(), container.firstChild);
    }

    function setStatus(msg) {
        var el = document.getElementById(STATUS_ID);
        if (el) el.textContent = msg;
    }

    /* ---- tooltip ---- */
    var _tooltip = null;

    function getTooltip() {
        if (_tooltip) return _tooltip;
        _tooltip = document.createElement('div');
        _tooltip.style.cssText = [
            'position:fixed',
            'background:rgba(0,0,0,0.82)',
            'color:#fff',
            'padding:5px 11px',
            'border-radius:5px',
            'font-size:13px',
            'font-family:Arial,sans-serif',
            'pointer-events:none',
            'z-index:9999',
            'white-space:nowrap',
            'display:none',
            'box-shadow:0 2px 8px rgba(0,0,0,0.30)'
        ].join(';');
        document.body.appendChild(_tooltip);
        return _tooltip;
    }

    function showTooltip(el, text) {
        var tip = getTooltip();
        tip.textContent = text;
        tip.style.display = 'block';
        var rect = el.getBoundingClientRect();
        tip.style.left = (rect.left + rect.width / 2 - tip.offsetWidth / 2) + 'px';
        tip.style.top  = (rect.bottom + 8) + 'px';
    }

    function hideTooltip() {
        var tip = getTooltip();
        tip.style.display = 'none';
    }

    /* ---- avatar ---- */
    function makeAvatar(name) {
        var av = document.createElement('div');
        av.style.cssText = [
            'width:34px',
            'height:34px',
            'border-radius:50%',
            'background:' + colorForName(name),
            'color:#fff',
            'display:inline-flex',
            'align-items:center',
            'justify-content:center',
            'font-weight:bold',
            'font-size:13px',
            'cursor:pointer',
            'user-select:none',
            'border:2px solid rgba(255,255,255,0.55)',
            'transition:transform 0.15s',
            'flex-shrink:0'
        ].join(';');
        av.textContent = initials(name);
        av.title = name;

        av.addEventListener('mouseenter', function () {
            av.style.transform = 'scale(1.15)';
            showTooltip(av, name);
        });
        av.addEventListener('mouseleave', function () {
            av.style.transform = '';
            hideTooltip();
        });
        av.addEventListener('click', function () {
            showTooltip(av, name);
            setTimeout(hideTooltip, 2000);
        });
        return av;
    }

    /* ---- render lista ---- */
    function renderUsers(users) {
        var container = document.getElementById(AVATARS_ID);
        if (!container) return;
        container.innerHTML = '';
        hideTooltip();
        for (var i = 0; i < users.length; i++) {
            container.appendChild(makeAvatar(users[i]));
        }
    }

    /* ---- SignalR ---- */
    function waitForSignalR(callback, attempts) {
        attempts = attempts || 0;
        if (attempts > 40) { setStatus('SignalR no disponible'); return; }
        if (typeof $ !== 'undefined' && $.connection && $.connection.productsHub) {
            callback();
        } else {
            setTimeout(function () { waitForSignalR(callback, attempts + 1); }, 250);
        }
    }

    function startHub() {
        var hub = $.connection.productsHub;

        hub.client.updateUsers = function (users) {
            renderUsers(users);
        };

        $.connection.hub.start()
            .done(function () { setStatus('En vivo ●'); })
            .fail(function () { setStatus('Sin conexión'); });

        $.connection.hub.disconnected(function () {
            setStatus('Reconectando...');
            setTimeout(function () {
                $.connection.hub.start().done(function () { setStatus('En vivo ●'); });
            }, 5000);
        });
    }

    function init() {
        injectBar();
        waitForSignalR(startHub);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
