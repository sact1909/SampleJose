# Real-Time Connected Users with SignalR in DevExpress XAF (ASP.NET Web Forms)

This guide walks you through adding a real-time connected-users bar to any **ListView** in a DevExpress XAF Web Forms application (.NET Framework). When a user opens the target view, their avatar appears in a bar at the top of the screen. All other connected users see it update instantly — no refresh needed.

**Result:** a green bar showing avatar circles with initials, each with a hover/click tooltip showing the full username.

---

## Prerequisites

- DevExpress XAF application targeting ASP.NET Web Forms (.NET Framework 4.x)
- The SignalR and OWIN NuGet packages installed in your web project (see below)

### Install NuGet packages

Run this in the **Package Manager Console** targeting your web project:

```powershell
Install-Package Microsoft.AspNet.SignalR -ProjectName YourApp.Web
```

This single package pulls in everything needed:
- `Microsoft.AspNet.SignalR.Core`
- `Microsoft.AspNet.SignalR.SystemWeb`
- `Microsoft.Owin`
- `Microsoft.Owin.Host.SystemWeb`
- `Microsoft.Owin.Security`
- `Owin`

NuGet adds the `<Reference>` entries to your `.csproj` and copies the DLLs to `bin/` automatically on every build — you never touch `bin/` manually.

> **Note:** if you are working in a project where DevExpress is already installed, these DLLs may already be present in `bin/` as transitive dependencies. You still need to install the NuGet package so the references are explicit in your `.csproj` and survive a clean build.

After installing, verify the packages landed:

```powershell
Get-ChildItem .\bin | Where-Object { $_.Name -like "*SignalR*" -or $_.Name -like "*Owin*" }
```

---

## Step 1 — Get the SignalR jQuery client

The `~/signalr/hubs` proxy endpoint requires `jquery.signalR` to already be loaded. Copy the JS file from the NuGet cache into your web project's `Scripts/` folder:

```powershell
# Check what version of SignalR you have
[System.Reflection.Assembly]::LoadFile("$pwd\bin\Microsoft.AspNet.SignalR.Core.dll").GetName().Version

# Copy the matching JS (adjust version as needed)
Copy-Item "$env:USERPROFILE\.nuget\packages\microsoft.aspnet.signalr.js\2.4.3\content\Scripts\jquery.signalR-2.4.3.min.js" ".\Scripts\"
```

Register it in your `YourWebProject.csproj`:

```xml
<Content Include="Scripts\jquery.signalR-2.4.3.min.js" />
```

---

## Step 2 — Add assembly references to `YourWebProject.csproj`

Add these `<Reference>` entries pointing at the DLLs already in your `bin/`:

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

## Step 3 — Create the OWIN Startup class

Create `OwinStartup.cs` in the root of your web project:

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

Register it in the `.csproj`:

```xml
<Compile Include="OwinStartup.cs" />
```

---

## Step 4 — Create the Hub

Create `Hubs/ConnectedUsersHub.cs` in your web project. The hub stores a `connectionId → userName` map and broadcasts the full list on every connect/disconnect.

```csharp
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNet.SignalR;
using Microsoft.AspNet.SignalR.Hubs;

namespace YourApp.Web.Hubs {
    [HubName("connectedUsersHub")]   // must match the JS: $.connection.connectedUsersHub
    public class ConnectedUsersHub : Hub {

        // Static: shared across all requests in this AppDomain
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
<Compile Include="Hubs\ConnectedUsersHub.cs" />
```

---

## Step 5 — Create the JavaScript file

Create `Scripts/signalr-users.js`. This script injects the avatar bar into the page DOM and wires up the SignalR connection.

