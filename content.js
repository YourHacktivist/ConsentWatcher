(function () {
    'use strict';

    let analysisPopup = null;
    let isDragging = false;
    let offsetX, offsetY;
    const primaryColor = '#4361ee';
    const primaryLightColor = '#4cc9f0';
    const textColor = '#212121';
    const cardBackgroundColor = '#fff';
    const boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    const borderRadius = '8px';
    const fontFamily = 'Roboto, sans-serif';

    // Variables pour stocker la configuration
    let currentConfig = {
        selectedAI: 'openai',
        selectedModel: 'gpt-4',
        apiKey: ''
    };

    // Charger la configuration depuis le storage
    function loadConfig() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['selectedAI', 'selectedModel', 'apiKeys'], (result) => {
                console.log('Configuration chargée:', result); // Debug
                if (result.selectedAI && result.selectedModel && result.apiKeys) {
                    currentConfig = {
                        selectedAI: result.selectedAI,
                        selectedModel: result.selectedModel,
                        apiKey: result.apiKeys[result.selectedAI] || ''
                    };
                }
                console.log('Config actuelle:', currentConfig); // Debug
                resolve(currentConfig);
            });
        });
    }

    // Create a button to trigger the analysis
    function createActionButton() {
        const button = document.createElement('button');
        button.textContent = 'Analyze Privacy Policy';
        button.style.position = 'fixed';
        button.style.bottom = '20px';
        button.style.left = '20px';
        button.style.backgroundColor = primaryColor;
        button.style.color = 'white';
        button.style.padding = '12px 20px';
        button.style.border = 'none';
        button.style.borderRadius = borderRadius;
        button.style.cursor = 'pointer';
        button.style.fontSize = '16px';
        button.style.fontFamily = fontFamily;
        button.style.boxShadow = boxShadow;
        button.style.zIndex = '10000';

        button.addEventListener('mouseover', () => button.style.backgroundColor = primaryLightColor);
        button.addEventListener('mouseout', () => button.style.backgroundColor = primaryColor);
        button.addEventListener('click', async (e) => {
            // Effet ripple
            const circle = document.createElement("span");
            circle.style.position = "absolute";
            circle.style.borderRadius = "50%";
            circle.style.transform = "scale(0)";
            circle.style.animation = "ripple 600ms linear";
            circle.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
            circle.style.pointerEvents = "none";
            const rect = button.getBoundingClientRect();
            circle.style.left = `${e.clientX - rect.left}px`;
            circle.style.top = `${e.clientY - rect.top}px`;
            circle.style.width = circle.style.height = "100px";
            button.appendChild(circle);
            setTimeout(() => circle.remove(), 600);

            // Charger la config et lancer l'analyse
            await loadConfig();
            runAnalysis();
        });

        document.body.appendChild(button);
    }

    // Créer le payload selon l'IA sélectionnée
    function createApiPayload(prompt, aiService, model) {
        switch (aiService) {
            case 'openai':
                return {
                    model: model,
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    temperature: 0.3,
                    max_tokens: 4000
                };

            case 'claude':
                return {
                    model: model,
                    max_tokens: 4000,
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    temperature: 0.3
                };

            case 'gemini':
                return {
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 4000
                    }
                };

            case 'grok':
                return {
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    model: model,
                    stream: false,
                    temperature: 0.3,
                    max_tokens: 4000
                };

            default:
                return {
                    model: model,
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    temperature: 0.3,
                    max_tokens: 4000
                };
        }
    }

    // Extraire la réponse selon l'IA
    function extractResponse(response, aiService) {
        try {
            console.log('Réponse brute de l\'API:', response); // Debug

            switch (aiService) {
                case 'openai':
                case 'grok':
                    return response.choices?.[0]?.message?.content || 'Erreur lors de l\'analyse.';

                case 'claude':
                    return response.content?.[0]?.text || 'Erreur lors de l\'analyse.';

                case 'gemini':
                    return response.candidates?.[0]?.content?.parts?.[0]?.text || 'Erreur lors de l\'analyse.';

                default:
                    return response.choices?.[0]?.message?.content || 'Erreur lors de l\'analyse.';
            }
        } catch (error) {
            console.error('Erreur lors de l\'extraction de la réponse:', error);
            return 'Erreur lors de l\'analyse de la réponse.';
        }
    }

    // Function to analyze the privacy policy using selected AI API
    async function analyzePolicy(text) {
        console.log('Début de l\'analyse avec la config:', currentConfig); // Debug

        if (!currentConfig.apiKey) {
            console.error('Clé API manquante'); // Debug
            return 'Erreur: Clé API non configurée. Veuillez configurer votre clé API dans les paramètres de l\'extension.';
        }

        const prompt = `
You are a privacy assistant. Analyze the following privacy policy and provide concise answers to these questions, making sure each point starts on a new line:

1. What types of personal data are collected? (e.g., name, email, browsing history)

2. Is personal data shared with third parties? If yes, with whom and for what purpose?

3. Are cookies or other tracking technologies used? If yes, for what purposes?

4. What rights do users have regarding their data? (e.g., access, deletion, rectification)

5. IMPORTANT - Provide a numerical score from 0 to 10 (where 10 is fully compliant and trustworthy). Format: Score: X/10 with explanation.

6. Provide one key practical privacy advice for the user of this website.

IMPORTANT: For the score (point 5), respond EXACTLY in this format: "Score: X/10" where X is a number from 0 to 10.
Format your response with simple text, no markdown formatting. Make sure each numbered point starts on a new line.
`;

        const policyContent = `
Policy content:
"""${text.slice(0, 8000)}"""
`;

        const fullPrompt = prompt + policyContent;
        const payload = createApiPayload(fullPrompt, currentConfig.selectedAI, currentConfig.selectedModel);

        console.log('Payload envoyé:', payload); // Debug

        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'apiCall',
                aiService: currentConfig.selectedAI,
                body: JSON.stringify(payload),
                apiKey: currentConfig.apiKey
            }, (response) => {
                console.log('Réponse reçue du background:', response); // Debug

                if (chrome.runtime.lastError) {
                    console.error('Erreur runtime:', chrome.runtime.lastError);
                    resolve('Erreur de communication avec l\'extension.');
                    return;
                }

                if (!response) {
                    console.error('Pas de réponse du background script');
                    resolve('Erreur: Pas de réponse du serveur.');
                    return;
                }

                if (response.error) {
                    console.error('Erreur API:', response.error);
                    resolve(`Erreur API: ${response.error}`);
                    return;
                }

                const result = extractResponse(response, currentConfig.selectedAI);
                console.log('Résultat extrait:', result); // Debug
                resolve(result);
            });
        });
    }

    // Function to extract privacy policy text from the page
    function extractPrivacyPolicyText() {
        const selectors = [
            '[data-testid*="privacy"]',
            '[class*="privacy"]',
            '[id*="privacy"]',
            'main',
            'article',
            '.content',
            '#content',
            'body'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                let text = element.innerText || element.textContent || '';
                text = text.replace(/\s+/g, ' ').trim();
                if (text.length > 500) {
                    console.log(`Texte extrait avec le sélecteur ${selector}:`, text.slice(0, 200) + '...'); // Debug
                    return text;
                }
            }
        }

        const bodyText = document.body.innerText || document.body.textContent || '';
        console.log('Texte du body:', bodyText.slice(0, 200) + '...'); // Debug
        return bodyText;
    }

    // Function to extract visible text from the page
    function extractVisibleText() {
        const elements = Array.from(document.body.querySelectorAll('p, div, span, li, h1, h2, h3, h4, h5, h6'));
        const visibleText = elements
            .filter(el => {
                // Vérifier si l'élément est visible
                const style = window.getComputedStyle(el);
                return el.offsetParent !== null &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0';
            })
            .map(el => el.innerText ? el.innerText.trim() : '')
            .filter(text => text.length > 20) // Filtrer les textes trop courts
            .join(' ');

        console.log('Texte visible extrait:', visibleText.slice(0, 300) + '...'); // Debug
        return visibleText;
    }

    // Function to show a loading popup while analyzing
    function showLoadingPopup() {
        if (analysisPopup) {
            analysisPopup.remove();
        }

        analysisPopup = document.createElement('div');
        analysisPopup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1B1212;
            border: 1px solid ${primaryLightColor};
            padding: 40px 30px;
            z-index: 99999;
            border-radius: 16px;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.1);
            font-family: 'Inter', sans-serif;
            color: ${primaryColor};
            text-align: center;
            min-width: 320px;
            transition: opacity 0.4s ease;
        `;

        const title = document.createElement('div');
        title.style.fontSize = '20px';
        title.style.fontWeight = '600';
        title.textContent = 'Consent Watcher is scanning...';
        analysisPopup.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.style.marginTop = '8px';
        subtitle.style.fontSize = '14px';
        subtitle.style.color = '#8d99ae';
        subtitle.textContent = `Analyzing with ${currentConfig.selectedAI.toUpperCase()} - ${currentConfig.selectedModel}`;
        analysisPopup.appendChild(subtitle);

        // Animation de chargement
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            margin: 30px auto 0;
            width: 40px;
            height: 40px;
            border: 4px solid ${primaryLightColor};
            border-radius: 50%;
            border-top-color: ${primaryColor};
            animation: spin 1s ease-in-out infinite;
        `;
        analysisPopup.appendChild(spinner);

        document.body.appendChild(analysisPopup);

        // Ajouter l'animation CSS
        if (!document.getElementById('loading-styles')) {
            const style = document.createElement('style');
            style.id = 'loading-styles';
            style.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Fonction pour parser la réponse GPT
    function parseGPTResponse(text) {
        const sections = {
            dataCollection: '',
            dataSharing: '',
            tracking: '',
            userRights: '',
            gdprScore: '',
            privacyAdvice: '',
        };

        // Nettoyer le texte des astérisques et formatage markdown
        const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '');

        // Essayer différents patterns de regex sans les formatages gras
        const patterns = [
            {
                dataCollection: /1\.\s*(?:Data Collection\s*:)?\s*(.*?)(?=2\.|$)/s,
                dataSharing: /2\.\s*(?:Data Sharing\s*:)?\s*(.*?)(?=3\.|$)/s,
                tracking: /3\.\s*(?:Tracking\s*:)?\s*(.*?)(?=4\.|$)/s,
                userRights: /4\.\s*(?:User Rights\s*:)?\s*(.*?)(?=5\.|$)/s,
                gdprScore: /5\.\s*(?:GDPR Score\s*:)?\s*(.*?)(?=6\.|$)/s,
                privacyAdvice: /6\.\s*(?:Privacy Advice\s*:)?\s*(.*?)$/s,
            },
            {
                dataCollection: /1\.(.*?)(?=2\.|$)/s,
                dataSharing: /2\.(.*?)(?=3\.|$)/s,
                tracking: /3\.(.*?)(?=4\.|$)/s,
                userRights: /4\.(.*?)(?=5\.|$)/s,
                gdprScore: /5\.(.*?)(?=6\.|$)/s,
                privacyAdvice: /6\.(.*?)$/s,
            }
        ];

        for (const pattern of patterns) {
            for (const [key, regex] of Object.entries(pattern)) {
                if (!sections[key]) {
                    const match = cleanText.match(regex);
                    if (match && match[1]) {
                        sections[key] = match[1].trim().replace(/^-\s*/, '');
                    }
                }
            }
        }

        if (!sections.gdprScore || sections.gdprScore.length < 3) {
            // Chercher des patterns de score plus spécifiques
            const scorePatterns = [
                /Score\s*:?\s*(\d+)(?:\/10)?/i,
                /(\d+)\/10/,
                /Score.*?(\d+)/i,
                /Note.*?(\d+)/i,
                /Rating.*?(\d+)/i,
                /Évaluation.*?(\d+)/i,
                /Confiance.*?(\d+)/i,
                /Trust.*?(\d+)/i
            ];

            for (const scorePattern of scorePatterns) {
                const scoreMatch = cleanText.match(scorePattern);
                if (scoreMatch && scoreMatch[1]) {
                    const score = parseInt(scoreMatch[1]);
                    if (score >= 0 && score <= 10) {
                        sections.gdprScore = `Score: ${score}/10`;
                        break;
                    }
                }
            }
        }

        console.log('Sections parsées:', sections); // Debug
        return sections;
    }


    // Function to show the analysis result in a popup
    async function showAnalysisPopup(gptResponseText) {
        console.log('Affichage du popup avec:', gptResponseText); // Debug

        if (analysisPopup) analysisPopup.remove();

        if (!gptResponseText || gptResponseText.includes('Erreur')) {
            // Afficher l'erreur
            const errorPopup = document.createElement('div');
            errorPopup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff4444;
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 99999;
            max-width: 400px;
            text-align: center;
        `;
            errorPopup.innerHTML = `
            <h3>Erreur d'analyse</h3>
            <p>${gptResponseText}</p>
            <button onclick="this.parentElement.remove()" style="
                background: white;
                color: #ff4444;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                margin-top: 15px;
                cursor: pointer;
            ">Fermer</button>
        `;
            document.body.appendChild(errorPopup);
            return;
        }

        const parsed = parseGPTResponse(gptResponseText);

        const sections = [
            { icon: '📥', label: 'Collected data', key: 'dataCollection' },
            { icon: '🔄', label: 'Data sharing', key: 'dataSharing' },
            { icon: '🍪', label: 'Tracking', key: 'tracking' },
            { icon: '🧑‍⚖️', label: 'User rights', key: 'userRights' },
            { icon: '📊', label: 'GDPR score', key: 'gdprScore' },
            { icon: '💡', label: 'Privacy advice', key: 'privacyAdvice' },
            { icon: '📚', label: 'Resources', key: 'resources' }
        ];

        const container = document.createElement('div');
        container.style.cssText = `
        position: fixed;
        top: 60px;
        left: 60px;
        width: 760px;
        height: 520px;
        display: flex;
        background: #181818;
        border-radius: 18px;
        box-shadow: 0 18px 36px rgba(0,0,0,0.35);
        backdrop-filter: blur(14px);
        z-index: 99999;
        overflow: hidden;
        font-family: system-ui, sans-serif;
    `;

        // Rendre le popup déplaçable
        let isDragging = false, offsetX, offsetY;
        container.addEventListener('mousedown', (e) => {
            if (e.target === container || e.target.closest('.sidebar')) {
                isDragging = true;
                offsetX = e.clientX - container.getBoundingClientRect().left;
                offsetY = e.clientY - container.getBoundingClientRect().top;
                container.style.cursor = 'grabbing';
            }
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            container.style.left = `${e.clientX - offsetX}px`;
            container.style.top = `${e.clientY - offsetY}px`;
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
            container.style.cursor = 'default';
        });

        const sidebar = document.createElement('div');
        sidebar.className = 'sidebar';
        sidebar.style.cssText = `
        width: 190px;
        background: #121212;
        border-right: 1px solid #303030;
        display: flex;
        color: #fff;
        flex-direction: column;
        padding: 10px;
    `;

        const contentArea = document.createElement('div');
        contentArea.style.cssText = `
        flex: 1;
        padding: 25px;
        overflow-y: auto;
        font-size: 15px;
        color: #e2e8f0;
        line-height: 1.7;
        position: relative;
    `;

        const exportBtn = document.createElement('button');
        exportBtn.textContent = '📄 Export HTML';
        exportBtn.style.cssText = `
        position: absolute;
        bottom: 20px;
        right: 25px;
        background: #4361ee;
        color: white;
        padding: 10px 16px;
        font-size: 14px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        transition: background 0.2s ease;
    `;
        exportBtn.addEventListener('mouseover', () => exportBtn.style.background = '#4cc9f0');
        exportBtn.addEventListener('mouseout', () => exportBtn.style.background = '#4361ee');
        exportBtn.addEventListener('click', () => generateHTMLReport(gptResponseText));

        // Fonction pour extraire et formater le score GDPR
        function extractGDPRScore(gdprText) {
            const scoreMatch = gdprText.match(/Score\s*:?\s*(\d+)(?:\/10)?/i) ||
                gdprText.match(/(\d+)\/10/) ||
                gdprText.match(/Score.*?(\d+)/i);

            if (scoreMatch && scoreMatch[1]) {
                const score = parseInt(scoreMatch[1]);
                if (score >= 0 && score <= 10) {
                    return score;
                }
            }
            return null;
        }

        // Fonction pour obtenir la couleur selon le score
        function getScoreColor(score) {
            if (score === null) return '#6b7280';
            if (score >= 8) return '#10b981'; // Vert
            if (score >= 6) return '#f59e0b'; // Orange
            if (score >= 4) return '#f97316'; // Orange foncé
            return '#ef4444'; // Rouge
        }

        // Fonction pour obtenir le texte d'évaluation
        function getScoreText(score) {
            if (score === null) return 'Non évalué';
            if (score >= 8) return 'Excellent';
            if (score >= 6) return 'Correct';
            if (score >= 4) return 'Préoccupant';
            return 'Dangereux';
        }

        function renderSection(key, label) {
            contentArea.innerHTML = `
            <h2 style="
                margin-top: 0;
                font-size: 20px;
                color: #fff;
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 10px;
                margin-bottom: 20px;
            ">${label}</h2>
        `;

            const content = parsed[key] || gptResponseText || 'Aucune information disponible';

            if (key === 'gdprScore') {
                // Rendu spécial pour le score GDPR
                const score = extractGDPRScore(content);
                const scoreColor = getScoreColor(score);
                const scoreText = getScoreText(score);

                const scoreContainer = document.createElement('div');
                scoreContainer.style.cssText = `
                background: #242424;
                border: 2px solid ${scoreColor};
                border-radius: 16px;
                padding: 30px;
                text-align: center;
                margin-bottom: 25px;
                box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            `;

                const scoreDisplay = document.createElement('div');
                scoreDisplay.style.cssText = `
                font-size: 72px;
                font-weight: bold;
                color: ${scoreColor};
                margin-bottom: 15px;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
                scoreDisplay.textContent = score !== null ? `${score}/10` : 'N/A';

                const scoreLabel = document.createElement('div');
                scoreLabel.style.cssText = `
                font-size: 24px;
                font-weight: 600;
                color: ${scoreColor};
                margin-bottom: 20px;
                text-transform: uppercase;
                letter-spacing: 1px;
            `;
                scoreLabel.textContent = scoreText;

                const scoreExplanation = document.createElement('div');
                scoreExplanation.style.cssText = `
                background: #1a1a1a;
                border-radius: 12px;
                padding: 20px;
                margin-top: 20px;
                border-left: 4px solid ${scoreColor};
            `;

                const explanationText = content.replace(/Score\s*:?\s*\d+(?:\/10)?/i, '').trim();
                scoreExplanation.innerHTML = `
                <h4 style="color: #fff; margin: 0 0 12px 0; font-size: 16px;">Explication du score :</h4>
                <p style="color: #d1d5db; margin: 0; line-height: 1.6; font-size: 15px;">${explanationText || 'Aucune explication disponible.'}</p>
            `;

                scoreContainer.appendChild(scoreDisplay);
                scoreContainer.appendChild(scoreLabel);
                scoreContainer.appendChild(scoreExplanation);
                contentArea.appendChild(scoreContainer);

            } else if (key === 'resources') {
                // Section ressources spéciale
                const title = document.createElement('h2');
                title.textContent = '🔗 Additional resources';
                title.style.cssText = `
                margin-bottom: 16px;
                font-size: 17px;
                color: #e2e8f0;
                border-bottom: 1px solid #3e4c5e;
                padding-bottom: 8px;
            `;

                const grid = document.createElement('div');
                grid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 16px;
            `;

                const links = [
                    { name: 'ShutUpTracker', url: 'https://shutuptrackers.com', desc: 'A crowdsourced directory of mobile apps that track users.' },
                    { name: 'Tails', url: 'https://tails.net/', desc: 'A live operating system focused on privacy and anonymity.' },
                    { name: 'PrivacyTools', url: 'https://www.privacytools.io/', desc: 'A curated list of privacy-focused tools and services.' },
                    { name: 'Privacy Badger', url: 'https://privacybadger.org/', desc: 'A browser extension that blocks invisible trackers.' }
                ];

                links.forEach(link => {
                    const card = document.createElement('div');
                    card.style.cssText = `
                    background: #242424;
                    border: 1px solid #303030;
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    transition: transform 0.2s, box-shadow 0.2s;
                    cursor: pointer;
                `;
                    card.innerHTML = `
                    <h4 style="margin: 0 0 8px; font-size: 15px; color: #4cc9f0;">
                        <a href="${link.url}" target="_blank" style="text-decoration: none; color: inherit;">
                            ${link.name} ↗
                        </a>
                    </h4>
                    <p style="margin: 0; font-size: 13px; color: #d1d5db;">${link.desc}</p>
                `;
                    grid.appendChild(card);
                });

                contentArea.appendChild(title);
                contentArea.appendChild(grid);
                contentArea.appendChild(exportBtn);

            } else {
                // Rendu normal pour les autres sections
                const textBlock = document.createElement('div');
                textBlock.textContent = content;
                textBlock.style.cssText = `
                white-space: pre-wrap;
                background: #242424;
                border: 1px solid #303030;
                border-radius: 10px;
                padding: 18px;
                font-size: 15px;
                line-height: 1.75;
                color: #d1d5db;
                box-shadow: 0 2px 6px rgba(0,0,0,0.03);
                margin-bottom: 25px;
            `;
                contentArea.appendChild(textBlock);
            }

        }

        sections.forEach(({ icon, label, key }) => {
            const btn = document.createElement('button');
            btn.innerHTML = `${icon} ${label}`;

            // Couleur spéciale pour le bouton GDPR Score
            let buttonColor = '#e2e8f0';
            if (key === 'gdprScore') {
                const score = extractGDPRScore(parsed[key] || '');
                buttonColor = getScoreColor(score);
            }

            btn.style.cssText = `
            background: none;
            border: none;
            padding: 10px 12px;
            border-radius: 12px;
            margin: 4px 0;
            text-align: left;
            font-size: 14px;
            cursor: pointer;
            color: ${buttonColor};
            transition: background 0.2s;
        `;
            btn.addEventListener('click', () => renderSection(key, label));
            btn.addEventListener('mouseover', () => btn.style.background = '#303030');
            btn.addEventListener('mouseout', () => btn.style.background = 'none');
            sidebar.appendChild(btn);
        });




        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 18px;
        font-size: 24px;
        color: #777;
        cursor: pointer;
        z-index: 1000; `;
        closeBtn.addEventListener('click', () => container.remove());

        container.appendChild(sidebar);
        container.appendChild(contentArea);
        container.appendChild(closeBtn);
        document.body.appendChild(container);

        analysisPopup = container;

        // Afficher la première section par défaut
        renderSection(sections[0].key, sections[0].label);



        // Function to generate HTML report from the analysis result
        function generateHTMLReport(analysisResult) {
            const formattedResult = formatResponse(analysisResult);

            const score = extractGDPRScore(parsed['gdprScore'] || '');
            let scoreColor = getScoreColor(score);
            const scoreText = getScoreText(score);

            const htmlReport = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Consent Watcher - Privacy Policy Analysis Report</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                :root {
                    --primary-color: #4361ee;
                    --primary-light: #4cc9f0;
                    --primary-dark: #3a0ca3;
                    --text-color: #2b2d42;
                    --light-text: #8d99ae;
                    --background: #f8f9fa;
                    --card-bg: #ffffff;
                    --border-radius: 12px;
                    --box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
                    --transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                }

                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Inter', sans-serif;
                    line-height: 1.7;
                    color: var(--text-color);
                    background-color: var(--background);
                    padding: 40px;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .container {
                    max-width: 900px;
                    width: 100%;
                }

                header {
                    text-align: center;
                    margin-bottom: 40px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid var(--primary-light);
                    width: 100%;
                }

                h1 {
                    color: var(--primary-color);
                    font-size: 2.5rem;
                    font-weight: 700;
                    margin-bottom: 10px;
                    background: linear-gradient(90deg, var(--primary-color), var(--primary-light));
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                }

                .subtitle {
                    color: var(--light-text);
                    font-size: 1.1rem;
                    font-weight: 400;
                }

                .report-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 25px;
                    width: 100%;
                }

                .report-card {
                    background-color: var(--card-bg);
                    padding: 30px;
                    border-radius: var(--border-radius);
                    box-shadow: var(--box-shadow);
                    transition: var(--transition);
                    border: 1px solid rgba(0, 0, 0, 0.05);
                }

                .report-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.12);
                }

                .report-card h3 {
                    color: var(--primary-color);
                    margin-bottom: 15px;
                    font-size: 1.4rem;
                    font-weight: 600;
                    padding-bottom: 10px;
                    border-bottom: 2px solid var(--primary-light);
                    display: flex;
                    align-items: center;
                }

                .report-card h3::before {
                    content: "";
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: var(--primary-light);
                    margin-right: 10px;
                }

                .report-card p {
                    color: var(--text-color);
                    font-size: 1rem;
                    line-height: 1.8;
                    margin-bottom: 15px;
                }

                .gdpr-score-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 20px;
                    position: relative;
                }

                .gdpr-score {
                    font-size: 3rem;
                    font-weight: 700;
                    margin: 15px 0;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .score-label {
                    color: var(--light-text);
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 10px;
                }

                .score-text {
                    font-size: 1.2rem;
                    font-weight: 600;
                    padding: 8px 16px;
                    border-radius: 20px;
                    color: white;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                    margin-top: 10px;
                }

                .score-circle {
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 10px auto;
                    border: 4px solid;
                    position: relative;
                    overflow: hidden;
                }

                .score-circle::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: inherit;
                    opacity: 0.1;
                    border-radius: 50%;
                }

                .advice {
                    font-style: italic;
                    color: var(--light-text);
                    background-color: rgba(141, 153, 174, 0.1);
                    padding: 20px;
                    border-radius: var(--border-radius);
                    border-left: 4px solid var(--primary-light);
                }

                .full-width-card {
                    grid-column: 1 / -1;
                }

                @media (max-width: 768px) {
                    body {
                        padding: 20px;
                    }

                    .report-grid {
                        grid-template-columns: 1fr;
                    }

                    h1 {
                        font-size: 2rem;
                    }

                    .full-width-card {
                        grid-column: auto;
                    }

                    .gdpr-score {
                        font-size: 2.5rem;
                    }

                    .score-circle {
                        width: 100px;
                        height: 100px;
                    }
                }

                .floating-icon {
                    position: fixed;
                    bottom: 30px;
                    right: 30px;
                    width: 60px;
                    height: 60px;
                    background-color: var(--primary-color);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                    cursor: pointer;
                    transition: var(--transition);
                    z-index: 100;
                }

                .floating-icon:hover {
                    transform: scale(1.1);
                    background-color: var(--primary-dark);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1>Consent Watcher - Privacy Policy Analysis</h1>
                    <p class="subtitle">Comprehensive report on data handling practices</p>
                </header>

                <div class="report-grid">
                    <div class="report-card">
                        <h3>Data Collection</h3>
                        <p>${formattedResult.split('<br>1. ')[1]?.split('<br>2. ')[0] || 'N/A'}</p>
                    </div>

                    <div class="report-card">
                        <h3>Data Sharing</h3>
                        <p>${formattedResult.split('<br>2. ')[1]?.split('<br>3. ')[0] || 'N/A'}</p>
                    </div>

                    <div class="report-card">
                        <h3>Tracking</h3>
                        <p>${formattedResult.split('<br>3. ')[1]?.split('<br>4. ')[0] || 'N/A'}</p>
                    </div>

                    <div class="report-card">
                        <h3>User Rights</h3>
                        <p>${formattedResult.split('<br>4. ')[1]?.split('<br>5. ')[0] || 'N/A'}</p>
                    </div>

                    <div class="report-card full-width-card">
                        <div class="gdpr-score-container">
                            <h3>GDPR Compliance</h3>
                            <span class="score-label">Trust Score</span>
                            
                            <div class="score-circle" style="border-color: ${scoreColor}; color: ${scoreColor};">
                                <div class="gdpr-score">${score !== null ? score.toFixed(1) : 'N/A'}</div>
                            </div>
                            
                            <div class="score-text" style="background-color: ${scoreColor};">
                                ${scoreText}
                            </div>
                        </div>
                    </div>

                    <div class="report-card full-width-card">
                        <h3 id="advices">Privacy Advice</h3>
                        <p class="advice">${formattedResult.split('<br>6. ')[1] || 'N/A'}</p>
                    </div>
                </div>
            </div>

            <div class="floating-icon" title="Scroll to Advice" onclick="document.getElementById('advices').scrollIntoView({ behavior: 'smooth' });">
                ↓
            </div>
        </body>
        </html>
        `;

            const blob = new Blob([htmlReport], {
                type: 'text/html'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'privacy_analysis_report.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }






    }


    // Function to format the response for better readability
    function formatResponse(responseText) {
        let formattedText = responseText.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        formattedText = formattedText.replace(/(\d+\.)/g, '<br>$1');
        formattedText = formattedText.replace(/-/g, '<br>-');
        return formattedText;
    }


    // Main analysis function
    async function runAnalysis() {
        try {
            console.log('Début de l\'analyse...'); // Debug

            // Vérifier la configuration
            if (!currentConfig.apiKey) {
                console.error('Configuration manquante:', currentConfig);
                showAnalysisPopup('Erreur: Clé API non configurée. Veuillez configurer votre clé API dans les paramètres de l\'extension.');
                return;
            }

            showLoadingPopup();

            // Extraire le texte de la page
            const policyText = extractVisibleText();
            console.log('Longueur du texte extrait:', policyText.length); // Debug

            if (!policyText || policyText.length < 100) {
                console.log('Pas assez de texte trouvé');
                showAnalysisPopup('❌ Aucune politique de confidentialité détectée sur cette page ou contenu insuffisant.');
                return;
            }

            console.log('Appel de l\'API...'); // Debug
            const analysis = await analyzePolicy(policyText);
            console.log('Analyse terminée:', analysis); // Debug

            showAnalysisPopup(analysis);

        } catch (error) {
            console.error('Erreur lors de l\'analyse:', error);
            showAnalysisPopup('❌ Erreur lors de l\'analyse. Veuillez réessayer.');
        }
    }

    // Initialize when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createActionButton);
    } else {
        createActionButton();
    }

    // Add CSS styles for animations
    const styleEnhancer = document.createElement("style");
    styleEnhancer.innerHTML = `
        @keyframes fadeInScale {
            0% { opacity: 0; transform: scale(0.9); }
            100% { opacity: 1; transform: scale(1); }
        }

        @keyframes ripple {
            to { transform: scale(4); opacity: 0; }
        }

        button:hover {
            transition: all 0.3s ease;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(67, 97, 238, 0.3);
        }

        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-thumb {
            background-color: ${primaryLightColor};
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background-color: ${primaryColor};
        }
    `;
    document.head.appendChild(styleEnhancer);

})();
