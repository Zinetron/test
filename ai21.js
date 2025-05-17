import Together from "together-ai";

const together = new Together({apiKey: '2d6a01410a8f0009233865c2dd3a3b09ac4b4edd00d5a20d790f0b8c9939302d'});


function processString(inputStr) {
	// Удаляем все не-буквы в начале и конце строки
	let processed = inputStr.replace(/^[^a-zA-Z]+/, '').replace(/[^a-zA-Z]+$/, '');

	// Проверяем наличие хотя бы одной буквы
	if (!processed.match(/[a-zA-Z]/)) {
		throw new Error("Строка не содержит буквенных символов");
	}

	return processed;
}

const fetchData = (description, number) =>
	together.chat.completions.create({
	messages: [{
		"role": "user",
		"content": `Rephrase the following sentence exactly five times. Each rephrased version must be on a separate line and must fully replace the original sentence, without any additional information, introductions, commentary, or extra text. The answer should contain only these five lines, nothing more.\nSentence: ‘${description}’`
	}],
	model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
	max_tokens: null,
	temperature: 0.7,
	top_p: 0.7,
	top_k: 50,
	repetition_penalty: 1,
	stop: ["<|eot_id|>","<|eom_id|>"],
	})
		.then((chatCompletion) => {
			let result = chatCompletion.choices[0].message.content.split('\n').map(processString);
			if(result.length === 1) {
				result = result[0].split('.').map((text) => text.trim()).filter(item=> !!item);
				if(result.length === 10 ) {
					result = result.reduce((res, item, index, array) => {
						if(index%2 === 0) {
							res.push(`${item}. ${array[index+1]}`)
						}
						return res
					}, [])
				}
			}
			console.log('@@@@@@@@@@@@@@@@@@@@@');
			console.log(result);

			return result;
		})


export function getNewDescriptionII(description, number) {
    return new Promise(async (resolve) => {
		setTimeout(() => resolve(null), 60 * 2 * 1000)
		try {
			const result = await fetchData(description, number);
			if(!result?.length) {
				setTimeout(async () => {
					resolve(await getNewDescriptionII(description, number))
				}, 5000);
			} else {
				resolve(result);
			}
		} catch (e) {
			resolve(null);
			console.log('Ошибка ai21', e);
		}
})}
