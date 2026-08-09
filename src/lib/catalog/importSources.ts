/**
 * Brand / store sources shown on /admin/products/new for paste-to-scrape.
 * Shopify sites expand via products.json; Apple/Samsung use dedicated parsers.
 */

export type ImportSourceChip = {
  name: string;
  url: string;
  /** Optional note shown under hostname */
  note?: string;
};

export type ImportSourceGroup = {
  id: string;
  label: string;
  items: ImportSourceChip[];
};

/** Hostname fragment → brand label for GenericBrandAdapter */
export const IMPORT_DOMAIN_BRANDS: Record<string, string> = {
  "gonoise.com": "Noise",
  "noise.tech": "Noise",
  "stuffcool.com": "Stuffcool",
  "fireboltt.com": "Fire-Boltt",
  "goboult.co.in": "Boult",
  "boult.audio": "Boult",
  "ptron.in": "pTron",
  "ubonindia.com": "UBON",
  "boat-lifestyle.com": "boAt",
  "ambraneindia.com": "Ambrane",
  "portronics.com": "Portronics",
  "spigen.in": "Spigen",
  "zebronics.com": "Zebronics",
  "nurepublic.co": "Nu Republic",
  "urbnworld.com": "URBN",
  "syska.co.in": "Syska",
  "belkin.com": "Belkin",
  "anker.com": "Anker",
  "ankerlndiastore.com": "Anker",
  "apple.com": "Apple",
  "inspireonline.in": "Apple",
  "samsung.com": "Samsung",
  "dell.com": "Dell",
  "hp.com": "HP",
  "lenovo.com": "Lenovo",
  "store.acer.com": "Acer",
  "acer.com": "Acer",
  "asus.com": "ASUS",
};

export const IMPORT_SOURCE_GROUPS: ImportSourceGroup[] = [
  {
    id: "phones-refurb",
    label: "Phones & refurbished",
    items: [
      {
        name: "ReFit Global",
        url: "https://refitglobal.com/collections/refurbished-mobiles",
      },
      {
        name: "ReFit Apple",
        url: "https://refitglobal.com/collections/refurbished-iphone",
      },
      {
        name: "ReFit Samsung",
        url: "https://refitglobal.com/collections/samsung",
      },
      {
        name: "ReFit Xiaomi",
        url: "https://refitglobal.com/collections/xiaomi",
      },
      {
        name: "ReFit Pre-Owned",
        url: "https://refitglobal.com/collections/pre-owned",
      },
      { name: "Apple iPhone", url: "https://www.apple.com/in/iphone/" },
      { name: "Apple iPad", url: "https://www.apple.com/in/ipad/" },
      { name: "Apple Mac", url: "https://www.apple.com/in/mac/" },
      { name: "Apple Watch", url: "https://www.apple.com/in/watch/" },
      { name: "Inspire (Apple)", url: "https://inspireonline.in/" },
      {
        name: "Samsung Phones",
        url: "https://www.samsung.com/in/smartphones/all-smartphones/",
      },
      {
        name: "Samsung Tablets",
        url: "https://www.samsung.com/in/tablets/all-tablets/",
      },
      { name: "OnePlus", url: "https://www.oneplus.in/" },
      {
        name: "Google Pixel",
        url: "https://store.google.com/in/category/phones?hl=en-IN",
      },
      { name: "Nothing", url: "https://in.nothing.tech/collections/phones" },
      { name: "Vivo", url: "https://www.vivo.com/in/products" },
      { name: "Oppo", url: "https://www.oppo.com/in/smartphones/" },
      { name: "Xiaomi", url: "https://www.mi.com/in/" },
      { name: "Poco", url: "https://www.poco.in/" },
      { name: "Realme", url: "https://www.realme.com/in/" },
      { name: "iQOO", url: "https://www.iqoo.com/" },
      { name: "Motorola", url: "https://www.motorola.in/" },
      { name: "Infinix", url: "https://infinixmobiles.in/" },
      { name: "Tecno", url: "https://www.tecno-mobile.com/home/" },
      { name: "Lava", url: "https://lavamobiles.com/" },
      { name: "HMD (Nokia)", url: "https://www.hmd.com/en_in" },
      { name: "AI Plus", url: "https://aiplusstore.com/" },
    ],
  },
  {
    id: "wearables-audio",
    label: "Wearables & audio (priority)",
    items: [
      { name: "Noise", url: "https://www.gonoise.com/", note: "Shopify" },
      {
        name: "Fire-Boltt",
        url: "https://www.fireboltt.com/",
        note: "Shopify",
      },
      { name: "Boult", url: "https://goboult.co.in/", note: "Shopify" },
      { name: "pTron", url: "https://ptron.in/", note: "Shopify" },
      { name: "boAt", url: "https://www.boat-lifestyle.com/" },
      {
        name: "Samsung Watches",
        url: "https://www.samsung.com/in/watches/all-watches/",
      },
    ],
  },
  {
    id: "accessories",
    label: "Accessories & charging",
    items: [
      { name: "Stuffcool", url: "https://www.stuffcool.com/", note: "Shopify" },
      { name: "UBON", url: "https://ubonindia.com/", note: "Shopify" },
      { name: "Ambrane", url: "https://ambraneindia.com/" },
      {
        name: "Portronics",
        url: "https://www.portronics.com/collections/mobile-accessories",
      },
      { name: "Spigen", url: "https://spigen.in/" },
      { name: "Zebronics", url: "https://zebronics.com/" },
      { name: "Nu Republic", url: "https://www.nurepublic.co/" },
      {
        name: "URBN",
        url: "https://urbnworld.com/collections/power-banks",
      },
      { name: "Syska", url: "https://syska.co.in/", note: "Dukaan" },
      {
        name: "Belkin India",
        url: "https://www.belkin.com/in/products/wireless-chargers/",
      },
      {
        name: "Anker",
        url: "https://www.anker.com/collections/chargers",
      },
      { name: "SanDisk", url: "https://www.sandisk.com/en-in" },
    ],
  },
  {
    id: "computers",
    label: "Laptops & computers",
    items: [
      {
        name: "Samsung Computers",
        url: "https://www.samsung.com/in/computers/all-computers/",
      },
      { name: "Apple Mac", url: "https://www.apple.com/in/mac/" },
      { name: "Dell India", url: "https://www.dell.com/en-in/shop" },
      { name: "HP India", url: "https://www.hp.com/in-en/shop/listings/laptops" },
      {
        name: "Lenovo India",
        url: "https://www.lenovo.com/in/en/c/laptops/ideapad/",
      },
      {
        name: "Acer",
        url: "https://www.acer.com/in-en/laptops",
      },
      {
        name: "ASUS India",
        url: "https://www.asus.com/in/laptops/for-home/vivobook/",
      },
    ],
  },
];
