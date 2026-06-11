using System.Web;
using System.Web.UI;
using DevExpress.ExpressApp;
using SampleJose.Module.BusinessObjects;

namespace SampleJose.Module.Web.Controllers {
    public class ProductsConnectedUsersController : ViewController<ListView> {
        public ProductsConnectedUsersController() {
            TargetObjectType = typeof(Product);
        }

        protected override void OnViewControlsCreated() {
            base.OnViewControlsCreated();
            RegisterSignalRScripts();
        }

        private void RegisterSignalRScripts() {
            var page = HttpContext.Current?.Handler as Page;
            if (page == null) return;

            // jquery.signalR debe cargarse antes que el proxy ~/signalr/hubs
            page.ClientScript.RegisterClientScriptInclude(
                "jquery-signalr",
                VirtualPathUtility.ToAbsolute("~/Scripts/jquery.signalR-2.4.3.min.js"));

            // Proxy autogenerado por SignalR (requiere jquery.signalR ya cargado)
            page.ClientScript.RegisterClientScriptInclude(
                "signalr-hubs",
                VirtualPathUtility.ToAbsolute("~/signalr/hubs"));

            // Nuestro script de inicializacion y barra de usuarios
            page.ClientScript.RegisterClientScriptInclude(
                "products-signalr",
                VirtualPathUtility.ToAbsolute("~/Scripts/signalr-products.js"));
        }
    }
}
