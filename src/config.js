const PRODUCTS = [
  { id: 'p19', type: '19k', name: 'Túi mù 19K', price: 19000, img: 'https://files.catbox.moe/99t5k1.jpg', badge: 'HOT' },
  { id: 'p29', type: '29k', name: 'Túi mù 29K', price: 29000, img: 'https://files.catbox.moe/99t5k1.jpg', badge: 'NEW' },
  { id: 'p39', type: '39k', name: 'Túi mù 39K', price: 39000, img: 'https://files.catbox.moe/99t5k1.jpg', badge: 'VIP' },
  { id: 'p49', type: '49k', name: 'Túi mù 49K', price: 49000, img: 'https://files.catbox.moe/99t5k1.jpg', badge: 'MAX' }
];
const PLANS = [
  { id: 'hour', label: '1 giờ', price: 15000, duration: 3600000 },
  { id: 'day', label: '1 ngày', price: 30000, duration: 86400000 },
  { id: 'week', label: '1 tuần', price: 65000, duration: 604800000 },
  { id: 'month', label: '1 tháng', price: 135000, duration: 2592000000 },
  { id: 'forever', label: 'SALE Vĩnh viễn', price: 185000, duration: 315360000000 }
];
const TOOLS = {
  sunwin: { id: 'sunwin', name: 'Tool Sunwin', img: 'https://files.catbox.moe/s4qmq3.jfif' },
  lc79: { id: 'lc79', name: 'Tool LC79', img: 'https://files.catbox.moe/56s679.jfif' }
};
const CARD_TYPES = ['Viettel', 'Mobifone', 'Vinaphone', 'Vietnamobile', 'Gmobile'];
const CARD_AMOUNTS = [10000, 20000, 30000, 50000, 100000, 200000, 500000];
const BANK = { name: 'Zalo Pay', account: '0859 230 268', owner: 'PHAM MINH DUC', qr: 'https://files.catbox.moe/wr9c5a.jpg' };
module.exports = { PRODUCTS, PLANS, TOOLS, CARD_TYPES, CARD_AMOUNTS, BANK };
