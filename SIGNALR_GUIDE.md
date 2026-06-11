# Real-Time Connected Users with SignalR in DevExpress XAF (ASP.NET Web Forms)

This guide walks through adding a real-time connected-users bar to a specific **ListView** in a DevExpress XAF Web Forms application (.NET Framework). When a user opens the target view, their avatar appears in a bar at the top of the screen. All other connected users see it update instantly — no refresh needed. When the user navigates away, the bar disappears and the connection closes.

**Result:** a green bar showing avatar circles with initials, each with a hover/click tooltip showing the full username. The bar appears only while the target ListView is active and works correctly across XAF's AJAX navigation (no F5 required).

---

## Prerequisites

- DevExpress XAF application targeting ASP.NET Web Forms (.NET Framework 4.x)
- XAF solution structure: `YourApp.Module`, `YourApp.Module.Web`, `YourApp.Web`

### Install NuGet packages

Run this in the **Package Manager Console** targeting your **web project** (`YourApp.Web`):

```powershell
Install-Package Microsoft.AspNet.SignalR -ProjectName YourApp.Web
```

This pulls in everything needed:
- `Microsoft.AspNet.SignalR.Core`
- `Microsoft.AspNet.SignalR.SystemWeb`
- `Microsoft.Owin`
- `Microsoft.Owin.Host.SystemWeb`
- `Microsoft.Owin.Security`
- `Owin`

After installing, verify:

```powershell
Get-ChildItem .\bin | Where-Object { $_.Name -like "*SignalR*" -or $_.Name -like "*Owin*" }
```

---

## Step 1 — Add assembly references to `YourApp.Web.csproj`

Add these `<Reference>` entries pointing at the DLLs in your `bin/`:

```xml
<Reference Include="Microsoft.AspNet.SignalR.Core">
  <HintPath>bin\Microsoft.AspNet.SignalR.Core.dll</HintPath>
  <Private>True</Private>
</Reference>
<Reference Include="Microsoft.AspNet.SignalR.SystemWeb">
  <HintPath>bin\Microsoft.AspNet.SignalR.SystemWeb.dll</HintPath>
  <Private>True</Private>
</Reference>
<Reference Include="Microsoft.Owin">
  <HintPath>bin\Microsoft.Owin.dll</HintPath>
  <Private>True</Private>
</Reference>
<Reference Include="Microsoft.Owin.Host.SystemWeb">
  <HintPath>bin\Microsoft.Owin.Host.SystemWeb.dll</HintPath>
  <Private>True</Private>
</Reference>
<Reference Include="Microsoft.Owin.Security">
  <HintPath>bin\Microsoft.Owin.Security.dll</HintPath>
  <Private>True</Private>
</Reference>
<Reference Include="Owin">
  <HintPath>bin\Owin.dll</HintPath>
  <Private>True</Private>
</Reference>
<Reference Include="Microsoft.CSharp" />
```

> `Microsoft.CSharp` is required because SignalR uses `dynamic` internally (`Clients.All.*`). Without it you get _"Missing compiler required member 'CSharpArgumentInfo.Create'"_.

---

## Step 2 — Get the SignalR jQuery client

Copy the JS file from the NuGet cache into `Scripts/`:

```powershell
Copy-Item "$env:USERPROFILE\.nuget\packages\microsoft.aspnet.signalr.js\2.4.3\content\Scripts\jquery.signalR-2.4.3.min.js" ".\Scripts\"
```

Register it in `YourApp.Web.csproj`:

```xml
<Content Include="Scripts\jquery.signalR-2.4.3.min.js" />
```

---

## Step 3 — Create the OWIN Startup class

Create `OwinStartup.cs` in the root of `YourApp.Web`:

```csharp
using Microsoft.AspNet.SignalR;
using Microsoft.Owin;
using Owin;

[assembly: OwinStartup(typeof(YourApp.Web.OwinStartup))]

namespace YourApp.Web {
    public class OwinStartup {
        public void Configuration(IAppBuilder app) {
            app.MapSignalR();
        }
    }
}
```

Register in `.csproj`:

```xml
<Compile Include="OwinStartup.cs" />
```

---

## Step 4 — Create the Hub

Create `Hubs/ProductsHub.cs` in `YourApp.Web`. The hub stores a `connectionId → userName` map and broadcasts the full list on every connect/disconnect.

