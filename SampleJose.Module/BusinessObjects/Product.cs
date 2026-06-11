using System;
using DevExpress.Persistent.Base;
using DevExpress.Persistent.BaseImpl;
using DevExpress.Xpo;

namespace SampleJose.Module.BusinessObjects {
    [DefaultClassOptions]
    [NavigationItem("Default")]
    public class Product : BaseObject {
        public Product(Session session) : base(session) { }

        private string _name;
        [Size(200)]
        public string Name {
            get { return _name; }
            set { SetPropertyValue(nameof(Name), ref _name, value); }
        }

        private string _description;
        [Size(500)]
        public string Description {
            get { return _description; }
            set { SetPropertyValue(nameof(Description), ref _description, value); }
        }

        private decimal _price;
        public decimal Price {
            get { return _price; }
            set { SetPropertyValue(nameof(Price), ref _price, value); }
        }

        private int _stock;
        public int Stock {
            get { return _stock; }
            set { SetPropertyValue(nameof(Stock), ref _stock, value); }
        }
    }
}
