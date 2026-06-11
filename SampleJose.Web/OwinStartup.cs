using Microsoft.AspNet.SignalR;
using Microsoft.Owin;
using Owin;

[assembly: OwinStartup(typeof(SampleJose.Web.OwinStartup))]

namespace SampleJose.Web {
    public class OwinStartup {
        public void Configuration(IAppBuilder app) {
            app.MapSignalR();
        }
    }
}
