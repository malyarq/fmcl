/* global __dirname, console */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src', 'locales');
const enPath = path.join(localesDir, 'en.json');
const ruPath = path.join(localesDir, 'ru.json');

const shareKeysEn = {
    "share.title": "Share Instance",
    "share.desc": "Share your instance configuration with friends. They can import it using this code.",
    "share.generate": "Generate Code",
    "share.copy": "Copy Code",
    "share.import_title": "Import from Code",
    "share.import_desc": "Paste the share code below to import an instance.",
    "share.import_btn": "Import",
    "share.code_placeholder": "Paste burrow://share/... code here",
    "share.success_title": "Success",
    "share.success_desc": "Instance imported successfully!",
    "share.error_title": "Error",
    "share.error_desc": "Failed to import instance. Invalid code or missing mods.",
    "modpacks.share_btn": "Share",
    "modpacks.import_code_btn": "Import from Code"
};

const shareKeysRu = {
    "share.title": "Поделиться инстансом",
    "share.desc": "Поделитесь конфигурацией инстанса с друзьями. Они могут импортировать его, используя этот код.",
    "share.generate": "Сгенерировать код",
    "share.copy": "Копировать код",
    "share.import_title": "Импорт из кода",
    "share.import_desc": "Вставьте код ниже, чтобы импортировать инстанс.",
    "share.import_btn": "Импортировать",
    "share.code_placeholder": "Вставьте код burrow://share/...",
    "share.success_title": "Успешно",
    "share.success_desc": "Инстанс успешно импортирован!",
    "share.error_title": "Ошибка",
    "share.error_desc": "Не удалось импортировать инстанс. Неверный код или отсутствуют моды.",
    "modpacks.share_btn": "Поделиться",
    "modpacks.import_code_btn": "Импорт из кода"
};

function updateFile(filePath, keys) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);
    Object.assign(json, keys);
    fs.writeFileSync(filePath, JSON.stringify(json, null, 4));
    console.log(`Updated ${filePath}`);
}

updateFile(enPath, shareKeysEn);
updateFile(ruPath, shareKeysRu);