Rename the class and `[HubName]` to match your target entity (e.g. `ProductsHub` / `"productsHub"`).

```csharp
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNet.SignalR;
using Microsoft.AspNet.SignalR.Hubs;

namespace YourApp.Web.Hubs {
    [HubName("productsHub")]   // must match the JS: $.connection.productsHub
    public class ProductsHub : Hub {

        private static readonly ConcurrentDictionary<string, string> _users =
            new ConcurrentDictionary<string, string>();

        public override Task OnConnected() {
            _users[Context.ConnectionId] = Context.User?.Identity?.Name ?? "Anonymous";
            BroadcastUsers();
            return base.OnConnected();
        }

        public override Task OnDisconnected(bool stopCalled) {
            _users.TryRemove(Context.ConnectionId, out _);
            BroadcastUsers();
            return base.OnDisconnected(stopCalled);
        }

        public override Task OnReconnected() {
            _users[Context.ConnectionId] = Context.User?.Identity?.Name ?? "Anonymous";
            BroadcastUsers();
            return base.OnReconnected();
        }

        private void BroadcastUsers() {
            Clients.All.updateUsers(new List<string>(_users.Values));
        }
    }
}
```

Register in `.csproj`:

```xml
<Compile Include="Hubs\ProductsHub.cs" />
```

---

## Step 5 — Update `Web.config`

### 5a — Allow anonymous access to the SignalR endpoint

XAF enables Forms Authentication globally. Add this block so the SignalR handshake is not redirected to the login page:

```xml
<location path="signalr">
  <system.web>
    <authorization>
      <allow users="?" />
    </authorization>
  </system.web>
</location>
```

### 5b — Add assembly binding redirects

Check your actual OWIN version first:

```powershell
[System.Reflection.Assembly]::LoadFile("$pwd\bin\Microsoft.Owin.dll").GetName().Version
```

Then add inside the existing `<runtime><assemblyBinding>` block:

```xml
<dependentAssembly>
  <assemblyIdentity name="Microsoft.Owin" culture="neutral" publicKeyToken="31bf3856ad364e35" />
  <bindingRedirect oldVersion="0.0.0.0-4.2.2.0" newVersion="4.2.2.0" />
</dependentAssembly>
<dependentAssembly>
  <assemblyIdentity name="Microsoft.Owin.Host.SystemWeb" culture="neutral" publicKeyToken="31bf3856ad364e35" />
  <bindingRedirect oldVersion="0.0.0.0-4.2.2.0" newVersion="4.2.2.0" />
</dependentAssembly>
<dependentAssembly>
  <assemblyIdentity name="Microsoft.Owin.Security" culture="neutral" publicKeyToken="31bf3856ad364e35" />
  <bindingRedirect oldVersion="0.0.0.0-4.2.2.0" newVersion="4.2.2.0" />
</dependentAssembly>
```

> Replace `4.2.2.0` with whatever version your check returned.

---

## Step 6 — Create the JavaScript file

Create `Scripts/signalr-products.js` in `YourApp.Web`.

This script exposes two global functions that the XAF controller will call via `RegisterStartupScript` after every AJAX callback. It does **not** auto-execute on load — the controller drives when to connect and disconnect.

