using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNet.SignalR;
using Microsoft.AspNet.SignalR.Hubs;

namespace SampleJose.Web.Hubs {
    [HubName("productsHub")]
    public class ProductsHub : Hub {
        // connectionId -> displayName
        private static readonly ConcurrentDictionary<string, string> _users =
            new ConcurrentDictionary<string, string>();

        public override Task OnConnected() {
            var name = Context.User?.Identity?.Name ?? "Anónimo";
            _users[Context.ConnectionId] = name;
            BroadcastUsers();
            return base.OnConnected();
        }

        public override Task OnDisconnected(bool stopCalled) {
            _users.TryRemove(Context.ConnectionId, out _);
            BroadcastUsers();
            return base.OnDisconnected(stopCalled);
        }

        public override Task OnReconnected() {
            var name = Context.User?.Identity?.Name ?? "Anónimo";
            _users[Context.ConnectionId] = name;
            BroadcastUsers();
            return base.OnReconnected();
        }

        private void BroadcastUsers() {
            Clients.All.updateUsers(new List<string>(_users.Values));
        }
    }
}
