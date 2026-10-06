// 12 районов Ташкента. code хранится в БД и в callback_data (лимит 64 байта).
const DISTRICTS = [
  { code: 'almazar',        name: 'Алмазарский' },
  { code: 'bektemir',       name: 'Бектемирский' },
  { code: 'mirabad',        name: 'Мирабадский' },
  { code: 'mirzo_ulugbek',  name: 'Мирзо-Улугбекский' },
  { code: 'sergeli',        name: 'Сергелийский' },
  { code: 'uchtepa',        name: 'Учтепинский' },
  { code: 'chilanzar',      name: 'Чиланзарский' },
  { code: 'shaykhontohur',  name: 'Шайхантахурский' },
  { code: 'yunusabad',      name: 'Юнусабадский' },
  { code: 'yakkasaray',     name: 'Яккасарайский' },
  { code: 'yashnabad',      name: 'Яшнабадский' },
  { code: 'yangihayot',     name: 'Янгихаётский' },
];

const DISTRICT_CODES = DISTRICTS.map((d) => d.code);
const districtName = (code) => DISTRICTS.find((d) => d.code === code)?.name || code;

module.exports = { DISTRICTS, DISTRICT_CODES, districtName };