```javascript
(function () {
    'use strict';

    var BAR_ID     = 'products-users-bar';
    var AVATARS_ID = 'products-avatars';
    var STATUS_ID  = 'products-signalr-status';

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
            'color:#fff', 'padding:8px 20px', 'font-family:Arial,sans-serif',
            'font-size:14px', 'display:flex', 'align-items:center', 'gap:10px',
            'box-shadow:0 2px 6px rgba(0,0,0,0.20)', 'border-radius:0 0 6px 6px',
            'position:relative', 'z-index:1000', 'margin-bottom:4px'
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

    function removeBar() {
        var bar = document.getElementById(BAR_ID);
        if (bar) bar.parentNode.removeChild(bar);
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
            'position:fixed', 'background:rgba(0,0,0,0.82)', 'color:#fff',
            'padding:5px 11px', 'border-radius:5px', 'font-size:13px',
            'font-family:Arial,sans-serif', 'pointer-events:none', 'z-index:9999',
            'white-space:nowrap', 'display:none', 'box-shadow:0 2px 8px rgba(0,0,0,0.30)'
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

    function hideTooltip() { getTooltip().style.display = 'none'; }

    /* ---- avatar ---- */
    function makeAvatar(name) {
        var av = document.createElement('div');
        av.style.cssText = [
            'width:34px', 'height:34px', 'border-radius:50%',
            'background:' + colorForName(name), 'color:#fff',
            'display:inline-flex', 'align-items:center', 'justify-content:center',
            'font-weight:bold', 'font-size:13px', 'cursor:pointer', 'user-select:none',
            'border:2px solid rgba(255,255,255,0.55)', 'transition:transform 0.15s', 'flex-shrink:0'
        ].join(';');
        av.textContent = initials(name);
        av.title = name;
        av.addEventListener('mouseenter', function () { av.style.transform = 'scale(1.15)'; showTooltip(av, name); });
        av.addEventListener('mouseleave', function () { av.style.transform = ''; hideTooltip(); });
        av.addEventListener('click',      function () { showTooltip(av, name); setTimeout(hideTooltip, 2000); });
        return av;
    }

    function renderUsers(users) {
        var container = document.getElementById(AVATARS_ID);
        if (!container) return;
        container.innerHTML = '';
        hideTooltip();
        for (var i = 0; i < users.length; i++) container.appendChild(makeAvatar(users[i]));
    }

    /* ---- SignalR ---- */
    function wireHub() {
        var hub = $.connection.productsHub;   // must match [HubName] on the C# class
        hub.client.updateUsers = function (users) { renderUsers(users); };
    }

    function startConnection() {
        if ($.connection.hub.state === $.signalR.connectionState.connected) return;
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

    function stopConnection() {
        if (typeof $.connection !== 'undefined' &&
            $.connection.hub.state !== $.signalR.connectionState.disconnected) {
            $.connection.hub.stop();
        }
    }

    function ensureScriptsLoaded(callback) {
        if (typeof $.connection !== 'undefined' && $.connection.productsHub) {
            callback();
            return;
        }
        function loadHubs() {
            $.getScript('/signalr/hubs', function () { wireHub(); callback(); });
        }
        if (typeof $.connection !== 'undefined') {
            loadHubs();
        } else {
            $.getScript('/Scripts/jquery.signalR-2.4.3.min.js', loadHubs);
        }
    }

    /* ---- Public API — called by the XAF WindowController ---- */
    window.productsHub_connect = function () {
        if (typeof $ === 'undefined') { setTimeout(window.productsHub_connect, 150); return; }
        injectBar();
        ensureScriptsLoaded(startConnection);
    };

    window.productsHub_disconnect = function () {
        removeBar();
        stopConnection();
    };

})();
```

Register in `YourApp.Web.csproj`:

```xml
<Content Include="Scripts\signalr-products.js" />
```

---

## Step 7 — Create the XAF WindowController

Create the controller in `YourApp.Module.Web/Controllers/`. This is a **`WindowController`** — not a `ViewController` — so it persists across XAF's AJAX navigation for the entire session.

It hooks into `WebWindow.PagePreRender`, which XAF fires after **every** request and every AJAX callback. On each fire it checks the current view: if it is the target ListView it emits a connect command; otherwise it emits a disconnect command. Both are injected via `window.RegisterStartupScript`, which XAF correctly handles in AJAX callbacks (unlike `page.ClientScript.RegisterStartupScript`, which only works on full page loads).

