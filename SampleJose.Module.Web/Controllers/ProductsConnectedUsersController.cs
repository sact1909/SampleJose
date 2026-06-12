using System;
using DevExpress.ExpressApp;
using DevExpress.ExpressApp.Web;
using DevExpress.ExpressApp.Web.Templates;
using SampleJose.Module.BusinessObjects;

namespace SampleJose.Module.Web.Controllers {
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

            if (IsProductsDetailListView(Frame.View)) {
                // If scripts already loaded just connect, otherwise load then connect.
                // The guard window.__productsScriptReady prevents double-loading across AJAX callbacks.
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

        static bool IsProductsDetailListView(View view) {
            return view is DetailView lv
                && lv.ObjectTypeInfo != null
                && lv.ObjectTypeInfo.Type == typeof(Product);
        }
    }
}
