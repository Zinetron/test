import express from 'express';
import xlsx from 'xlsx';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'node:fs';
import { fileURLToPath, URL } from 'url';
import { dirname } from 'node:path';
import { exiftool } from 'exiftool-vendored';
import { getNewDescriptionII } from "./ai21.js";
import cors from "cors";

// Для поддержки __dirname в ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3001;
const nameExcelFile = 'input.xlsx';
const imagesDir = 'E:\\Servera_Sora\\images\\';

// Путь к Excel файлу (файл должен лежать в той же папке с сервером или скорректируйте путь)
const excelFilePath = path.join(__dirname, nameExcelFile);
// Имя листа Excel (измените при необходимости)
const workbook = xlsx.readFile(excelFilePath);
const sheetName = Object.keys(workbook.Sheets)[0];
const worksheet = workbook.Sheets[sheetName];
// Опция defval: "" гарантирует, что пустые ячейки преобразуются в пустую строку
const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
// Сопоставляем строки с их индексами для дальнейшей работы
const jsonDataIndex = jsonData.map((row, index) => ({ index, row }));

// Middleware для работы с JSON
app.use(express.json());
app.use(cors());
// Функция для записи Excel файла
function writeExcel() {
    console.log()
    workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(jsonData, { skipHeader: false });
    xlsx.writeFile(workbook, excelFilePath);
}

// GET-эндпоинт: возвращает первую строку с отсутствующим Status и обновляет его на "1"
app.get('/get-prompt', (req, res) => {
    try {
        // findIndex возвращает -1 если ни один элемент не найден.
        const promptIndex = jsonDataIndex.findIndex(({ row }) => !row.Status || row.Status === "");
        console.log("2", promptIndex)
        if (promptIndex === -1) {
            return res.json(null);
        }
        const item = jsonDataIndex[promptIndex];
        // Обновляем статус в оригинальном jsonData
        writeExcel();
        res.json({
            index: item.index,
            prompt: item.row.Prompt,
        });
    } catch (error) {
        console.error('Error in GET /get-prompt', error);
        res.status(500).json({ error: 'Ошибка при обработке Excel файла' });
    }
});

// GET-эндпоинт: возвращает все строки с Status равным "1"
app.get('/get-prompts-status-1', (req, res) => {
    try {
        const items = jsonDataIndex.filter(({ row }) => row.Status === "1");
        if (!items.length) {
            return res.json([]);
        }
        res.json(items.map((item) => ({
            index: item.index,
            prompt: item.row.Prompt,
        })));
    } catch (error) {
        console.error('Error in GET /get-prompts-status-1', error);
        res.status(500).json({ error: 'Ошибка при обработке Excel файла' });
    }
});

// GET-эндпоинт: устанавливает статус для строки с указанным индексом на "1"
app.get('/set-prompt-status-1/:indexItem', (req, res) => {
    try {
        const indexItem = parseInt(req.params.indexItem, 10);
        if (isNaN(indexItem) || !jsonData[indexItem]) {
            return res.status(400).json({ error: 'Некорректный индекс' });
        }
        jsonData[indexItem].Status = "1";
        writeExcel();
        res.json(true);
    } catch (error) {
        console.error('Error in GET /set-prompt-status-1', error);
        res.status(500).json({ error: 'Ошибка при обработке Excel файла' });
    }
});

// GET-эндпоинт: устанавливает статус для строки с указанным индексом на "error"
app.get('/set-prompt-status-error/:indexItem', (req, res) => {
    try {
        const indexItem = parseInt(req.params.indexItem, 10);
        if (isNaN(indexItem) || !jsonData[indexItem]) {
            return res.status(400).json({ error: 'Некорректный индекс' });
        }
        jsonData[indexItem].Status = "error";
        writeExcel();
        res.json(true);
    } catch (error) {
        console.error('Error in GET /set-prompt-status-error', error);
        res.status(500).json({ error: 'Ошибка при обработке Excel файла' });
    }
});

// Если директории для изображений не существует, создаём её
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

const getNewKeywords = (keywordsArray) => {
    if (!Array.isArray(keywordsArray) || keywordsArray.length === 0) return [];
    const middleIndex = Math.floor(keywordsArray.length / 2);
    const firstHalf = keywordsArray.slice(0, middleIndex);
    const secondHalf = keywordsArray.slice(middleIndex);
    const shuffledSecondHalf = shuffleArray(secondHalf);
    // Удаляем последний элемент для разнообразия
    shuffledSecondHalf.pop();
    return firstHalf.concat(shuffledSecondHalf);
};

// Простая функция перемешивания массива
function shuffleArray(array) {
    const newArr = array.slice();
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

async function sleep(time) {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}

// POST-эндпоинт: принимает массив ссылок и индекс для скачивания изображений, обновляет статус на "Finish"
app.post('/download-images', async (req, res) => {
    try {
        const { index: indexPrompt, links } = req.body;

        if (typeof indexPrompt !== 'number' || !Array.isArray(links)) {
            return res.status(400).json({ error: 'Некорректные данные: ожидается число index и массив links' });
        }

        const row = jsonData[indexPrompt];
        if (!row) {
            return res.status(400).json({ error: 'Указан некорректный индекс' });
        }

        // Получаем новое описание через функцию из ai21.js (если требуется)
        let descriptions = [/*row.Description , ...await getNewDescriptionII(row.Description, 3)*/];

        for (const [indexLinks, link] of links.entries()) {
            try {
                const response = await fetch(link);
                if (!response.ok) {
                    throw new Error(`Ошибка загрузки иллюстрации: ${response.statusText}`);
                }

                // Используем саму ссылку для извлечения имени файла
                const myUrl = new URL(link);
                const decodedPath = decodeURIComponent(myUrl.pathname);
                const fileName = path.basename(decodedPath);
                const imageFileName = `${indexPrompt}_${indexLinks}_${fileName}`;
                const imagePath = path.join(imagesDir, imageFileName);

                const buffer = await response.buffer();
                fs.writeFileSync(imagePath, buffer);
                await sleep(500);

                try {
                    const keywords = row.Keywords ? row.Keywords.split(', ') : [];
                    const newKeywords = indexLinks === 0 ? keywords : getNewKeywords(keywords);
                    // Берём соответствующее описание или исходное, если описаний меньше, чем ссылок
                    const Description = descriptions[indexLinks] || row.Description || '';
                    await exiftool.write(
                        imagePath,
                        {
                            Description,
                            Title: Description,
                            ObjectName: Description,
                            'Caption-Abstract': Description,
                            Subject: newKeywords,
                            Keywords: newKeywords,
                            XPSubject: Description + '.'
                        },
                        ['-overwrite_original']
                    );
                    console.log('Записан файл и проставлены тэги:', imageFileName);
                } catch (e) {
                    console.error('Ошибка записи метаданных в файл:', e);
                }
            } catch (e) {
                console.error(`Ошибка при обработке ссылки ${link}:`, e);
            }
        }
        // Обновляем статус в Excel на "Finish"
        row.Status = "Finish";
        writeExcel();
        res.json({ message: 'Обновление завершено, статус изменён на "Finish"' });
    } catch (error) {
        console.error('Error in POST /download-images', error);
        res.status(500).json({ error: 'Ошибка при обновлении Excel файла' });
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