```csharp
using System;
using DevExpress.ExpressApp;
using DevExpress.ExpressApp.Web;
using DevExpress.ExpressApp.Web.Templates;
using YourApp.Module.BusinessObjects;

namespace YourApp.Module.Web.Controllers {
    public class ProductsConnectedUsersController : WindowController {

        public ProductsConnectedUsersController() {
            TargetWindowType = WindowType.Main;
        }

        protected override void OnActivated() {
            base.OnActivated();
            ((WebWindow)Window).PagePreRender += Window_PagePreRender;
        }

        protected override void OnDeactivated() {
            ((WebWindow)Window).PagePreRender -= Window_PagePreRender;
            base.OnDeactivated();
        }

        void Window_PagePreRender(object sender, EventArgs _) {
            var window = (WebWindow)sender;

            if (IsProductsListView(Frame.View)) {
                // Load SignalR scripts lazily (only on first navigation to this view),
                // then call connect. The guard __productsScriptReady prevents double-loading
                // across subsequent AJAX callbacks.
                const string script = @"
(function() {
    if (window.__productsScriptReady) {
        window.productsHub_connect && window.productsHub_connect();
        return;
    }
    window.__productsScriptReady = true;
    function onAppReady() { window.productsHub_connect && window.productsHub_connect(); }
    function loadApp() { $.getScript('/Scripts/signalr-products.js', onAppReady); }
    if (typeof $.connection !== 'undefined') {
        loadApp();
    } else {
        $.getScript('/Scripts/jquery.signalR-2.4.3.min.js', loadApp);
    }
})();";
                window.RegisterStartupScript(GetType().FullName, script);
            } else {
                window.RegisterStartupScript(GetType().FullName,
                    "window.productsHub_disconnect && window.productsHub_disconnect();");
            }
        }

        static bool IsProductsListView(View view) {
            return view is ListView lv
                && lv.ObjectTypeInfo != null
                && lv.ObjectTypeInfo.Type == typeof(Product); // replace with your type
        }
    }
}
```

Register in `YourApp.Module.Web.csproj`:

```xml
<Compile Include="Controllers\ProductsConnectedUsersController.cs" />
```

---

## File checklist

| File | Project |
|---|---|
| `Hubs/ProductsHub.cs` | `YourApp.Web` |
| `OwinStartup.cs` | `YourApp.Web` |
| `Scripts/jquery.signalR-x.x.x.min.js` | `YourApp.Web` |
| `Scripts/signalr-products.js` | `YourApp.Web` |
| `Controllers/ProductsConnectedUsersController.cs` | `YourApp.Module.Web` |

`Default.aspx` — **no changes needed**.

---

## Why `WindowController` + `PagePreRender`, not `ViewController` + `OnViewControlsCreated`

XAF Web Forms uses AJAX callbacks for navigation. When the user clicks a nav item, only a partial response is sent — the page is **not** reloaded. This means:

- `page.ClientScript.RegisterStartupScript` (standard ASP.NET) **only works on full page loads** — it is silently ignored in AJAX callbacks.
- `ViewController.OnViewControlsCreated` fires when the view is created, but by the time an AJAX navigation completes, that hook has already passed for the new view.

The correct pattern (documented by DevExpress for the same problem in their timer-refresh example) is:

1. Use a **`WindowController`** with `TargetWindowType = Main` so it lives for the whole session.
2. Subscribe to **`WebWindow.PagePreRender`**, which XAF fires on every request **and** every AJAX callback.
3. Use **`WebWindow.RegisterStartupScript`** (XAF's own method), which correctly injects scripts into both full renders and AJAX partial responses.

The result: the controller checks `Frame.View` on every callback, and the client always receives either a connect or a disconnect command immediately after navigation — no F5 required.

---

## How it works end-to-end

```
User navigates to the Products ListView (AJAX callback)
  └─> XAF fires WebWindow.PagePreRender
        └─> WindowController checks: IsProductsListView? → true
              └─> RegisterStartupScript emits the loader inline script

Browser executes the inline script
  └─> First visit: __productsScriptReady is false
        └─> $.getScript loads jquery.signalR → then signalr-products.js
              └─> productsHub_connect() is called
                    └─> injectBar() — green bar appears at top of view
                    └─> ensureScriptsLoaded → $.getScript('/signalr/hubs')
                          └─> wireHub() — registers hub.client.updateUsers
                          └─> startConnection() — $.connection.hub.start()

  └─> Subsequent visits (AJAX nav back to Products): __productsScriptReady is true
        └─> productsHub_connect() called directly — no script reload

SignalR handshake completes
  └─> Server: OnConnected → stores connectionId → userName → BroadcastUsers()
  └─> Client: hub.client.updateUsers → renderUsers() → avatars appear

User navigates away (any other view — AJAX callback)
  └─> XAF fires WebWindow.PagePreRender
        └─> WindowController checks: IsProductsListView? → false
              └─> RegisterStartupScript emits: productsHub_disconnect()
                    └─> removeBar() — bar disappears
                    └─> stopConnection() — SignalR connection closed
  └─> Server: OnDisconnected → removes entry → BroadcastUsers()
  └─> All remaining clients re-render their avatar list
```