```javascript
(function () {
    'use strict';

    var BAR_ID     = 'connected-users-bar';
    var AVATARS_ID = 'connected-avatars';
    var STATUS_ID  = 'connected-status';

    // Color palette — one color per user, derived from their name
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

    // ---------- bar ----------

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
            '<span style="font-size:15px;opacity:0.85;">Viewing this page:</span>' +
            '<div id="' + AVATARS_ID + '" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"></div>' +
            '<span id="' + STATUS_ID + '" style="margin-left:auto;font-size:11px;opacity:0.70;"></span>';

        return bar;
    }

    function injectBar() {
        if (document.getElementById(BAR_ID)) return;

        // Try common XAF Web Forms container selectors, fall back to body
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

    // ---------- tooltip ----------

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
        getTooltip().style.display = 'none';
    }

    // ---------- avatar ----------

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

    function renderUsers(users) {
        var container = document.getElementById(AVATARS_ID);
        if (!container) return;
        container.innerHTML = '';
        hideTooltip();
        for (var i = 0; i < users.length; i++) {
            container.appendChild(makeAvatar(users[i]));
        }
    }

    // ---------- SignalR ----------

    function waitForSignalR(callback, attempts) {
        attempts = attempts || 0;
        if (attempts > 40) { setStatus('SignalR unavailable'); return; }
        if (typeof $ !== 'undefined' && $.connection && $.connection.connectedUsersHub) {
            callback();
        } else {
            setTimeout(function () { waitForSignalR(callback, attempts + 1); }, 250);
        }
    }

    function startHub() {
        var hub = $.connection.connectedUsersHub;   // matches [HubName] on the C# class

        hub.client.updateUsers = function (users) {
            renderUsers(users);
        };

        $.connection.hub.start()
            .done(function () { setStatus('Live ●'); })
            .fail(function () { setStatus('Disconnected'); });

        $.connection.hub.disconnected(function () {
            setStatus('Reconnecting...');
            setTimeout(function () {
                $.connection.hub.start().done(function () { setStatus('Live ●'); });
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
```

Register in `.csproj`:

```xml
<Content Include="Scripts\signalr-users.js" />
```

---

## Step 6 — Create the XAF ViewController

Create the controller in your **Web module project** (`YourApp.Module.Web`). It hooks into `OnViewControlsCreated` — the correct XAF lifecycle point where the ASPX page is available — and registers the three scripts in the required load order.

```csharp
using System.Web;
using System.Web.UI;
using DevExpress.ExpressApp;
using YourApp.Module.BusinessObjects;   // your target business object type

namespace YourApp.Module.Web.Controllers {
    public class ConnectedUsersController : ViewController<ListView> {
        public ConnectedUsersController() {
            TargetObjectType = typeof(YourTargetObject); // e.g. typeof(Product)
        }

        protected override void OnViewControlsCreated() {
            base.OnViewControlsCreated();
            RegisterScripts();
        }

        private void RegisterScripts() {
            var page = HttpContext.Current?.Handler as Page;
            if (page == null) return;

            // Order matters: signalR lib → hub proxy → our init script
            page.ClientScript.RegisterClientScriptInclude(
                "jquery-signalr",
                VirtualPathUtility.ToAbsolute("~/Scripts/jquery.signalR-2.4.3.min.js"));

            page.ClientScript.RegisterClientScriptInclude(
                "signalr-hubs",
                VirtualPathUtility.ToAbsolute("~/signalr/hubs"));

            page.ClientScript.RegisterClientScriptInclude(
                "connected-users",
                VirtualPathUtility.ToAbsolute("~/Scripts/signalr-users.js"));
        }
    }
}
```

Register in `YourApp.Module.Web.csproj`:

```xml
<Compile Include="Controllers\ConnectedUsersController.cs" />
```

---

## Step 7 — Update `Web.config`

### 7a — Allow anonymous access to the SignalR endpoint

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

### 7b — Add assembly binding redirects

SignalR was compiled against older OWIN versions. Redirect them all to whatever version is physically in your `bin/`:

```powershell
# Check your actual version first
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

> Replace `4.2.2.0` with whatever version your `Get-ChildItem bin | ...` check returned.

---

## File checklist

| File | Project |
|---|---|
| `Hubs/ConnectedUsersHub.cs` | Web app project |
| `OwinStartup.cs` | Web app project |
| `Scripts/jquery.signalR-x.x.x.min.js` | Web app project |
| `Scripts/signalr-users.js` | Web app project |
| `Controllers/ConnectedUsersController.cs` | Web module project |

---

## How it works end-to-end

```
Browser opens ListView
  └─> XAF controller fires OnViewControlsCreated
        └─> Registers 3 <script> tags in order:
              1. jquery.signalR-2.4.3.min.js   (SignalR jQuery transport layer)
              2. ~/signalr/hubs                 (auto-generated hub proxy)
              3. signalr-users.js               (our bar + avatar logic)

signalr-users.js runs
  └─> injectBar()     — adds the green bar to the top of the view
  └─> waitForSignalR  — polls until $.connection.connectedUsersHub is ready
  └─> startHub()      — calls $.connection.hub.start()

SignalR handshake completes
  └─> Server: OnConnected fires
        └─> Stores Context.ConnectionId → Context.User.Identity.Name
        └─> BroadcastUsers() → Clients.All.updateUsers([...names])
  └─> Client: hub.client.updateUsers fires
        └─> renderUsers() rebuilds avatars from the name list

User leaves the page / closes tab
  └─> Server: OnDisconnected fires
        └─> Removes the connection from the dictionary
        └─> BroadcastUsers() → all remaining clients re-render their avatars
```
