// ==UserScript==
// @name         Sora - FInish
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Автоотправка промтов и скачивание иллюстраций (type=image_gen) из Sora.
// @author
// @match        https://sora.chatgpt.com/library
// @grant        none
// @run-at document-idle
// ==/UserScript==

(function () {
    "use strict";

    /* ------------------------------------------------------------------
       1) НАСТРОЙКИ
    ------------------------------------------------------------------ */
    // Ваш токен
    const token = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE5MzQ0ZTY1LWJiYzktNDRkMS1hOWQwLWY5NTdiMDc5YmQwZSIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MSJdLCJjbGllbnRfaWQiOiJhcHBfWDh6WTZ2VzJwUTl0UjNkRTduSzFqTDVnSCIsImV4cCI6MTc0ODI3MTM0OCwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9hdXRoIjp7InVzZXJfaWQiOiJ1c2VyLVdUbjJZN1R0Q0NZRGpkcWN4ZW13dXAzNiJ9LCJodHRwczovL2FwaS5vcGVuYWkuY29tL3Byb2ZpbGUiOnsiZW1haWwiOiJzbWFldmFuZHJlaTNAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJpYXQiOjE3NDc0MDczNDcsImlzcyI6Imh0dHBzOi8vYXV0aC5vcGVuYWkuY29tIiwianRpIjoiZTBhNzRmYzItZGZiZC00MGVlLWFmMDAtMzUyZjkxZWRiZTFlIiwibmJmIjoxNzQ3NDA3MzQ3LCJwd2RfYXV0aF90aW1lIjoxNzQ3NDA3MzQ2MjMzLCJzY3AiOlsib3BlbmlkIiwiZW1haWwiLCJwcm9maWxlIiwib2ZmbGluZV9hY2Nlc3MiLCJtb2RlbC5yZXF1ZXN0IiwibW9kZWwucmVhZCIsIm9yZ2FuaXphdGlvbi5yZWFkIiwib3JnYW5pemF0aW9uLndyaXRlIl0sInNlc3Npb25faWQiOiJhdXRoc2Vzc19xeGo1aENmYVhmYzRGMWU4Vzd2dFVtVEkiLCJzdWIiOiJnb29nbGUtb2F1dGgyfDExNDIwNjA5OTM0ODA1NjYzODkzNiJ9.w4GJ3YEdJCIaxe7yyZVrXgt57uxZ1NNXsBPfnxOxSx7dQJ__B60Aar2_js5psoqmBBmeVzmNwBFL0vQmY5XAwT79J9aW7Tf6VgvZpBaR3n_EXpQ_tiPnI0e-RuaFn4cYNtgLX-pAlLhVquy4Q95UI5JSO5BUMe56q_hcJyxH5FDU7bjptsTenbpBZl7hEU_poH2y_JDM7K77aNmpPc2SjHb5oCyRyMELrEYSsu4uLrNcUzSjxMlwpKIKK5BcnK0MWkflRuiDk9vYRwh9YctjvDo0sZbwr8X1kBYv_ZpidkhaN3mxSQNbejpAZWQo3agU8g4ichcQge4IS2j3vKRWIoD7kgjaQY9ytOIyMCfXEFqHsgG1W66wTAwiLtKzvbWL9fL8LZPqAxqq0LNrP0WVQAScVx3VCZLJyB1he4rA0N3NL4lds54zUmzZB9a58uWkekbAJeUNjkGI-FxPyJ4lZ_wJiAhvlzeGKh9ISAsn-U381j1KpsbdGPMpxyOfaArXqKZgWzmE4GQqFlU1PbqCGjJnWvIt1HV6kr-5igdsfu74SXF3ilsd8oTU--NtJFRZKkv06PqVKi7ymH1uy6fmgrraF7wNd7fLlU6GmwdWBT4u6cAf8nDwSN-nS_MRuQiOdY8SlMui39cgVnp7jCgOzdf56LRDXxnRnzUYK861-iQ";

    const server = 'http://localhost:3001';
    const limit = 100;
    const pages = 2;

    // Адрес с промтом (должен отдавать актуальный промт)
    const promptUrl = server + "/get-prompt";
    const getPromptsStatus1Url = server + "/get-prompts-status-1";
    const promptStatus1Url = server + "/set-prompt-status-1";
    const promptStatusErrorUrl = server + "/set-prompt-status-error";
    // Адрес, куда отправляем ссылки на сгенерированные изображения
    const saveImageUrl = server+ '/download-images';

    // Селектор для textarea (на странице Sora). Если одно поле, можно 'textarea'
    const inputSelector = 'textarea';

    // Селектор для кнопки отправки. Посмотрите класс или атрибут у кнопки «Создать»
    const sendButtonSelector = 'button.bg-token-bg-inverse.text-token-text-inverse';

    // Селектор окна лимита (если появляется)
    const rateLimitSelector = "body > div > div > div > div.text-token-text-secondary";

    // Моссив id отправленных промтов
    let arrayActivePromts = new Map();


    // Паузы
    const AFTER_PROMPTS_PAUSE_MS   = 30000;    // если отсутсвует промт (1 мин)


    /* ------------------------------------------------------------------
       2) ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
    ------------------------------------------------------------------ */
    let running = localStorage.getItem('running') === 'true' || false;          // Флаг запуска/остановки

    /* ------------------------------------------------------------------
       3) УТИЛИТЫ
    ------------------------------------------------------------------ */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForElement(selector, timeout = 15000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = document.querySelector(selector);
            if (el) return el;
            await sleep(500);
        }
        throw new Error(`Не дождались элемента: ${selector}`);
    }

    function setInputValue(textarea, value) {
        const reactKey = Object.keys(textarea).find(key => key.startsWith("__reactProps$"));
        if (reactKey) {
            const reactEvents = textarea[reactKey];
            if (reactEvents && reactEvents.onChange) {
                reactEvents.onChange({ target: { value } });
            }
        }
    }

    async function waitForButtonToBeActive(button, maxRetries = 20) {
        for (let i = 0; i < maxRetries; i++) {
            const disabled = button.disabled || button.getAttribute("data-disabled") === "true";
            if (!disabled) return;
            await sleep(300);
        }
    }

    async function waitForRateLimitToClear(maxWaitCycles = 3) {
        for (let i = 0; i < maxWaitCycles; i++) {
            if (!document.querySelector(rateLimitSelector)) return;
            await sleep(15000); // ждём 15с
        }
    }

    async function waitForTextareaEmpty(textarea, maxRetries = 10) {
        for (let i = 0; i < maxRetries; i++) {
            if (!textarea.value) return;
            await sleep(500);
        }
    }


    /* ------------------------------------------------------------------
       4) ЧТЕНИЕ СПИСКА ПРОМТОВ
    ------------------------------------------------------------------ */
    async function fetchPrompt() {
        try {
            const res = await fetch(promptUrl);
            if (!res.ok) {
                throw new Error(`Ошибка при получении промтов: ${res.status}`);
            }
            const prompt = await res.json();
            console.log("[fetchPrompt] Промт загружен:", prompt);
            return prompt;
        } catch (err) {
            console.error("[fetchPrompt] Ошибка загрузки промтов:", err);
            return null;
        }
    }


    /* ------------------------------------------------------------------
       5) ОТПРАВКА ОДНОГО ПРОМТА
    ------------------------------------------------------------------ */
    async function sendPrompt(promptText) {
        const textarea = document.querySelector(inputSelector);
        const sendButton = document.querySelector(sendButtonSelector);

        if (!textarea || !sendButton) {
            console.error("Не найдена textarea или кнопка! Пропускаем...");
            return false;
        }

        // Ждём, пока поле станет пустым
        await waitForTextareaEmpty(textarea);

        // Устанавливаем промт
        setInputValue(textarea, promptText);
        await sleep(300);

        let sent = false;
        while (!sent) {
            await waitForButtonToBeActive(sendButton);
            if (document.querySelector(rateLimitSelector)) {
                await waitForRateLimitToClear();
            }
            sendButton.click();
            await sleep(1000);

            // Проверяем окно лимита
            if (document.querySelector(rateLimitSelector)) {
                console.warn("[sendPrompt] Лимит после клика");
                await waitForRateLimitToClear();
            }

            if(document.querySelector("div[role='dialog']")) {
                running = !running;
                localStorage.setItem('running', running);
                updateControlButtonText();
                sent = true;
                alert('Лимит запросов на генерацию привышен!')
                break;
            }
            // Если textarea очистилась — отправлено
            if (!textarea.value) {
                sent = true;
                break;
            }
            await sleep(1500);
        }
        return sent;
    }

    async function setPromptStatus1(promtData) {
        try {
            const response = await fetch(`${promptStatus1Url}/${promtData.index}`);
            if (!response.ok) {
                console.error(`Ошибка при отправке: ${response.status}`);
            } else {
                console.log(`[setPromptStatus1] Изменент статус: "${promtData.prompt}"`);
            }
        } catch (error) {
            console.error("[deletePromptFromExcel] Ошибка:", error);
        }
    }

    async function setPromptStatusError(promtData) {
        try {
            const response = await fetch(`${promptStatusErrorUrl}/${promtData.index}`);
            if (!response.ok) {
                console.error(`Ошибка при отправке: ${response.status}`);
            } else {
                console.log(`[setPromptStatusError] Изменент статус на error: "${promtData.prompt}"`);
            }
        } catch (error) {
            console.error("[setPromptStatusError] Ошибка:", error);
        }
    }


    async function fetchGen(limit) {
        console.log(`[DOWNLOAD] Начинаем скачивание (image_gen) последних ${limit} заданий...`);
        const response = await fetch(`https://sora.chatgpt.com/backend/video_gen?limit=${limit}${after ? `&after=${after}` : ''}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            if (response.status === 401) {
                alert("Ошибка: токен истек или недействителен. Останавливаемся.");
                running = false;
                localStorage.setItem('running', running);
                updateControlButtonText();
                return;
            } else {
                throw new Error('[fetchAndDownloadImages] Не удалось получить список');
            }
        }

        const data = await response.json();
        console.log(`[DOWNLOAD last_id] ${limit}`, data.last_id);
        return data.task_responses || [] ;
    }


    /* ------------------------------------------------------------------
       7) СКАЧИВАНИЕ ИЗОБРАЖЕНИЙ (type=image_gen)
    ------------------------------------------------------------------ */

    // 7.2 Отправляем на локальный сервер
    async function sendImageToServer(index, links) {
        try {
            const resp = await fetch(saveImageUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index, links }),
            });
            if (!resp.ok) {
                throw new Error(`[sendImageToServer] Ошибка: ${resp.statusText}`);
            }
            console.log(`[sendImageToServer] Изображение "${index}" отправлено на сервер.`);
        } catch (error) {
            console.error('[sendImageToServer] Ошибка:', error);
        }
    }


    async function fetchPromptsStatus1() {
        try {
            const res = await fetch(getPromptsStatus1Url);
            if (!res.ok) {
                throw new Error(`Ошибка при получении промтов: ${res.status}`);
            }
            const prompts = await res.json();
            console.log("[fetchPrompt] Промт загружен:", prompts);
            return prompts;
        } catch (err) {
            console.error("[fetchPrompt] Ошибка загрузки промтов:", err);
            return [];
        }
    }



    async function fetchGen2(limit, after = null) {
        const url = `https://sora.chatgpt.com/backend/video_gen?limit=${limit}${after ? `&after=${after}` : ''}`;
        console.log(`[DOWNLOAD] Запрашиваем ${limit} заданий${after ? ` после ${after}` : ''}...`);
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert("Ошибка: токен истек или недействителен. Останавливаемся.");
                running = false;
                localStorage.setItem('running', running);
                updateControlButtonText();
                return { task_responses: [], last_id: null };
            }
            throw new Error('[fetchGen] Не удалось получить список, status=' + response.status);
        }

        const data = await response.json();
        console.log(`[DOWNLOAD last_id]`, data.last_id);
        return {
            task_responses: data.task_responses || [],
            last_id: data.last_id
        };
    }

    async function fetchLastPages(limit, pagesCount) {
        let after = null;
        const allTasks = [];

        for (let page = 1; page <= pagesCount; page++) {
            const { task_responses, last_id } = await fetchGen2(limit, after);

            if (!task_responses.length) {
                console.log(`Страница ${page}: заданий не найдено, прерываем.`);
                break;
            }

            allTasks.push(...task_responses);
            after = last_id;

            // Если last_id нет или больше нечего запрашивать — выходим досрочно
            if (!after) {
                console.log(`После страницы ${page} больше записей нет.`);
                break;
            }
        }

        console.log(`Всего скачано заданий: ${allTasks.length}`);
        return allTasks;
    }


    /* ------------------------------------------------------------------
       8) ГЛАВНЫЙ ЦИКЛ
    ------------------------------------------------------------------ */
   async function processPromptsAndDownloads() {
    const promts = await fetchPromptsStatus1();
    promts.forEach((item) => {
        arrayActivePromts.set(item.prompt, item.index);
    });

    const producer = (async () => {
        while (running) {
            if(document.querySelector("div[role='dialog']")) {
                running = !running;
                localStorage.setItem('running', running);
                updateControlButtonText();
                alert('Лимит запросов на генерацию привышен!')
            }
            const promptData = await fetchPrompt();
            if (!promptData) {
                console.error("Промт отсутвует");
                await sleep(AFTER_PROMPTS_PAUSE_MS);
                break;
            }
            console.log(promptData);
            const sent = await sendPrompt(promptData.prompt);
            if (sent) {
                arrayActivePromts.set(promptData.prompt, promptData.index);
                await setPromptStatus1(promptData);
            } else {
                console.warn(`[process] Промт не отправился, пропускаем #${promptData.index} - ${promptData.prompt}`);
                await setPromptStatusError(promptData);
            }
        }
    })();

    const consumer = (async () => {
        while (running || arrayActivePromts.size > 0) {
            if (arrayActivePromts.size > 0) {
                const data = await fetchLastPages(limit, pages);
                for (const item of data) {
                    if (item.generations.length && arrayActivePromts.has(item.prompt)) {
                        const indexPromt = arrayActivePromts.get(item.prompt);
                        arrayActivePromts.delete(item.prompt);
                        const gens = item.generations || [];
                        await sendImageToServer(indexPromt, gens.map(({ url }) => url));
                    }
                }
            }
            await sleep(20000);
        }
    })();

    await Promise.all([producer, consumer]);
}


    /* ------------------------------------------------------------------
       9) КНОПКА (Старт/Стоп)
    ------------------------------------------------------------------ */
    function addControlButton() {
        const btn = document.createElement("button");
        btn.id = "promptControlButton";
        btn.textContent = "Старт";

        Object.assign(btn.style, {
            position: "fixed",
            top: "10px",
            right: "10px",
            padding: "10px 20px",
            backgroundColor: "#4CAF50",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            zIndex: 999999,
        });

        btn.addEventListener("click", () => {
            running = !running;
            localStorage.setItem('running', running)
            updateControlButtonText();
            if (running) {
                processPromptsAndDownloads();
            }
        });

        document.body.appendChild(btn);
    }

    function updateControlButtonText() {
        const btn = document.getElementById("promptControlButton");
        if (btn) {
            btn.textContent = running ? "Стоп" : "Старт";
        }
    }


    /* ------------------------------------------------------------------
       10) ИНИЦИАЛИЗАЦИЯ
    ------------------------------------------------------------------ */
    async function initScript() {
        console.log("[init] Запуск скрипта...");

        // Добавляем кнопку
        addControlButton();

        // Ждём textarea/кнопку отправки
        try {
            await waitForElement(inputSelector, 30000);
            await waitForElement(sendButtonSelector, 30000);
        } catch (e) {
            console.warn("[init] Не появились textarea или кнопка:", e.message);
        }

        console.log("[init] Скрипт готов. Нажмите «Старт», чтобы начать.");
        // Каждые 30 секунд эмулируем движение мыши
        setInterval(() => {
            window.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: 0,
                clientY: 0
            }));
        }, 10000); // интервал в миллисекундах
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            get: function() { return false; }
        });

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: function() { return 'visible'; }
        });

        updateControlButtonText();
        if (running) {
           processPromptsAndDownloads();
        }

         //setInterval(function(){
          // window.location.href = window.location.href;
         //}, 60000 * 15); // обновление страницы каждые 60 секунд
    }

    window.addEventListener("load", initScript);
    setInterval(() => {
        const event = new Event('visibilitychange');
        document.dispatchEvent(event);
    }, 30000);
})();
